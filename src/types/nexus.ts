export type Regime =
  | 'trend_up'
  | 'trend_down'
  | 'range'
  | 'volatility_compression'
  | 'volatility_expansion'
  | 'chop'
  | 'no_trade'
  | 'LIQUIDATION_EVENT';

export interface MarketSnapshot {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread_bps: number;
  atr: number;
  adx: number;
  trend_strength: number;
  volatility_pct: number;
  volume: number;
  rvix?: number;
  funding_rate: number;
  open_interest: number;
  oi_change_pct: number;
  delta_imbalance: number;
  cumulative_volume_delta: number;
  taker_buy_sell_ratio: number;
  vwap_distance_pct: number;
  bb_width_pct: number;
  rsi: number;
  higher_tf_bias: 'bullish' | 'bearish' | 'neutral';
  session_quality: number;
  liquidity_score: number;
  depth_usd: number;
  sentiment_score: number;
}

export interface TradePlan {
  symbol: string;
  side: 'long' | 'short';
  entry: number;
  stop: number;
  target: number;
  position_units: number;
  score: number;
  regime: Regime;
  reasons: string[];
}

export interface TradeApproval {
  approved: boolean;
  trade: TradePlan | null;
  veto_reasons: string[];
}

export interface ExecutionResult {
  spread_cost: number;
  slippage_cost: number;
  expected_cost: number;
  quality: 'good' | 'fair' | 'poor';
}

export interface SetupCandidate {
  setup: 'PRE_PUMP_ABSORPTION' | 'EXHAUSTION_REVERSAL' | 'BREAKOUT_ACCEPTANCE' | 'FAILED_BREAKOUT' | 'TREND_PULLBACK';
  side: 'BUY' | 'SELL';
  score: number;
  reasons: string[];
}

export interface SignalDecision {
  approved: boolean;
  setup: string;
  side: string;
  grade: 'A' | 'B' | 'C';
  confidence: number;
  regime: string;
  entry: number;
  stop: number;
  target: number;
  expires_at: string;
  expected_net_r: number;
  reasons: string[];
  warnings: string[];
  invalidations: string[];
  feature_snapshot: Record<string, any>;
  live_eligible: boolean;
}

export type GateState = 'PASS' | 'BLOCK';
export type OrderState = 'CREATED' | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'UNKNOWN';

export interface AccountValidation {
  ok: boolean;
  can_trade: boolean;
  account_type?: string;
  wallet_balance: number;
  available_balance: number;
  positions: number;
  reason_codes: string[];
  checked_at: string;
}

export interface RiskGate {
  state: GateState;
  risk_amount: number;
  daily_pnl: number;
  open_positions: number;
  expected_rr: number;
  reasons: string[];
}

export interface ExecutionGate {
  state: GateState;
  symbol: string;
  side: string;
  quantity: number;
  spread_bps: number;
  estimated_cost: number;
  reasons: string[];
}

export interface OrderRecord {
  client_order_id: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  state: OrderState;
  exchange_order_id?: string;
  entry_price?: number;
  stop_order_id?: string;
  target_order_id?: string;
  updated_at: string;
  raw: Record<string, any>;
}

export interface Settings {
  binance_api_key?: string;
  binance_api_secret?: string;
  binance_base_url: string;
  binance_testnet: boolean;
  symbol: string;
  account_capital: number;
  max_risk_per_trade: number;
  max_daily_loss: number;
  max_open_positions: number;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  enable_live_orders: boolean;
  use_realtime_data: boolean;
}

export interface PositionSnapshot {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry_price: number;
  mark_price: number;
  unrealized_pnl: number;
  leverage: number;
}

export interface TonyBotBridgeStatus {
  connected: boolean;
  bot_name: string;
  webhook_url: string;
  last_ping: string | null;
  pending_signals: number;
  auto_dispatch: boolean;
  secret_configured: boolean;
}

export interface TonyBotSignal {
  id: string;
  timestamp: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE' | 'ALERT';
  source: 'TONYBOT_V1' | 'TELEGRAM_COMMAND' | 'WEBHOOK';
  setup?: string;
  confidence: number;
  suggested_entry?: number;
  suggested_stop?: number;
  suggested_target?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  notes?: string;
}
