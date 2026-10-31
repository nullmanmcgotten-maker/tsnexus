export type Market = 'perp_binance' | 'polymarket' | 'solana_memecoin';

export type Side = 'BUY' | 'SELL';

export interface Quote {
  adapter: Market;
  symbol: string;
  side: Side;
  price: number; // For Polymarket: 0.00–1.00 probability, Perps/Memes: USD price
  size: number; // shares / contracts / tokens
  notional_usd: number; // ALWAYS authoritative number for risk
  slippage_bps: number;
  metadata: {
    safety?: SafetyScanResult;
    strategy_id?: string;
    market_title?: string;
    resolution_time?: string;
    token_mint?: string;
    ai_estimate?: number;
    funding_rate?: number;
    regime?: string;
    [key: string]: any;
  };
}

export type OrderStatus = 'PROPOSED' | 'GATED' | 'APPROVED' | 'SUBMITTED' | 'FILLED' | 'PARTIAL' | 'REJECTED' | 'UNKNOWN' | 'CANCELLED' | 'BLOCKED';

export interface OrderResult {
  order_id: string | null;
  status: 'FILLED' | 'PARTIAL' | 'REJECTED' | 'UNKNOWN' | 'CANCELLED';
  filled_size: number;
  avg_price: number | null;
  notional_usd: number;
  raw: Record<string, any>;
}

export interface UnifiedOrderRecord {
  id: string;
  adapter: Market;
  symbol: string;
  side: Side;
  notional_usd: number;
  price: number;
  size: number;
  status: OrderStatus;
  reason_code?: string;
  strategy_id?: string;
  parent_id?: string;
  raw_request?: string;
  raw_response?: string;
  created_at: string;
  updated_at: string;
}

export interface UnifiedPosition {
  id: string;
  adapter: Market;
  symbol: string;
  side: Side;
  size: number;
  entry_price: number;
  mark_price: number;
  notional_usd: number;
  pnl_usd: number;
  opened_at: string;
  closed_at?: string;
  strategy_id?: string;
  max_adverse_excursion_usd?: number;
}

export interface SafetyScanResult {
  mint: string;
  passed: boolean;
  p_rug: number; // threshold <= 0.15
  bundle_pct: number; // threshold <= 0.40
  sniper_pct: number; // threshold <= 0.30
  top10_holder_pct: number; // threshold <= 0.50
  lp_locked: boolean;
  honeypot: boolean;
  token_age_hours: number;
  reasons: string[];
  scanned_at: string;
}

export interface RiskEngineConfig {
  total_capital_usd: number;
  max_total_exposure_pct: number; // 0.30
  market_caps: {
    perp_binance: number; // 0.15
    polymarket: number; // 0.10
    solana_memecoin: number; // 0.05
  };
  max_daily_loss_pct: number; // 0.02
  max_drawdown_pct: number; // 0.15
  hard_caps_usd: {
    solana_memecoin: number; // $25 (non-negotiable during demo)
    polymarket: number; // $100
    perp_binance: number; // $500
  };
  funding_budget_usd: number; // $30/day max projected funding cost
}

export interface StrategyDSL {
  id: string;
  market: Market;
  version: number;
  triggers: Array<{
    indicator: string;
    params: Record<string, any>;
    condition: string;
  }>;
  guards: Array<{
    name: 'safety_filter' | 'max_notional_usd' | 'regime' | 'liquidity_min_usd' | 'funding_budget';
    params: Record<string, any>;
  }>;
  exit: {
    stop_loss?: { type: string; multiplier?: number; value?: number };
    take_profit?: { type: string; value?: number; r_multiple?: number };
    timeout_minutes?: number; // 30 min max for memecoins
  };
  params: Record<string, number>;
  param_ranges: Record<string, [number, number]>;
  created_by: 'human' | 'reflector';
  backtest_win_rate?: number;
  backtest_sharpe?: number;
  approved: boolean;
  created_at: string;
}

export interface ReflectionRecord {
  id: string;
  trade_id: string;
  market: Market;
  loss_usd: number;
  diagnosis: string;
  param_changed: string;
  old_value: number;
  new_value: number;
  proposed_strategy_version: string;
  backtest_win_rate: number;
  backtest_sharpe: number;
  accepted: boolean;
  created_at: string;
}

export interface ShadowPnlRecord {
  id: string;
  adapter: Market;
  symbol: string;
  side: Side;
  strategy_id: string;
  entry_price: number;
  exit_price: number;
  size: number;
  notional_usd: number;
  pnl_usd: number;
  slippage_assumed_bps: number;
  mae_usd: number; // max adverse excursion
  opened_at: string;
  closed_at: string;
  status: 'OPEN' | 'CLOSED';
}

export interface GoNoGoCriteriaStatus {
  shadow_pnl_positive: boolean; // Positive or explainably neutral in >=2 of 3 markets
  zero_risk_breaches: boolean; // Zero risk-gate breaches
  journal_integrity: boolean; // Integrity across mid-run restart
  safety_filter_efficacy: boolean; // >=3 of 25 daily scans rejected
  ai_router_resilience: boolean; // Survives 429 cascade to deterministic rules
  all_passed: boolean;
}
