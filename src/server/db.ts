import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(path.join(DB_DIR, "journal.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
CREATE INDEX IF NOT EXISTS idx_orders_adapter_status ON orders(adapter, status);

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
  id            TEXT PRIMARY KEY,
  dsl_yaml      TEXT NOT NULL,
  parent_id     TEXT,
  created_by    TEXT,
  backtest_win_rate REAL,
  backtest_sharpe   REAL,
  approved      INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reflections (
  id            TEXT PRIMARY KEY,
  trade_id      TEXT NOT NULL,
  diagnosis     TEXT,
  param_changed TEXT,
  old_value     TEXT,
  new_value     TEXT,
  proposed_strategy_version TEXT,
  accepted      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shadow_pnl (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  adapter       TEXT, symbol TEXT, side TEXT,
  strategy_id   TEXT,
  entry_price   REAL, exit_price REAL, size REAL,
  notional_usd  REAL, pnl_usd REAL,
  slippage_assumed_bps REAL,
  mae_usd       REAL,
  opened_at     TEXT, closed_at TEXT,
  status        TEXT
);
`);
