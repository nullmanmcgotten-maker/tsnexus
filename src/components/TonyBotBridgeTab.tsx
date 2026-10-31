import React, { useState } from 'react';
import {
  Bot,
  ExternalLink,
  Radio,
  Send,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Settings, TonyBotSignal } from '../types/nexus.ts';
import { journalStore } from '../engine/journalStore.ts';

interface TonyBotBridgeTabProps {
  settings: Settings;
  signals: TonyBotSignal[];
  onRefreshSignals: () => void;
  onApproveSignalInNexus: (signal: TonyBotSignal) => void;
}

export const TonyBotBridgeTab: React.FC<TonyBotBridgeTabProps> = ({
  settings,
  signals,
  onRefreshSignals,
  onApproveSignalInNexus,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<
    Array<{ type: 'user' | 'bot'; text: string; timestamp: string }>
  >([
    {
      type: 'bot',
      text: '🤖 TonyBot Companion online and linked to NEXUS Trading Engine.\nAvailable commands: /status, /risk, /positions, /scan [symbol], /killswitch',
      timestamp: new Date().toISOString().substring(11, 19),
    },
  ]);

  const [testSymbol, setTestSymbol] = useState('BTCUSDT');
  const [testAction, setTestAction] = useState<'BUY' | 'SELL'>('BUY');
  const [testSetup, setTestSetup] = useState('PRE_PUMP_ABSORPTION');
  const [testConfidence, setTestConfidence] = useState(0.85);

  const handleSendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    const ts = new Date().toISOString().substring(11, 19);
    const newHistory = [...commandHistory, { type: 'user' as const, text: cmd, timestamp: ts }];

    let responseText = '';
    const lower = cmd.toLowerCase();

    if (lower === '/status') {
      responseText = `🟢 <b>NEXUS STATUS:</b>\nEngine: ${settings.enable_live_orders ? 'ARMED (LIVE)' : 'ARMED (PAPER)'}\nSymbol: ${settings.symbol}\nCapital: $${settings.account_capital}\nTonyBot Bridge: Online & Listening`;
    } else if (lower === '/risk') {
      responseText = `🛡️ <b>RISK GOVERNOR:</b>\nMax Risk/Trade: ${(settings.max_risk_per_trade * 100).toFixed(2)}%\nMax Daily Loss: ${(settings.max_daily_loss * 100).toFixed(1)}%\nCircuit Breaker: Normal (Green)`;
    } else if (lower === '/positions') {
      responseText = `📊 <b>ACTIVE POSITIONS:</b>\n1. BTCUSDT LONG | 0.154 Qty | Mark: $65,020 | PnL: +$142.60`;
    } else if (lower.startsWith('/scan')) {
      const sym = cmd.split(' ')[1]?.toUpperCase() || 'BTCUSDT';
      responseText = `🔍 <b>SCAN RESULT FOR ${sym}:</b>\nDetected: PRE_PUMP_ABSORPTION\nConfidence: 86%\nDelta Imbalance: +0.42\nThesis Grade: A (Ready for Execution)`;
    } else if (lower === '/killswitch') {
      responseText = `🚨 <b>EMERGENCY KILL-SWITCH TRIPPED!</b>\nAll order routing suspended. Disarmed.`;
    } else {
      responseText = `Unknown command "${cmd}". Try /status, /risk, /positions, or /scan btc`;
    }

    newHistory.push({ type: 'bot' as const, text: responseText, timestamp: ts });
    setCommandHistory(newHistory);
    setCommandInput('');
  };

  const handleSimulateWebhook = async () => {
    const newSig: TonyBotSignal = {
      id: `TONY-HOOK-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      symbol: testSymbol,
      action: testAction,
      source: 'WEBHOOK',
      setup: testSetup,
      confidence: testConfidence,
      suggested_entry: testSymbol === 'BTCUSDT' ? 65000 : 3500,
      suggested_stop: testSymbol === 'BTCUSDT' ? 64800 : 3480,
      suggested_target: testSymbol === 'BTCUSDT' ? 65400 : 3540,
      status: 'PENDING',
      notes: `Inbound webhook triggered from TonyBot scanner for ${testSymbol}`,
    };

    journalStore.addSignal(newSig);
    onRefreshSignals();

    try {
      await fetch('/api/tonybot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: testSymbol,
          action: testAction,
          setup: testSetup,
          confidence: testConfidence,
          notes: newSig.notes,
        }),
      });
    } catch {
      // Local fallback
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner: Repo Link & Integration Card */}
      <div className="bg-[#10141f] border border-cyan-800/40 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">TONYBOT COMPANION BRIDGE</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  CONNECTED
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Two-way signal exchange &amp; Telegram command controller for{' '}
                <a
                  href="https://github.com/nullmanmcgotten-maker/TONYBOT"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 underline hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  nullmanmcgotten-maker/TONYBOT <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-slate-500">WEBHOOK INGESTION URL</div>
              <code className="text-slate-300 bg-[#0b0e14] px-2 py-1 rounded border border-slate-800 text-[11px]">
                POST /api/tonybot/webhook
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Live Incoming Signals & Bot Command Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incoming Signal Queue */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                INCOMING SIGNALS FROM TONYBOT ({signals.length})
              </h4>
              <span className="text-[11px] text-slate-500">Awaiting NEXUS Risk Gate</span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {signals.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No signals currently in queue.</div>
              ) : (
                signals.map((sig) => (
                  <div
                    key={sig.id}
                    className="bg-[#0b0e14] border border-slate-800 rounded-lg p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{sig.symbol}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            sig.action === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {sig.action}
                        </span>
                        <span className="text-slate-400 text-[11px]">({sig.source})</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sig.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : sig.status === 'EXECUTED'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : sig.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {sig.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Setup: <strong className="text-slate-200">{sig.setup}</strong></span>
                      <span>Confidence: <strong className="text-cyan-300">{(sig.confidence * 100).toFixed(0)}%</strong></span>
                    </div>

                    <p className="text-slate-400 text-[11px] leading-relaxed italic">{sig.notes}</p>

                    {sig.status === 'PENDING' && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            journalStore.updateSignalStatus(sig.id, 'REJECTED');
                            onRefreshSignals();
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => onApproveSignalInNexus(sig)}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all flex items-center gap-1"
                        >
                          Send to NEXUS Engine <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Test Signal Injection */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold block mb-2">SIMULATE INBOUND TONYBOT SIGNAL:</span>
            <div className="grid grid-cols-4 gap-2 mb-2">
              <select
                value={testSymbol}
                onChange={(e) => setTestSymbol(e.target.value)}
                className="bg-[#0b0e14] border border-slate-800 rounded px-2 py-1 text-white"
              >
                <option value="BTCUSDT">BTCUSDT</option>
                <option value="ETHUSDT">ETHUSDT</option>
                <option value="SOLUSDT">SOLUSDT</option>
              </select>

              <select
                value={testAction}
                onChange={(e) => setTestAction(e.target.value as any)}
                className="bg-[#0b0e14] border border-slate-800 rounded px-2 py-1 text-white"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>

              <select
                value={testSetup}
                onChange={(e) => setTestSetup(e.target.value)}
                className="bg-[#0b0e14] border border-slate-800 rounded px-2 py-1 text-white col-span-2"
              >
                <option value="PRE_PUMP_ABSORPTION">PRE_PUMP_ABSORPTION</option>
                <option value="EXHAUSTION_REVERSAL">EXHAUSTION_REVERSAL</option>
                <option value="BREAKOUT_ACCEPTANCE">BREAKOUT_ACCEPTANCE</option>
                <option value="FAILED_BREAKOUT">FAILED_BREAKOUT</option>
                <option value="TREND_PULLBACK">TREND_PULLBACK</option>
              </select>
            </div>

            <button
              onClick={handleSimulateWebhook}
              className="w-full py-1.5 rounded bg-cyan-700/80 hover:bg-cyan-600 text-white font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" /> Post Simulated Signal to Webhook
            </button>
          </div>
        </div>

        {/* Telegram / TonyBot Command Simulator */}
        <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                TONYBOT TELEGRAM COMMAND CONSOLE
              </h4>
              <span className="text-[11px] text-slate-500">Live Bot Simulator</span>
            </div>

            {/* Chat output */}
            <div className="bg-[#07090e] border border-slate-900 rounded-lg p-3 h-80 overflow-y-auto space-y-3 font-mono text-xs">
              {commandHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${item.type === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-slate-500 mb-0.5">
                    {item.type === 'user' ? 'You' : 'TonyBot'} • {item.timestamp}
                  </span>
                  <div
                    className={`p-2.5 rounded-lg max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                      item.type === 'user'
                        ? 'bg-slate-800 text-white'
                        : 'bg-[#111827] text-cyan-200 border border-slate-800'
                    }`}
                  >
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick command buttons & input bar */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
              {['/status', '/risk', '/positions', '/scan BTCUSDT', '/killswitch'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => {
                    setCommandInput(cmd);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] whitespace-nowrap transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendCommand} className="flex gap-2">
              <input
                type="text"
                placeholder="Type a bot command (e.g. /status, /risk)..."
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                className="flex-1 bg-[#0b0e14] border border-slate-800 rounded px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
