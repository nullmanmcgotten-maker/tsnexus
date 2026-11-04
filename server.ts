import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_TONYBOT_ACTIONS = new Set(['BUY', 'SELL', 'CLOSE', 'ALERT']);

interface TonyBotWebhookPayload {
  symbol?: unknown;
  action?: unknown;
  setup?: string;
  confidence?: number;
  entry?: number;
  stop?: number;
  target?: number;
  notes?: string;
}

type RequestWithRawBody = express.Request & { rawBody?: Buffer };

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, body) => {
      (req as RequestWithRawBody).rawBody = Buffer.from(body);
    },
  }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: 'NEXUS-TONYBOT-UNIFIED-v1.0',
      kernel: 'market-agnostic-usd-notional',
      adapters: ['perp_binance', 'polymarket', 'solana_memecoin'],
      ai_layer: 'cascading-router-active',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/ai/ask', async (req, res) => {
    const { prompt, jsonMode } = req.body ?? {};
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'prompt required' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'AI reviewer unavailable; use deterministic risk checks' });
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({});
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: jsonMode ? { responseMimeType: 'application/json' } : undefined,
      });
      return res.json({ text: response.text });
    } catch (error: any) {
      console.warn('[SERVER AI ROUTE EXCEPTION]', error.message);
      return res.status(503).json({ error: 'AI reviewer unavailable; use deterministic risk checks' });
    }
  });

  app.get('/api/binance/market', async (req, res) => {
    const querySymbol = req.query.symbol;
    const symbol = querySymbol === undefined ? 'BTCUSDT' : querySymbol;
    if (typeof symbol !== 'string' || !/^[A-Z0-9]{3,20}$/.test(symbol)) {
      return res.status(400).json({ error: 'invalid symbol' });
    }
    const encodedSymbol = encodeURIComponent(symbol);

    try {
      const [bookRes, premiumRes] = await Promise.all([
        fetch(`https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=${encodedSymbol}`),
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodedSymbol}`),
      ]);

      if (bookRes.ok && premiumRes.ok) {
        const bookData = await bookRes.json();
        const premiumData = await premiumRes.json();
        const bid = parseFloat(bookData.bidPrice);
        const ask = parseFloat(bookData.askPrice);
        const price = (bid + ask) / 2.0;
        const spreadBps = ((ask - bid) / price) * 10000;

        return res.json({
          symbol,
          price,
          bid,
          ask,
          bidQty: parseFloat(bookData.bidQty),
          askQty: parseFloat(bookData.askQty),
          spread_bps: Number(spreadBps.toFixed(2)),
          funding_rate: parseFloat(premiumData.lastFundingRate || '0.0001'),
          mark_price: parseFloat(premiumData.markPrice || `${price}`),
          index_price: parseFloat(premiumData.indexPrice || `${price}`),
          is_live: true,
        });
      }
    } catch {
      // Fall back to clearly marked simulated data if the public API is unavailable.
    }

    const basePrice = symbol.startsWith('ETH') ? 3500 : symbol.startsWith('SOL') ? 180 : 65000;
    const spreadBps = 0.6;
    const spread = (basePrice * spreadBps) / 10000;
    return res.json({
      symbol,
      price: basePrice,
      bid: basePrice - spread / 2,
      ask: basePrice + spread / 2,
      bidQty: 12.5,
      askQty: 14.2,
      spread_bps: spreadBps,
      funding_rate: 0.00015,
      mark_price: basePrice,
      index_price: basePrice,
      is_live: false,
    });
  });

  app.post('/api/binance/account', async (req, res) => {
    const { apiKey, apiSecret, testnet } = req.body ?? {};

    if (typeof apiKey !== 'string' || !apiKey || typeof apiSecret !== 'string' || !apiSecret) {
      return res.status(503).json({
        ok: false,
        can_trade: false,
        reason_codes: ['binance_credentials_not_configured'],
        checked_at: new Date().toISOString(),
        mode: 'UNCONFIGURED',
      });
    }

    const targetUrl = testnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';

    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}&recvWindow=5000`;
      const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
      const binanceRes = await fetch(`${targetUrl}/fapi/v2/account?${queryString}&signature=${signature}`, {
        headers: { 'X-MBX-APIKEY': apiKey },
      });

      if (!binanceRes.ok) {
        const errorText = await binanceRes.text();
        return res.status(400).json({
          ok: false,
          can_trade: false,
          reason_codes: [`binance_api_error: ${binanceRes.status}`, errorText],
          checked_at: new Date().toISOString(),
        });
      }

      const account = await binanceRes.json();
      const positions = (account.positions || []).filter(
        (position: any) => Math.abs(parseFloat(position.positionAmt || '0')) > 0
      );
      const wallet = parseFloat(account.totalWalletBalance || '0');
      const available = parseFloat(account.availableBalance || '0');
      const canTrade = Boolean(account.canTrade);
      const reasons: string[] = [];
      if (!canTrade) reasons.push('exchange_can_trade_false');
      if (available <= 0) reasons.push('no_available_balance');

      return res.json({
        ok: reasons.length === 0,
        can_trade: canTrade && reasons.length === 0,
        account_type: account.accountType || 'USD_M_FUTURES',
        wallet_balance: wallet,
        available_balance: available,
        positions: positions.length,
        reason_codes: reasons,
        checked_at: new Date().toISOString(),
        mode: 'LIVE_SIGNED',
      });
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        can_trade: false,
        reason_codes: [`account_validation_exception: ${error.message}`],
        checked_at: new Date().toISOString(),
      });
    }
  });

  // Credentials and destination are server-side only; callers may supply message text only.
  app.post('/api/telegram/notify', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const { text } = req.body ?? {};
    if (!token || !chatId) {
      return res.status(503).json({ ok: false, error: 'Telegram notifier is not configured on the server' });
    }
    if (typeof text !== 'string' || text.length === 0 || text.length > 4000) {
      return res.status(400).json({ ok: false, error: 'text required (maximum 4000 characters)' });
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      const data = await response.json();
      return res.status(response.ok ? 200 : 502).json({ ok: response.ok, response: data });
    } catch (error: any) {
      return res.status(502).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/tonybot/webhook', (req, res) => {
    const secret = process.env.TONYBOT_WEBHOOK_SECRET;
    const signature = String(req.get('x-tonybot-signature') ?? '');
    const rawBody = (req as RequestWithRawBody).rawBody;
    if (!secret || !rawBody || !/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
    const received = Buffer.from(signature, 'hex');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const payload = req.body as TonyBotWebhookPayload | undefined;
    if (!payload || typeof payload.symbol !== 'string' || !/^[A-Z0-9]{3,20}$/.test(payload.symbol)) {
      return res.status(400).json({ error: 'valid symbol is required' });
    }
    if (typeof payload.action !== 'string' || !ALLOWED_TONYBOT_ACTIONS.has(payload.action)) {
      return res.status(400).json({ error: 'invalid action' });
    }

    console.log('[TONYBOT WEBHOOK RECEIVED]', { symbol: payload.symbol, action: payload.action });
    const signalId = `TONY-HOOK-${Date.now().toString(36).toUpperCase()}`;
    return res.json({
      success: true,
      signal_id: signalId,
      status: 'QUEUED_FOR_NEXUS_EVALUATION',
      message: `Signal for ${payload.symbol} (${payload.action}) received from TonyBot and sent to NEXUS Risk Governor.`,
      received_at: new Date().toISOString(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`NEXUS Engine Server online at http://127.0.0.1:${PORT}`);
  });
}

startServer();
