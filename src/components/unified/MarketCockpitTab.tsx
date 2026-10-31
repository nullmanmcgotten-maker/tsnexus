import React, { useState } from 'react';
import {
  Coins,
  Scale,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { Market, Quote, Side, UnifiedOrderRecord, UnifiedPosition } from '../../types/unified.ts';
import { adapterRegistry } from '../../core/adapters/registry.ts';
import { SAMPLE_MEMECOINS, SolanaMemecoinAdapter } from '../../core/adapters/solanaMemecoin.ts';
import { SAMPLE_POLY_MARKETS, PolymarketClobAdapter } from '../../core/adapters/polymarketClob.ts';
import { UnifiedRiskEngine } from '../../core/kernel/riskEngine.ts';
import { fineTunedProposalReviewer } from '../../core/ai/reviewer.ts';
import { polymarketEventAnalyst } from '../../core/ai/eventAnalyst.ts';
import { unifiedJournal } from '../../core/kernel/journal.ts';

interface MarketCockpitTabProps {
  riskEngine: UnifiedRiskEngine;
  positions: UnifiedPosition[];
  onOrderCompleted: (order: UnifiedOrderRecord) => void;
}

interface PipelineStage {
  name: string;
  status: 'IDLE' | 'RUNNING' | 'PASS' | 'FAIL';
  message?: string;
}

export const MarketCockpitTab: React.FC<MarketCockpitTabProps> = ({
  riskEngine,
  positions,
  onOrderCompleted,
}) => {
  const [selectedMarket, setSelectedMarket] = useState<Market>('solana_memecoin');

  // Memecoin state
  const [selectedMeme, setSelectedMeme] = useState(SAMPLE_MEMECOINS[0]);
  const [memeNotionalInput, setMemeNotionalInput] = useState<number>(20.0); // <= $25

  // Polymarket state
  const [selectedPoly, setSelectedPoly] = useState(SAMPLE_POLY_MARKETS[0]);
  const [polyNotionalInput, setPolyNotionalInput] = useState<number>(75.0); // <= $100
  const [analyzingPoly, setAnalyzingPoly] = useState(false);
  const [polyAiResult, setPolyAiResult] = useState<any>(null);

  // Perp state
  const [selectedPerpSymbol, setSelectedPerpSymbol] = useState<'BTCUSDT' | 'ETHUSDT'>('BTCUSDT');
  const [perpNotionalInput, setPerpNotionalInput] = useState<number>(300.0); // <= $500

  // Execution pipeline tracking
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStages, setExecutionStages] = useState<PipelineStage[]>([
    { name: '1. Standard Quote Construction (USD Notional)', status: 'IDLE' },
    { name: '2. Pre-Gate Safety Filter (Memecoin Only)', status: 'IDLE' },
    { name: '3. Layer 3 AI Proposal Reviewer (Reject-Only)', status: 'IDLE' },
    { name: '4. Unified Risk Engine Kernel (Hard Caps & Portfolio Caps)', status: 'IDLE' },
    { name: '5. Order Lifecycle & Shadow Fill (dry_run=true)', status: 'IDLE' },
  ]);
  const [lastPipelineOrder, setLastPipelineOrder] = useState<UnifiedOrderRecord | null>(null);

  const memeAdapter = adapterRegistry.get('solana_memecoin') as SolanaMemecoinAdapter;
  const polyAdapter = adapterRegistry.get('polymarket') as PolymarketClobAdapter;
  const perpAdapter = adapterRegistry.get('perp_binance');

  const handleAnalyzePolymarket = async () => {
    setAnalyzingPoly(true);
    try {
      const result = await polymarketEventAnalyst.analyzeMarket(
        selectedPoly.token_id,
        selectedPoly.question,
        selectedPoly.midpoint,
        selectedPoly.resolution_date
      );
      setPolyAiResult(result);
    } finally {
      setAnalyzingPoly(false);
    }
  };

  const handleRunExecutionPipeline = async (side: Side) => {
    setIsExecuting(true);
    setLastPipelineOrder(null);
    const stages: PipelineStage[] = [
      { name: '1. Standard Quote Construction (USD Notional)', status: 'RUNNING' },
      { name: '2. Pre-Gate Safety Filter (Memecoin Only)', status: 'IDLE' },
      { name: '3. Layer 3 AI Proposal Reviewer (Reject-Only)', status: 'IDLE' },
      { name: '4. Unified Risk Engine Kernel (Hard Caps & Portfolio Caps)', status: 'IDLE' },
      { name: '5. Order Lifecycle & Shadow Fill (dry_run=true)', status: 'IDLE' },
    ];
    setExecutionStages([...stages]);

    try {
      // Stage 1: Build Quote
      await new Promise((r) => setTimeout(r, 400));
      const adapter = adapterRegistry.get(selectedMarket);
      let symbol = '';
      let notional = 0;
      let meta: Record<string, any> = {};

      if (selectedMarket === 'solana_memecoin') {
        symbol = selectedMeme.symbol;
        notional = memeNotionalInput;
        meta = { safety: selectedMeme.safety };
      } else if (selectedMarket === 'polymarket') {
        symbol = selectedPoly.token_id;
        notional = polyNotionalInput;
        meta = { market_title: selectedPoly.question, ai_estimate: polyAiResult?.ai_probability_estimate };
      } else {
        symbol = selectedPerpSymbol;
        notional = perpNotionalInput;
      }

      let quote: Quote;
      try {
        quote = await adapter.quote(symbol, side, notional, meta);
      } catch (err: any) {
        stages[0].status = 'FAIL';
        stages[0].message = err.message;
        setExecutionStages([...stages]);
        setIsExecuting(false);
        return;
      }

      stages[0].status = 'PASS';
      stages[0].message = `Created Quote: ${side} ${quote.size} ${quote.symbol} = $${quote.notional_usd} USD Notional`;
      setExecutionStages([...stages]);

      // Stage 2: Safety Filter (MANDATORY BEFORE RISK KERNEL)
      stages[1].status = 'RUNNING';
      setExecutionStages([...stages]);
      await new Promise((r) => setTimeout(r, 450));

      if (selectedMarket === 'solana_memecoin') {
        if (!selectedMeme.safety.passed) {
          stages[1].status = 'FAIL';
          stages[1].message = `Safety filter BLOCKED token: ${selectedMeme.safety.reasons.join(', ')}`;
          setExecutionStages([...stages]);

          // Record blocked order
          const blockedOrder: UnifiedOrderRecord = {
            id: `ORD-${Date.now().toString(36).toUpperCase()}`,
            adapter: selectedMarket,
            symbol: quote.symbol,
            side: quote.side,
            notional_usd: quote.notional_usd,
            price: quote.price,
            size: quote.size,
            status: 'BLOCKED',
            reason_code: `safety_filter_failed: ${selectedMeme.safety.reasons.join(', ')}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          unifiedJournal.recordOrder(blockedOrder);
          onOrderCompleted(blockedOrder);
          setLastPipelineOrder(blockedOrder);
          setIsExecuting(false);
          return;
        } else {
          stages[1].status = 'PASS';
          stages[1].message = `CoinScan passed: p_rug=${selectedMeme.safety.p_rug} (<0.15), bundle=${selectedMeme.safety.bundle_pct} (<0.40), LP locked`;
        }
      } else {
        stages[1].status = 'PASS';
        stages[1].message = 'Safety filter not required for this asset class (Perps/Polymarket)';
      }
      setExecutionStages([...stages]);

      // Stage 3: Layer 3 AI Proposal Reviewer (Reject-Only)
      stages[2].status = 'RUNNING';
      setExecutionStages([...stages]);
      await new Promise((r) => setTimeout(r, 400));

      const aiReview = await fineTunedProposalReviewer.reviewProposal(quote);
      if (aiReview.rejected) {
        stages[2].status = 'FAIL';
        stages[2].message = `AI Reviewer REJECTED proposal: ${aiReview.reason}`;
        setExecutionStages([...stages]);

        const blockedOrder: UnifiedOrderRecord = {
          id: `ORD-${Date.now().toString(36).toUpperCase()}`,
          adapter: selectedMarket,
          symbol: quote.symbol,
          side: quote.side,
          notional_usd: quote.notional_usd,
          price: quote.price,
          size: quote.size,
          status: 'BLOCKED',
          reason_code: `ai_reviewer_rejected: ${aiReview.reason}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        unifiedJournal.recordOrder(blockedOrder);
        onOrderCompleted(blockedOrder);
        setLastPipelineOrder(blockedOrder);
        setIsExecuting(false);
        return;
      }

      stages[2].status = 'PASS';
      stages[2].message = `${aiReview.reviewer_model}: Verdict NO_OBJECTION. Handing off to Risk Kernel.`;
      setExecutionStages([...stages]);

      // Stage 4: Risk Engine Gate (Single source of "no")
      stages[3].status = 'RUNNING';
      setExecutionStages([...stages]);
      await new Promise((r) => setTimeout(r, 450));

      const gateRes = await riskEngine.gate(quote, positions, 25.0);
      if (!gateRes.approved) {
        stages[3].status = 'FAIL';
        stages[3].message = `Risk Engine VETO: ${gateRes.reason}`;
        setExecutionStages([...stages]);

        const blockedOrder: UnifiedOrderRecord = {
          id: `ORD-${Date.now().toString(36).toUpperCase()}`,
          adapter: selectedMarket,
          symbol: quote.symbol,
          side: quote.side,
          notional_usd: quote.notional_usd,
          price: quote.price,
          size: quote.size,
          status: 'REJECTED',
          reason_code: gateRes.reason,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        unifiedJournal.recordOrder(blockedOrder);
        onOrderCompleted(blockedOrder);
        setLastPipelineOrder(blockedOrder);
        setIsExecuting(false);
        return;
      }

      stages[3].status = 'PASS';
      stages[3].message = `Approved by Risk Kernel. Exposure limits cleared (Hard Cap: $${adapter.hardCapUsd}).`;
      setExecutionStages([...stages]);

      // Stage 5: Order Submission (Dry Run)
      stages[4].status = 'RUNNING';
      setExecutionStages([...stages]);
      await new Promise((r) => setTimeout(r, 500));

      const orderRes = await adapter.submit(quote, true);
      stages[4].status = 'PASS';
      stages[4].message = `Order FILLED in shadow accounting! Order ID: ${orderRes.order_id} (dry_run=true)`;
      setExecutionStages([...stages]);

      const filledOrder: UnifiedOrderRecord = {
        id: orderRes.order_id || `ORD-${Date.now()}`,
        adapter: selectedMarket,
        symbol: quote.symbol,
        side: quote.side,
        notional_usd: quote.notional_usd,
        price: quote.price,
        size: quote.size,
        status: 'FILLED',
        reason_code: 'approved_risk_kernel_shadow_fill',
        strategy_id: quote.metadata?.strategy_id || `${selectedMarket}_default`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      unifiedJournal.recordOrder(filledOrder);
      onOrderCompleted(filledOrder);
      setLastPipelineOrder(filledOrder);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Market Selector Tabs (Primary focus: Memecoins + Polymarket. Baseline: Perps) */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMarket('solana_memecoin')}
            className={`px-4 py-2 rounded-md font-bold transition-all flex items-center gap-2 ${
              selectedMarket === 'solana_memecoin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>1. Solana Memecoins (Jupiter + CoinScan)</span>
            <span className="text-[10px] bg-amber-950 px-1.5 py-0.2 rounded border border-amber-800 text-amber-400">
              Primary v1.0
            </span>
          </button>

          <button
            onClick={() => setSelectedMarket('polymarket')}
            className={`px-4 py-2 rounded-md font-bold transition-all flex items-center gap-2 ${
              selectedMarket === 'polymarket'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
            }`}
          >
            <Scale className="w-4 h-4 text-indigo-400" />
            <span>2. Polymarket CLOB (Prediction)</span>
            <span className="text-[10px] bg-indigo-950 px-1.5 py-0.2 rounded border border-indigo-800 text-indigo-400">
              Primary v1.0
            </span>
          </button>

          <button
            onClick={() => setSelectedMarket('perp_binance')}
            className={`px-4 py-2 rounded-md font-bold transition-all flex items-center gap-2 ${
              selectedMarket === 'perp_binance'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>3. Binance Futures (Perpetuals)</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700 text-slate-400">
              Baseline
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400">
          Hard Cap:{' '}
          <strong className="text-white">
            {selectedMarket === 'solana_memecoin' ? '$25 USD (STRICT)' : selectedMarket === 'polymarket' ? '$100 USD' : '$500 USD'}
          </strong>
        </div>
      </div>

      {/* ADAPTER 1: SOLANA MEMECOINS VIEW */}
      {selectedMarket === 'solana_memecoin' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_MEMECOINS.map((token) => {
              const isSelected = selectedMeme.mint === token.mint;
              return (
                <div
                  key={token.mint}
                  onClick={() => setSelectedMeme(token)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-950/20 border-amber-500/60 shadow-md'
                      : 'bg-[#10141f] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{token.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        token.safety.passed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {token.safety.passed ? 'SAFETY PASSED' : 'RUG HAZARD'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Symbol:</span>
                      <strong className="text-amber-300 font-bold">{token.symbol}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Price USD:</span>
                      <span className="text-slate-200">${token.priceUsd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume Spike:</span>
                      <span className="text-emerald-400">{token.volumeSpike}x avg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RSI (1m):</span>
                      <span className="text-slate-200">{token.rsi1m}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>p_rug metric:</span>
                      <span className={token.safety.p_rug <= 0.15 ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                        {token.safety.p_rug} (max 0.15)
                      </span>
                    </div>
                  </div>

                  {!token.safety.passed && (
                    <div className="mt-2 p-1.5 rounded bg-rose-950/40 border border-rose-800 text-[10px] text-rose-300">
                      Veto Reasons: {token.safety.reasons.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Memecoin Quote Box with $25 Hard Cap Slider */}
          <div className="bg-[#10141f] border border-amber-900/40 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  JUPITER SWAP &amp; USD NOTIONAL SIZER ({selectedMeme.symbol})
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Jupiter DEX Route • Slippage cap: 300 bps • Max hold timeout: 30 minutes • Hard $25 USD limit
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-400">Order Notional:</span>
                <span className="text-lg font-bold text-amber-400">${memeNotionalInput.toFixed(2)} USD</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Exposure Amount (Hard Cap: $25.00)</span>
                  <span className="text-white font-bold">${memeNotionalInput} / $25 max</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1"
                  value={memeNotionalInput}
                  onChange={(e) => setMemeNotionalInput(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 h-2 rounded cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-[#0b0e14] p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500">Estimated Tokens</span>
                  <div className="text-sm font-bold text-white">
                    {Math.round(memeNotionalInput / selectedMeme.priceUsd).toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#0b0e14] p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500">Stop-Loss (2x ATR)</span>
                  <div className="text-sm font-bold text-rose-400">
                    ${(selectedMeme.priceUsd * 0.94).toFixed(6)} (-6%)
                  </div>
                </div>
                <div className="bg-[#0b0e14] p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500">Take-Profit (2R)</span>
                  <div className="text-sm font-bold text-emerald-400">
                    ${(selectedMeme.priceUsd * 1.12).toFixed(6)} (+12%)
                  </div>
                </div>
                <div className="bg-[#0b0e14] p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500">Max Hold Period</span>
                  <div className="text-sm font-bold text-cyan-300">30 Minutes</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => handleRunExecutionPipeline('BUY')}
                  disabled={isExecuting}
                  className="px-6 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {isExecuting ? 'Running Order Pipeline...' : `Execute Quote for $${memeNotionalInput} USD`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADAPTER 2: POLYMARKET CLOB VIEW */}
      {selectedMarket === 'polymarket' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_POLY_MARKETS.map((ev) => {
              const isSelected = selectedPoly.token_id === ev.token_id;
              return (
                <div
                  key={ev.token_id}
                  onClick={() => {
                    setSelectedPoly(ev);
                    setPolyAiResult(null);
                  }}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/20 border-indigo-500/60 shadow-md'
                      : 'bg-[#10141f] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] text-indigo-400 font-bold mb-1">{ev.category}</div>
                  <h5 className="font-bold text-white text-xs mb-3 leading-snug">{ev.question}</h5>

                  <div className="space-y-1 text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>CLOB Midpoint:</span>
                      <strong className="text-white font-bold">{(ev.midpoint * 100).toFixed(0)}% (${ev.midpoint})</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Best Bid / Ask:</span>
                      <span className="text-slate-300">${ev.best_bid} / ${ev.best_ask}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>24h Volume:</span>
                      <span className="text-cyan-300">${(ev.volume_24h / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Resolution:</span>
                      <span className="text-slate-400">{ev.resolution_date.substring(0, 10)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Probability Analyst & GTC Maker Box */}
          <div className="bg-[#10141f] border border-indigo-900/40 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-400" />
                  POLYMARKET CLOB QUOTER &amp; PROBABILITY ANALYST
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  GTC Resting Limits • EIP-712 Auth • Passive Two-Sided Maker Spread within 20 bps
                </p>
              </div>

              <button
                onClick={handleAnalyzePolymarket}
                disabled={analyzingPoly}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {analyzingPoly ? 'Analyzing Event Probability...' : 'Run Layer 2 AI Analyst'}
              </button>
            </div>

            {/* AI Analysis Result Card */}
            {polyAiResult && (
              <div className="bg-indigo-950/30 border border-indigo-500/40 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    AI Event Probability: {(polyAiResult.ai_probability_estimate * 100).toFixed(1)}% vs CLOB Midpoint {(polyAiResult.clob_midpoint * 100).toFixed(0)}%
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      polyAiResult.candidate_signal_emitted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {polyAiResult.candidate_signal_emitted ? 'DEVIATION SIGNAL TRIGGERED (>8%)' : 'NO DEVIATION TRIGGER (<8%)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 italic">{polyAiResult.rationale}</p>
              </div>
            )}

            {/* Quoter inputs */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Notional Size USD (Hard Cap: $100.00)</span>
                <span className="text-white font-bold">${polyNotionalInput} / $100 max</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={polyNotionalInput}
                onChange={(e) => setPolyNotionalInput(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 h-2 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => handleRunExecutionPipeline('BUY')}
                disabled={isExecuting}
                className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                {isExecuting ? 'Running Order Pipeline...' : `Submit GTC Limit for $${polyNotionalInput} USD`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADAPTER 3: BINANCE FUTURES (PERP) VIEW */}
      {selectedMarket === 'perp_binance' && (
        <div className="space-y-4">
          <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  BINANCE USD-M FUTURES EXECUTION (BASELINE)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Funding Watcher • Liquidation Density Monitor • Hard Cap: $500 USD
                </p>
              </div>

              <div className="flex items-center gap-2">
                {['BTCUSDT', 'ETHUSDT'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedPerpSymbol(s as any)}
                    className={`px-3 py-1.5 rounded font-bold transition-colors ${
                      selectedPerpSymbol === s
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Notional Size USD (Hard Cap: $500.00)</span>
                <span className="text-white font-bold">${perpNotionalInput} / $500 max</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="25"
                value={perpNotionalInput}
                onChange={(e) => setPerpNotionalInput(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 h-2 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                onClick={() => handleRunExecutionPipeline('BUY')}
                disabled={isExecuting}
                className="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                {isExecuting ? 'Running Pipeline...' : `Execute Perp Order for $${perpNotionalInput} USD`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified 5-Stage Execution Verification Pipeline */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          UNIFIED ORDER EXECUTION PIPELINE (PROPOSED → GATED → APPROVED → SUBMITTED → FILLED)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {executionStages.map((st, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border text-[11px] ${
                st.status === 'RUNNING'
                  ? 'bg-cyan-950/20 border-cyan-500/50 text-cyan-200'
                  : st.status === 'PASS'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                  : st.status === 'FAIL'
                  ? 'bg-rose-950/20 border-rose-500/50 text-rose-200'
                  : 'bg-[#0b0e14] border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-[10px]">STAGE 0{i + 1}</span>
                {st.status === 'RUNNING' && <span className="text-cyan-400 animate-pulse">RUNNING</span>}
                {st.status === 'PASS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {st.status === 'FAIL' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
              </div>
              <div className="font-semibold text-slate-200 text-xs mb-1">{st.name}</div>
              {st.message && <div className="text-[10px] text-slate-300 mt-1 leading-tight">{st.message}</div>}
            </div>
          ))}
        </div>

        {/* Order Reconciled banner */}
        {lastPipelineOrder && (
          <div
            className={`mt-4 p-3.5 rounded-lg border text-xs flex items-center justify-between ${
              lastPipelineOrder.status === 'FILLED'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
            }`}
          >
            <div>
              <span className="font-bold uppercase tracking-wider">
                {lastPipelineOrder.status === 'FILLED' ? 'ORDER RECONCILED (SHADOW JOURNAL RECORDED)' : 'ORDER VETOED & BLOCKED BY ENGINE'}
              </span>
              <div className="text-slate-300 text-[11px] mt-0.5">
                ID: <code>{lastPipelineOrder.id}</code> | Market: {lastPipelineOrder.adapter} | Reason: {lastPipelineOrder.reason_code}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                lastPipelineOrder.status === 'FILLED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {lastPipelineOrder.status}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
