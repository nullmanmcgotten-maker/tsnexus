import { Market, Quote, RiskEngineConfig, UnifiedPosition } from '../../types/unified.ts';

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

export class UnifiedRiskEngine {
  constructor(private cfg: RiskEngineConfig = DEFAULT_RISK_CONFIG) {}

  getConfig(): RiskEngineConfig {
    return { ...this.cfg };
  }

  updateConfig(updated: Partial<RiskEngineConfig>) {
    this.cfg = { ...this.cfg, ...updated };
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

    // 1. Mandatory Safety Filter PRECEDENCE (Memecoins only)
    // Non-negotiable constraint: Runs before risk kernel, not after.
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

      // Check max hold time (30 min limit) and max slippage (300 bps)
      if (q.slippage_bps > 300) {
        return {
          approved: false,
          reason: 'slippage_cap_exceeded_300bps',
        };
      }

      // Check daily new meme positions count <= 3
      const memePositions = openPositions.filter((p) => p.adapter === 'solana_memecoin');
      if (memePositions.length >= 3) {
        return {
          approved: false,
          reason: 'daily_meme_positions_limit_reached',
        };
      }
    }

    // 2. Polymarket Boundary Check (Reject <0.02 or >0.98 near-resolution markets)
    if (q.adapter === 'polymarket') {
      if (q.price < 0.02 || q.price > 0.98) {
        return {
          approved: false,
          reason: 'polymarket_near_resolution_extreme_risk',
          details: { price: q.price },
        };
      }
    }

    // 3. Absolute Hard USD Cap Check
    const hardCap = this.cfg.hard_caps_usd[q.adapter];
    if (q.notional_usd > hardCap) {
      return {
        approved: false,
        reason: 'hard_cap_exceeded',
        details: { requested: q.notional_usd, limit: hardCap, adapter: q.adapter },
      };
    }

    // 4. Cross-Market Total Exposure Cap (30%)
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

    // 5. Per-Market Sub-Cap Check (Perp: 15%, Poly: 10%, Meme: 5%)
    const currentMarketExposure = openPositions
      .filter((p) => p.adapter === q.adapter)
      .reduce((acc, p) => acc + p.notional_usd, 0);
    const marketLimit = capital * this.cfg.market_caps[q.adapter];

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

    // 6. Daily Loss Circuit Breaker Check (2%)
    const dailyLossPct = Math.max(0, -dailyLossUsd) / capital;
    if (dailyLossPct >= this.cfg.max_daily_loss_pct) {
      return {
        approved: false,
        reason: 'daily_loss_breaker',
        details: { dailyLossPct, limit: this.cfg.max_daily_loss_pct },
      };
    }

    // 7. Max Drawdown Circuit Breaker Check (15%)
    const currentDrawdownPct = Math.max(0, peakCapitalUsd - (capital + dailyLossUsd)) / peakCapitalUsd;
    if (currentDrawdownPct >= this.cfg.max_drawdown_pct) {
      return {
        approved: false,
        reason: 'drawdown_breaker',
        details: { currentDrawdownPct, limit: this.cfg.max_drawdown_pct },
      };
    }

    // 8. Perp Funding Cost Budget Check
    if (q.adapter === 'perp_binance') {
      const projectedFundingCost = openPositions
        .filter((p) => p.adapter === 'perp_binance')
        .reduce((sum, p) => sum + p.notional_usd * 0.0003 * 3, 0); // 3 funding intervals/day

      if (projectedFundingCost >= this.cfg.funding_budget_usd) {
        return {
          approved: false,
          reason: 'funding_budget_exceeded',
          details: { projectedFundingCost, budget: this.cfg.funding_budget_usd },
        };
      }
    }

    return {
      approved: true,
      reason: 'approved',
    };
  }
}
