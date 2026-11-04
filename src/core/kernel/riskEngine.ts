import { Quote, RiskEngineConfig, UnifiedPosition } from '../../types/unified.ts';

export const DEFAULT_RISK_CONFIG: RiskEngineConfig = {
  total_capital_usd: 10000.0,
  max_total_exposure_pct: 0.3, // 30% total portfolio exposure cap
  market_caps: {
    perp_binance: 0.15, // 15% sub-cap
    polymarket: 0.1, // 10% sub-cap
    solana_memecoin: 0.05, // 5% sub-cap
  },
  max_daily_loss_pct: 0.02, // 2% daily loss breaker
  max_drawdown_pct: 0.15, // 15% max drawdown breaker
  hard_caps_usd: {
    solana_memecoin: 25.0, // Non-negotiable $25 hard cap during demo
    polymarket: 100.0, // $100 hard cap
    perp_binance: 500.0, // $500 hard cap
  },
  funding_budget_usd: 30.0, // $30 projected daily funding budget
};

// Keep the documented limits immutable even if a caller holds a reference to defaults.
Object.freeze(DEFAULT_RISK_CONFIG.market_caps);
Object.freeze(DEFAULT_RISK_CONFIG.hard_caps_usd);
Object.freeze(DEFAULT_RISK_CONFIG);

const cloneConfig = (config: RiskEngineConfig): RiskEngineConfig => ({
  ...config,
  market_caps: { ...config.market_caps },
  hard_caps_usd: { ...config.hard_caps_usd },
});

export class UnifiedRiskEngine {
  private cfg: RiskEngineConfig;

  constructor(config: RiskEngineConfig = DEFAULT_RISK_CONFIG) {
    this.cfg = cloneConfig(config);
  }

  getConfig(): RiskEngineConfig {
    return cloneConfig(this.cfg);
  }

  updateConfig(updated: Partial<RiskEngineConfig>): void {
    const next = { ...this.cfg, ...updated };
    const validatePositiveNumber = (name: string, value: number, max?: number) => {
      if (!Number.isFinite(value) || value <= 0 || (max !== undefined && value > max)) {
        throw new RangeError(`${name} must be finite, positive${max === undefined ? '' : `, and no greater than ${max}`}`);
      }
    };

    validatePositiveNumber('total_capital_usd', next.total_capital_usd);
    validatePositiveNumber('max_total_exposure_pct', next.max_total_exposure_pct, DEFAULT_RISK_CONFIG.max_total_exposure_pct);
    validatePositiveNumber('max_daily_loss_pct', next.max_daily_loss_pct, DEFAULT_RISK_CONFIG.max_daily_loss_pct);
    validatePositiveNumber('max_drawdown_pct', next.max_drawdown_pct, DEFAULT_RISK_CONFIG.max_drawdown_pct);
    validatePositiveNumber('funding_budget_usd', next.funding_budget_usd, DEFAULT_RISK_CONFIG.funding_budget_usd);

    for (const [adapter, limit] of Object.entries(next.market_caps)) {
      const documentedLimit = DEFAULT_RISK_CONFIG.market_caps[adapter as keyof typeof DEFAULT_RISK_CONFIG.market_caps];
      if (documentedLimit === undefined) throw new RangeError(`Unknown market cap adapter: ${adapter}`);
      validatePositiveNumber(`market_caps.${adapter}`, limit, documentedLimit);
    }
    for (const [adapter, limit] of Object.entries(next.hard_caps_usd)) {
      const documentedLimit = DEFAULT_RISK_CONFIG.hard_caps_usd[adapter as keyof typeof DEFAULT_RISK_CONFIG.hard_caps_usd];
      if (documentedLimit === undefined) throw new RangeError(`Unknown hard cap adapter: ${adapter}`);
      validatePositiveNumber(`hard_caps_usd.${adapter}`, limit, documentedLimit);
    }

    this.cfg = cloneConfig({
      ...next,
      market_caps: { ...this.cfg.market_caps, ...updated.market_caps },
      hard_caps_usd: { ...this.cfg.hard_caps_usd, ...updated.hard_caps_usd },
    });
  }

