import {
  AccountValidation,
  ExecutionGate,
  ExecutionResult,
  MarketSnapshot,
  PositionSnapshot,
  Regime,
  RiskGate,
  Settings,
  SetupCandidate,
  SignalDecision,
  TradeApproval,
  TradePlan,
} from '../types/nexus.ts';

/**
 * Classify market regime based on ADX, trend strength, volatility, BB width, and higher TF bias.
 * Direct port of nexus_engine/market_regime.py
 */
export function classifyRegime(snapshot: MarketSnapshot): Regime {
  if (snapshot.adx >= 28 && snapshot.trend_strength >= 0.6) {
    return snapshot.higher_tf_bias === 'bullish' ? 'trend_up' : 'trend_down';
  }

  if (snapshot.bb_width_pct < 0.15 && snapshot.volatility_pct < 0.8) {
    return 'volatility_compression';
  }

  if (snapshot.volatility_pct > 1.5 && snapshot.volume > 0) {
    return 'volatility_expansion';
  }

  if (snapshot.adx < 20 && Math.abs(snapshot.vwap_distance_pct) < 0.5 && Math.abs(snapshot.rsi - 50) < 15) {
    return 'range';
  }

  if (snapshot.volatility_pct < 0.35 && Math.abs(snapshot.rsi - 50) < 10) {
    return 'chop';
  }

  return 'no_trade';
}

/**
 * Return normalized regime quality score [0, 1].
 */
export function regimeScore(snapshot: MarketSnapshot): number {
  const regime = classifyRegime(snapshot);
  const weights: Record<string, number> = {
    trend_up: 0.9,
    trend_down: 0.9,
    range: 0.6,
    volatility_compression: 0.75,
    volatility_expansion: 0.7,
    chop: 0.2,
    no_trade: 0.0,
    LIQUIDATION_EVENT: 0.85,
  };

  let base = weights[regime] ?? 0.0;
  if (snapshot.session_quality < 0.2) {
    base *= 0.7;
  }

  return Math.max(0.0, Math.min(1.0, base));
}

/**
 * Order flow summary from market microstructure.
 * Direct port of nexus_engine/orderflow.py
 */
export function orderFlowSignal(snapshot: MarketSnapshot): {
  direction: 'bullish' | 'bearish' | 'neutral';
  score: number;
  delta_imbalance: number;
  cumulative_volume_delta: number;
  taker_buy_sell_ratio: number;
} {
  const delta = snapshot.delta_imbalance;
  const cfd = snapshot.cumulative_volume_delta;
  const takerRatio = snapshot.taker_buy_sell_ratio;

  let score = 0.0;
  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  if (delta > 0.3) {
    score += 0.5;
    direction = 'bullish';
  } else if (delta < -0.3) {
    score += 0.5;
    direction = 'bearish';
  }

  if (cfd > 0) {
    score += 0.25;
  } else if (cfd < 0) {
    score -= 0.25;
  }

  if (takerRatio > 1.15) {
    score += 0.15;
  } else if (takerRatio < 0.85) {
    score -= 0.15;
  }

  return {
    direction,
    score: Math.max(-1.0, Math.min(1.0, score)),
    delta_imbalance: delta,
    cumulative_volume_delta: cfd,
    taker_buy_sell_ratio: takerRatio,
  };
}

/**
 * Liquidity score [0, 1].
 * Direct port of nexus_engine/orderflow.py: liquidity_score
 */
export function liquidityScore(snapshot: MarketSnapshot): number {
  let score = 0.0;
  score += Math.min(snapshot.liquidity_score, 1.0);
  score += Math.min(snapshot.depth_usd / 250000.0, 1.0) * 0.5;
  if (snapshot.spread_bps < 3.0) {
    score += 0.25;
  }
  if (snapshot.session_quality > 0.5) {
    score += 0.25;
  }
  return Math.max(0.0, Math.min(1.0, score / 2.0));
}

/**
 * Execution cost estimation.
 * Direct port of nexus_engine/execution.py
 */
