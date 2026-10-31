import { Market, OrderResult, Quote, SafetyScanResult, Side, UnifiedPosition } from '../../types/unified.ts';
import { BaseAdapter } from './base.ts';

export const SAMPLE_MEMECOINS: Array<{
  name: string;
  symbol: string;
  mint: string;
  priceUsd: number;
  volumeSpike: number;
  rsi1m: number;
  safety: SafetyScanResult;
}> = [
  {
    name: 'Bonk Doge Alpha',
    symbol: 'BDA',
    mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    priceUsd: 0.00042,
    volumeSpike: 1.85,
    rsi1m: 28.5,
    safety: {
      mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      passed: true,
      p_rug: 0.08, // < 0.15 passed
      bundle_pct: 0.22, // < 0.40 passed
      sniper_pct: 0.18, // < 0.30 passed
      top10_holder_pct: 0.34, // < 0.50 passed
      lp_locked: true,
      honeypot: false,
      token_age_hours: 48,
      reasons: [],
      scanned_at: new Date().toISOString(),
    },
  },
  {
    name: 'CatwifHat Turbo',
    symbol: 'CWIF',
    mint: '9n4tpeU8EpRocDeGW9nx5iEkL5dXLa3N212V8gkQpump',
    priceUsd: 0.00185,
    volumeSpike: 2.1,
    rsi1m: 29.0,
    safety: {
      mint: '9n4tpeU8EpRocDeGW9nx5iEkL5dXLa3N212V8gkQpump',
      passed: true,
      p_rug: 0.11,
      bundle_pct: 0.35,
      sniper_pct: 0.24,
      top10_holder_pct: 0.42,
      lp_locked: true,
      honeypot: false,
      token_age_hours: 72,
      reasons: [],
      scanned_at: new Date().toISOString(),
    },
  },
  {
    name: 'Suspicious Moon Rug',
    symbol: 'SMRUG',
    mint: '3kX2badTokenHoneyPotDoNotBuyEver11111111111111',
    priceUsd: 0.054,
    volumeSpike: 4.8,
    rsi1m: 24.0,
    safety: {
      mint: '3kX2badTokenHoneyPotDoNotBuyEver11111111111111',
      passed: false,
      p_rug: 0.68, // RUG RISK DETECTED
      bundle_pct: 0.72, // BUNDLE SNIPED
      sniper_pct: 0.64,
      top10_holder_pct: 0.88,
      lp_locked: false,
      honeypot: true,
      token_age_hours: 4, // < 24h forbidden
      reasons: ['p_rug_exceeded', 'bundle_detected', 'sniper_cluster', 'lp_unlocked', 'honeypot', 'token_too_new'],
      scanned_at: new Date().toISOString(),
    },
  },
];

export class SolanaMemecoinAdapter extends BaseAdapter {
  readonly market: Market = 'solana_memecoin';
  readonly displayName = 'Solana Memecoins (Jupiter + CoinScan)';
  readonly hardCapUsd = 25.0; // STRICT $25 hard cap during demo

  private dailyScansUsed: number = 7;
  private readonly maxDailyScans: number = 25; // Free-tier budget constraint

  async health(): Promise<{ status: 'OK' | 'DEGRADED' | 'DOWN'; latency_ms: number; details: Record<string, any> }> {
    return {
      status: 'OK',
      latency_ms: 110,
      details: {
        router: 'Jupiter v1 (api.jup.ag / lite-api fallback)',
        rpc: 'Helius RPC Node (Free Tier)',
        safety_engine: 'CoinScan SDK Safety Filter',
        daily_scans_quota: `${this.dailyScansUsed} / ${this.maxDailyScans} used`,
        hard_cap_enforced: '$25 per trade',
        max_hold_time: '30 minutes',
        slippage_cap: '300 bps',
      },
    };
  }

  getDailyScansStatus(): { used: number; max: number; remaining: number } {
    return {
      used: this.dailyScansUsed,
      max: this.maxDailyScans,
      remaining: Math.max(0, this.maxDailyScans - this.dailyScansUsed),
    };
  }

