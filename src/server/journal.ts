import { randomUUID } from "crypto";
import { db } from "./db";

export interface OrderRow {
  id: string;
  adapter: string;
  symbol: string;
  side: string;
  notional_usd: number;
  price: number | null;
  size: number | null;
  status: string;
  reason_code: string | null;
  strategy_id: string | null;
  parent_id: string | null;
  raw_request: string | null;
  raw_response: string | null;
  created_at: string;
  updated_at: string;
}

export function createOrder(row: Partial<OrderRow>): OrderRow {
  const now = new Date().toISOString();
  const full: OrderRow = {
    id: row.id ?? randomUUID(),
    adapter: row.adapter ?? "unknown",
    symbol: row.symbol ?? "UNKNOWN",
    side: row.side ?? "BUY",
    notional_usd: row.notional_usd ?? 0,
    price: row.price ?? null,
    size: row.size ?? null,
    status: row.status ?? "PROPOSED",
    reason_code: row.reason_code ?? null,
    strategy_id: row.strategy_id ?? null,
    parent_id: row.parent_id ?? null,
    raw_request: row.raw_request ?? null,
    raw_response: row.raw_response ?? null,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO orders (
      id, adapter, symbol, side, notional_usd, price, size, status,
      reason_code, strategy_id, parent_id, raw_request, raw_response,
      created_at, updated_at
    ) VALUES (
      @id, @adapter, @symbol, @side, @notional_usd, @price, @size, @status,
      @reason_code, @strategy_id, @parent_id, @raw_request, @raw_response,
      @created_at, @updated_at
    )
  `).run(full);

  return full;
}

export function updateOrderStatus(
  id: string,
  status: string,
  reasonCode?: string,
  rawResponse?: string,
) {
  db.prepare(`
    UPDATE orders
    SET status = ?,
        reason_code = COALESCE(?, reason_code),
        raw_response = COALESCE(?, raw_response),
        updated_at = ?
    WHERE id = ?
  `).run(status, reasonCode ?? null, rawResponse ?? null, new Date().toISOString(), id);
}

export function recoverOpenOrders(): OrderRow[] {
  return db.prepare(`SELECT * FROM orders WHERE status IN ('SUBMITTED', 'UNKNOWN')`).all() as OrderRow[];
}

export function recoverJournalOrders(): OrderRow[] {
  return db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all() as OrderRow[];
}

export function dailyLossPct(startCapital: number): number {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const row = db.prepare(`
    SELECT COALESCE(SUM(pnl_usd), 0) AS p
    FROM positions
    WHERE closed_at >= ?
  `).get(since) as { p: number };
  return startCapital > 0 ? Math.max(0, -row.p) / startCapital : 0;
}

export function totalExposureUsd(): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(notional_usd), 0) AS e
    FROM positions
    WHERE closed_at IS NULL
  `).get() as { e: number };
  return row.e;
}

export function marketExposureUsd(adapter: string): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(notional_usd), 0) AS e
    FROM positions
    WHERE closed_at IS NULL AND adapter = ?
  `).get(adapter) as { e: number };
  return row.e;
}
