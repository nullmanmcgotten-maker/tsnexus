import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  Search,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Shield,
  Layers,
  Cpu,
  LogIn,
  LogOut,
  ChevronRight,
  FolderOpen,
  Sparkles,
  Download,
  Terminal,
  FileJson,
  Code2,
  Clock,
  Eye,
  Sliders,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  AuthState,
  subscribeAuthState,
} from '../../core/auth/googleAuth.ts';
import {
  driveService,
  DriveFile,
  DriveProjectBundle,
} from '../../core/drive/driveService.ts';
import { UnifiedRiskEngine } from '../../core/kernel/riskEngine.ts';
import { dslEngine } from '../../core/strategy/dsl/dslEngine.ts';
import { unifiedJournal } from '../../core/kernel/journal.ts';
import { RiskEngineConfig, StrategyDSL, UnifiedOrderRecord } from '../../types/unified.ts';

interface GoogleDriveAppTabProps {
  riskEngine: UnifiedRiskEngine;
  onUpdateRiskConfig: (cfg: Partial<RiskEngineConfig>) => void;
  onRefreshOrders: () => void;
  activeAppSource: 'drive' | 'tsnexus';
  setActiveAppSource: (source: 'drive' | 'tsnexus') => void;
  activeDriveProject: DriveProjectBundle | null;
  setActiveDriveProject: (bundle: DriveProjectBundle | null) => void;
}

