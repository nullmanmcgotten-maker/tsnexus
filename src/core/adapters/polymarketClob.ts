import { Market, OrderResult, Quote, Side, UnifiedPosition } from '../../types/unified.ts';
import { BaseAdapter } from './base.ts';

export interface PolymarketEvent {
  token_id: string;
  question: string;
  category: string;
  midpoint: number;
  best_bid: number;
  best_ask: number;
  volume_24h: number;
  resolution_date: string;
  liquidity_score: number;
}

export const SAMPLE_POLY_MARKETS: PolymarketEvent[] = [
  {
    token_id: 'POLY-FED-DEC26-CUT',
    question: 'Fed cuts interest rates at next FOMC meeting?',
    category: 'Macroeconomics',
    midpoint: 0.68,
    best_bid: 0.67,
    best_ask: 0.69,
    volume_24h: 3450000,
    resolution_date: '2026-12-18T18:00:00Z',
    liquidity_score: 0.92,
  },
  {
    token_id: 'POLY-BTC-100K-EOY',
    question: 'Bitcoin touches $100,000 before year-end?',
    category: 'Crypto',
    midpoint: 0.42,
    best_bid: 0.41,
    best_ask: 0.43,
    volume_24h: 6890000,
    resolution_date: '2026-12-31T23:59:59Z',
    liquidity_score: 0.95,
  },
  {
    token_id: 'POLY-SOL-ATH-Q4',
    question: 'Solana breaks All-Time High in Q4?',
    category: 'Crypto',
    midpoint: 0.55,
    best_bid: 0.54,
    best_ask: 0.56,
    volume_24h: 1820000,
    resolution_date: '2026-12-31T23:59:59Z',
    liquidity_score: 0.88,
  },
];

export class PolymarketClobAdapter extends BaseAdapter {
  readonly market: Market = 'polymarket';
  readonly displayName = 'Polymarket CLOB (Prediction)';
  readonly hardCapUsd = 100.0;

  private l1WalletConfigured: boolean = true;
  private l2HmacKey: string = 'derived_eip712_clob_creds_v2';

  async health(): Promise<{ status: 'OK' | 'DEGRADED' | 'DOWN'; latency_ms: number; details: Record<string, any> }> {
    return {
      status: 'OK',
      latency_ms: 68,
      details: {
        host: 'https://clob.polymarket.com',
        chain_id: 137, // Polygon
        auth: 'L1 EIP-712 + L2 HMAC-SHA256 (Read-Only Demo)',
        active_markets_tracked: SAMPLE_POLY_MARKETS.length,
        allowed_orders: ['GTC', 'GTD'],
      },
    };
  }

  async getBalanceUsd(): Promise<number> {
    return 1250.0; // USDC
  }

  async quote(symbol: string, side: Side, notionalUsd: number, metadata: Record<string, any> = {}): Promise<Quote> {
    if (notionalUsd > this.hardCapUsd) {
      throw new Error(`CapExceeded: Requested $${notionalUsd} exceeds Polymarket hard cap of $${this.hardCapUsd}`);
    }

    const marketEvent =
      SAMPLE_POLY_MARKETS.find((m) => m.token_id === symbol) || SAMPLE_POLY_MARKETS[0];
    const price = side === 'BUY' ? marketEvent.best_ask : marketEvent.best_bid;

    if (price < 0.02 || price > 0.98) {
      throw new Error(`ExtremePriceRisk: Polymarket price ${price} outside allowed 0.02-0.98 band.`);
    }

    // notional_usd = price * size
    const size = Number((notionalUsd / price).toFixed(2));
    const exactNotional = Number((price * size).toFixed(2));

    return {
      adapter: this.market,
      symbol: marketEvent.token_id,
      side,
      price,
      size,
      notional_usd: exactNotional,
      slippage_bps: 10.0,
      metadata: {
        ...metadata,
        market_title: marketEvent.question,
        category: marketEvent.category,
        clob_midpoint: marketEvent.midpoint,
        resolution_date: marketEvent.resolution_date,
        liquidity_score: marketEvent.liquidity_score,
        order_type: 'GTC', // Good-till-cancelled limit
      },
    };
  }

  async submit(quote: Quote, dryRun: boolean = true): Promise<OrderResult> {
    const orderId = `POLY-${dryRun ? 'SHADOW' : 'GTC'}-${Date.now().toString(36).toUpperCase()}`;

    // Dry run intercepts before network call
    return {
      order_id: orderId,
      status: 'FILLED',
      filled_size: quote.size,
      avg_price: quote.price,
      notional_usd: quote.notional_usd,
      raw: {
        token_id: quote.symbol,
        side: quote.side,
        price: quote.price,
        size: quote.size,
        order_type: 'GTC',
        dry_run: dryRun,
        auth_sig: 'EIP712_INTERCEPTED',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async cancel(orderId: string): Promise<boolean> {
    console.log(`[POLYMARKET CLOB] GTC limit order cancelled: ${orderId}`);
    return true;
  }

  async positions(): Promise<UnifiedPosition[]> {
    return [
      {
        id: 'POS-POLY-FED',
        adapter: 'polymarket',
        symbol: 'POLY-FED-DEC26-CUT',
        side: 'BUY',
        size: 110.0,
        entry_price: 0.65,
        mark_price: 0.68,
        notional_usd: 74.8,
        pnl_usd: 3.3,
        opened_at: new Date(Date.now() - 7200000).toISOString(),
        strategy_id: 'poly_maker',
        max_adverse_excursion_usd: -1.2,
      },
    ];
  }
}
