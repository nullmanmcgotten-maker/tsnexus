import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  PowerOff,
  Coins,
  Scale,
  TrendingUp,
  Sliders,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { RiskEngineConfig, UnifiedPosition } from '../../types/unified.ts';
import { UnifiedRiskEngine } from '../../core/kernel/riskEngine.ts';

interface RiskKernelTabProps {
  riskEngine: UnifiedRiskEngine;
  positions: UnifiedPosition[];
  dailyLossTripped: boolean;
  onToggleTripDailyLoss: () => void;
  onClosePosition: (id: string) => void;
  onUpdateRiskConfig: (cfg: Partial<RiskEngineConfig>) => void;
}

export const RiskKernelTab: React.FC<RiskKernelTabProps> = ({
  riskEngine,
  positions,
  dailyLossTripped,
  onToggleTripDailyLoss,
  onClosePosition,
  onUpdateRiskConfig,
}) => {
  const cfg = riskEngine.getConfig();

  const totalExposureUsd = positions.reduce((sum, p) => sum + p.notional_usd, 0);
  const totalExposurePct = (totalExposureUsd / cfg.total_capital_usd) * 100;

  const memeExposureUsd = positions
    .filter((p) => p.adapter === 'solana_memecoin')
    .reduce((sum, p) => sum + p.notional_usd, 0);

  const polyExposureUsd = positions
    .filter((p) => p.adapter === 'polymarket')
    .reduce((sum, p) => sum + p.notional_usd, 0);

  const perpExposureUsd = positions
    .filter((p) => p.adapter === 'perp_binance')
    .reduce((sum, p) => sum + p.notional_usd, 0);

  const maxTotalAllowed = cfg.total_capital_usd * cfg.max_total_exposure_pct;
  const maxMemeAllowed = cfg.total_capital_usd * cfg.market_caps.solana_memecoin;
  const maxPolyAllowed = cfg.total_capital_usd * cfg.market_caps.polymarket;
  const maxPerpAllowed = cfg.total_capital_usd * cfg.market_caps.perp_binance;

  const currentDailyPnlUsd = dailyLossTripped
    ? -cfg.total_capital_usd * cfg.max_daily_loss_pct - 15.0
    : positions.reduce((sum, p) => sum + p.pnl_usd, 14.25);

  const isTripped = currentDailyPnlUsd <= -cfg.total_capital_usd * cfg.max_daily_loss_pct;

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner: Circuit Breaker Status */}
      <div
        className={`p-5 rounded-lg border ${
          isTripped
            ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
            : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isTripped ? (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            )}
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {isTripped ? 'CIRCUIT BREAKER TRIPPED: RISK GATE LOCKED' : 'UNIFIED RISK KERNEL: ALL CAPS ENFORCED'}
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isTripped
                  ? 'All subsequent trade proposals across Memecoins, Polymarket, and Perps are hard-vetoed.'
                  : 'USD notional caps, 30% portfolio exposure cap, and sub-caps are strictly validated before order submission.'}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleTripDailyLoss}
            className={`px-3 py-1.5 rounded font-bold border transition-colors flex items-center gap-1.5 ${
              isTripped
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border-rose-700'
            }`}
          >
            <PowerOff className="w-3.5 h-3.5" />
            {isTripped ? 'Reset Breaker to Normal' : 'Simulate Daily Loss Trip (2%)'}
          </button>
        </div>
      </div>

      {/* 4 Primary Portfolio Risk Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">TOTAL PORTFOLIO EXPOSURE</div>
          <div className="text-2xl font-bold text-white mt-1">
            ${totalExposureUsd.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {totalExposurePct.toFixed(1)}% of ${(cfg.total_capital_usd).toLocaleString()} (Cap: {(cfg.max_total_exposure_pct * 100)}% / ${maxTotalAllowed.toFixed(0)})
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-cyan-500 h-full"
              style={{ width: `${Math.min(100, (totalExposureUsd / maxTotalAllowed) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">DAILY PnL CIRCUIT BREAKER</div>
          <div className={`text-2xl font-bold mt-1 ${currentDailyPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {currentDailyPnlUsd >= 0 ? '+' : ''}${currentDailyPnlUsd.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Breaker: -${(cfg.total_capital_usd * cfg.max_daily_loss_pct).toFixed(0)} ({cfg.max_daily_loss_pct * 100}% max)
          </div>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">MAX DRAWDOWN BREAKER</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">15.0%</div>
          <div className="mt-2 text-[11px] text-slate-400">
            Ceiling: -${(cfg.total_capital_usd * cfg.max_drawdown_pct).toFixed(0)} Drawdown
          </div>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">PERP FUNDING BUDGET</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">$4.20 / $30</div>
          <div className="mt-2 text-[11px] text-slate-400">
            Max $30/day projected funding cost
          </div>
        </div>
      </div>

      {/* Per-Market Sub-Caps and Hard Caps Table */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-3">
          PER-MARKET EXPOSURE ALLOCATION &amp; HARD CAPS (§4)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Memecoin Card */}
          <div className="bg-[#0b0e14] border border-amber-900/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Coins className="w-4 h-4" /> Solana Memecoins
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] border border-amber-800">
                5% Sub-Cap
              </span>
            </div>
            <div className="flex justify-between text-slate-300 pt-1">
              <span>Current Exposure:</span>
              <span className="font-bold text-white">${memeExposureUsd.toFixed(2)} / ${maxMemeAllowed.toFixed(0)} max</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Per-Trade Hard Cap:</span>
              <span className="font-bold text-amber-400">${cfg.hard_caps_usd.solana_memecoin}.00 USD (STRICT)</span>
            </div>
            <div className="text-[10px] text-slate-500 pt-1">
              Precedence: Safety filter must pass before kernel gate. Max hold: 30m.
            </div>
          </div>

          {/* Polymarket Card */}
          <div className="bg-[#0b0e14] border border-indigo-900/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                <Scale className="w-4 h-4" /> Polymarket CLOB
              </span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px] border border-indigo-800">
                10% Sub-Cap
              </span>
            </div>
            <div className="flex justify-between text-slate-300 pt-1">
              <span>Current Exposure:</span>
              <span className="font-bold text-white">${polyExposureUsd.toFixed(2)} / ${maxPolyAllowed.toFixed(0)} max</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Per-Trade Hard Cap:</span>
              <span className="font-bold text-indigo-400">${cfg.hard_caps_usd.polymarket}.00 USD</span>
            </div>
            <div className="text-[10px] text-slate-500 pt-1">
              Boundary: Rejects prices &lt;0.02 or &gt;0.98. Passive GTC quoter.
            </div>
          </div>

          {/* Perp Card */}
          <div className="bg-[#0b0e14] border border-emerald-900/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Binance Perps
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-800">
                15% Sub-Cap
              </span>
            </div>
            <div className="flex justify-between text-slate-300 pt-1">
              <span>Current Exposure:</span>
              <span className="font-bold text-white">${perpExposureUsd.toFixed(2)} / ${maxPerpAllowed.toFixed(0)} max</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Per-Trade Hard Cap:</span>
              <span className="font-bold text-emerald-400">${cfg.hard_caps_usd.perp_binance}.00 USD</span>
            </div>
            <div className="text-[10px] text-slate-500 pt-1">
              Boundary: Funding budget watcher + liquidation margin check.
            </div>
          </div>
        </div>
      </div>

      {/* Active Cross-Market Positions Table */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold">
            CROSS-MARKET OPEN POSITIONS ({positions.length})
          </h4>
          <span className="text-[11px] text-slate-500">Kernel exposure state</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0b0e14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Market Adapter</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Entry Price</th>
                <th className="py-2.5 px-3">Mark Price</th>
                <th className="py-2.5 px-3">Notional USD</th>
                <th className="py-2.5 px-3">Unrealized PnL</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-500">
                    No active positions across any market adapter. Exposure is $0.00.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-200 capitalize">
                        {pos.adapter.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{pos.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{pos.size}</td>
                    <td className="py-2.5 px-3 text-slate-300">${pos.entry_price}</td>
                    <td className="py-2.5 px-3 text-slate-300">${pos.mark_price}</td>
                    <td className="py-2.5 px-3 font-bold text-white">${pos.notional_usd.toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${pos.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pos.pnl_usd >= 0 ? '+' : ''}${pos.pnl_usd.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onClosePosition(pos.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