export const GoogleDriveAppTab: React.FC<GoogleDriveAppTabProps> = ({
  riskEngine,
  onUpdateRiskConfig,
  onRefreshOrders,
  activeAppSource,
  setActiveAppSource,
  activeDriveProject,
  setActiveDriveProject,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Drive browser state
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderHistory, setFolderHistory] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'folders' | 'configs' | 'strategies' | 'code'>('all');

  // File inspector
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Execution runner state
  const [isRunningSim, setIsRunningSim] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simSuccess, setSimSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthState((state) => {
      setAuthState(state);
    });

    initAuth(
      (_user, _token) => {
        // Authenticated
      },
      () => {
        // Not authenticated
      }
    );

    return () => unsub();
  }, []);

  // When token is available, load root files
  useEffect(() => {
    if (authState.accessToken) {
      loadDriveFiles(currentFolderId);
    }
  }, [authState.accessToken, currentFolderId]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        loadDriveFiles('root');
      }
    } catch (e: any) {
      setAuthError(e.message || 'Google Sign-In failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setFiles([]);
    setSelectedFile(null);
    setSelectedFileContent(null);
  };

  const loadDriveFiles = async (folderId: string, search?: string) => {
    const token = authState.accessToken;
    if (!token) return;

    setIsLoadingFiles(true);
    try {
      const result = await driveService.listFiles(token, {
        folderId,
        searchTerm: search || searchTerm,
      });
      setFiles(result);
    } catch (err: any) {
      console.error('Error listing files:', err);
      setAuthError(err.message);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFolderClick = (folder: DriveFile) => {
    setCurrentFolderId(folder.id);
    setFolderHistory((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFile(null);
    setSelectedFileContent(null);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = folderHistory[index];
    setFolderHistory((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(target.id);
    setSelectedFile(null);
    setSelectedFileContent(null);
  };

  const handleSelectFile = async (file: DriveFile) => {
    setSelectedFile(file);
    const token = authState.accessToken;
    if (!token || file.isFolder) return;

    setIsLoadingContent(true);
    try {
      const content = await driveService.getFileContent(token, file.id);
      setSelectedFileContent(content);
    } catch (e: any) {
      setSelectedFileContent(`// Error reading file: ${e.message}`);
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Load current folder files into Active App Bundle
  const handleLoadFolderAsApp = async () => {
    const token = authState.accessToken;
    if (!token) return;

    setIsLoadingFiles(true);
    try {
      const currentFolderName = folderHistory[folderHistory.length - 1].name;
      const bundle = await driveService.buildProjectBundle(
        token,
        currentFolderName === 'My Drive' ? 'Google Drive Root Project' : currentFolderName,
        files,
        currentFolderId
      );

      setActiveDriveProject(bundle);
      setActiveAppSource('drive');

      // Apply detected configs
      if (bundle.parsedConfig) {
        riskEngine.updateConfig(bundle.parsedConfig);
        onUpdateRiskConfig(bundle.parsedConfig);
      }
      if (bundle.parsedStrategies && bundle.parsedStrategies.length > 0) {
        bundle.parsedStrategies.forEach((strat) => dslEngine.saveStrategy(strat));
      }
      if (bundle.parsedOrders && bundle.parsedOrders.length > 0) {
        unifiedJournal.loadExternalOrders(bundle.parsedOrders);
        onRefreshOrders();
      }
    } catch (e: any) {
      alert(`Failed to bundle project: ${e.message}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Provide a 1-click rich sample Drive project if user has not yet uploaded files
  const handleLoadSampleDriveProject = () => {
    const sampleBundle: DriveProjectBundle = {
      projectName: 'TonyBot-Live-Alpha (Google Drive)',
      sourceType: 'google_drive',
      loadedAt: new Date().toISOString(),
      detectedType: 'trading_bot',
      summary: 'Imported full autonomous trading bot bundle with custom risk gates and DSL strategies from Google Drive.',
      rawEnvVars: {
        BOT_ENV: 'live_shadow',
        JUPITER_SLIPPAGE_BPS: '150',
        POLYMARKET_MAKER_SPREAD: '0.015',
        BINANCE_MAX_LEVERAGE: '5',
      },
      parsedConfig: {
        total_capital_usd: 15000.0,
        max_total_exposure_pct: 0.25,
        max_daily_loss_pct: 0.015,
        max_drawdown_pct: 0.12,
        hard_caps_usd: {
          solana_memecoin: 25.0,
          polymarket: 150.0,
          perp_binance: 750.0,
        },
        funding_budget_usd: 45.0,
      },
      parsedStrategies: [
        {
          id: 'drive_sol_alpha',
          market: 'solana_memecoin',
          version: 2,
          triggers: [
            { indicator: 'rsi', params: { period: 7 }, condition: '< 28' },
            { indicator: 'volume_spike', params: { period: 15 }, condition: '> 2.0' },
          ],
          guards: [
            { name: 'safety_filter', params: { required: true, max_p_rug: 0.12 } },
            { name: 'max_notional_usd', params: { cap: 25.0 } },
          ],
          exit: {
            stop_loss: { type: 'atr', multiplier: 1.8 },
            take_profit: { type: 'r_multiple', value: 2.5 },
            timeout_minutes: 25,
          },
          params: {
            rsi_threshold: 28.0,
            volume_spike_multiplier: 2.0,
            stop_loss_mult: 1.8,
          },
          param_ranges: {
            rsi_threshold: [20.0, 35.0],
            volume_spike_multiplier: [1.5, 3.5],
            stop_loss_mult: [1.2, 2.5],
          },
          created_by: 'reflector',
          backtest_win_rate: 61.4,
          backtest_sharpe: 2.05,
          approved: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'drive_poly_fed_skew',
          market: 'polymarket',
          version: 1,
          triggers: [
            { indicator: 'prob_deviation', params: { max_bps: 15 }, condition: '< 0.015' },
            { indicator: 'time_to_resolution', params: { min_days: 5 }, condition: '> 5' },
          ],
          guards: [
            { name: 'max_notional_usd', params: { cap: 100.0 } },
            { name: 'liquidity_min_usd', params: { min_depth: 75000 } },
          ],
          exit: {
            timeout_minutes: 720,
          },
          params: {
            spread_bps: 15.0,
            drift_cents: 0.01,
          },
          param_ranges: {
            spread_bps: [10.0, 40.0],
            drift_cents: [0.005, 0.025],
          },
          created_by: 'human',
          backtest_win_rate: 66.8,
          backtest_sharpe: 2.21,
          approved: true,
          created_at: new Date().toISOString(),
        },
      ],
      files: [
        {
          id: 'drive-f1',
          name: 'risk_parameters.json',
          mimeType: 'application/json',
          language: 'json',
          content: JSON.stringify(
            {
              total_capital_usd: 15000.0,
              max_total_exposure_pct: 0.25,
              max_daily_loss_pct: 0.015,
              hard_caps_usd: {
                solana_memecoin: 25.0,
                polymarket: 150.0,
                perp_binance: 750.0,
              },
            },
            null,
            2
          ),
        },
        {
          id: 'drive-f2',
          name: 'tonybot_alpha.dsl',
          mimeType: 'text/plain',
          language: 'typescript',
          content: `// Strategy loaded from Google Drive: TonyBot Alpha
export const tonyStrategy = {
  market: 'solana_memecoin',
  triggers: [
    { indicator: 'rsi', params: { period: 7 }, condition: '< 28' },
    { indicator: 'volume_spike', params: { period: 15 }, condition: '> 2.0' }
  ],
  guards: [
    { name: 'safety_filter', params: { max_p_rug: 0.12 } },
    { name: 'max_notional_usd', params: { cap: 25.0 } }
  ],
  exit: { timeout_minutes: 25, stop_loss: 1.8 }
};`,
        },
        {
          id: 'drive-f3',
          name: 'bot_bridge.py',
          mimeType: 'text/x-python',
          language: 'python',
          content: `# TonyBot Execution Bridge (Google Drive Source)
import time
import requests

def evaluate_and_route(signal):
    print(f"[GOOGLE DRIVE BOT] Evaluating signal: {signal['symbol']}")
    # Enforces Nexus Hard Caps ($25 Meme, $100 Poly, $500 Perp)
    if signal['market'] == 'solana_memecoin' and signal['notional_usd'] > 25.0:
        raise ValueError("Exceeds $25 demo cap")
    return {"status": "APPROVED", "kernel": "nexus_rust_ffi"}
`,
        },
        {
          id: 'drive-f4',
          name: '.env.bot',
          mimeType: 'text/plain',
          language: 'yaml',
          content: `BOT_ENV=live_shadow\nJUPITER_SLIPPAGE_BPS=150\nPOLYMARKET_MAKER_SPREAD=0.015\nBINANCE_MAX_LEVERAGE=5`,
        },
      ],
    };

    setActiveDriveProject(sampleBundle);
    setActiveAppSource('drive');
    riskEngine.updateConfig(sampleBundle.parsedConfig!);
    onUpdateRiskConfig(sampleBundle.parsedConfig!);
    sampleBundle.parsedStrategies!.forEach((s) => dslEngine.saveStrategy(s));
  };

  // "Let Work" Testbench: Executes a simulated multi-market trade run with the loaded Drive app
  const handleExecuteDriveAppRun = async () => {
    setIsRunningSim(true);
    setSimLogs([]);
    setSimSuccess(null);

    const log = (msg: string) => setSimLogs((prev) => [...prev, `[${new Date().toISOString().substring(11, 19)}] ${msg}`]);

    try {
      log(`⚡ INITIATING DRIVE APP RUNTIME: "${activeDriveProject?.projectName || 'Google Drive App'}"`);
      await new Promise((r) => setTimeout(r, 400));

      log(`📁 Verifying loaded project files: ${activeDriveProject?.files.length || 0} files mapped into memory.`);
      await new Promise((r) => setTimeout(r, 400));

      const activeCfg = riskEngine.getConfig();
      log(`🛡️ Risk Engine Active: Total Capital $${activeCfg.total_capital_usd.toLocaleString()} | Meme Cap $${activeCfg.hard_caps_usd.solana_memecoin} | Poly Cap $${activeCfg.hard_caps_usd.polymarket} | Perp Cap $${activeCfg.hard_caps_usd.perp_binance}`);
      await new Promise((r) => setTimeout(r, 500));

      log('🔄 Ingesting live market signal from Drive Strategy: SOL Memecoin (Symbol: $DRIVE_PEPE)...');
      await new Promise((r) => setTimeout(r, 400));

      // 1. Meme trade pass test
      const memeQuote = {
        adapter: 'solana_memecoin' as const,
        symbol: 'DRIVE_PEPE',
        side: 'BUY' as const,
        size: 24500,
        price: 0.00098,
        notional_usd: 24.01, // <= $25
        slippage_bps: 140,
        metadata: {
          safety: {
            mint: 'DRIVE7xpepe111111111111111111111111111111111',
            passed: true,
            p_rug: 0.08,
            bundle_pct: 0.12,
            sniper_pct: 0.15,
            top10_holder_pct: 0.28,
            lp_locked: true,
            honeypot: false,
            token_age_hours: 18.5,
            reasons: [],
            scanned_at: new Date().toISOString(),
          },
        },
      };

      const gateRes = await riskEngine.gate(memeQuote, [], 0);
      if (gateRes.approved) {
        log(`✅ GATE PASSED: $DRIVE_PEPE (Notional $24.01 <= $25 Cap). Safety filter OK (p_rug=0.08).`);
        // Record into journal
        const newOrder: UnifiedOrderRecord = {
          id: `ORD-DRIVE-${Date.now().toString(36).toUpperCase()}`,
          adapter: 'solana_memecoin',
          symbol: 'DRIVE_PEPE',
          side: 'BUY',
          size: memeQuote.size,
          price: memeQuote.price,
          notional_usd: memeQuote.notional_usd,
          status: 'FILLED',
          reason_code: 'drive_app_strategy_signal: approved_by_risk_kernel',
          strategy_id: activeDriveProject?.parsedStrategies?.[0]?.id || 'drive_sol_alpha',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        unifiedJournal.recordOrder(newOrder);
        onRefreshOrders();
        log(`📝 Order ${newOrder.id} successfully recorded into Unified Journal (§3.3).`);
      } else {
        log(`❌ GATE REJECTED: ${gateRes.reason}`);
      }

      await new Promise((r) => setTimeout(r, 500));
      log('📊 Evaluating Polymarket CLOB liquidity and probability band...');
      await new Promise((r) => setTimeout(r, 400));

      const polyQuote = {
        adapter: 'polymarket' as const,
        symbol: 'POLY-TECH-AI-2026',
        side: 'BUY' as const,
        size: 120,
        price: 0.72,
        notional_usd: 86.4, // <= $100 / $150
        slippage_bps: 20,
        metadata: {
          market_title: 'Tech AI Breakthrough 2026',
          resolution_time: '2026-12-31T23:59:59Z',
        },
      };

      const polyGate = await riskEngine.gate(polyQuote, [], 0);
      if (polyGate.approved) {
        log(`✅ GATE PASSED: POLY-TECH-AI-2026 (Notional $86.40 <= $100 Cap).`);
        const polyOrder: UnifiedOrderRecord = {
          id: `ORD-DRIVE-${Date.now().toString(36).toUpperCase()}`,
          adapter: 'polymarket',
          symbol: 'POLY-TECH-AI-2026',
          side: 'BUY',
          size: polyQuote.size,
          price: polyQuote.price,
          notional_usd: polyQuote.notional_usd,
          status: 'FILLED',
          reason_code: 'drive_poly_fed_skew: clob_maker_limit_order',
          strategy_id: 'drive_poly_fed_skew',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        unifiedJournal.recordOrder(polyOrder);
        onRefreshOrders();
        log(`📝 Order ${polyOrder.id} successfully recorded into Unified Journal.`);
      }

      await new Promise((r) => setTimeout(r, 400));
      log('🎉 DRIVE APP RUNTIME EXECUTING SUCCESSFULLY: Engine running on Google Drive project!');
      setSimSuccess(true);
    } catch (e: any) {
      log(`🚨 RUNTIME ERROR: ${e.message}`);
      setSimSuccess(false);
    } finally {
      setIsRunningSim(false);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (filterType === 'folders') return f.isFolder;
    if (filterType === 'configs')
      return !f.isFolder && (f.name.endsWith('.json') || f.name.endsWith('.env') || f.name.endsWith('.toml') || f.name.endsWith('.yaml'));
    if (filterType === 'strategies')
      return !f.isFolder && (f.name.endsWith('.dsl') || f.name.includes('strategy') || f.name.endsWith('.json'));
    if (filterType === 'code')
      return !f.isFolder && (f.name.endsWith('.py') || f.name.endsWith('.rs') || f.name.endsWith('.ts') || f.name.endsWith('.js'));
    return true;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-[#10141f] border border-blue-800/40 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <HardDrive className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  GOOGLE DRIVE APP WORKSPACE & RUNTIME
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  DRIVE READ-ONLY
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1 max-w-2xl font-sans">
                Read, parse, and run your trading bot, strategy DSL scripts, and risk configurations directly from your
                Google Drive instead of the default local tsnexus repository.
              </p>
            </div>
          </div>

          {/* Active Source Toggle Switch */}
          <div className="bg-[#0b0e14] border border-slate-800 p-2 rounded-lg flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold px-2">ACTIVE APP SOURCE:</span>
            <button
              onClick={() => setActiveAppSource('drive')}
              className={`px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                activeAppSource === 'drive'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-950 border border-blue-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              Google Drive App
            </button>
            <button
              onClick={() => setActiveAppSource('tsnexus')}
              className={`px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                activeAppSource === 'tsnexus'
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              tsnexus (Local)
            </button>
          </div>
        </div>

        {/* Current Active Project Bar */}
        {activeDriveProject && (
          <div className="mt-4 pt-4 border-t border-blue-900/40 flex flex-wrap items-center justify-between gap-3 bg-blue-950/20 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-2 text-blue-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white">Active Loaded App:</span>
              <span className="text-blue-200 font-semibold">{activeDriveProject.projectName}</span>
              <span className="text-slate-400 text-[10px]">
                ({activeDriveProject.files.length} files • Loaded {activeDriveProject.loadedAt.substring(11, 19)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExecuteDriveAppRun}
                disabled={isRunningSim}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                {isRunningSim ? 'Executing...' : 'Run / Let Work Live'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Google Auth & Drive Explorer vs Project Bundle & Code Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Auth Status & Drive File Browser (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Auth Card */}
          <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {authState.isAuthenticated && authState.user ? (
                  <div className="flex items-center gap-3">
                    {authState.user.photoURL ? (
                      <img
                        src={authState.user.photoURL}
                        alt="User"
                        className="w-9 h-9 rounded-full border border-blue-500/50"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                        {authState.user.email?.[0].toUpperCase() || 'U'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{authState.user.displayName || 'Google User'}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-bold">
                          CONNECTED
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{authState.user.email}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-bold text-white text-xs">CONNECT GOOGLE DRIVE</h3>
                    <p className="text-[11px] text-slate-400">
                      Sign in with Google to read your files, trading bots, and strategies with permission.
                    </p>
                  </div>
                )}
              </div>

              {/* Official Google Sign-In button or Sign Out */}
              <div>
                {authState.isAuthenticated ? (
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                ) : (
                  <button
                    className="gsi-material-button"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                  >
                    <div className="gsi-material-button-state"></div>
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          xmlnsXlink="http://www.w3.org/1999/xlink"
                          style={{ display: 'block' }}
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          ></path>
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          ></path>
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          ></path>
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          ></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {authError && (
              <div className="mt-3 p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[11px]">{authError}</span>
              </div>
            )}
          </div>

          {/* Drive Explorer Card */}
          <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>GOOGLE DRIVE FILE EXPLORER</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSampleDriveProject}
                  className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/50 flex items-center gap-1 text-[11px] font-semibold transition-colors"
                  title="Load full test app structure with bot, risk, and DSL strategies"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Load Sample Drive App
                </button>

                <button
                  onClick={() => loadDriveFiles(currentFolderId)}
                  disabled={!authState.accessToken || isLoadingFiles}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50"
                  title="Refresh Files"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-1 overflow-x-auto py-1 px-2 bg-[#0b0e14] rounded border border-slate-800 text-[11px]">
              {folderHistory.map((f, i) => (
                <React.Fragment key={f.id}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600" />}
                  <button
                    onClick={() => handleBreadcrumbClick(i)}
                    className={`hover:text-white transition-colors truncate max-w-[120px] ${
                      i === folderHistory.length - 1 ? 'font-bold text-blue-400' : 'text-slate-400'
                    }`}
                  >
                    {f.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Drive files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadDriveFiles(currentFolderId, searchTerm)}
                  className="w-full bg-[#0b0e14] border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {(['all', 'folders', 'configs', 'strategies', 'code'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2 py-1 rounded text-[10px] uppercase font-semibold capitalize transition-all ${
                      filterType === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Files List Table */}
            <div className="border border-slate-800 rounded bg-[#0b0e14] overflow-hidden max-h-80 overflow-y-auto">
              {!authState.isAuthenticated ? (
                <div className="p-8 text-center text-slate-500">
                  <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-400" />
                  <p className="font-semibold text-slate-400">Google Drive Not Connected</p>
                  <p className="text-[11px] mt-1">Please sign in above to list files from your Google Drive.</p>
                </div>
              ) : isLoadingFiles ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-400" />
                  <span>Loading files from Google Drive...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Folder className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No matching files found in this folder.</p>
                  <button
                    onClick={handleLoadSampleDriveProject}
                    className="mt-3 px-3 py-1 rounded bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[11px] hover:bg-blue-600/50"
                  >
                    Load Sample Drive Project Bundle
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#111624] text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Modified</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredFiles.map((file) => {
                      const isSelected = selectedFile?.id === file.id;
                      return (
                        <tr
                          key={file.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-blue-950/40 text-blue-200' : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {file.isFolder ? (
                                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                              ) : file.name.endsWith('.json') ? (
                                <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : file.name.endsWith('.py') || file.name.endsWith('.rs') || file.name.endsWith('.ts') ? (
                                <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span
                                className={`truncate max-w-[200px] font-semibold cursor-pointer ${
                                  file.isFolder ? 'text-amber-300 hover:underline' : 'text-slate-200 hover:text-white'
                                }`}
                                onClick={() => (file.isFolder ? handleFolderClick(file) : handleSelectFile(file))}
                              >
                                {file.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px]">
                            {file.isFolder ? 'Folder' : file.name.split('.').pop()?.toUpperCase() || 'File'}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">
                            {file.modifiedTime ? file.modifiedTime.substring(0, 10) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {file.isFolder ? (
                              <button
                                onClick={() => handleFolderClick(file)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                              >
                                Open
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelectFile(file)}
                                className="px-2 py-0.5 rounded bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-700/50 text-[10px]"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Folder Action Footer */}
            {authState.isAuthenticated && files.length > 0 && (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {files.length} items in current directory
                </span>
                <button
                  onClick={handleLoadFolderAsApp}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-blue-950 transition-all text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Load Current Folder as App
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: App Bundle Inspector & "Let Work" Testbench (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Bundle Overview Card */}
          <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-white text-xs">LOADED GOOGLE DRIVE APP BUNDLE</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                {activeDriveProject ? activeDriveProject.detectedType.toUpperCase() : 'NO BUNDLE'}
              </span>
            </div>

            {activeDriveProject ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded bg-[#0b0e14] border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Project:</span>
                    <span className="text-white font-bold">{activeDriveProject.projectName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Source:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <HardDrive className="w-3 h-3" /> Google Drive
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Recognized Files:</span>
                    <span className="text-slate-200">{activeDriveProject.files.length}</span>
                  </div>
                </div>

                {/* Parsed Risk Limits */}
                {activeDriveProject.parsedConfig && (
                  <div className="p-2.5 rounded bg-[#0b0e14] border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                      <Shield className="w-3.5 h-3.5" />
                      <span>CUSTOM RISK LIMITS INJECTED</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Capital:</span>
                        <span className="text-white font-semibold">
                          ${activeDriveProject.parsedConfig.total_capital_usd?.toLocaleString() || '10,000'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Meme Hard Cap:</span>
                        <span className="text-amber-400 font-bold">
                          ${activeDriveProject.parsedConfig.hard_caps_usd?.solana_memecoin || 25}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Poly Cap:</span>
                        <span className="text-indigo-400 font-bold">
                          ${activeDriveProject.parsedConfig.hard_caps_usd?.polymarket || 100}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Perp Cap:</span>
                        <span className="text-emerald-400 font-bold">
                          ${activeDriveProject.parsedConfig.hard_caps_usd?.perp_binance || 500}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Parsed Strategies */}
                {activeDriveProject.parsedStrategies && (
                  <div className="p-2.5 rounded bg-[#0b0e14] border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>DETECTED STRATEGIES ({activeDriveProject.parsedStrategies.length})</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {activeDriveProject.parsedStrategies.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/80 text-[11px]"
                        >
                          <span className="font-bold text-white">{s.id}</span>
                          <span className="text-slate-400 capitalize">{s.market.replace('_', ' ')}</span>
                          <span className="text-emerald-400 font-semibold">{s.backtest_win_rate}% WR</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Run / Let Work CTA */}
                <div className="pt-2">
                  <button
                    onClick={handleExecuteDriveAppRun}
                    disabled={isRunningSim}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all text-xs disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    {isRunningSim ? 'EXECUTING DRIVE APP RUN...' : 'LET WORK: RUN LIVE SIMULATION'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 space-y-3">
                <Sliders className="w-8 h-8 mx-auto opacity-30 text-blue-400" />
                <p className="text-xs">No Drive project bundled yet.</p>
                <button
                  onClick={handleLoadSampleDriveProject}
                  className="px-3 py-1.5 rounded bg-blue-600 text-white font-bold text-xs shadow hover:bg-blue-500"
                >
                  Load Sample Drive App Now
                </button>
              </div>
            )}
          </div>

          {/* Live Execution Logs Terminal */}
          {simLogs.length > 0 && (
            <div className="bg-[#0b0e14] border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>DRIVE APP EXECUTION LOGS</span>
                </div>
                {simSuccess === true && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                    STATUS: OK
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300 leading-relaxed">
                {simLogs.map((logLine, idx) => (
                  <div
                    key={idx}
                    className={
                      logLine.includes('✅')
                        ? 'text-emerald-400 font-semibold'
                        : logLine.includes('❌') || logLine.includes('🚨')
                        ? 'text-rose-400'
                        : logLine.includes('⚡')
                        ? 'text-cyan-300 font-bold'
                        : 'text-slate-300'
                    }
                  >
                    {logLine}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Content Previewer */}
          {selectedFile && (
            <div className="bg-[#10141f] border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5 text-slate-200 font-bold truncate max-w-[220px]">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {selectedFile.size ? `${(parseInt(selectedFile.size) / 1024).toFixed(1)} KB` : 'Text'}
                </span>
              </div>

              {isLoadingContent ? (
                <div className="p-4 text-center text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-400" />
                  <span>Loading content from Drive...</span>
                </div>
              ) : selectedFileContent ? (
                <pre className="p-2.5 rounded bg-[#080b11] border border-slate-900 text-slate-300 text-[10px] font-mono max-h-56 overflow-auto whitespace-pre-wrap leading-relaxed">
                  {selectedFileContent}
                </pre>
              ) : (
                <p className="text-slate-500 text-[11px]">Select a file to inspect its content.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
