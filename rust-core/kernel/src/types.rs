//! Shared types. These mirror the Python `core/adapters/base.py` contract
//! 1:1 so Quote/OrderResult can cross the PyO3 boundary without translation
//! drift between the Rust kernel and the Python adapter/strategy layer.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Side {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Market {
    PerpBinance,
    Polymarket,
    SolanaMemecoin,
}

impl Market {
    pub fn as_str(&self) -> &'static str {
        match self {
            Market::PerpBinance => "perp_binance",
            Market::Polymarket => "polymarket",
            Market::SolanaMemecoin => "solana_memecoin",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub adapter: Market,
    pub symbol: String,
    pub side: Side,
    pub price: f64,
    pub size: f64,
    /// ALWAYS the authoritative number for risk — notional_usd, not price*size,
    /// is what every gate below checks.
    pub notional_usd: f64,
    pub slippage_bps: f64,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    Proposed,
    Gated,
    Approved,
    Submitted,
    Filled,
    Partial,
    Rejected,
    Blocked,
    Unknown,
    Reconciled,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResult {
    pub order_id: Option<String>,
    pub status: OrderStatus,
    pub filled_size: f64,
    pub avg_price: Option<f64>,
    pub raw: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum GateRejection {
    #[error("hard_cap_exceeded")]
    HardCapExceeded,
    #[error("total_exposure_cap")]
    TotalExposureCap,
    #[error("market_cap_exceeded")]
    MarketCapExceeded,
    #[error("daily_loss_breaker")]
    DailyLossBreaker,
    #[error("drawdown_breaker")]
    DrawdownBreaker,
    #[error("funding_budget")]
    FundingBudget,
    #[error("safety_filter_missing_or_failed")]
    SafetyFilter,
}
