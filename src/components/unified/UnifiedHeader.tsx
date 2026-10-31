import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  PowerOff,
  Clock,
  Sparkles,
  Layers,
  Cpu,
  Coins,
  Scale,
  TrendingUp,
  FileCode,
} from 'lucide-react';

interface UnifiedHeaderProps {
  isArmed: boolean;
  onToggleArmed: () => void;
  dailyLossTripped: boolean;
  onEmergencyKill: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  isArmed,
  onToggleArmed,
  dailyLossTripped,
  onEmergencyKill,
  activeTab,
  setActiveTab,
}) => {
  const [utcTime, setUtcTime] = useState('');
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().substring(11, 19) + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const navTabs = [
    { id: 'cockpit', label: 'Multi-Market Cockpit', icon: Layers },
    { id: 'rust_kernel', label: 'Rust Hot Path', icon: Cpu, badge: '<1µs' },
    { id: 'risk_kernel', label: 'Risk Kernel (USD Caps)', icon: ShieldCheck },
    { id: 'ai_evolution', label: 'Self-Evolving AI', icon: Sparkles, badge: 'AlphaEvo' },
    { id: 'strategy_dsl', label: 'Strategy DSL Studio', icon: FileCode },
    { id: 'safety_filter', label: 'CoinScan Safety', icon: Coins, badge: '25/day' },
    { id: 'demo_gonogo', label: '3-Week Demo & Go/No-Go', icon: Scale, badge: 'Day 14' },
    { id: 'journal', label: 'Unified Journal', icon: Radio },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#090d16] sticky top-0 z-50">
      {/* Top operational status bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold tracking-wider text-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-white font-bold">NEXUS</span>
            <span className="text-cyan-400 font-bold">×</span>
            <span className="text-emerald-400 font-bold">TONYBOT</span>
            <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              UNIFIED v1.0
            </span>
          </div>

          <div className="h-3 w-px bg-slate-800 hidden sm:block"></div>

          {/* 3 Adapter Badges with caps */}
          <div className="hidden lg:flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/50">
              MEME: $25 CAP
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/50">
              POLY: $100 CAP
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
              PERP: $500 CAP
            </span>
          </div>

          {/* Execution Mode */}
          <div className="flex items-center gap-1.5 hidden md:flex">
            <span className="text-slate-500">MODE:</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              SHADOW DEMO (DRY_RUN=TRUE)
            </span>
          </div>

          {/* Circuit breaker */}
          <div className="flex items-center gap-1.5 hidden xl:flex">
            <span className="text-slate-500">GATE:</span>
            {dailyLossTripped ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> TRIPPED
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> RISK ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-slate-400 hidden sm:flex">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{utcTime}</span>
          </div>

          <button
            onClick={onToggleArmed}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              isArmed
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold'
            }`}
          >
            {isArmed ? 'Disarm Kernel' : 'Arm Kernel'}
          </button>

          <button
            onClick={() => setShowKillConfirm(true)}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 transition-colors flex items-center gap-1"
          >
            <PowerOff className="w-3 h-3 text-rose-400" />
            KILL-SWITCH
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="px-4 flex items-center overflow-x-auto space-x-1 py-1.5 text-xs">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-slate-400" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Emergency Kill Modal */}
      {showKillConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111624] border border-rose-700/60 rounded-lg max-w-md w-full p-6 shadow-2xl font-mono text-xs">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-sm font-bold text-white">EMERGENCY KILL-SWITCH</h3>
            </div>
            <p className="text-slate-300 mb-4 leading-relaxed">
              Instantly disarms all 3 adapters (Perps, Polymarket, Memecoins), blocks all proposed orders in the Risk Engine, cancels active resting GTC quotes, and trips the daily loss circuit breaker.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowKillConfirm(false)}
                className="px-4 py-2 rounded text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onEmergencyKill();
                  setShowKillConfirm(false);
                }}
                className="px-4 py-2 rounded font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950 transition-all flex items-center gap-1.5"
              >
                <PowerOff className="w-3.5 h-3.5" />
                EXECUTE EMERGENCY KILL
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
