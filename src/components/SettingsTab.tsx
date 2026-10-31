import React, { useState } from 'react';
import {
  Key,
  Shield,
  Send,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Save,
  Server,
  Zap,
} from 'lucide-react';
import { Settings } from '../types/nexus.ts';

interface SettingsTabProps {
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSaveSettings }) => {
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [showSecret, setShowSecret] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTestTelegram = async () => {
    if (!formData.telegram_bot_token || !formData.telegram_chat_id) {
      setTelegramStatus('Error: Provide bot token and chat ID first.');
      return;
    }
    setTelegramStatus('Dispatching test ping to Telegram...');
    try {
      const res = await fetch('/api/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: formData.telegram_bot_token,
          chatId: formData.telegram_chat_id,
          text: `🟢 <b>NEXUS QUANT ENGINE</b>\nTest notification successfully received!\nTimestamp: ${new Date().toISOString()}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTelegramStatus('Success! Message delivered to your Telegram chat.');
      } else {
        setTelegramStatus(`Failed: ${data.error || 'Check token/chat_id'}`);
      }
    } catch (err: any) {
      setTelegramStatus(`Network error: ${err.message}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              NEXUS ENGINE CONFIGURATION &amp; CREDENTIALS
            </h3>
            <p className="text-slate-400 text-[11px] mt-1">
              Configuration mapped directly to <code>nexus_engine/config.py</code>.
            </p>
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            {saveSuccess ? 'Settings Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-amber-950/20 border border-amber-600/40 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-amber-200 text-[11px] leading-relaxed">
          <strong>Security Principle:</strong> Never enable withdrawal permissions on your Binance API keys.
          Restrict permissions strictly to Futures trading. If credentials are empty, NEXUS operates in
          full offline paper simulation mode without real exchange funds.
        </div>
      </div>

      {/* Binance Futures Configuration */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          BINANCE USD-M FUTURES EXCHANGE ADAPTER
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1">Binance API Key</label>
            <input
              type="text"
              placeholder="e.g. vmPUZE6mv9SD5VNHk4HlWFsOr6a..."
              value={formData.binance_api_key || ''}
              onChange={(e) => setFormData({ ...formData, binance_api_key: e.target.value })}
              className="w-full bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Binance API Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                placeholder="HMAC SHA-256 Secret Key"
                value={formData.binance_api_secret || ''}
                onChange={(e) => setFormData({ ...formData, binance_api_secret: e.target.value })}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Base URL</label>
            <input
              type="text"
              value={formData.binance_base_url}
              onChange={(e) => setFormData({ ...formData, binance_base_url: e.target.value })}
              className="w-full bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white"
            />
          </div>

          <div className="flex items-center gap-6 pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={formData.binance_testnet}
                onChange={(e) => setFormData({ ...formData, binance_testnet: e.target.checked })}
                className="accent-emerald-500 w-4 h-4 rounded"
              />
              <span>Use Binance Futures Testnet</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={formData.enable_live_orders}
                onChange={(e) => setFormData({ ...formData, enable_live_orders: e.target.checked })}
                className="accent-rose-500 w-4 h-4 rounded"
              />
              <span className={formData.enable_live_orders ? 'text-rose-400 font-bold' : ''}>
                Enable Live Orders (Disarm for Paper)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Telegram Bot & Notifier Configuration */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
          <Send className="w-4 h-4 text-cyan-400" />
          TELEGRAM APPROVAL &amp; LIFECYCLE NOTIFIER
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1">Telegram Bot Token</label>
            <input
              type="text"
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={formData.telegram_bot_token || ''}
              onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
              className="w-full bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Telegram Chat ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. -100123456789 or user chat ID"
                value={formData.telegram_chat_id || ''}
                onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white"
              />
              <button
                type="button"
                onClick={handleTestTelegram}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap transition-colors"
              >
                Send Test Ping
              </button>
            </div>
          </div>
        </div>

        {telegramStatus && (
          <div className="p-2.5 rounded bg-[#0b0e14] border border-slate-800 text-slate-300 text-[11px]">
            {telegramStatus}
          </div>
        )}
      </div>

      {/* Account Sizing & Risk Parameters */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          ACCOUNT CAPITALIZATION &amp; ASSET BASE
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-400 mb-1">Primary Asset Symbol</label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              className="w-full bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Account Capital ($ USD)</label>
            <input
              type="number"
              step="100"
              value={formData.account_capital}
              onChange={(e) => setFormData({ ...formData, account_capital: parseFloat(e.target.value) || 10000 })}
              className="w-full bg-[#0b0e14] border border-slate-800 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Real-time WebSocket Feeds</label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-2">
              <input
                type="checkbox"
                checked={formData.use_realtime_data}
                onChange={(e) => setFormData({ ...formData, use_realtime_data: e.target.checked })}
                className="accent-cyan-500 w-4 h-4 rounded"
              />
              <span>Stream Live Binance AggTrades</span>
            </label>
          </div>
        </div>
      </div>
    </form>
  );
};
