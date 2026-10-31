# NEXUS × TONYBOT — Unified Multi-Market Trading Platform (v1.0)

A unified trading platform merging **NEXUS** (live execution engine, order lifecycle, risk governor, durable SQLite journal) and **TONYBOT** (strategy engine, indicators, regime classifier, backtester) into a **single market-agnostic kernel** with pluggable adapters, a self-evolving 3-layer AI architecture on free tiers, and a 3-week shadow-trading demo with Go/No-Go criteria.

---

## Architecture Overview

### 1. Market-Agnostic Kernel & USD Notional Contract
The kernel does not know what a "share", "token", or "contract" is—it operates strictly on **USD Notional**, Side (`BUY`/`SELL`), and a unified **Risk Gate**.
- Standard `Quote`: `{ adapter: Market, symbol, side, price, size, notional_usd, slippage_bps, metadata }`
- Standard `OrderResult`: `{ order_id, status: FILLED | PARTIAL | REJECTED | UNKNOWN, filled_size, avg_price, raw }`
- Standard Lifecycle: `PROPOSED → GATED → APPROVED → SUBMITTED → FILLED` (with `PARTIAL`, `REJECTED`, `UNKNOWN → RECONCILED`, and `BLOCKED`).

### 2. Pluggable Market Adapters
1. **Solana Memecoins (`solana_memecoin`)** *(Primary Focus for v1.0)*:
   - Jupiter swaps (`api.jup.ag` with lite-api fallback) + Helius RPC.
   - **Mandatory CoinScan Safety Filter**: Runs *before* the risk kernel (`p_rug` $\le 0.15$, `bundle_pct` $\le 0.40$, `sniper_pct` $\le 0.30$, `top10_holder_pct` $\le 0.50$, LP locked, honeypot flag, 25 scans/day quota tracker).
   - **Hard Cap: $25 USD per trade** during demo (non-negotiable). Max hold: 30 minutes. Slippage cap: 300 bps.
   - Strategy: `meme_momentum.yaml` (safety + volume spike $> 1.5\times$ + 1m RSI $< 30$).
2. **Polymarket CLOB (`polymarket_clob`)** *(Primary Focus for v1.0)*:
   - Event-probability trading ($0.00–1.00$).
   - L1 EIP-712 wallet derivation + L2 HMAC-SHA256 authenticated order signing.
   - Rejects prices $<0.02$ or $>0.98$ (near-resolution extreme risk).
   - Hard Cap: **$100 USD**. GTC resting limit orders.
   - Strategies: `poly_maker.yaml` (passive 2-sided quoter within 20 bps of midpoint) & `poly_deviation.yaml` (AI deviation $> 8\%$).
3. **Binance Futures (`perp_binance`)** *(Baseline Kernel Validation)*:
   - Signed HMAC-SHA256 REST + WebSocket API. Testnet toggle.
   - Funding watcher ($30/day budget) & liquidation margin watcher.
   - Hard Cap: **$500 USD**. Strategies: `perp_pullback.yaml` & `perp_breakout.yaml`.

---

## 3. Risk Kernel (Single Source of "No")
- **Total Portfolio Exposure Cap**: $30\%$ of total capital ($10,000 capital $\rightarrow$ $3,000 max exposure).
- **Per-Market Sub-Caps**:
  - Solana Memecoins: $5\%$ sub-cap ($500 max).
  - Polymarket CLOB: $10\%$ sub-cap ($1,000 max).
  - Binance Perps: $15\%$ sub-cap ($1,500 max).
- **Daily Loss Circuit Breaker**: $2\%$ daily loss limit ($200 max loss $\rightarrow$ engine locks).
- **Max Drawdown Breaker**: $15\%$ drawdown ceiling ($1,500 max).

---

## 4. Three-Layer Self-Evolution AI Architecture
- **Layer 1: Failed-Trade Reflector (AlphaEvo Pattern)**:
  - Diagnoses losing shadow trades.
  - Proposes **exactly ONE parameter change** within declared YAML parameter ranges.
  - Runs out-of-sample backtest validation (Win-rate $\ge$ baseline $- 3\%$ OR Sharpe $\ge$ baseline $+ 0.15$).
  - Successful mutations are staged as new strategy versions in the database.
- **Layer 2: Polymarket Event Analyst**:
  - Independent probabilistic LLM evaluation of prediction markets.
  - Generates candidate signals when $|P_{\text{AI}} - P_{\text{market}}| > 0.08$ with $> 7$ days to expiry.
  - 1-hour cache TTL to preserve free-tier quotas.
- **Layer 3: Fine-Tuned Reviewer**:
  - **Non-Negotiable Rule**: The reviewer can **ONLY REJECT**, never approve! Approval is solely the Risk Engine's role.
- **AI Router Cascade**:
  - Free-tier cascade: Gemini 2.5 Flash $\rightarrow$ Groq (Llama-3.3 70B) $\rightarrow$ Cerebras (Llama-3.3 70B) $\rightarrow$ Mistral $\rightarrow$ Deterministic Rules.
  - 429 rate-limit resilience built-in.

---

## 5. Strategy DSL
Machine-verifiable YAML representation:
```yaml
strategy:
  id: meme_momentum_v1
  market: solana_memecoin
  triggers:
    - indicator: rsi
      period: 7
      condition: "< 30"
    - indicator: volume_spike
      multiplier: 1.5
  guards:
    - safety_filter: passed
    - max_notional_usd: 25
  exit:
    stop_loss: { type: atr, multiplier: 2.0 }
    take_profit: { type: r_multiple, value: 2.0 }
    timeout_minutes: 30
```

---

## 6. The 5 Mandatory Go/No-Go Criteria (§9.1)
1. **Shadow P&L**: Positive or explainably neutral in $\ge 2$ of 3 markets.
2. **Zero Risk Breaches**: Zero order cap or sub-cap breaches.
3. **Journal Integrity**: Consistency across mid-run restarts.
4. **Safety Filter Efficacy**: $\ge 3$ of 25 daily scans rejected.
5. **AI Router Resilience**: Bot continues on deterministic rules when providers return 429.

---

## Running the Application

```bash
# Start full-stack development server
npm run dev

# Compile production build
npm run build
```
