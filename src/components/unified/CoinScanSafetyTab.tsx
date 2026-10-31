import React, { useState } from 'react';
import {
  Coins,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Lock,
  Unlock,
} from 'lucide-react';
import { SafetyScanResult } from '../../types/unified.ts';
import { SAMPLE_MEMECOINS, SolanaMemecoinAdapter } from '../../core/adapters/solanaMemecoin.ts';
import { adapterRegistry } from '../../core/adapters/registry.ts';

export const CoinScanSafetyTab: React.FC = () => {
  const memeAdapter = adapterRegistry.get('solana_memecoin') as SolanaMemecoinAdapter;
  const [scanQuota, setScanQuota] = useState(memeAdapter.getDailyScansStatus());

  const [inputMint, setInputMint] = useState('');
  const [scanHistory, setScanHistory] = useState<SafetyScanResult[]>([
    SAMPLE_MEMECOINS[0].safety,
    SAMPLE_MEMECOINS[1].safety,
    SAMPLE_MEMECOINS[2].safety,
  ]);
  const [activeScan, setActiveScan] = useState<SafetyScanResult | null>(SAMPLE_MEMECOINS[0].safety);
  const [isScanning, setIsScanning] = useState(false);

  const handleScanMint = async (mintToScan: string) => {
    setIsScanning(true);
    try {
      const res = await memeAdapter.runSafetyScan(mintToScan);
      setActiveScan(res);
      setScanHistory((prev) => [res, ...prev.filter((p) => p.mint !== res.mint)]);
      setScanQuota(memeAdapter.getDailyScansStatus());
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const rejectedCount = scanHistory.filter((s) => !s.passed).length;

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner: Safety Filter Invariant & Free-Tier Quota */}
      <div className="bg-[#10141f] border border-amber-900/40 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                COINSCAN TOKEN SAFETY FILTER ENGINE (§5.3)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
              <strong>Non-Negotiable Rule:</strong> Runs <em>before</em> the risk kernel, not after. No memecoin order can be quoted or submitted without passing all hard thresholds.
            </p>
          </div>

          <div className="bg-[#0b0e14] border border-slate-800 rounded-lg px-4 py-2 text-right">
            <span className="text-[10px] text-slate-500">FREE-TIER SCAN QUOTA</span>
            <div className="text-base font-bold text-amber-400">
              {scanQuota.used} / {scanQuota.max} Scans
            </div>
            <span className="text-[10px] text-slate-400">{scanQuota.remaining} remaining today</span>
          </div>
        </div>
      </div>

      {/* Thresholds Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] text-slate-500 uppercase">p_rug (Rug Risk)</span>
          <div className="text-base font-bold text-emerald-400 mt-1">&le; 0.15</div>
          <span className="text-[10px] text-slate-400">AI Rug Prediction</span>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] text-slate-500 uppercase">bundle_pct</span>
          <div className="text-base font-bold text-emerald-400 mt-1">&le; 0.40</div>
          <span className="text-[10px] text-slate-400">Sniped Bundle Detection</span>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] text-slate-500 uppercase">sniper_pct</span>
          <div className="text-base font-bold text-emerald-400 mt-1">&le; 0.30</div>
          <span className="text-[10px] text-slate-400">Bot Sniper Clustering</span>
        </div>

        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] text-slate-500 uppercase">top10_holder_pct</span>
          <div className="text-base font-bold text-emerald-400 mt-1">&le; 0.50</div>
          <span className="text-[10px] text-slate-400">Whale Concentration</span>
        </div>
      </div>

      {/* Interactive Token Mint Scanner Bar */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold">
          SCAN TOKEN MINT / TEST SAMPLES
        </h4>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste Solana token mint address (e.g. 7xKXtg2CW...)..."
            value={inputMint}
            onChange={(e) => setInputMint(e.target.value)}
            className="flex-1 bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => handleScanMint(inputMint.trim() || SAMPLE_MEMECOINS[0].mint)}
            disabled={isScanning}
            className="px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {isScanning ? 'Scanning...' : 'Scan Mint'}
          </button>
        </div>

        {/* Quick test buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="text-slate-500">Quick Test Samples:</span>
          {SAMPLE_MEMECOINS.map((m) => (
            <button
              key={m.mint}
              onClick={() => handleScanMint(m.mint)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
            >
              <span>{m.name}</span>
              {m.safety.passed ? (
                <span className="text-emerald-400 text-[10px]">(Safe)</span>
              ) : (
                <span className="text-rose-400 text-[10px]">(Malicious Rug)</span>
              )}
            </button>
          ))}
        </div>

        {/* Active Scan Result Inspector */}
        {activeScan && (
          <div
            className={`mt-4 p-4 rounded-lg border space-y-3 ${
              activeScan.passed
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeScan.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="font-bold text-sm text-white">
                  {activeScan.passed ? 'SAFETY FILTER PASSED — CLEARED FOR KERNEL' : 'HARD VETO: MALICIOUS TOKEN PATTERN DETECTED'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Mint: {activeScan.mint.substring(0, 16)}...</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs">
              <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">p_rug</span>
                <div className={`font-bold ${activeScan.p_rug <= 0.15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeScan.p_rug}
                </div>
              </div>
              <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">bundle_pct</span>
                <div className={`font-bold ${activeScan.bundle_pct <= 0.4 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(activeScan.bundle_pct * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">sniper_pct</span>
                <div className={`font-bold ${activeScan.sniper_pct <= 0.3 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(activeScan.sniper_pct * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">top10_holder</span>
                <div className={`font-bold ${activeScan.top10_holder_pct <= 0.5 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(activeScan.top10_holder_pct * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">LP Locked</span>
                <div className={`font-bold ${activeScan.lp_locked ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeScan.lp_locked ? 'LOCKED' : 'UNLOCKED'}
                </div>
              </div>
              <div className="bg-[#0b0e14] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500">Age</span>
                <div className={`font-bold ${activeScan.token_age_hours >= 24 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeScan.token_age_hours}h
                </div>
              </div>
            </div>

            {!activeScan.passed && activeScan.reasons.length > 0 && (
              <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-[11px] text-rose-300">
                <strong>Veto Reason Codes:</strong> {activeScan.reasons.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Safety Filter Efficacy Checker (Go/No-Go Criterion 4) */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            CRITERION 4 VERIFICATION: SAFETY FILTER EFFICACY (§9.1)
          </h4>
          <span className="text-[11px] text-emerald-400 font-bold">
            {rejectedCount} of {scanHistory.length} Scans Blocked ({rejectedCount >= 3 ? 'Criterion Satisfied' : 'Pending &ge;3 Blocks'})
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          &ldquo;Safety filter efficacy: &ge; 3 of 25 daily scans rejected (if never rejects, threshold is too loose or filter is not wired).&rdquo;
        </p>
      </div>
    </div>
  );
};
