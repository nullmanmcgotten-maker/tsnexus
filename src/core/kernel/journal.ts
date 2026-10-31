import {
  Market,
  OrderStatus,
  ReflectionRecord,
  ShadowPnlRecord,
  StrategyDSL,
  UnifiedOrderRecord,
  UnifiedPosition,
} from '../../types/unified.ts';

const STORAGE_UNIFIED_ORDERS = 'nexus_tonybot_unified_orders_v1';
const STORAGE_UNIFIED_POSITIONS = 'nexus_tonybot_unified_positions_v1';
const STORAGE_UNIFIED_REFLECTIONS = 'nexus_tonybot_unified_reflections_v1';

export class UnifiedJournal {
  private orders: UnifiedOrderRecord[] = [];
  private positions: UnifiedPosition[] = [];
  private reflections: ReflectionRecord[] = [];

  constructor() {
    this.recover();
  }

  recover() {
    try {
      const ords = localStorage.getItem(STORAGE_UNIFIED_ORDERS);
      this.orders = ords ? JSON.parse(ords) : [];

      const pos = localStorage.getItem(STORAGE_UNIFIED_POSITIONS);
      this.positions = pos ? JSON.parse(pos) : [];

      const ref = localStorage.getItem(STORAGE_UNIFIED_REFLECTIONS);
      this.reflections = ref ? JSON.parse(ref) : [];
    } catch {
      this.orders = [];
      this.positions = [];
      this.reflections = [];
    }

    if (this.orders.length === 0) {
      this.seedInitialJournal();
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_UNIFIED_ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_UNIFIED_POSITIONS, JSON.stringify(this.positions));
      localStorage.setItem(STORAGE_UNIFIED_REFLECTIONS, JSON.stringify(this.reflections));
    } catch (e) {
      console.warn('Storage persist error', e);
    }
  }

  private seedInitialJournal() {
    this.orders = [
      {
        id: 'ORD-PERP-8831',
        adapter: 'perp_binance',
        symbol: 'BTCUSDT',
        side: 'BUY',
        notional_usd: 325.1,
        price: 64850.0,
        size: 0.005,
        status: 'FILLED',
        reason_code: 'approved_risk_kernel',
        strategy_id: 'perp_pullback',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3590000).toISOString(),
      },
      {
        id: 'ORD-POLY-9102',
        adapter: 'polymarket',
        symbol: 'POLY-FED-DEC26-CUT',
        side: 'BUY',
        notional_usd: 74.8,
        price: 0.65,
        size: 115,
        status: 'FILLED',
        reason_code: 'clob_maker_quote',
        strategy_id: 'poly_maker',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7190000).toISOString(),
      },
      {
        id: 'ORD-MEME-4421',
        adapter: 'solana_memecoin',
        symbol: 'BDA',
        side: 'BUY',
        notional_usd: 23.1, // <= $25
        price: 0.00041,
        size: 56341,
        status: 'FILLED',
        reason_code: 'safety_passed_volume_spike',
        strategy_id: 'meme_momentum',
        created_at: new Date(Date.now() - 900000).toISOString(),
        updated_at: new Date(Date.now() - 890000).toISOString(),
      },
      {
        id: 'ORD-MEME-4422-REJECT',
        adapter: 'solana_memecoin',
        symbol: 'SMRUG',
        side: 'BUY',
        notional_usd: 25.0,
        price: 0.054,
        size: 462,
        status: 'BLOCKED',
        reason_code: 'safety_filter_failed: p_rug_exceeded, bundle_detected, lp_unlocked',
        strategy_id: 'meme_momentum',
        created_at: new Date(Date.now() - 500000).toISOString(),
        updated_at: new Date(Date.now() - 500000).toISOString(),
      },
    ];

    this.reflections = [
      {
        id: 'REFL-INIT-01',
        trade_id: 'SHADOW-MEME-302',
        market: 'solana_memecoin',
        loss_usd: -0.96,
        diagnosis: 'Intraday slippage expansion caused entry price slippage of 180 bps.',
        param_changed: 'stop_loss_multiplier',
        old_value: 2.0,
        new_value: 1.75,
        proposed_strategy_version: 'meme_momentum_v2',
        backtest_win_rate: 57.2,
        backtest_sharpe: 1.71,
        accepted: true,
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ];

    this.persist();
  }

  getOrders(): UnifiedOrderRecord[] {
    return [...this.orders];
  }

  recordOrder(order: UnifiedOrderRecord) {
    const idx = this.orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      this.orders[idx] = order;
    } else {
      this.orders.unshift(order);
    }
    this.persist();
  }

  updateOrderStatus(orderId: string, status: OrderStatus, reason?: string) {
    const ord = this.orders.find((o) => o.id === orderId);
    if (ord) {
      ord.status = status;
      if (reason) ord.reason_code = reason;
      ord.updated_at = new Date().toISOString();
      this.persist();
    }
  }

  getReflections(): ReflectionRecord[] {
    return [...this.reflections];
  }

  recordReflection(refl: ReflectionRecord) {
    this.reflections.unshift(refl);
    this.persist();
  }
}

export const unifiedJournal = new UnifiedJournal();
