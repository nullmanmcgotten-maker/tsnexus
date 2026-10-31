import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Bot, 
  PowerOff, 
  Clock, 
  Radio, 
  Zap,
  ExternalLink
} from 'lucide-react';
import { Settings } from '../types/nexus.ts';

interface HeaderProps {
  settings: Settings;
  isArmed: boolean;
  onToggleArmed: () => void;
  dailyLossTripped: boolean;
  onEmergencyKill: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tonyBotConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  isArmed,
  onToggleArmed,
  dailyLossTripped,
  onEmergencyKill,
  activeTab,
  setActiveTab,
  tonyBotConnected,
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

  const navItems = [
    { id: 'cockpit', label: 'Live Cockpit' },
    { id: 'setups', label: 'Signal & Thesis Matrix' },
    { id: 'lifecycle', label: 'Order Lifecycle Runner' },
    { id: 'risk', label: 'Risk Governor' },
    { id: 'journal', label: 'Trade Journal & Stats' },
    { id: 'tonybot', label: 'TonyBot Bridge', badge: 'Companion' },
    { id: 'settings', label: 'Config & Credentials' },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#0b0f19] sticky top-0 z-50">
      {/* Top operational status bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-semibold tracking-wider text-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-subtle"></span>
            <span className="text-emerald-400 font-bold">NEXUS</span>
            <span className="text-slate-400 text-[11px] font-normal">ENGINE v2.4</span>
          </div>

          <div className="h-3 w-px bg-slate-800 hidden sm:block"></div>

          {/* Engine state */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">ENGINE:</span>
            {isArmed ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                ARMED {settings.enable_live_orders ? '(LIVE)' : '(PAPER)'}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                DISARMED
              </span>
            )}
          </div>

          {/* Risk Governor status */}
          <div className="flex items-center gap-1.5 hidden md:flex">
            <span className="text-slate-400">RISK GATE:</span>
            {dailyLossTripped ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-400" /> TRIPPED (BLOCKED)
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> ACTIVE
              </span>
            )}
          </div>

          {/* Binance status */}
          <div className="flex items-center gap-1.5 hidden lg:flex">
            <span className="text-slate-400">EXCHANGE:</span>
            <span className="text-slate-300">
              BINANCE FUTURES ({settings.binance_testnet ? 'TESTNET' : 'PROD'})
            </span>
          </div>

          {/* TonyBot Companion Status */}
          <div className="flex items-center gap-1.5 hidden xl:flex">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">TONYBOT:</span>
            <span className="text-cyan-300 font-semibold flex items-center gap-1">
              LINKED
              <a
                href="https://github.com/nullmanmcgotten-maker/TONYBOT"
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Open TONYBOT repository"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{utcTime}</span>
          </div>

          <button
            onClick={onToggleArmed}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              isArmed
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-900/50'
            }`}
          >
            {isArmed ? 'Disarm Engine' : 'Arm Execution'}
          </button>

          <button
            onClick={() => setShowKillConfirm(true)}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 transition-colors flex items-center gap-1"
            title="Emergency Kill-Switch (Instantly abort execution and cancel open risk)"
          >
            <PowerOff className="w-3 h-3 text-rose-400" />
            KILL-SWITCH
          </button>
        </div>
      </div>

      {/* Main navigation tabs */}
      <div className="px-4 flex items-center overflow-x-auto space-x-1 py-1.5 text-sm">
        {navItems.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Emergency Kill Confirmation Modal */}
      {showKillConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111624] border border-rose-700/60 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-mono">EMERGENCY KILL-SWITCH</h3>
            </div>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              This action immediately trips the NEXUS Risk Governor, disarms all live signal execution, halts pending orders, and broadcasts a circuit-breaker alert to Telegram and TonyBot.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowKillConfirm(false)}
                className="px-4 py-2 rounded text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onEmergencyKill();
                  setShowKillConfirm(false);
                }}
                className="px-4 py-2 rounded text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950 transition-all flex items-center gap-1.5"
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
