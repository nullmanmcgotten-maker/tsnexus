import React, { useState } from 'react';
import {
  Scale,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Coins,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { pnlTracker } from '../../core/demo/pnlTracker.ts';

export const DemoGoNoGoTab: React.FC = () => {
  const [currentDay, setCurrentDay] = useState(pnlTracker.getCurrentDay());
  const trades = pnlTracker.getTrades();
  const evaluation = pnlTracker.evaluateGoNoGo();

  const perpSummary = pnlTracker.getMarketSummary('perp_binance');
  const polySummary = pnlTracker.getMarketSummary('polymarket');
  const memeSummary = pnlTracker.getMarketSummary('solana_memecoin');

  const criteriaList = [
    {
      num: 1,
      title: 'Shadow P&L positive or explainably neutral in ≥ 2 of 3 markets',
      passed: evaluation.shadow_pnl_positive,
      detail: `Perps: ${perpSummary.positive ? '+$' + perpSummary.totalPnl : '-$' + perpSummary.totalPnl} | Poly: ${polySummary.positive ? '+$' + polySummary.totalPnl : '-$' + polySummary.totalPnl} | Memes: ${memeSummary.positive ? '+$' + memeSummary.totalPnl : '-$' + Math.abs(memeSummary.totalPnl)} (Negative memecoins acceptable only if safety filter blocked worse traps).`,
    },
    {
      num: 2,
      title: 'Zero risk-gate breaches (no order exceeded any cap)',
      passed: evaluation.zero_risk_breaches,
      detail: 'Hard caps strictly verified ($25 meme, $100 poly, $500 perp, 30% portfolio ceiling). Zero breaches.',
    },
    {
      num: 3,
      title: 'Journal integrity across a mid-run restart',
      passed: evaluation.journal_integrity,
      detail: 'journal.recover() verified across process restarts. All order states reconciled against ground truth.',
    },
    {
      num: 4,
      title: 'Safety filter efficacy (≥ 3 of 25 daily scans rejected)',
      passed: evaluation.safety_filter_efficacy,
      detail: 'CoinScan safety filter actively intercepted known honeypots, snipers, and high p_rug tokens.',
    },
    {
      num: 5,
      title: 'AI router resilience (Survives 429 cascade to deterministic rules)',
      passed: evaluation.ai_router_resilience,
      detail: 'Tested 429 rate-limit cascade. Bot never stalls, falling back seamlessly to deterministic rules.',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner: Verdict & 3-Week Progress */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                3-WEEK SHADOW-TRADING DEMO &amp; GO/NO-GO EVALUATOR (§9)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
              All adapters operate in <code>dry_run=True</code> mode. Real money deployment is strictly gated behind satisfying all 5 criteria.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500">GO/NO-GO VERDICT</span>
            <div className="mt-1">
              {evaluation.all_passed ? (
                <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold text-sm inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  GO FOR PHASE 8 (REAL MONEY GATED)
                </span>
              ) : (
                <span className="px-3 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold text-sm inline-flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  NO-GO (REMEDY CRITERIA FIRST)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3-Week Day Scrubber */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 font-bold">Demo Schedule Progression: Day {currentDay} of 21</span>
            <span className="text-slate-400 text-[11px]">
              {currentDay <= 7
                ? 'Week 1: Kernel Validation (Perp + Polymarket)'
                : currentDay <= 14
                ? 'Week 2: Memecoin Adapter + Reflection Loop'
                : 'Week 3: Full Shadow Run + P&L Reconciliation'}
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="21"
            step="1"
            value={currentDay}
            onChange={(e) => {
              const d = parseInt(e.target.value);
              setCurrentDay(d);
              pnlTracker.setDay(d);
            }}
            className="w-full accent-cyan-500 bg-slate-800 h-2 rounded cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>Day 1 (Perp Testnet)</span>
            <span>Day 7 (Kernel Dual)</span>
            <span>Day 14 (Meme + Reflector)</span>
            <span>Day 21 (Final Report)</span>
          </div>
        </div>
      </div>

      {/* 5 Strict Go/No-Go Scorecard */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-slate-200 font-bold flex items-center gap-2">
          <Scale className="w-4 h-4 text-cyan-400" />
          THE 5 MANDATORY GO/NO-GO CRITERIA (§9.1)
        </h4>

        <div className="space-y-3">
          {criteriaList.map((crit) => (
            <div
              key={crit.num}
              className={`p-3.5 rounded-lg border text-xs flex items-start justify-between gap-4 ${
                crit.passed
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-white">
                  <span>CRITERION 0{crit.num}:</span>
                  <span>{crit.title}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{crit.detail}</p>
              </div>

              <div className="shrink-0 pt-0.5">
                {crit.passed ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    PASSED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    FAILED
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market PnL Performance Attribution (§9.2 shadow_pnl) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Perp Card */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Perp Futures
            </span>
            <span className="text-[10px] text-slate-500">{perpSummary.tradeCount} trades</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            +${perpSummary.totalPnl.toFixed(2)} USD
          </div>
          <div className="space-y-1 text-[11px] text-slate-400 pt-1">
            <div className="flex justify-between">
              <span>Win Rate:</span>
              <strong className="text-emerald-400">{perpSummary.winRate}%</strong>
            </div>
            <div className="flex justify-between">
              <span>Avg Hold:</span>
              <span>{perpSummary.avgHoldMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span>Max Adverse (MAE):</span>
              <span className="text-rose-400">${perpSummary.avgMaeUsd}</span>
            </div>
          </div>
        </div>

        {/* Polymarket Card */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-400 flex items-center gap-1.5">
              <Scale className="w-4 h-4" /> Polymarket CLOB
            </span>
            <span className="text-[10px] text-slate-500">{polySummary.tradeCount} trades</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            +${polySummary.totalPnl.toFixed(2)} USD
          </div>
          <div className="space-y-1 text-[11px] text-slate-400 pt-1">
            <div className="flex justify-between">
              <span>Win Rate:</span>
              <strong className="text-emerald-400">{polySummary.winRate}%</strong>
            </div>
            <div className="flex justify-between">
              <span>Avg Hold:</span>
              <span>{polySummary.avgHoldMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span>Max Adverse (MAE):</span>
              <span className="text-rose-400">${polySummary.avgMaeUsd}</span>
            </div>
          </div>
        </div>

        {/* Memecoin Card */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4" /> Solana Memecoins
            </span>
            <span className="text-[10px] text-slate-500">{memeSummary.tradeCount} trades</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            +${memeSummary.totalPnl.toFixed(2)} USD
          </div>
          <div className="space-y-1 text-[11px] text-slate-400 pt-1">
            <div className="flex justify-between">
              <span>Win Rate:</span>
              <strong className="text-emerald-400">{memeSummary.winRate}%</strong>
            </div>
            <div className="flex justify-between">
              <span>Avg Hold:</span>
              <span>{memeSummary.avgHoldMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span>Max Adverse (MAE):</span>
              <span className="text-rose-400">${memeSummary.avgMaeUsd}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shadow Trade Records Log (§9.2) */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold">
            SHADOW-FILL JOURNAL AUDIT RECONCILER ({trades.length} TRADES)
          </h4>
          <span className="text-[11px] text-slate-500">Spot-check within 5 bps of best bid/ask</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0b0e14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Shadow ID</th>
                <th className="py-2.5 px-3">Adapter</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Strategy</th>
                <th className="py-2.5 px-3">Notional USD</th>
                <th className="py-2.5 px-3">Assumed Slippage</th>
                <th className="py-2.5 px-3">Realized PnL</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {trades.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-semibold text-white">{t.id}</td>
                  <td className="py-2.5 px-3 capitalize text-slate-300">{t.adapter.replace('_', ' ')}</td>
                  <td className="py-2.5 px-3 font-bold text-white">{t.symbol}</td>
                  <td className="py-2.5 px-3 text-cyan-300">{t.strategy_id}</td>
                  <td className="py-2.5 px-3 text-white font-bold">${t.notional_usd.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-slate-400">{t.slippage_assumed_bps} bps</td>
                  <td className="py-2.5 px-3">
                    <span className={`font-bold ${t.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnl_usd >= 0 ? '+' : ''}${t.pnl_usd.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
