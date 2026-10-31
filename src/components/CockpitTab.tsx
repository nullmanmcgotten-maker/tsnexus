import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Zap,
  BarChart2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { MarketSnapshot, TradeApproval, Settings } from '../types/nexus.ts';
import {
  classifyRegime,
  regimeScore,
  orderFlowSignal,
  liquidityScore,
  generateTradePlan,
} from '../engine/nexusLogic.ts';

interface CockpitTabProps {
  snapshot: MarketSnapshot;
  onUpdateSnapshot: (updated: Partial<MarketSnapshot>) => void;
  settings: Settings;
  onRunPlanApproval: (approval: TradeApproval) => void;
  latestApproval: TradeApproval | null;
}

export const CockpitTab: React.FC<CockpitTabProps> = ({
  snapshot,
  onUpdateSnapshot,
  settings,
  onRunPlanApproval,
  latestApproval,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(snapshot.symbol);
  const [isSimulatingTicks, setIsSimulatingTicks] = useState(false);

  const regime = classifyRegime(snapshot);
  const regScore = regimeScore(snapshot);
  const flow = orderFlowSignal(snapshot);
  const liqScore = liquidityScore(snapshot);

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    if (sym === 'BTCUSDT') {
      onUpdateSnapshot({
        symbol: 'BTCUSDT',
        price: 65000.0,
        bid: 64998.0,
        ask: 65002.0,
        spread_bps: 0.6,
        atr: 1200.0,
        adx: 33.0,
        trend_strength: 0.82,
        volatility_pct: 0.94,
        volume: 2400000,
        funding_rate: 0.00018,
        open_interest: 58000000,
        oi_change_pct: 3.2,
        delta_imbalance: 0.42,
        cumulative_volume_delta: 120000,
        taker_buy_sell_ratio: 1.18,
        vwap_distance_pct: 0.12,
        bb_width_pct: 0.11,
        rsi: 58,
        higher_tf_bias: 'bullish',
        session_quality: 0.78,
        liquidity_score: 0.8,
        depth_usd: 250000,
        sentiment_score: 0.72,
      });
    } else if (sym === 'ETHUSDT') {
      onUpdateSnapshot({
        symbol: 'ETHUSDT',
        price: 3495.0,
        bid: 3494.5,
        ask: 3495.5,
        spread_bps: 1.2,
        atr: 65.0,
        adx: 29.5,
        trend_strength: 0.75,
        volatility_pct: 1.1,
        volume: 1200000,
        funding_rate: 0.00012,
        open_interest: 24000000,
        oi_change_pct: 1.8,
        delta_imbalance: 0.28,
        cumulative_volume_delta: 45000,
        taker_buy_sell_ratio: 1.12,
        vwap_distance_pct: -0.05,
        bb_width_pct: 0.13,
        rsi: 54,
        higher_tf_bias: 'bullish',
        session_quality: 0.7,
        liquidity_score: 0.75,
        depth_usd: 180000,
        sentiment_score: 0.65,
      });
    } else if (sym === 'SOLUSDT') {
      onUpdateSnapshot({
        symbol: 'SOLUSDT',
        price: 182.5,
        bid: 182.45,
        ask: 182.55,
        spread_bps: 2.1,
        atr: 5.8,
        adx: 24.0,
        trend_strength: 0.52,
        volatility_pct: 1.8,
        volume: 980000,
        funding_rate: -0.00025,
        open_interest: 15000000,
        oi_change_pct: -2.1,
        delta_imbalance: -0.35,
        cumulative_volume_delta: -68000,
        taker_buy_sell_ratio: 0.81,
        vwap_distance_pct: -0.4,
        bb_width_pct: 0.18,
        rsi: 42,
        higher_tf_bias: 'bearish',
        session_quality: 0.65,
        liquidity_score: 0.68,
        depth_usd: 140000,
        sentiment_score: 0.48,
      });
    }
  };

  const handleRunApproval = () => {
    const approval = generateTradePlan(
      snapshot,
      settings.account_capital,
      settings.max_risk_per_trade,
      1.8
    );
    onRunPlanApproval(approval);
  };

  const simulateMarketTick = () => {
    const delta = (Math.random() - 0.48) * (snapshot.price * 0.0008);
    const newPrice = Number((snapshot.price + delta).toFixed(2));
    const spread = (newPrice * snapshot.spread_bps) / 10000;
    const newBid = Number((newPrice - spread / 2).toFixed(2));
    const newAsk = Number((newPrice + spread / 2).toFixed(2));
    const newImbalance = Number(
      Math.max(-0.8, Math.min(0.8, snapshot.delta_imbalance + (Math.random() - 0.5) * 0.15)).toFixed(2)
    );

    onUpdateSnapshot({
      price: newPrice,
      bid: newBid,
      ask: newAsk,
      delta_imbalance: newImbalance,
      cumulative_volume_delta: snapshot.cumulative_volume_delta + Math.round((Math.random() - 0.45) * 5000),
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Asset Selector, Live Price, and Fast Action */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-[#0b0e14] p-1 rounded-md border border-slate-800">
            {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((sym) => (
              <button
                key={sym}
                onClick={() => handleSymbolChange(sym)}
                className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  selectedSymbol === sym
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

          <div>
            <div className="text-[11px] font-mono text-slate-400">MID PRICE</div>
            <div className="text-xl font-bold font-mono text-emerald-400 tracking-tight flex items-baseline gap-2">
              ${snapshot.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400">
                Bid: ${snapshot.bid.toLocaleString()} / Ask: ${snapshot.ask.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={simulateMarketTick}
            className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Simulate a real-time price tick and micro-flow shift"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Simulate Tick
          </button>

          <button
            onClick={handleRunApproval}
            className="px-4 py-1.5 text-xs font-mono font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950 flex items-center gap-2 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Evaluate Trade Gates
          </button>
        </div>
      </div>

      {/* Grid of 6 Key Microstructure & Regime Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Regime Classification */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>CLASSIFIED REGIME</span>
            <span className="text-slate-500">nexus_engine/market_regime.py</span>
          </div>
          <div className="flex items-center justify-between">
            <span
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wide border ${
                regime === 'trend_up'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : regime === 'trend_down'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : regime === 'volatility_compression'
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
            >
              {regime.replace('_', ' ')}
            </span>
            <span className="text-sm font-mono text-slate-300">
              Score: <span className="font-bold text-white">{(regScore * 100).toFixed(0)}%</span>
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>ADX (Trend Strength):</span>
              <span className="text-slate-200">{snapshot.adx.toFixed(1)} ({snapshot.trend_strength.toFixed(2)})</span>
            </div>
            <div className="flex justify-between">
              <span>Macro TF Bias:</span>
              <span className={`uppercase font-semibold ${snapshot.higher_tf_bias === 'bullish' ? 'text-emerald-400' : snapshot.higher_tf_bias === 'bearish' ? 'text-rose-400' : 'text-slate-400'}`}>
                {snapshot.higher_tf_bias}
              </span>
            </div>
          </div>
        </div>

        {/* Spread & Depth Gate */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>EXECUTION FRICTION &amp; DEPTH</span>
            <span className="text-slate-500">Gate &lt;= 4.0 bps</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold font-mono text-white">
                {snapshot.spread_bps.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">bps</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {snapshot.spread_bps <= 3.0 ? (
                  <span className="text-emerald-400">Acceptable Spread</span>
                ) : snapshot.spread_bps <= 4.0 ? (
                  <span className="text-amber-400">Elevated Spread</span>
                ) : (
                  <span className="text-rose-400 font-bold">VETO: Spread &gt; 4 bps</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold font-mono text-white">
                ${(snapshot.depth_usd / 1000).toFixed(0)}k
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {snapshot.depth_usd >= 100000 ? (
                  <span className="text-emerald-400">Depth Cleared (&gt;$100k)</span>
                ) : (
                  <span className="text-rose-400 font-bold">VETO: Insufficient Depth</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full ${
                snapshot.spread_bps <= 3 ? 'bg-emerald-500' : snapshot.spread_bps <= 4 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, (snapshot.spread_bps / 5.0) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Orderflow Microstructure */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>ORDERFLOW &amp; DELTA</span>
            <span className="text-slate-500">Aggressor Bias</span>
          </div>
          <div className="flex items-center justify-between">
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${
                flow.direction === 'bullish'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : flow.direction === 'bearish'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {flow.direction} flow ({flow.score.toFixed(2)})
            </span>
            <span className="text-xs font-mono text-slate-300">
              Taker R: <span className="font-bold text-white">{snapshot.taker_buy_sell_ratio.toFixed(2)}</span>
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Delta Imbalance:</span>
              <span className={snapshot.delta_imbalance >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {snapshot.delta_imbalance > 0 ? '+' : ''}{snapshot.delta_imbalance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cumulative Vol Delta (CVD):</span>
              <span className="text-slate-200">{snapshot.cumulative_volume_delta.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Perp Funding & Open Interest */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>PERPETUAL MARKET STRUCTURE</span>
            <span className="text-slate-500">Crowding &amp; Basis</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-mono">Funding 8h</div>
              <div className="text-base font-bold font-mono text-white">
                {(snapshot.funding_rate * 100).toFixed(4)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-mono">OI Change 24h</div>
              <div className={`text-base font-bold font-mono ${snapshot.oi_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {snapshot.oi_change_pct > 0 ? '+' : ''}{snapshot.oi_change_pct.toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono">
            {snapshot.funding_rate > 0.0006 ? (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Crowded Long Funding (Veto Risk)
              </span>
            ) : (
              <span className="text-emerald-400">Funding within normal equilibrium</span>
            )}
          </div>
        </div>

        {/* Volatility & Momentum */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>VOLATILITY &amp; OSCILLATORS</span>
            <span className="text-slate-500">Compression Check</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="bg-[#0b0e14] p-1.5 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400">RSI 14</div>
              <div className="text-sm font-bold text-white">{snapshot.rsi}</div>
            </div>
            <div className="bg-[#0b0e14] p-1.5 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400">BB Width</div>
              <div className="text-sm font-bold text-white">{(snapshot.bb_width_pct * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-[#0b0e14] p-1.5 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400">Vol Pct</div>
              <div className="text-sm font-bold text-white">{(snapshot.volatility_pct * 100).toFixed(0)}%</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono flex justify-between">
            <span>ATR: ${snapshot.atr.toFixed(1)}</span>
            <span>VWAP Dist: {(snapshot.vwap_distance_pct * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* Session Quality & Liquidity */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>SESSION QUALITY SCORE</span>
            <span className="text-slate-500">Minimum 0.35</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold font-mono text-emerald-400">
              {(snapshot.session_quality * 100).toFixed(0)}%
            </div>
            <div className="text-right text-xs font-mono text-slate-300">
              Composite Liq: <span className="font-bold text-white">{(liqScore * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="mt-2 text-xs font-mono">
            {snapshot.session_quality < 0.35 ? (
              <span className="text-rose-400 font-semibold">VETO: Weak off-peak session</span>
            ) : (
              <span className="text-emerald-400">Peak trading volume session</span>
            )}
          </div>
        </div>
      </div>

      {/* Engine Gate Evaluation Result Banner */}
      {latestApproval && (
        <div
          className={`p-4 rounded-lg border font-mono ${
            latestApproval.approved
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {latestApproval.approved ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  {latestApproval.approved
                    ? `SIGNAL APPROVED FOR EXECUTION: ${latestApproval.trade?.side.toUpperCase()} ${latestApproval.trade?.symbol}`
                    : 'SIGNAL VETOED BY NEXUS MANDATORY GATES'}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {latestApproval.approved
                    ? `Cleared all 14 regime, orderflow, spread, and risk checks. Composite Score: ${latestApproval.trade?.score}`
                    : `Engine blocked order dispatch due to ${latestApproval.veto_reasons.length} mandatory veto condition(s).`}
                </p>
              </div>
            </div>

            {latestApproval.approved && latestApproval.trade && (
              <div className="text-right">
                <span className="text-xs text-slate-400">Target R:R</span>
                <div className="text-base font-bold text-emerald-400">
                  {(
                    Math.abs(latestApproval.trade.target - latestApproval.trade.entry) /
                    Math.abs(latestApproval.trade.entry - latestApproval.trade.stop)
                  ).toFixed(2)}
                  R
                </div>
              </div>
            )}
          </div>

          {/* Trade Details if approved */}
          {latestApproval.approved && latestApproval.trade && (
            <div className="mt-4 pt-3 border-t border-emerald-800/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Entry Target:</span>
                <div className="text-white font-bold">${latestApproval.trade.entry.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-400">Stop Loss:</span>
                <div className="text-rose-400 font-bold">${latestApproval.trade.stop.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-400">Take Profit:</span>
                <div className="text-emerald-400 font-bold">${latestApproval.trade.target.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-400">Position Size:</span>
                <div className="text-cyan-300 font-bold">{latestApproval.trade.position_units} units</div>
              </div>
            </div>
          )}

          {/* Veto reasons if rejected */}
          {!latestApproval.approved && latestApproval.veto_reasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-rose-800/40">
              <span className="text-xs text-rose-300 font-semibold">Active Veto Reason Codes:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {latestApproval.veto_reasons.map((vr) => (
                  <span
                    key={vr}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-900/60 text-rose-200 border border-rose-700/60"
                  >
                    {vr}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
