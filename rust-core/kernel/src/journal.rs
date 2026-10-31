//! Restart-safe SQLite journal. Every lifecycle transition is written here
//! before it is reported anywhere else (Telegram, UI, Python). On restart,
//! `recover()` re-reads SUBMITTED/UNKNOWN rows so the kernel never trusts
//! its own memory of in-flight state across a crash.

use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult};
use uuid::Uuid;

pub struct Journal {
    conn: Connection,
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS orders (
    id            TEXT PRIMARY KEY,
    adapter       TEXT NOT NULL,
    symbol        TEXT NOT NULL,
    side          TEXT NOT NULL,
    notional_usd  REAL NOT NULL,
    price         REAL,
    size          REAL,
    status        TEXT NOT NULL,
    reason_code   TEXT,
    strategy_id   TEXT,
    parent_id     TEXT,
    raw_request   TEXT,
    raw_response  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
    id            TEXT PRIMARY KEY,
    adapter       TEXT NOT NULL,
    symbol        TEXT NOT NULL,
    size          REAL NOT NULL,
    entry_price   REAL NOT NULL,
    notional_usd  REAL NOT NULL,
    opened_at     TEXT NOT NULL,
    closed_at     TEXT,
    pnl_usd       REAL,
    strategy_id   TEXT
);

CREATE TABLE IF NOT EXISTS strategy_versions (
    id                TEXT PRIMARY KEY,
    dsl_yaml          TEXT NOT NULL,
    parent_id         TEXT,
    created_by        TEXT,
    backtest_win_rate REAL,
    backtest_sharpe   REAL,
    approved          INTEGER DEFAULT 0,
    created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reflections (
    id                         TEXT PRIMARY KEY,
    trade_id                   TEXT NOT NULL,
    diagnosis                  TEXT,
    param_changed               TEXT,
    old_value                  TEXT,
    new_value                  TEXT,
    proposed_strategy_version  TEXT,
    accepted                   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
"#;

impl Journal {
    pub fn open(path: &str) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> SqlResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn })
    }

    /// Insert a new order row in PROPOSED status. Returns the generated id.
    pub fn propose_order(
        &self,
        adapter: &str,
        symbol: &str,
        side: &str,
        notional_usd: f64,
        strategy_id: Option<&str>,
    ) -> SqlResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO orders (id, adapter, symbol, side, notional_usd, status, strategy_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'proposed', ?6, ?7, ?7)",
            params![id, adapter, symbol, side, notional_usd, strategy_id, now],
        )?;
        Ok(id)
    }

    pub fn update_status(&self, order_id: &str, status: &str, reason_code: Option<&str>) -> SqlResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE orders SET status = ?1, reason_code = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, reason_code, now, order_id],
        )?;
        Ok(())
    }

    /// Rows a restart must reconcile against ground truth from the adapter.
    pub fn recover_pending(&self) -> SqlResult<Vec<(String, String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, adapter, status FROM orders WHERE status IN ('submitted', 'unknown')")?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            })?
            .collect::<SqlResult<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn daily_loss_pct(&self, capital_usd: f64) -> SqlResult<f64> {
        let since = (Utc::now() - chrono::Duration::hours(24)).to_rfc3339();
        let loss: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(pnl_usd), 0.0) FROM positions
             WHERE closed_at IS NOT NULL AND closed_at >= ?1 AND pnl_usd < 0",
            params![since],
            |r| r.get(0),
        )?;
    pub fn record_fill(&self, order_id: &str, price: f64, size: f64) -> SqlResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE orders SET status = 'filled', price = ?1, size = ?2, updated_at = ?3 WHERE id = ?4",
            params![price, size, now, order_id],
        )?;
        Ok(())
    }

    pub fn open_position(
        &self,
        adapter: &str,
        symbol: &str,
        size: f64,
        entry_price: f64,
        notional_usd: f64,
        strategy_id: Option<&str>,
    ) -> SqlResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO positions (id, adapter, symbol, size, entry_price, notional_usd, opened_at, strategy_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, adapter, symbol, size, entry_price, notional_usd, now, strategy_id],
        )?;
        Ok(id)
    }

    pub fn close_position(&self, position_id: &str, exit_price: f64, pnl_usd: f64) -> SqlResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE positions SET closed_at = ?1, pnl_usd = ?2 WHERE id = ?3",
            params![now, pnl_usd, position_id],
        )?;
        Ok(())
    }

    pub fn total_open_exposure_usd(&self) -> SqlResult<f64> {
        let exp: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(notional_usd), 0.0) FROM positions WHERE closed_at IS NULL",
            [],
            |r| r.get(0),
        )?;
        Ok(exp)
    }

    pub fn market_open_exposure_usd(&self, adapter: &str) -> SqlResult<f64> {
        let exp: f64 = self.conn.query_row(
            "SELECT COALESCE(SUM(notional_usd), 0.0) FROM positions WHERE closed_at IS NULL AND adapter = ?1",
            params![adapter],
            |r| r.get(0),
        )?;
        Ok(exp)
    }

    pub fn projected_funding_cost_usd(&self) -> SqlResult<f64> {
        let perp_exp = self.market_open_exposure_usd("perp_binance")?;
        // 3 intervals per day * assumed standard 0.01% rate
        Ok(perp_exp * 0.0003)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn propose_then_recover_finds_in_flight_orders() {
        let j = Journal::open_in_memory().unwrap();
        let id = j
            .propose_order("perp_binance", "BTCUSDT", "BUY", 100.0, Some("perp_pullback_v1"))
            .unwrap();
        j.update_status(&id, "submitted", None).unwrap();

        let pending = j.recover_pending().unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].0, id);
    }

    #[test]
    fn filled_orders_are_not_recovered() {
        let j = Journal::open_in_memory().unwrap();
        let id = j.propose_order("polymarket", "EVT-1", "BUY", 50.0, None).unwrap();
        j.update_status(&id, "filled", None).unwrap();
        assert!(j.recover_pending().unwrap().is_empty());
    }
}