  /**
   * Authoritative gate check for ANY market quote.
   * Single source of "no".
   */
  async gate(
    q: Quote,
    openPositions: UnifiedPosition[],
    dailyLossUsd: number,
    peakCapitalUsd: number = this.cfg.total_capital_usd
  ): Promise<{ approved: boolean; reason: string; details?: Record<string, any> }> {
    const capital = this.cfg.total_capital_usd;

    // Unknown adapters must never bypass caps due to undefined comparisons.
    const hardCap = this.cfg.hard_caps_usd[q.adapter];
    const marketCapPct = this.cfg.market_caps[q.adapter];
    if (hardCap === undefined || marketCapPct === undefined) {
      return { approved: false, reason: 'unknown_adapter_fail_closed' };
    }

    // 1. Mandatory Safety Filter PRECEDENCE (Memecoins only)
    if (q.adapter === 'solana_memecoin') {
      const safety = q.metadata?.safety;
      if (!safety || !safety.passed) {
        const failReasons = safety?.reasons?.join(', ') || 'safety_scan_missing';
        return {
          approved: false,
          reason: `safety_filter_failed: ${failReasons}`,
          details: { safety },
        };
      }

      if (q.slippage_bps > 300) {
        return { approved: false, reason: 'slippage_cap_exceeded_300bps' };
      }

      const memePositions = openPositions.filter((p) => p.adapter === 'solana_memecoin');
      if (memePositions.length >= 3) {
        return { approved: false, reason: 'daily_meme_positions_limit_reached' };
      }
    }

    if (q.adapter === 'polymarket' && (q.price < 0.02 || q.price > 0.98)) {
      return {
        approved: false,
        reason: 'polymarket_near_resolution_extreme_risk',
        details: { price: q.price },
      };
    }

    if (q.notional_usd > hardCap) {
      return {
        approved: false,
        reason: 'hard_cap_exceeded',
        details: { requested: q.notional_usd, limit: hardCap, adapter: q.adapter },
      };
    }

    const currentTotalExposure = openPositions.reduce((acc, p) => acc + p.notional_usd, 0);
    if (currentTotalExposure + q.notional_usd > capital * this.cfg.max_total_exposure_pct) {
      return {
        approved: false,
        reason: 'total_exposure_cap',
        details: {
          current: currentTotalExposure,
          requested: q.notional_usd,
          limit: capital * this.cfg.max_total_exposure_pct,
        },
      };
    }

    const currentMarketExposure = openPositions
      .filter((p) => p.adapter === q.adapter)
      .reduce((acc, p) => acc + p.notional_usd, 0);
    const marketLimit = capital * marketCapPct;

    if (currentMarketExposure + q.notional_usd > marketLimit) {
      return {
        approved: false,
        reason: 'market_cap_exceeded',
        details: {
          adapter: q.adapter,
          current: currentMarketExposure,
          requested: q.notional_usd,
          limit: marketLimit,
        },
      };
    }

    const dailyLossPct = Math.max(0, -dailyLossUsd) / capital;
    if (dailyLossPct >= this.cfg.max_daily_loss_pct) {
      return {
        approved: false,
        reason: 'daily_loss_breaker',
        details: { dailyLossPct, limit: this.cfg.max_daily_loss_pct },
      };
    }

    const currentDrawdownPct = Math.max(0, peakCapitalUsd - (capital + dailyLossUsd)) / peakCapitalUsd;
    if (currentDrawdownPct >= this.cfg.max_drawdown_pct) {
      return {
        approved: false,
        reason: 'drawdown_breaker',
        details: { currentDrawdownPct, limit: this.cfg.max_drawdown_pct },
      };
    }

    if (q.adapter === 'perp_binance') {
      const projectedFundingCost = openPositions
        .filter((p) => p.adapter === 'perp_binance')
        .reduce((sum, p) => sum + p.notional_usd * 0.0003 * 3, 0);

      if (projectedFundingCost >= this.cfg.funding_budget_usd) {
        return {
          approved: false,
          reason: 'funding_budget_exceeded',
          details: { projectedFundingCost, budget: this.cfg.funding_budget_usd },
        };
      }
    }

    return { approved: true, reason: 'approved' };
  }
}
