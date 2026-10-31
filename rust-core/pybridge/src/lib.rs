//! Builds (via `maturin build --release`) into `nexus_kernel`, a native
//! Python extension module. The Python adapter/strategy/AI/GUI layer calls
//! `nexus_kernel.gate(quote_json, snapshot_json)` instead of re-implementing
//! risk math — the hard caps, exposure math and journal live in exactly one
//! place (Rust), not duplicated across two languages.
//!
//! Build: `cd rust-core && maturin develop --release -m pybridge/Cargo.toml`
//! then `import nexus_kernel` works from the python-layer venv.

use nexus_kernel::{Journal, Market, PortfolioSnapshot, Quote, RiskConfig, RiskEngine, Side};
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use std::cell::RefCell;

fn parse_market(s: &str) -> PyResult<Market> {
    match s {
        "perp_binance" => Ok(Market::PerpBinance),
        "polymarket" => Ok(Market::Polymarket),
        "solana_memecoin" => Ok(Market::SolanaMemecoin),
        other => Err(PyValueError::new_err(format!("unknown market: {other}"))),
    }
}

fn parse_side(s: &str) -> PyResult<Side> {
    match s {
        "BUY" => Ok(Side::Buy),
        "SELL" => Ok(Side::Sell),
        other => Err(PyValueError::new_err(format!("unknown side: {other}"))),
    }
}

/// gate(quote: dict, snapshot: dict) -> (approved: bool, reason: str)
///
/// quote keys: adapter, symbol, side, price, size, notional_usd,
///             slippage_bps (optional), metadata (optional dict)
/// snapshot keys: total_capital_usd, total_exposure_usd, market_exposure_usd,
///                daily_loss_pct, drawdown_pct,
///                projected_funding_cost_usd (optional), funding_budget_usd (optional)
#[pyfunction]
fn gate(py: Python<'_>, quote: Bound<'_, PyAny>, snapshot: Bound<'_, PyAny>) -> PyResult<(bool, String)> {
    let quote_json: serde_json::Value = pythonize_dict_to_json(py, &quote)?;
    let snap_json: serde_json::Value = pythonize_dict_to_json(py, &snapshot)?;

    let q = Quote {
        adapter: parse_market(quote_json["adapter"].as_str().unwrap_or(""))?,
        symbol: quote_json["symbol"].as_str().unwrap_or("").to_string(),
        side: parse_side(quote_json["side"].as_str().unwrap_or(""))?,
        price: quote_json["price"].as_f64().unwrap_or(0.0),
        size: quote_json["size"].as_f64().unwrap_or(0.0),
        notional_usd: quote_json["notional_usd"].as_f64().unwrap_or(0.0),
        slippage_bps: quote_json["slippage_bps"].as_f64().unwrap_or(0.0),
        metadata: quote_json["metadata"]
            .as_object()
            .map(|m| m.clone().into_iter().collect())
            .unwrap_or_default(),
    };

    let snap = PortfolioSnapshot {
        total_capital_usd: snap_json["total_capital_usd"].as_f64().unwrap_or(0.0),
        total_exposure_usd: snap_json["total_exposure_usd"].as_f64().unwrap_or(0.0),
        market_exposure_usd: snap_json["market_exposure_usd"].as_f64().unwrap_or(0.0),
        daily_loss_pct: snap_json["daily_loss_pct"].as_f64().unwrap_or(0.0),
        drawdown_pct: snap_json["drawdown_pct"].as_f64().unwrap_or(0.0),
        projected_funding_cost_usd: snap_json["projected_funding_cost_usd"].as_f64(),
        funding_budget_usd: snap_json["funding_budget_usd"].as_f64(),
    };

    let engine = RiskEngine::new(RiskConfig::default());
    match engine.gate(&q, &snap) {
        Ok(()) => Ok((true, "approved".to_string())),
        Err(reason) => Ok((false, reason.to_string())),
    }
}

fn pythonize_dict_to_json(py: Python<'_>, obj: &Bound<'_, PyAny>) -> PyResult<serde_json::Value> {
    let json_mod = py.import_bound("json")?;
    let dumped: String = json_mod.call_method1("dumps", (obj,))?.extract()?;
    serde_json::from_str(&dumped).map_err(|e| PyValueError::new_err(e.to_string()))
}

/// Thin wrapper around the SQLite journal. One instance per process;
/// the Python side holds it for the life of the kernel.
#[pyclass]
struct PyJournal {
    inner: RefCell<Journal>,
}

#[pymethods]
impl PyJournal {
    #[new]
    fn new(path: &str) -> PyResult<Self> {
        let j = Journal::open(path).map_err(|e| PyValueError::new_err(e.to_string()))?;
        Ok(Self { inner: RefCell::new(j) })
    }

    fn propose_order(
        &self,
        adapter: &str,
        symbol: &str,
        side: &str,
        notional_usd: f64,
        strategy_id: Option<&str>,
    ) -> PyResult<String> {
        self.inner
            .borrow()
            .propose_order(adapter, symbol, side, notional_usd, strategy_id)
            .map_err(|e| PyValueError::new_err(e.to_string()))
    }

    fn update_status(&self, order_id: &str, status: &str, reason_code: Option<&str>) -> PyResult<()> {
        self.inner
            .borrow()
            .update_status(order_id, status, reason_code)
            .map_err(|e| PyValueError::new_err(e.to_string()))
    }

    fn recover_pending(&self) -> PyResult<Vec<(String, String, String)>> {
        self.inner
            .borrow()
            .recover_pending()
            .map_err(|e| PyValueError::new_err(e.to_string()))
    }

    fn daily_loss_pct(&self, capital_usd: f64) -> PyResult<f64> {
        self.inner
            .borrow()
            .daily_loss_pct(capital_usd)
            .map_err(|e| PyValueError::new_err(e.to_string()))
    }
}

#[pymodule]
fn nexus_kernel(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(gate, m)?)?;
    m.add_class::<PyJournal>()?;
    Ok(())
}
