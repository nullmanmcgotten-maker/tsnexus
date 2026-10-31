import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Percent,
  Sliders,
  PowerOff,
  CheckCircle,
} from 'lucide-react';
import { PositionSnapshot, Settings } from '../types/nexus.ts';
import { RiskGovernor } from '../engine/nexusLogic.ts';

interface RiskGovernorTabProps {
  settings: Settings;
  onUpdateSettings: (updated: Partial<Settings>) => void;
  dailyLossTripped: boolean;
  onToggleTripDailyLoss: () => void;
  positions: PositionSnapshot[];
  onClosePosition: (symbol: string) => void;
}

export const RiskGovernorTab: React.FC<RiskGovernorTabProps> = ({
  settings,
  onUpdateSettings,
  dailyLossTripped,
  onToggleTripDailyLoss,
  positions,
  onClosePosition,
}) => {
  const governor = new RiskGovernor(settings);
  const maxLossUsd = governor.maxDailyLoss(settings.account_capital);
  const maxRiskTradeUsd = governor.maxTradeRisk(settings.account_capital);

  const currentDailyPnl = dailyLossTripped
    ? -maxLossUsd - 15.0
    : positions.reduce((acc, p) => acc + p.unrealized_pnl, 45.0);

  const isTripped = currentDailyPnl <= -maxLossUsd;

  return (
    <div className="space-y-6">
      {/* Top Banner: Circuit Breaker Status */}
      <div
        className={`border rounded-lg p-5 font-mono ${
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
                {isTripped ? 'CIRCUIT BREAKER ENGAGED: DAILY LOSS LIMIT REACHED' : 'RISK GOVERNOR: NORMAL OPERATION'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {isTripped
                  ? 'All subsequent trade proposals are hard-vetoed by the engine until next UTC trading session.'
                  : 'Account risk boundaries and position limits strictly enforced on every signal.'}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleTripDailyLoss}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              isTripped
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border-rose-700'
            }`}
          >
            <PowerOff className="w-3.5 h-3.5" />
            {isTripped ? 'Reset Breaker to Normal' : 'Simulate Circuit Breaker Trip'}
          </button>
        </div>
      </div>

      {/* 4 Risk Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">TODAY&apos;S NET REALIZED + UNREALIZED PnL</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              currentDailyPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {currentDailyPnl >= 0 ? '+' : ''}${currentDailyPnl.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Limit: -${maxLossUsd.toFixed(2)} ({settings.max_daily_loss * 100}% max)
          </div>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">MAX RISK BUDGET PER TRADE</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">
            ${maxRiskTradeUsd.toFixed(2)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {(settings.max_risk_per_trade * 100).toFixed(2)}% of ${settings.account_capital.toLocaleString()}
          </div>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">OPEN POSITIONS OCCUPANCY</div>
          <div className="text-2xl font-bold text-white mt-1">
            {positions.length} / {settings.max_open_positions}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {positions.length < settings.max_open_positions
              ? `${settings.max_open_positions - positions.length} slots available`
              : 'Maximum capacity reached'}
          </div>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-[10px] uppercase">R:R THRESHOLD FLOOR</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            1.80 R
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Trades &lt; 1.8 R automatically vetoed
          </div>
        </div>
      </div>

      {/* Active Open Positions Table */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 font-mono">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold">
            ACTIVE FUTURES POSITIONS ({positions.length})
          </h4>
          <span className="text-[11px] text-slate-500">Live reconciliation state</span>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No open positions in account. Risk exposure is 0.00 USD.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b0e14] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Mark Price</th>
                  <th className="py-2.5 px-3">Leverage</th>
                  <th className="py-2.5 px-3">Unrealized PnL</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {positions.map((pos) => (
                  <tr key={pos.symbol} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-bold text-white">{pos.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.side === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{pos.quantity}</td>
                    <td className="py-2.5 px-3 text-slate-300">${pos.entry_price.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-300">${pos.mark_price.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-cyan-300">{pos.leverage}x</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold ${
                          pos.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onClosePosition(pos.symbol)}
                        className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      >
                        Market Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Risk Governor Settings Form */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 font-mono">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          RISK GOVERNOR THRESHOLD TUNING (nexus_engine/config.py)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Max Risk Per Trade (Fraction)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                min="0.001"
                max="0.05"
                value={settings.max_risk_per_trade}
                onChange={(e) => onUpdateSettings({ max_risk_per_trade: parseFloat(e.target.value) || 0.004 })}
                className="bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white w-full"
              />
              <span className="text-slate-400 font-bold">{(settings.max_risk_per_trade * 100).toFixed(2)}%</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Default 0.004 (0.4% capital at risk)</p>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Max Daily Loss (Fraction)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.005"
                min="0.005"
                max="0.1"
                value={settings.max_daily_loss}
                onChange={(e) => onUpdateSettings({ max_daily_loss: parseFloat(e.target.value) || 0.02 })}
                className="bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white w-full"
              />
              <span className="text-slate-400 font-bold">{(settings.max_daily_loss * 100).toFixed(1)}%</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Default 0.02 (2.0% daily circuit-breaker)</p>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Max Open Positions</label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.max_open_positions}
              onChange={(e) => onUpdateSettings({ max_open_positions: parseInt(e.target.value) || 3 })}
              className="bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white w-full"
            />
            <p className="text-[11px] text-slate-500 mt-1">Default 3 concurrent futures positions</p>
          </div>
        </div>
      </div>
    </div>
  );
};