export function estimateExecutionCost(snapshot: MarketSnapshot, units: number): ExecutionResult {
  const mid = (snapshot.bid + snapshot.ask) / 2.0;
  const spread_cost = Math.abs(snapshot.ask - snapshot.bid) * units;
  const slippage_cost = Math.max(0.0, Math.abs(snapshot.price - mid) * units * 0.7);
  const expected_cost = spread_cost + slippage_cost;

  let quality: 'good' | 'fair' | 'poor' = 'good';
  if (snapshot.spread_bps > 4.5) {
    quality = 'poor';
  } else if (snapshot.spread_bps > 2.0) {
    quality = 'fair';
  }

  return {
    spread_cost,
    slippage_cost,
    expected_cost,
    quality,
  };
}

/**
 * Execution quality score [0, 1].
 */
export function executionQuality(snapshot: MarketSnapshot, units: number): number {
  const cost = estimateExecutionCost(snapshot, units);
  let score = 1.0;
  const denominator = snapshot.price * Math.max(units, 1.0) * 0.02;
  score -= Math.min(cost.expected_cost / (denominator > 0 ? denominator : 1), 1.0);
  if (snapshot.spread_bps > 2.5) {
    score -= 0.2;
  }
  if (snapshot.depth_usd < 100000) {
    score -= 0.2;
  }
  return Math.max(0.0, Math.min(1.0, score));
}

/**
 * Capital at risk budget.
 * Direct port of nexus_engine/risk.py
 */
export function riskBudget(accountCapital: number, riskFraction: number = 0.004): number {
  return accountCapital * riskFraction;
}

/**
 * Position sizing based on distance to stop loss.
 */
export function positionUnitsForRisk(
  entryPrice: number,
  stopPrice: number,
  accountCapital: number,
  riskFraction: number = 0.004
): number {
  if (stopPrice <= 0 || entryPrice <= 0) return 0.0;
  const stopDistance = Math.abs(entryPrice - stopPrice);
  if (stopDistance <= 0) return 0.0;
  const riskAmount = riskBudget(accountCapital, riskFraction);
  return riskAmount / stopDistance;
}

/**
 * Risk-to-reward ratio.
 */
export function riskReward(entry: number, stop: number, target: number): number {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  if (risk <= 0) return 0.0;
  return reward / risk;
}

/**
 * Approval reasons builder.
 */
function approvalReasons(snapshot: MarketSnapshot): string[] {
  const reasons: string[] = [];
  const regime = classifyRegime(snapshot);
  if (['trend_up', 'trend_down', 'volatility_compression'].includes(regime)) {
    reasons.push(`regime:${regime}`);
  }
  if (snapshot.session_quality >= 0.5) {
    reasons.push('session_quality:good');
  } else {
    reasons.push('session_quality:weak');
  }
  if (snapshot.spread_bps <= 3.0) {
    reasons.push('spread:acceptable');
  }
  if (snapshot.depth_usd >= 100000) {
    reasons.push('depth:acceptable');
  }
  return reasons;
}

/**
 * Generate trade plan or veto with specific reason codes.
 * Direct port of nexus_engine/setup_engine.py: generate_trade_plan
 */
