//! Journal-backed portfolio exposure aggregator.
//! Phase 2 of MIGRATION_PLAN.md: aggregates exposure per market from the
//! `positions` table so the kernel feeds `_portfolio_snapshot()` with one
//! authoritative ground truth, preventing adapter state drift.

use crate::journal::Journal;
use crate::risk_engine::PortfolioSnapshot;
use crate::types::Market;
use rusqlite::Result as SqlResult;

pub struct Portfolio;

impl Portfolio {
    /// Compute the authoritative portfolio snapshot directly from the journal.
    pub fn snapshot(
        journal: &Journal,
        market: Market,
        total_capital_usd: f64,
        peak_capital_usd: f64,
        funding_budget_usd: Option<f64>,
    ) -> SqlResult<PortfolioSnapshot> {
        let total_exposure_usd = journal.total_open_exposure_usd()?;
        let market_exposure_usd = journal.market_open_exposure_usd(market.as_str())?;
        let daily_loss_pct = journal.daily_loss_pct(total_capital_usd)?;

        // Current equity = total capital + realized 24h PnL
        let current_equity = total_capital_usd * (1.0 - daily_loss_pct);
        let drawdown_pct = if peak_capital_usd > 0.0 {
            ((peak_capital_usd - current_equity).max(0.0)) / peak_capital_usd
        } else {
            0.0
        };

        let projected_funding_cost_usd = if market == Market::PerpBinance {
            Some(journal.projected_funding_cost_usd()?)
        } else {
            None
        };

        Ok(PortfolioSnapshot {
            total_capital_usd,
            total_exposure_usd,
            market_exposure_usd,
            daily_loss_pct,
            drawdown_pct,
            projected_funding_cost_usd,
            funding_budget_usd,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal::Journal;

    #[test]
    fn portfolio_snapshot_aggregates_open_positions() {
        let j = Journal::open_in_memory().unwrap();
        let pos_id = j.open_position("solana_memecoin", "BDA", 55000.0, 0.00041, 22.55, Some("meme_v1")).unwrap();
        assert!(!pos_id.is_empty());

        let snap = Portfolio::snapshot(&j, Market::SolanaMemecoin, 10_000.0, 10_000.0, None).unwrap();
        assert_eq!(snap.total_exposure_usd, 22.55);
        assert_eq!(snap.market_exposure_usd, 22.55);
        assert_eq!(snap.daily_loss_pct, 0.0);
    }
}
