import React, { useState, useEffect } from 'react';
import { UnifiedHeader } from './components/unified/UnifiedHeader.tsx';
import { MarketCockpitTab } from './components/unified/MarketCockpitTab.tsx';
import { RiskKernelTab } from './components/unified/RiskKernelTab.tsx';
import { SelfEvolutionTab } from './components/unified/SelfEvolutionTab.tsx';
import { StrategyDSLTab } from './components/unified/StrategyDSLTab.tsx';
import { CoinScanSafetyTab } from './components/unified/CoinScanSafetyTab.tsx';
import { DemoGoNoGoTab } from './components/unified/DemoGoNoGoTab.tsx';
import { RustKernelTab } from './components/unified/RustKernelTab.tsx';
import { GoogleDriveAppTab } from './components/unified/GoogleDriveAppTab.tsx';
import { JournalTab } from './components/JournalTab.tsx';
import {
  RiskEngineConfig,
  UnifiedOrderRecord,
  UnifiedPosition,
} from './types/unified.ts';
import { DEFAULT_RISK_CONFIG, UnifiedRiskEngine } from './core/kernel/riskEngine.ts';
import { unifiedJournal } from './core/kernel/journal.ts';
import { adapterRegistry } from './core/adapters/registry.ts';
import { DriveProjectBundle } from './core/drive/driveService.ts';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('drive_app');
  const [isArmed, setIsArmed] = useState<boolean>(true);
  const [dailyLossTripped, setDailyLossTripped] = useState<boolean>(false);
  const [riskEngine] = useState<UnifiedRiskEngine>(() => new UnifiedRiskEngine(DEFAULT_RISK_CONFIG));

  const [activeAppSource, setActiveAppSource] = useState<'drive' | 'tsnexus'>('drive');
  const [activeDriveProject, setActiveDriveProject] = useState<DriveProjectBundle | null>(null);

  const [positions, setPositions] = useState<UnifiedPosition[]>([]);
  const [orders, setOrders] = useState<UnifiedOrderRecord[]>([]);

  useEffect(() => {
    // Load initial positions and orders from registry and journal
    adapterRegistry.getAllPositions().then((posList) => setPositions(posList));
    setOrders(unifiedJournal.getOrders());
  }, []);

  const handleToggleArmed = () => {
    setIsArmed(!isArmed);
  };

  const handleEmergencyKill = () => {
    setIsArmed(false);
    setDailyLossTripped(true);
    alert('🚨 EMERGENCY KILL-SWITCH ACTIVATED!\nKernel disarmed. All active resting GTC quotes cancelled and risk gates locked.');
  };

  const handleClosePosition = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  const handleOrderCompleted = (order: UnifiedOrderRecord) => {
    setOrders(unifiedJournal.getOrders());
    // Refresh positions
    adapterRegistry.getAllPositions().then((posList) => setPositions(posList));
  };

  const handleUpdateRiskConfig = (cfg: Partial<RiskEngineConfig>) => {
    riskEngine.updateConfig(cfg);
  };

  return (
    <div className="min-h-screen bg-[#080b11] text-[#e2e8f0] flex flex-col font-['Inter',sans-serif]">
      <UnifiedHeader
        isArmed={isArmed}
        onToggleArmed={handleToggleArmed}
        dailyLossTripped={dailyLossTripped}
        onEmergencyKill={handleEmergencyKill}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAppSource={activeAppSource}
        activeDriveProjectName={activeDriveProject?.projectName}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'drive_app' && (
          <GoogleDriveAppTab
            riskEngine={riskEngine}
            onUpdateRiskConfig={handleUpdateRiskConfig}
            onRefreshOrders={() => setOrders(unifiedJournal.getOrders())}
            activeAppSource={activeAppSource}
            setActiveAppSource={setActiveAppSource}
            activeDriveProject={activeDriveProject}
            setActiveDriveProject={setActiveDriveProject}
          />
        )}
        {activeTab === 'cockpit' && (
          <MarketCockpitTab
            riskEngine={riskEngine}
            positions={positions}
            onOrderCompleted={handleOrderCompleted}
          />
        )}

        {activeTab === 'rust_kernel' && <RustKernelTab />}

        {activeTab === 'risk_kernel' && (
          <RiskKernelTab
            riskEngine={riskEngine}
            positions={positions}
            dailyLossTripped={dailyLossTripped}
            onToggleTripDailyLoss={() => setDailyLossTripped(!dailyLossTripped)}
            onClosePosition={handleClosePosition}
            onUpdateRiskConfig={handleUpdateRiskConfig}
          />
        )}

        {activeTab === 'ai_evolution' && (
          <SelfEvolutionTab
            onRefreshJournal={() => setOrders(unifiedJournal.getOrders())}
          />
        )}

        {activeTab === 'strategy_dsl' && <StrategyDSLTab />}

        {activeTab === 'safety_filter' && <CoinScanSafetyTab />}

        {activeTab === 'demo_gonogo' && <DemoGoNoGoTab />}

        {activeTab === 'journal' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
              <h3 className="text-sm font-bold text-white mb-1">
                UNIFIED MULTI-MARKET ORDER JOURNAL (§3.3)
              </h3>
              <p className="text-[11px] text-slate-400">
                Restart-safe journal tracking orders across Memecoins, Polymarket, and Perps with status reconciliation.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#0b0e14] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Adapter</th>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Notional USD</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Reason Code / Gate</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-semibold text-white">{ord.id}</td>
                        <td className="py-2.5 px-3 capitalize text-slate-300">{ord.adapter.replace('_', ' ')}</td>
                        <td className="py-2.5 px-3 font-bold text-white">{ord.symbol}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ord.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {ord.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{ord.size}</td>
                        <td className="py-2.5 px-3 font-bold text-white">${ord.notional_usd.toFixed(2)}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ord.status === 'FILLED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : ord.status === 'BLOCKED' || ord.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate">
                          {ord.reason_code || 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {ord.created_at.substring(11, 19)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-[#06080d] py-3 px-6 text-center text-xs text-slate-500 font-mono">
        NEXUS × TONYBOT Unified Platform v1.0 • Market-Agnostic Kernel • Pluggable Adapters: Solana Memecoins, Polymarket, Binance Perps
      </footer>
    </div>
  );
}

export default App;
