import { Market, UnifiedPosition } from '../../types/unified.ts';
import { BaseAdapter } from './base.ts';
import { PerpBinanceAdapter } from './perpBinance.ts';
import { PolymarketClobAdapter } from './polymarketClob.ts';
import { SolanaMemecoinAdapter } from './solanaMemecoin.ts';

export class AdapterRegistry {
  private adapters: Map<Market, BaseAdapter> = new Map();

  constructor() {
    this.register(new PerpBinanceAdapter());
    this.register(new PolymarketClobAdapter());
    this.register(new SolanaMemecoinAdapter());
  }

  register(adapter: BaseAdapter) {
    this.adapters.set(adapter.market, adapter);
  }

  get(market: Market): BaseAdapter {
    const adapter = this.adapters.get(market);
    if (!adapter) {
      throw new Error(`Unregistered market adapter: ${market}`);
    }
    return adapter;
  }

  getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  async getAllPositions(): Promise<UnifiedPosition[]> {
    const allLists = await Promise.all(this.getAll().map((a) => a.positions()));
    return allLists.flat();
  }

  async checkAllHealth(): Promise<Record<Market, any>> {
    const results: Record<string, any> = {};
    for (const adapter of this.getAll()) {
      results[adapter.market] = await adapter.health();
    }
    return results;
  }
}

export const adapterRegistry = new AdapterRegistry();
