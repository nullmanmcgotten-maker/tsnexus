import React, { useState } from 'react';
import {
  Sparkles,
  RotateCcw,
  Cpu,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Play,
  ArrowRight,
  Database,
  Radio,
  Zap,
} from 'lucide-react';
import { ReflectionRecord, StrategyDSL } from '../../types/unified.ts';
import { aiRouter, AIProvider } from '../../core/ai/router.ts';
import { strategyReflector, FailedTradeRecord } from '../../core/ai/reflector.ts';
import { dslEngine } from '../../core/strategy/dsl/dslEngine.ts';
import { unifiedJournal } from '../../core/kernel/journal.ts';

interface SelfEvolutionTabProps {
  onRefreshJournal: () => void;
}

export const SelfEvolutionTab: React.FC<SelfEvolutionTabProps> = ({ onRefreshJournal }) => {
  const [providers, setProviders] = useState<AIProvider[]>(aiRouter.getProviders());
  const [reflections, setReflections] = useState<ReflectionRecord[]>(unifiedJournal.getReflections());
  const [isReflecting, setIsReflecting] = useState(false);
  const [activeDiagnosis, setActiveDiagnosis] = useState<any>(null);

  const sampleFailedTrades: FailedTradeRecord[] = [
    {
      trade_id: 'SHADOW-MEME-302',
      adapter: 'solana_memecoin',
      symbol: 'CWIF',
      side: 'BUY',
      entry_price: 0.00192,
      exit_price: 0.00184,
      pnl_usd: -0.96,
      strategy_id: 'meme_momentum',
      mae_usd: -1.4,
      reasons: ['stop_loss_hit', 'intraday_slippage_expanded'],
    },
    {
      trade_id: 'SHADOW-PERP-109',
      adapter: 'perp_binance',
      symbol: 'BTCUSDT',
      side: 'BUY',
      entry_price: 65120.0,
      exit_price: 64890.0,
      pnl_usd: -1.38,
      strategy_id: 'perp_pullback',
      mae_usd: -2.1,
      reasons: ['flow_divergence', 'funding_pressure_shift'],
    },
  ];

  const [selectedTrade, setSelectedTrade] = useState<FailedTradeRecord>(sampleFailedTrades[0]);

  const handleRunReflection = async () => {
    setIsReflecting(true);
    setActiveDiagnosis(null);
    try {
      const strategies = dslEngine.getStrategies();
      const currentStrategy =
        strategies.find((s) => s.id === selectedTrade.strategy_id) || strategies[0];

      const reflection = await strategyReflector.reflectFailedTrade(selectedTrade, currentStrategy);
      unifiedJournal.recordReflection(reflection);
      setReflections(unifiedJournal.getReflections());
      setActiveDiagnosis(reflection);
      onRefreshJournal();
    } finally {
      setIsReflecting(false);
    }
  };

  const handleSimulate429 = () => {
    aiRouter.simulateProvider429('gemini', 60);
    aiRouter.simulateProvider429('groq', 60);
    setProviders(aiRouter.getProviders());
  };

  const handleResetLimits = () => {
    aiRouter.clearProviderLimits();
    setProviders(aiRouter.getProviders());
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner: Three-Layer Evolution Concept */}
      <div className="bg-[#10141f] border border-cyan-800/40 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                SELF-EVOLVING AI ARCHITECTURE (FREE-TIER CASCADE)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Based on the <strong>AlphaEvo</strong> pattern: LLMs handle <em>failure reflection and single-parameter mutations</em> validated against out-of-sample backtests, while a fine-tuned reviewer enforces safety. Model weights and validated DSL parameters carry the learning forward.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
              3 LAYERS ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Layer 1: Reflector & Mutation Sandbox */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-200 font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-400" />
              LAYER 1 — FAILED-TRADE REFLECTOR &amp; MUTATION LOOP (§7.2)
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Select a losing shadow trade to diagnose and run an AlphaEvo-style parameter mutation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTrade.trade_id}
              onChange={(e) => {
                const found = sampleFailedTrades.find((t) => t.trade_id === e.target.value);
                if (found) setSelectedTrade(found);
              }}
              className="bg-[#0b0e14] border border-slate-800 rounded px-2.5 py-1.5 text-white"
            >
              {sampleFailedTrades.map((t) => (
                <option key={t.trade_id} value={t.trade_id}>
                  {t.trade_id} ({t.symbol} {t.side} | PnL: ${t.pnl_usd})
                </option>
              ))}
            </select>

            <button
              onClick={handleRunReflection}
              disabled={isReflecting}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isReflecting ? 'Diagnosing & Backtesting...' : 'Run Reflection & Mutation'}
            </button>
          </div>
        </div>

        {/* Diagnosis & Mutation Result Card */}
        {activeDiagnosis && (
          <div className="bg-[#0b0e14] border border-cyan-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                REFLECTOR CONCLUSION FOR {activeDiagnosis.trade_id}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeDiagnosis.accepted
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {activeDiagnosis.accepted ? 'OOS BACKTEST PASSED → VERSION STAGED' : 'BACKTEST GATE REJECTED'}
              </span>
            </div>

            <div className="text-[11px] text-slate-300 bg-[#111624] p-3 rounded border border-slate-800 leading-relaxed italic">
              &ldquo;{activeDiagnosis.diagnosis}&rdquo;
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-[#111624] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">Parameter Mutated</span>
                <div className="font-bold text-white text-xs mt-0.5">{activeDiagnosis.param_changed}</div>
              </div>

              <div className="bg-[#111624] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">Value Transition</span>
                <div className="font-bold text-cyan-300 text-xs mt-0.5">
                  {activeDiagnosis.old_value} <ArrowRight className="w-3 h-3 inline mx-1" /> {activeDiagnosis.new_value}
                </div>
              </div>

              <div className="bg-[#111624] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">OOS Win Rate</span>
                <div className="font-bold text-emerald-400 text-xs mt-0.5">{activeDiagnosis.backtest_win_rate}%</div>
              </div>

              <div className="bg-[#111624] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">OOS Sharpe Ratio</span>
                <div className="font-bold text-white text-xs mt-0.5">{activeDiagnosis.backtest_sharpe}</div>
              </div>
            </div>
          </div>
        )}

        {/* Reflections History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0b0e14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Reflection ID</th>
                <th className="py-2 px-3">Failed Trade</th>
                <th className="py-2 px-3">Param Mutated</th>
                <th className="py-2 px-3">Transition</th>
                <th className="py-2 px-3">Staged Version</th>
                <th className="py-2 px-3">OOS Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reflections.map((ref) => (
                <tr key={ref.id} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-semibold text-white">{ref.id}</td>
                  <td className="py-2 px-3 text-slate-300">{ref.trade_id}</td>
                  <td className="py-2 px-3 text-cyan-300">{ref.param_changed}</td>
                  <td className="py-2 px-3 text-slate-200">
                    {ref.old_value} → <strong className="text-white">{ref.new_value}</strong>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-[11px]">{ref.proposed_strategy_version}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ref.accepted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {ref.accepted ? 'PASSED (Sharpe +0.15)' : 'REJECTED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Layer 3: Fine-Tuned Reviewer Invariant Card */}
      <div className="bg-[#10141f] border border-amber-900/40 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <ShieldAlert className="w-4 h-4" />
          <span>LAYER 3 — FINE-TUNED TRADE PROPOSAL REVIEWER (REJECT-ONLY INVARIANT)</span>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">
          <strong>Non-Negotiable Architecture Rule (§7.4):</strong> The fine-tuned reviewer model invoked before the risk gate can <em>only reject</em>, never approve. If the reviewer detects abnormal honeypots, sniper clustering, or high spread, it emits <code>REJECT</code> and blocks execution. If it finds no hazards, it returns <code>NO_OBJECTION</code>, passing the proposal to the Risk Engine where hard caps and exposure limits are authoritatively enforced.
        </p>
      </div>

      {/* AI Router Cascade & 429 Resilience Simulator */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-200 font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              AI ROUTER FREE-TIER CASCADE &amp; 429 RESILIENCE (§7.1)
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Automatic failover: Gemini → Groq → Cerebras → Mistral → Deterministic Rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulate429}
              className="px-3 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors text-[11px]"
              title="Test Go/No-Go Criterion 5: Verify bot survives when free LLM providers return 429"
            >
              Simulate 429 Rate-Limits
            </button>
            <button
              onClick={handleResetLimits}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors text-[11px]"
            >
              Reset Provider Quotas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {providers.map((prov) => {
            const isLimited = Boolean(prov.rateLimitedUntil && prov.rateLimitedUntil > Date.now());
            return (
              <div
                key={prov.name}
                className={`p-3 rounded-lg border ${
                  isLimited
                    ? 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                    : 'bg-[#0b0e14] border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-xs">{prov.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      isLimited ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {isLimited ? '429 LIMITED' : 'AVAILABLE'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mb-2">{prov.model}</div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Daily Calls Used:</span>
                  <strong className="text-white">{prov.dailyQuotaUsed}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