export function generateTradePlan(
  snapshot: MarketSnapshot,
  accountCapital: number = 10000.0,
  riskFraction: number = 0.004,
  rrFloor: number = 1.8
): TradeApproval {
  const vetoes: string[] = [];
  const regime = classifyRegime(snapshot);

  if (regime === 'chop' || regime === 'no_trade') {
    vetoes.push('regime_disallows_trade');
  }

  if (snapshot.spread_bps > 4.0) {
    vetoes.push('spread_too_wide');
  }

  if (snapshot.depth_usd < 100000) {
    vetoes.push('insufficient_depth');
  }

  if (snapshot.session_quality < 0.35) {
    vetoes.push('weak_session');
  }

  if (snapshot.volatility_pct < 0.2 && snapshot.bb_width_pct < 0.08) {
    vetoes.push('too_low_volatility');
  }

  if (snapshot.funding_rate > 0.0006) {
    vetoes.push('funding_pressure_bias');
  }

  const liq = liquidityScore(snapshot);
  const flow = orderFlowSignal(snapshot);

  if (liq < 0.45) {
    vetoes.push('liquidity_score_too_low');
  }

  if (flow.score === 0) {
    vetoes.push('order_flow_not_confirmed');
  }

  // Direction selection
  let side: 'long' | 'short' | null = null;
  if (snapshot.higher_tf_bias === 'bullish' && (flow.direction === 'bullish' || flow.direction === 'neutral')) {
    side = 'long';
  } else if (snapshot.higher_tf_bias === 'bearish' && (flow.direction === 'bearish' || flow.direction === 'neutral')) {
    side = 'short';
  } else {
    side = flow.direction === 'bullish' ? 'long' : flow.direction === 'bearish' ? 'short' : null;
  }

  if (!side) {
    vetoes.push('no_clear_direction');
    return { approved: false, trade: null, veto_reasons: vetoes };
  }

  if (snapshot.higher_tf_bias === 'neutral' && regime !== 'trend_up' && regime !== 'trend_down') {
    vetoes.push('neutral_bias_without_structure');
  }

  // Price / risk model
  let entry: number;
  let stop: number;
  let target: number;

  if (side === 'long') {
    entry = snapshot.ask * 1.0002;
    stop = snapshot.bid * 0.997;
    target = entry * (1 + (rrFloor * Math.abs(entry - stop)) / entry);
  } else {
    entry = snapshot.bid * 0.9998;
    stop = snapshot.ask * 1.003;
    target = entry * (1 - (rrFloor * Math.abs(entry - stop)) / entry);
  }

  const rr = riskReward(entry, stop, target);
  if (rr < rrFloor) {
    vetoes.push('risk_reward_too_low');
  }

  const positionSize = positionUnitsForRisk(entry, stop, accountCapital, riskFraction);
  if (positionSize <= 0) {
    vetoes.push('position_size_zero');
  }

  const execScore = executionQuality(snapshot, positionSize);
  if (execScore < 0.5) {
    vetoes.push('execution_quality_too_low');
  }

  const score =
    regimeScore(snapshot) * 0.35 +
    liq * 0.2 +
    Math.max(0.0, flow.score) * 0.25 +
    execScore * 0.2;

  if (score < 0.65) {
    vetoes.push('approval_score_too_low');
  }

  if (vetoes.length > 0) {
    return {
      approved: false,
      trade: null,
      veto_reasons: vetoes,
    };
  }

  const plan: TradePlan = {
    symbol: snapshot.symbol,
    side,
    entry: Number(entry.toFixed(4)),
    stop: Number(stop.toFixed(4)),
    target: Number(target.toFixed(4)),
    position_units: Number(positionSize.toFixed(4)),
    score: Number(score.toFixed(4)),
    regime,
    reasons: approvalReasons(snapshot),
  };

  return {
    approved: true,
    trade: plan,
    veto_reasons: [],
  };
}

/**
 * Systematic Setup Detectors.
 * Direct port of nexus_engine/setup_detectors.py
 */
export function detectSetups(snapshot: MarketSnapshot): SetupCandidate[] {
  const candidates: SetupCandidate[] = [];
  const regime = classifyRegime(snapshot);
  const imbalance = snapshot.delta_imbalance;
  const flow = orderFlowSignal(snapshot);

  // PRE_PUMP_ABSORPTION
  if (
    (regime === 'trend_up' || regime === 'volatility_compression') &&
    snapshot.higher_tf_bias === 'bullish' &&
    imbalance > 0.12 &&
    snapshot.liquidity_score >= 0.5
  ) {
    candidates.push({
      setup: 'PRE_PUMP_ABSORPTION',
      side: 'BUY',
      score: 0.82,
      reasons: ['macro_alignment', 'persistent_buy_flow', 'room_to_resistance'],
    });
  }

  // EXHAUSTION_REVERSAL
  if (
    (regime === 'trend_down' || regime === 'volatility_expansion') &&
    snapshot.higher_tf_bias === 'bearish' &&
    imbalance < -0.12 &&
    snapshot.funding_rate > 0.0003
  ) {
    candidates.push({
      setup: 'EXHAUSTION_REVERSAL',
      side: 'SELL',
      score: 0.8,
      reasons: ['bearish_structure', 'persistent_sell_flow', 'long_crowding_trap'],
    });
  }

  // BREAKOUT_ACCEPTANCE
  if (regime === 'volatility_compression' && Math.abs(imbalance) > 0.18) {
    candidates.push({
      setup: 'BREAKOUT_ACCEPTANCE',
      side: imbalance > 0 ? 'BUY' : 'SELL',
      score: 0.76,
      reasons: ['compression_exhaustion', 'flow_expansion_velocity'],
    });
  }

  // FAILED_BREAKOUT
  if (regime === 'range' && Math.abs(imbalance) > 0.2) {
    candidates.push({
      setup: 'FAILED_BREAKOUT',
      side: imbalance > 0 ? 'SELL' : 'BUY',
      score: 0.74,
      reasons: ['liquidity_sweep_detected', 'range_mean_reversion'],
    });
  }

  // TREND_PULLBACK
  if ((regime === 'trend_up' || regime === 'trend_down') && Math.abs(imbalance) > 0.1) {
    candidates.push({
      setup: 'TREND_PULLBACK',
      side: regime === 'trend_up' ? 'BUY' : 'SELL',
      score: 0.72,
      reasons: ['trend_regime_continuation', 'pullback_order_flow_return'],
    });
  }

  return candidates;
}

