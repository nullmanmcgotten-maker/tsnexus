//! The one place a trade can be refused. Pure, synchronous, dependency-free
//! logic so it is trivially unit-testable and so the PyO3 bridge can call it
//! without an async runtime on the Python side.

use crate::types::{GateRejection, Market, Quote};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct RiskConfig {
    pub total_exposure_pct: f64, // 0.30
    pub market_caps: HashMap<Market, f64>,
    pub daily_loss_pct: f64,  // 0.02
    pub max_drawdown_pct: f64, // 0.15
    pub hard_caps_usd: HashMap<Market, f64>,
}

impl Default for RiskConfig {
    fn default() -> Self {
        let mut market_caps = HashMap::new();
        market_caps.insert(Market::PerpBinance, 0.15);
        market_caps.insert(Market::Polymarket, 0.10);
        market_caps.insert(Market::SolanaMemecoin, 0.05);

        let mut hard_caps_usd = HashMap::new();
        hard_caps_usd.insert(Market::SolanaMemecoin, 25.0);
        hard_caps_usd.insert(Market::Polymarket, 100.0);
        hard_caps_usd.insert(Market::PerpBinance, 500.0);

        Self {
            total_exposure_pct: 0.30,
            market_caps,
            daily_loss_pct: 0.02,
            max_drawdown_pct: 0.15,
            hard_caps_usd,
        }
    }
}

/// Portfolio facts the gate needs. The Rust kernel does not know how these
/// numbers are computed (that's `journal` + the Python adapters feeding
/// fills back in) — it only ever consumes them.
#[derive(Debug, Clone, Copy)]
pub struct PortfolioSnapshot {
    pub total_capital_usd: f64,
    pub total_exposure_usd: f64,
    pub market_exposure_usd: f64,
    pub daily_loss_pct: f64,
    pub drawdown_pct: f64,
    pub projected_funding_cost_usd: Option<f64>,
    pub funding_budget_usd: Option<f64>,
}

pub struct RiskEngine {
    pub cfg: RiskConfig,
}

impl RiskEngine {
    pub fn new(cfg: RiskConfig) -> Self {
        Self { cfg }
    }

    /// Returns Ok(()) if the quote is approved, or the first rejection
    /// reason hit, checked in a fixed, auditable order.
    pub fn gate(&self, q: &Quote, snap: &PortfolioSnapshot) -> Result<(), GateRejection> {
        let hard_cap = self
            .cfg
            .hard_caps_usd
            .get(&q.adapter)
            .copied()
            .unwrap_or(f64::MAX);
        if q.notional_usd > hard_cap {
            return Err(GateRejection::HardCapExceeded);
        }

        if snap.total_exposure_usd + q.notional_usd
            > snap.total_capital_usd * self.cfg.total_exposure_pct
        {
            return Err(GateRejection::TotalExposureCap);
        }

        let mkt_cap = self
            .cfg
            .market_caps
            .get(&q.adapter)
            .copied()
            .unwrap_or(0.0);
        if snap.market_exposure_usd + q.notional_usd > snap.total_capital_usd * mkt_cap {
            return Err(GateRejection::MarketCapExceeded);
        }

        if snap.daily_loss_pct >= self.cfg.daily_loss_pct {
            return Err(GateRejection::DailyLossBreaker);
        }

        if snap.drawdown_pct >= self.cfg.max_drawdown_pct {
            return Err(GateRejection::DrawdownBreaker);
        }

        if q.adapter == Market::PerpBinance {
            if let (Some(projected), Some(budget)) =
                (snap.projected_funding_cost_usd, snap.funding_budget_usd)
            {
                if projected > budget {
                    return Err(GateRejection::FundingBudget);
                }
            }
        }

        if q.adapter == Market::SolanaMemecoin {
            let safety_passed = q
                .metadata
                .get("safety")
                .and_then(|v| v.get("passed"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if !safety_passed {
                return Err(GateRejection::SafetyFilter);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap as Map;

    fn quote(market: Market, notional: f64, safety_passed: bool) -> Quote {
        let mut metadata = Map::new();
        if market == Market::SolanaMemecoin {
            metadata.insert(
                "safety".to_string(),
                serde_json::json!({ "passed": safety_passed }),
            );
        }
        Quote {
            adapter: market,
            symbol: "TEST".into(),
            side: crate::types::Side::Buy,
            price: 1.0,
            size: notional,
            notional_usd: notional,
            slippage_bps: 0.0,
            metadata,
        }
    }

    fn snap(capital: f64, total_exp: f64, mkt_exp: f64) -> PortfolioSnapshot {
        PortfolioSnapshot {
            total_capital_usd: capital,
            total_exposure_usd: total_exp,
            market_exposure_usd: mkt_exp,
            daily_loss_pct: 0.0,
            drawdown_pct: 0.0,
            projected_funding_cost_usd: None,
            funding_budget_usd: None,
        }
    }

    #[test]
    fn memecoin_hard_cap_enforced_independent_of_portfolio_math() {
        let engine = RiskEngine::new(RiskConfig::default());
        let q = quote(Market::SolanaMemecoin, 25.01, true);
        let s = snap(100_000.0, 0.0, 0.0); // plenty of room
        assert!(matches!(
            engine.gate(&q, &s),
            Err(GateRejection::HardCapExceeded)
        ));
    }

    #[test]
    fn memecoin_without_safety_pass_is_blocked_before_anything_else() {
        let engine = RiskEngine::new(RiskConfig::default());
        let q = quote(Market::SolanaMemecoin, 10.0, false);
        let s = snap(100_000.0, 0.0, 0.0);
        assert!(matches!(
            engine.gate(&q, &s),
            Err(GateRejection::SafetyFilter)
        ));
    }

    #[test]
    fn within_all_caps_is_approved() {
        let engine = RiskEngine::new(RiskConfig::default());
        let q = quote(Market::Polymarket, 50.0, true);
        let s = snap(10_000.0, 0.0, 0.0);
        assert!(engine.gate(&q, &s).is_ok());
    }

    #[test]
    fn market_cap_blocks_before_total_cap_would() {
        let engine = RiskEngine::new(RiskConfig::default());
        // Polymarket cap is 10% of capital; put existing exposure right at the edge.
        let q = quote(Market::Polymarket, 10.0, true);
        let s = snap(100.0, 0.0, 9.5); // 9.5 + 10 > 10% of 100
        assert!(matches!(
            engine.gate(&q, &s),
            Err(GateRejection::MarketCapExceeded)
        ));
    }
}
