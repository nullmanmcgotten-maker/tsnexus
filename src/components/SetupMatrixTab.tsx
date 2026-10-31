import React, { useState } from 'react';
import {
  Sparkles,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { MarketSnapshot, SetupCandidate, SignalDecision } from '../types/nexus.ts';
import { detectSetups, buildSignalDecision, classifyRegime } from '../engine/nexusLogic.ts';
import { journalStore } from '../engine/journalStore.ts';

interface SetupMatrixTabProps {
  snapshot: MarketSnapshot;
  onUpdateSnapshot: (updated: Partial<MarketSnapshot>) => void;
  onSelectCandidateForLifecycle: (decision: SignalDecision) => void;
}

export const SetupMatrixTab: React.FC<SetupMatrixTabProps> = ({
  snapshot,
  onUpdateSnapshot,
  onSelectCandidateForLifecycle,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<SetupCandidate | null>(null);

  const detectedCandidates = detectSetups(snapshot);
  const regime = classifyRegime(snapshot);
  const stats = journalStore.getSetupStats();

  const handleSelect = (candidate: SetupCandidate) => {
    setSelectedCandidate(candidate);
    const relatedStat = stats.find((s) => s.setup === candidate.setup) || { count: 35, wins: 22 };
    const decision = buildSignalDecision(candidate, snapshot, {
      count: relatedStat.count,
      wins: relatedStat.wins,
    });
    onSelectCandidateForLifecycle(decision);
  };

  return (
    <div className="space-y-6">
      {/* Overview & Parameter Tuning Bar */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              MICROSTRUCTURE PARAMETER SANDBOX
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Adjust market conditions to evaluate real-time setup detection and gate trigger behavior.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Current Regime: <strong className="text-cyan-300">{regime}</strong>
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs font-mono">
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Delta Imbalance</span>
              <span className="text-white font-bold">{snapshot.delta_imbalance.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="-0.8"
              max="0.8"
              step="0.05"
              value={snapshot.delta_imbalance}
              onChange={(e) => onUpdateSnapshot({ delta_imbalance: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Spread (bps)</span>
              <span className="text-white font-bold">{snapshot.spread_bps.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="6.0"
              step="0.2"
              value={snapshot.spread_bps}
              onChange={(e) => onUpdateSnapshot({ spread_bps: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Depth ($k)</span>
              <span className="text-white font-bold">{(snapshot.depth_usd / 1000).toFixed(0)}k</span>
            </div>
            <input
              type="range"
              min="50000"
              max="500000"
              step="25000"
              value={snapshot.depth_usd}
              onChange={(e) => onUpdateSnapshot({ depth_usd: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>RSI (14)</span>
              <span className="text-white font-bold">{snapshot.rsi}</span>
            </div>
            <input
              type="range"
              min="20"
              max="80"
              step="1"
              value={snapshot.rsi}
              onChange={(e) => onUpdateSnapshot({ rsi: parseInt(e.target.value) })}
              className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Volatility %</span>
              <span className="text-white font-bold">{(snapshot.volatility_pct * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.1"
              value={snapshot.volatility_pct}
              onChange={(e) => onUpdateSnapshot({ volatility_pct: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Session Quality</span>
              <span className="text-white font-bold">{(snapshot.session_quality * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={snapshot.session_quality}
              onChange={(e) => onUpdateSnapshot({ session_quality: parseFloat(e.target.value) })}
              className="w-full accent-teal-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Detected Setups Cards */}
      <div>
        <div className="flex items-center justify-between mb-3 font-mono">
          <h4 className="text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            DETECTED HIGH-PROBABILITY CANDIDATES ({detectedCandidates.length})
          </h4>
          <span className="text-xs text-slate-500">
            Source: <code className="text-slate-400">nexus_engine/setup_detectors.py</code>
          </span>
        </div>

        {detectedCandidates.length === 0 ? (
          <div className="bg-[#10141f] border border-slate-800/80 rounded-lg p-8 text-center text-slate-400 font-mono text-xs">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            No setup conditions met under current parameter state.
            <div className="mt-1 text-slate-500 text-[11px]">
              Try adjusting Delta Imbalance (&gt;0.12 for Pre-Pump, &lt;-0.12 for Exhaustion) or regime parameters above.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detectedCandidates.map((candidate, idx) => {
              const stat = stats.find((s) => s.setup === candidate.setup);
              const decision = buildSignalDecision(candidate, snapshot, {
                count: stat?.count ?? 30,
                wins: stat?.wins ?? 20,
              });

              return (
                <div
                  key={idx}
                  className="bg-[#10141f] border border-slate-800 hover:border-slate-700 rounded-lg p-4 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between font-mono mb-2">
                      <span className="text-[10px] text-slate-500 font-bold">SETUP #{idx + 1}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          candidate.side === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {candidate.side}
                      </span>
                    </div>

                    <h5 className="text-sm font-bold font-mono text-white tracking-wide">
                      {candidate.setup.replace(/_/g, ' ')}
                    </h5>

                    {/* Thesis Grade & Net R */}
                    <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-center">
                      <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400">THESIS GRADE</div>
                        <div
                          className={`text-base font-bold ${
                            decision.grade === 'A'
                              ? 'text-emerald-400'
                              : decision.grade === 'B'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          Grade {decision.grade}
                        </div>
                      </div>

                      <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400">CONFIDENCE</div>
                        <div className="text-base font-bold text-cyan-300">
                          {(decision.confidence * 100).toFixed(0)}%
                        </div>
                      </div>

                      <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400">NET R</div>
                        <div className="text-base font-bold text-white">
                          {decision.expected_net_r.toFixed(1)}R
                        </div>
                      </div>
                    </div>

                    {/* Reasons list */}
                    <div className="mt-3">
                      <span className="text-[10px] font-mono text-slate-500">CONFIRMATION FACTORS:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {candidate.reasons.map((r, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {r.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Invalidation Rules */}
                    <div className="mt-3 text-[11px] font-mono text-slate-400">
                      <span className="text-[10px] text-slate-500">HARD INVALIDATIONS:</span>
                      <div className="text-rose-400/90 text-[10px] mt-0.5">
                        stop_broken, data_stale (&gt;90s), regime_changed
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">
                      {decision.live_eligible ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Live Eligible
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5" /> Paper/Review Only
                        </span>
                      )}
                    </span>

                    <button
                      onClick={() => handleSelect(candidate)}
                      className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1 transition-colors"
                    >
                      Stage in Lifecycle <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Setup Performance Reference Table */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <h4 className="text-xs uppercase tracking-wider font-mono text-slate-400 mb-3">
          HISTORICAL SETUP CALIBRATION MATRIX (JOURNAL EMPIRICAL FEED)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0b0e14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Setup Identifier</th>
                <th className="py-2 px-3">Sample Count</th>
                <th className="py-2 px-3">Wins / Losses</th>
                <th className="py-2 px-3">Empirical Win-Rate</th>
                <th className="py-2 px-3">Avg Net R</th>
                <th className="py-2 px-3">Calibrator Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats.map((s) => (
                <tr key={s.setup} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-semibold text-white">{s.setup}</td>
                  <td className="py-2 px-3 text-slate-300">{s.count} trades</td>
                  <td className="py-2 px-3 text-slate-300">
                    <span className="text-emerald-400">{s.wins}W</span> /{' '}
                    <span className="text-rose-400">{s.losses}L</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-bold text-emerald-400">{s.winRate}%</span>
                  </td>
                  <td className="py-2 px-3 text-cyan-300">{s.avgNetR}R</td>
                  <td className="py-2 px-3 text-slate-400">
                    {s.count >= 30 ? (
                      <span className="text-emerald-400">Active (40% weight)</span>
                    ) : (
                      <span className="text-slate-500">Awaiting &gt;=30 trades</span>
                    )}
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
