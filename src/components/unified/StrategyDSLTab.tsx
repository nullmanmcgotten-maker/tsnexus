import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  Save,
  RotateCcw,
  AlertTriangle,
  Play,
  FileCode,
} from 'lucide-react';
import { StrategyDSL } from '../../types/unified.ts';
import { dslEngine } from '../../core/strategy/dsl/dslEngine.ts';

export const StrategyDSLTab: React.FC = () => {
  const [strategies, setStrategies] = useState<StrategyDSL[]>(dslEngine.getStrategies());
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDSL>(strategies[0]);
  const [editorText, setEditorText] = useState<string>(JSON.stringify(strategies[0], null, 2));
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] }>({
    valid: true,
    errors: [],
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSelectStrategy = (strat: StrategyDSL) => {
    setSelectedStrategy(strat);
    setEditorText(JSON.stringify(strat, null, 2));
    setValidationResult(dslEngine.validateDSL(strat));
    setSaveMessage(null);
  };

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(editorText) as StrategyDSL;
      const res = dslEngine.validateDSL(parsed);
      setValidationResult(res);
      return res;
    } catch (e: any) {
      const res = { valid: false, errors: [`JSON Parse Error: ${e.message}`] };
      setValidationResult(res);
      return res;
    }
  };

  const handleSave = () => {
    const val = handleValidate();
    if (!val.valid) return;

    try {
      const parsed = JSON.parse(editorText) as StrategyDSL;
      const res = dslEngine.saveStrategy(parsed);
      if (res.success) {
        setStrategies(dslEngine.getStrategies());
        setSelectedStrategy(parsed);
        setSaveMessage('Strategy DSL validated and saved to kernel registry!');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (e: any) {
      setValidationResult({ valid: false, errors: [e.message] });
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              STRATEGY DSL STUDIO &amp; VALIDATOR (§6)
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Machine-verifiable strategy representation. LLM mutations are strictly bound by declared parameter ranges, mandatory safety filter guards, and out-of-sample backtest thresholds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleValidate}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Validate Schema
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Strategy DSL
            </button>
          </div>
        </div>
      </div>

      {/* Strategies Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {strategies.map((strat) => (
          <button
            key={strat.id}
            onClick={() => handleSelectStrategy(strat)}
            className={`px-3 py-2 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              selectedStrategy.id === strat.id
                ? 'bg-slate-800 text-white border border-slate-600 shadow-sm'
                : 'bg-[#10141f] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>{strat.id}.yaml</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
              v{strat.version}
            </span>
          </button>
        ))}
      </div>

      {/* Editor & Validation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Area */}
        <div className="lg:col-span-2 bg-[#10141f] border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="font-bold text-white text-xs flex items-center gap-2">
              <span>ACTIVE DSL SPECIFICATION:</span>
              <code className="text-cyan-300">{selectedStrategy.id} (Market: {selectedStrategy.market})</code>
            </span>
            <span className="text-slate-500 text-[11px]">YAML / JSON Representation</span>
          </div>

          <textarea
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            rows={22}
            className="w-full bg-[#07090e] border border-slate-900 rounded p-3 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500/80 leading-relaxed"
            spellCheck={false}
          />

          {saveMessage && (
            <div className="mt-3 p-2 rounded bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {saveMessage}
            </div>
          )}
        </div>

        {/* Validation & OOS Backtest Rules Box */}
        <div className="space-y-4">
          <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-slate-200 font-bold">
              SCHEMA &amp; SAFETY VALIDATION STATUS (§6.3)
            </h4>

            {validationResult.valid ? (
              <div className="p-3 rounded bg-emerald-950/20 border border-emerald-500/40 text-emerald-300 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  DSL Schema Validated
                </div>
                <div className="text-[10px] text-slate-400">
                  All parameters have matching ranges, indicators match market constraints, and safety filters are present.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded bg-rose-950/20 border border-rose-500/40 text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Validation Errors Found
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[10px]">
                  {validationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 text-[11px] text-slate-400 space-y-2">
              <div className="font-bold text-slate-300">Enforced Invariants:</div>
              <div>• Param keys strictly bound to range [min, max]</div>
              <div>• Polymarket prohibits technical indicators (no RSI)</div>
              <div>• Memecoin strategies require <code>safety_filter</code> guard</div>
              <div>• <code>max_notional_usd</code> &le; Hard Cap ($25 meme, $100 poly, $500 perp)</div>
            </div>
          </div>

          {/* OOS Backtest Gate Card */}
          <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-slate-200 font-bold">
              OUT-OF-SAMPLE BACKTEST GATE (§6.4)
            </h4>
            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>Out-of-Sample Window:</span>
                <strong className="text-white">&ge; 90 Days</strong>
              </div>
              <div className="flex justify-between">
                <span>Baseline Win-Rate:</span>
                <span className="text-emerald-400 font-bold">{selectedStrategy.backtest_win_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span>Baseline Sharpe:</span>
                <span className="text-cyan-300 font-bold">{selectedStrategy.backtest_sharpe}</span>
              </div>
              <div className="flex justify-between">
                <span>Max Drawdown Rule:</span>
                <span className="text-slate-300">&le; Current + 20% rel.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