  async runSafetyScan(mint: string): Promise<SafetyScanResult> {
    if (this.dailyScansUsed >= this.maxDailyScans) {
      throw new Error(`CoinScanQuotaExceeded: Reached daily free-tier limit of ${this.maxDailyScans} scans.`);
    }
    this.dailyScansUsed += 1;

    const sample = SAMPLE_MEMECOINS.find((m) => m.mint === mint);
    if (sample) {
      return { ...sample.safety, scanned_at: new Date().toISOString() };
    }

    // Default simulation scan
    return {
      mint,
      passed: true,
      p_rug: 0.09,
      bundle_pct: 0.28,
      sniper_pct: 0.19,
      top10_holder_pct: 0.38,
      lp_locked: true,
      honeypot: false,
      token_age_hours: 36,
      reasons: [],
      scanned_at: new Date().toISOString(),
    };
  }

  async getBalanceUsd(): Promise<number> {
    return 420.0; // SOL balance in USD
  }

  async quote(symbol: string, side: Side, notionalUsd: number, metadata: Record<string, any> = {}): Promise<Quote> {
    // Hard cap enforcement
    if (notionalUsd > this.hardCapUsd) {
      throw new Error(`CapExceeded: Requested $${notionalUsd} exceeds Memecoin hard cap of $${this.hardCapUsd}`);
    }

    const token = SAMPLE_MEMECOINS.find((m) => m.symbol === symbol || m.mint === symbol) || SAMPLE_MEMECOINS[0];

    // Check or perform safety filter
    let safetyResult = metadata?.safety as SafetyScanResult | undefined;
    if (!safetyResult) {
      safetyResult = await this.runSafetyScan(token.mint);
    }

    const price = token.priceUsd;
    const size = Number((notionalUsd / price).toFixed(0));
    const exactNotional = Number((price * size).toFixed(2));

    return {
      adapter: this.market,
      symbol: token.symbol,
      side,
      price,
      size,
      notional_usd: exactNotional,
      slippage_bps: 150.0, // <= 300 bps
      metadata: {
        ...metadata,
        token_name: token.name,
        token_mint: token.mint,
        dex: 'Jupiter',
        safety: safetyResult,
        max_hold_minutes: 30,
        volume_spike_multiplier: token.volumeSpike,
        rsi_1m: token.rsi1m,
      },
    };
  }

  async submit(quote: Quote, dryRun: boolean = true): Promise<OrderResult> {
    const orderId = `SOL-${dryRun ? 'SHADOW' : 'TX'}-${Date.now().toString(36).toUpperCase()}`;

    // Assert safety filter passed before proceeding
    if (!quote.metadata?.safety?.passed) {
      return {
        order_id: null,
        status: 'REJECTED',
        filled_size: 0,
        avg_price: null,
        notional_usd: 0,
        raw: {
          error: 'Safety filter rejected token',
          reasons: quote.metadata?.safety?.reasons,
        },
      };
    }

    return {
      order_id: orderId,
      status: 'FILLED',
      filled_size: quote.size,
      avg_price: quote.price,
      notional_usd: quote.notional_usd,
      raw: {
        symbol: quote.symbol,
        token_mint: quote.metadata?.token_mint,
        side: quote.side,
        dex: 'Jupiter',
        dry_run: dryRun,
        priority_fee_micro_lamports: 50000,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async cancel(orderId: string): Promise<boolean> {
    console.log(`[SOLANA MEMECOIN] Order cancel/timeout triggered: ${orderId}`);
    return true;
  }

  async positions(): Promise<UnifiedPosition[]> {
    return [
      {
        id: 'POS-MEME-BDA',
        adapter: 'solana_memecoin',
        symbol: 'BDA',
        side: 'BUY',
        size: 55000,
        entry_price: 0.00041,
        mark_price: 0.00042,
        notional_usd: 23.1, // <= $25
        pnl_usd: 0.55,
        opened_at: new Date(Date.now() - 900000).toISOString(), // 15 mins ago
        strategy_id: 'meme_momentum',
        max_adverse_excursion_usd: -0.85,
      },
    ];
  }
}
