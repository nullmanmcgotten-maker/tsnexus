import { Market, StrategyDSL } from '../../../types/unified.ts';

export const BUILT_IN_STRATEGIES: StrategyDSL[] = [
  {
    id: 'meme_momentum',
    market: 'solana_memecoin',
    version: 1,
    triggers: [
      { indicator: 'rsi', params: { period: 7 }, condition: '< 30' },
      { indicator: 'volume_spike', params: { period: 20 }, condition: '> 1.5' },
    ],
    guards: [
      { name: 'safety_filter', params: { required: true, max_p_rug: 0.15 } },
      { name: 'max_notional_usd', params: { cap: 25.0 } },
    ],
    exit: {
      stop_loss: { type: 'atr', multiplier: 2.0 },
      take_profit: { type: 'r_multiple', value: 2.0 },
      timeout_minutes: 30, // 30 min maximum holding period
    },
    params: {
      rsi_entry_threshold: 30.0,
      volume_spike_multiplier: 1.5,
      stop_loss_multiplier: 2.0,
      take_profit_r_multiple: 2.0,
    },
    param_ranges: {
      rsi_entry_threshold: [20.0, 38.0],
      volume_spike_multiplier: [1.2, 3.0],
      stop_loss_multiplier: [1.2, 3.0],
      take_profit_r_multiple: [1.5, 4.0],
    },
    created_by: 'human',
    backtest_win_rate: 56.4,
    backtest_sharpe: 1.62,
    approved: true,
    created_at: '2026-10-31T08:00:00Z',
  },
  {
    id: 'poly_maker',
    market: 'polymarket',
    version: 1,
    triggers: [
      { indicator: 'prob_deviation', params: { max_bps: 20 }, condition: '< 0.02' },
      { indicator: 'time_to_resolution', params: { min_days: 7 }, condition: '> 7' },
    ],
    guards: [
      { name: 'max_notional_usd', params: { cap: 100.0 } },
      { name: 'liquidity_min_usd', params: { min_depth: 50000 } },
    ],
    exit: {
      timeout_minutes: 1440,
    },
    params: {
      quote_spread_bps: 20.0,
      refresh_threshold_cents: 0.01,
      max_adverse_move_cents: 0.02,
    },
    param_ranges: {
      quote_spread_bps: [10.0, 50.0],
      refresh_threshold_cents: [0.005, 0.03],
      max_adverse_move_cents: [0.01, 0.05],
    },
    created_by: 'human',
    backtest_win_rate: 64.2,
    backtest_sharpe: 1.95,
    approved: true,
    created_at: '2026-10-31T08:00:00Z',
  },
  {
    id: 'poly_deviation',
    market: 'polymarket',
    version: 1,
    triggers: [
      { indicator: 'prob_deviation', params: { threshold: 0.08 }, condition: '> 0.08' },
      { indicator: 'time_to_resolution', params: { min_days: 7 }, condition: '> 7' },
    ],
    guards: [
      { name: 'max_notional_usd', params: { cap: 100.0 } },
      { name: 'liquidity_min_usd', params: { min_depth: 50000 } },
    ],
    exit: {
      take_profit: { type: 'probability_reversion', value: 0.05 },
    },
    params: {
      deviation_trigger_pct: 0.08,
      min_days_to_expiry: 7.0,
    },
    param_ranges: {
      deviation_trigger_pct: [0.05, 0.15],
      min_days_to_expiry: [3.0, 21.0],
    },
    created_by: 'human',
    backtest_win_rate: 59.8,
    backtest_sharpe: 1.74,
    approved: true,
    created_at: '2026-10-31T08:00:00Z',
  },
  {
    id: 'perp_pullback',
    market: 'perp_binance',
    version: 1,
    triggers: [
      { indicator: 'rsi', params: { period: 14 }, condition: '< 45' },
      { indicator: 'price_above_ema', params: { ema: 200 }, condition: 'true' },
    ],
    guards: [
      { name: 'funding_budget', params: { max_daily: 30.0 } },
      { name: 'max_notional_usd', params: { cap: 500.0 } },
      { name: 'regime', params: { allowed: ['trend_up', 'volatility_compression'] } },
    ],
    exit: {
      stop_loss: { type: 'atr', multiplier: 1.5 },
      take_profit: { type: 'r_multiple', value: 2.0 },
    },
    params: {
      rsi_oversold: 42.0,
      ema_period: 200.0,
      stop_atr_mult: 1.5,
    },
    param_ranges: {
      rsi_oversold: [30.0, 50.0],
      ema_period: [50.0, 250.0],
      stop_atr_mult: [1.0, 2.5],
    },
    created_by: 'human',
    backtest_win_rate: 58.2,
    backtest_sharpe: 1.68,
    approved: true,
    created_at: '2026-10-31T08:00:00Z',
  },
  {
    id: 'perp_breakout',
    market: 'perp_binance',
    version: 1,
    triggers: [
      { indicator: 'bb_breakout', params: { std: 2.0 }, condition: 'outside' },
      { indicator: 'volume_spike', params: { mult: 1.8 }, condition: '> 1.8' },
    ],
    guards: [
      { name: 'funding_budget', params: { max_daily: 30.0 } },
      { name: 'max_notional_usd', params: { cap: 500.0 } },
    ],
    exit: {
      stop_loss: { type: 'fixed_pct', value: 0.015 },
      take_profit: { type: 'r_multiple', value: 2.5 },
    },
    params: {
      bb_std: 2.0,
      volume_mult: 1.8,
    },
    param_ranges: {
      bb_std: [1.5, 3.0],
      volume_mult: [1.2, 3.0],
    },
    created_by: 'human',
    backtest_win_rate: 51.5,
    backtest_sharpe: 1.42,
    approved: true,
    created_at: '2026-10-31T08:00:00Z',
  },
];