/**
 * Thesis Engine & Confidence Calibrator.
 * Direct port of nexus_engine/thesis_engine.py
 */
export function buildSignalDecision(
  candidate: SetupCandidate,
  snapshot: MarketSnapshot,
  historicalStats: { count: number; wins: number } = { count: 35, wins: 22 }
): SignalDecision {
  const rawScore = candidate.score;

  // Calibrate with empirical journal stats
  let confidence = rawScore;
  if (historicalStats.count >= 30) {
    const empirical = historicalStats.wins / historicalStats.count;
    confidence = Math.max(0.0, Math.min(1.0, rawScore * 0.6 + empirical * 0.4));
  }

  const side = candidate.side === 'BUY' ? 'long' : 'short';
  const entry = side === 'long' ? snapshot.ask * 1.0002 : snapshot.bid * 0.9998;
  const stop = side === 'long' ? snapshot.bid * 0.997 : snapshot.ask * 1.003;
  const target =
    side === 'long'
      ? entry * (1 + (2.0 * Math.abs(entry - stop)) / entry)
      : entry * (1 - (2.0 * Math.abs(entry - stop)) / entry);

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const net_r = risk > 0 ? reward / risk : 0;

  let grade: 'A' | 'B' | 'C' = 'C';
  if (confidence >= 0.78 && net_r >= 1.8) {
    grade = 'A';
  } else if (confidence >= 0.65 && net_r >= 1.5) {
    grade = 'B';
  }

  const approved = grade === 'A' && net_r >= 1.8;
  const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();

  return {
    approved,
    setup: candidate.setup,
    side: candidate.side,
    grade,
    confidence: Number(confidence.toFixed(3)),
    regime: classifyRegime(snapshot),
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    target: Number(target.toFixed(2)),
    expires_at: expiresAt,
    expected_net_r: Number(net_r.toFixed(2)),
    reasons: candidate.reasons,
    warnings: snapshot.spread_bps > 2.5 ? ['Elevated spread bps'] : [],
    invalidations: ['stop_broken', 'data_stale', 'regime_changed'],
    feature_snapshot: {
      symbol: snapshot.symbol,
      spread_bps: snapshot.spread_bps,
      depth_usd: snapshot.depth_usd,
      rsi: snapshot.rsi,
      imbalance: snapshot.delta_imbalance,
    },
    live_eligible: approved,
  };
}

/**
 * Risk Governor & Kill-Switch Validation.
 * Direct port of nexus_engine/risk_governor.py
 */
export class RiskGovernor {
  constructor(private settings: Settings) {}

  maxTradeRisk(accountBalance: number): number {
    return accountBalance * this.settings.max_risk_per_trade;
  }

  maxDailyLoss(accountBalance: number): number {
    return accountBalance * this.settings.max_daily_loss;
  }

  checkTradeAllowed(
    accountBalance: number,
    dailyPnl: number,
    openPositions: number,
    estimatedRisk: number,
    expectedRr: number
  ): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (dailyPnl <= -this.maxDailyLoss(accountBalance)) {
      reasons.push('daily_loss_limit_reached');
    }
    if (openPositions >= this.settings.max_open_positions) {
      reasons.push('max_open_positions_reached');
    }
    if (estimatedRisk > this.maxTradeRisk(accountBalance)) {
      reasons.push('trade_risk_exceeds_limit');
    }
    if (expectedRr < 1.5) {
      reasons.push('risk_reward_below_threshold');
    }

    return {
      ok: reasons.length === 0,
      reasons,
    };
  }

  validatePositionLimit(positions: PositionSnapshot[], newSymbol: string): boolean {
    const sameSymbol = positions.filter((p) => p.symbol === newSymbol).length;
    return sameSymbol < this.settings.max_open_positions;
  }
}
