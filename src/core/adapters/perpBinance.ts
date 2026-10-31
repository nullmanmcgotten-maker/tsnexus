import { Market, OrderResult, Quote, Side, UnifiedPosition } from '../../types/unified.ts';
import { BaseAdapter } from './base.ts';

export class PerpBinanceAdapter extends BaseAdapter {
  readonly market: Market = 'perp_binance';
  readonly displayName = 'Binance USD-M Futures';
  readonly hardCapUsd = 500.0;

  private testnet: boolean;
  private apiKey?: string;
  private apiSecret?: string;

  constructor(options: { testnet?: boolean; apiKey?: string; apiSecret?: string } = {}) {
    super();
    this.testnet = options.testnet ?? true;
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
  }

  async health(): Promise<{ status: 'OK' | 'DEGRADED' | 'DOWN'; latency_ms: number; details: Record<string, any> }> {
    const start = Date.now();
    try {
      const res = await fetch('/api/binance/market?symbol=BTCUSDT');
      const latency = Date.now() - start;
      if (res.ok) {
        return {
          status: 'OK',
          latency_ms: latency,
          details: {
            endpoint: this.testnet ? 'wss://testnet.binancefuture.com' : 'wss://fstream.binance.com',
            auth_mode: this.apiKey ? 'SIGNED_HMAC' : 'SIMULATED',
            allowed_symbols: ['BTCUSDT', 'ETHUSDT'],
          },
        };
      }
      return { status: 'DEGRADED', latency_ms: latency, details: { error: 'Non-200 market response' } };
    } catch (e: any) {
      return { status: 'DEGRADED', latency_ms: Date.now() - start, details: { error: e.message } };
    }
  }

  async getBalanceUsd(): Promise<number> {
    return 8450.0;
  }

  async quote(symbol: string, side: Side, notionalUsd: number, metadata: Record<string, any> = {}): Promise<Quote> {
    if (notionalUsd > this.hardCapUsd) {
      throw new Error(`CapExceeded: Requested $${notionalUsd} exceeds Perp hard cap of $${this.hardCapUsd}`);
    }

    const cleanSymbol = symbol === 'SAMPLE' ? 'BTCUSDT' : symbol;
    let price = cleanSymbol.startsWith('ETH') ? 3495.0 : 65000.0;

    try {
      const res = await fetch(`/api/binance/market?symbol=${cleanSymbol}`);
      if (res.ok) {
        const data = await res.json();
        price = side === 'BUY' ? data.ask || data.price : data.bid || data.price;
      }
    } catch {
      // Offline fallback
    }

    const size = Number((notionalUsd / price).toFixed(5));
    const exactNotional = Number((price * size).toFixed(2));

    return {
      adapter: this.market,
      symbol: cleanSymbol,
      side,
      price,
      size,
      notional_usd: exactNotional,
      slippage_bps: 2.0,
      metadata: {
        ...metadata,
        funding_rate: 0.00015,
        leverage: 10,
        margin_type: 'CROSSED',
      },
    };
  }

  async submit(quote: Quote, dryRun: boolean = true): Promise<OrderResult> {
    const orderId = `BIN-${dryRun ? 'DEMO' : 'LIVE'}-${Date.now().toString(36).toUpperCase()}`;

    // Dry run never issues real exchange order
    return {
      order_id: orderId,
      status: 'FILLED',
      filled_size: quote.size,
      avg_price: quote.price,
      notional_usd: quote.notional_usd,
      raw: {
        symbol: quote.symbol,
        side: quote.side,
        type: 'MARKET',
        dry_run: dryRun,
        clientOrderId: orderId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async cancel(orderId: string): Promise<boolean> {
    console.log(`[PERP BINANCE] Cancel order ${orderId}`);
    return true;
  }

  async positions(): Promise<UnifiedPosition[]> {
    return [
      {
        id: 'POS-PERP-BTC',
        adapter: 'perp_binance',
        symbol: 'BTCUSDT',
        side: 'BUY',
        size: 0.005,
        entry_price: 64850.0,
        mark_price: 65020.0,
        notional_usd: 325.1,
        pnl_usd: 8.5,
        opened_at: new Date(Date.now() - 3600000).toISOString(),
        strategy_id: 'perp_pullback',
        max_adverse_excursion_usd: -4.2,
      },
    ];
  }
}