export class DSLEngine {
  private strategies: StrategyDSL[] = [];

  constructor() {
    this.strategies = [...BUILT_IN_STRATEGIES];
  }

  getStrategies(): StrategyDSL[] {
    return [...this.strategies];
  }

  /**
   * DSL Validator (§6.3)
   * 1. Every param key has a matching param_range.
   * 2. Every Trigger.indicator is implemented for that market (Polymarket has no RSI!).
   * 3. Guards include safety_filter for solana_memecoin.
   * 4. max_notional_usd guard present and <= hard cap.
   */
  validateDSL(dsl: StrategyDSL): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Param ranges check
    for (const key of Object.keys(dsl.params)) {
      if (!dsl.param_ranges[key]) {
        errors.push(`Missing param_range for parameter "${key}"`);
      } else {
        const val = dsl.params[key];
        const [min, max] = dsl.param_ranges[key];
        if (val < min || val > max) {
          errors.push(`Param "${key}" value ${val} out of declared range [${min}, ${max}]`);
        }
      }
    }

    // 2. Market indicator compatibility
    const polyAllowed = ['prob_deviation', 'time_to_resolution', 'clob_depth', 'volume_spike'];
    for (const trigger of dsl.triggers) {
      if (dsl.market === 'polymarket' && !polyAllowed.includes(trigger.indicator)) {
        errors.push(`Indicator "${trigger.indicator}" is invalid for Polymarket (Polymarket has no technical indicators like RSI).`);
      }
    }

    // 3. Mandatory safety_filter guard for memecoins
    if (dsl.market === 'solana_memecoin') {
      const hasSafety = dsl.guards.some((g) => g.name === 'safety_filter');
      if (!hasSafety) {
        errors.push('MANDATORY GUARD MISSING: solana_memecoin strategy MUST include "safety_filter".');
      }
    }

    // 4. Max notional guard <= hard cap
    const notionalGuard = dsl.guards.find((g) => g.name === 'max_notional_usd');
    const hardCaps = { solana_memecoin: 25, polymarket: 100, perp_binance: 500 };
    const maxCap = hardCaps[dsl.market];

    if (!notionalGuard) {
      errors.push(`MANDATORY GUARD MISSING: strategy MUST include "max_notional_usd" guard.`);
    } else if (Number(notionalGuard.params?.cap) > maxCap) {
      errors.push(`Guard max_notional_usd ${notionalGuard.params?.cap} exceeds market hard cap of $${maxCap}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  saveStrategy(dsl: StrategyDSL): { success: boolean; errors: string[] } {
    const validation = this.validateDSL(dsl);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const idx = this.strategies.findIndex((s) => s.id === dsl.id && s.version === dsl.version);
    if (idx >= 0) {
      this.strategies[idx] = dsl;
    } else {
      this.strategies.push(dsl);
    }
    return { success: true, errors: [] };
  }
}

export const dslEngine = new DSLEngine();
