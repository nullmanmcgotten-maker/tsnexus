# Migration Plan: NEXUS + TONYBOT → Rust kernel / Python strategy layer

## Why not rewrite everything in Rust

Three of the four "speed matters" components (adapters, AI router, GUI) are
bound by either network I/O (exchange/LLM latency dwarfs any language
difference) or library availability (PySide6, py-clob-client, solana-py,
ccxt have no Rust equivalent worth the migration cost). Rewriting those in
Rust would mean re-implementing exchange auth, CLOB order signing, and a
GUI toolkit from scratch for no measurable speed gain. The actual
bottleneck this system has had (per project history: ~45% win rate on
~40 trades, re-entry risk, leverage mismatch) is **decision quality and
discipline**, not per-tick Rust-vs-Python latency. So: Rust where
correctness-under-concurrency and gate-every-order-the-same-way matter,
Python everywhere else.

## Phase 0 — Scaffold (this delivery)

- [x] Cargo workspace: `kernel` (risk engine, order lifecycle, journal, bus)
- [x] `pybridge`: PyO3 module exposing `nexus_kernel.gate()` + `PyJournal`
- [x] Python `BaseAdapter` whose `submit()` always routes through the Rust gate
- [x] Contract tests proving Python → Rust round-trips match the spec's caps
- [x] One example strategy DSL (`meme_momentum_v1`) + schema/validator

## Phase 1 — Port adapters (1 week)

Port `perp_binance.py`, `polymarket_clob.py`, `solana_memecoin.py` from the
original spec's §5 into `python-layer/adapters/`, each implementing
`_submit_impl` and `_portfolio_snapshot` against `BaseAdapter`. Contract
tests (`tests/test_adapter_contract.py`) run the same four assertions
against all three in dry-run:
1. `quote()` returns `notional_usd` within 1% of `price * size`
2. `submit(dry_run=True)` never emits a network write (mock transport)
3. `positions()` returns `{market, symbol, size, notional_usd, entry_price}`
4. a quote above the adapter's hard cap raises `CapExceeded` (now thrown by
   the Rust gate, not Python — the test just confirms the exception still
   surfaces correctly across the PyO3 boundary)

## Phase 2 — Journal-backed portfolio accounting (3-4 days)

`PyJournal` already has `propose_order`/`update_status`/`recover_pending`/
`daily_loss_pct`. Add `record_fill`, `open_position`, `close_position` to
`kernel/journal.rs`, and a `portfolio.rs` that aggregates exposure per
market from the `positions` table — this is what feeds
`_portfolio_snapshot()` on the Python side instead of each adapter
tracking its own (easy-to-drift) numbers.

## Phase 3 — Message bus wiring + adapter processes (3-4 days)

Run each adapter as its own asyncio task/process; wire `Bus::publish_quote`
/ `report_health` through the pybridge so a Polymarket rate-limit backoff
can never stall the perp adapter. Channel naming stays as specified:
`nexus.quotes.{market}`, `nexus.orders.{market}`, `nexus.fills.{market}`,
`nexus.health`.

## Phase 4 — DSL compiler + backtest gate (1 week)

`strategy/dsl/compiler.py`: DSL → `evaluate(context) -> Signal | None`.
Any `strategy_versions` row from the reflector must pass the backtest gate
(90-day OOS window, win-rate ≥ baseline − 3pp OR Sharpe +0.15, max
drawdown ≤ current + 20% relative) before `approved=1` — unapproved
versions are never loaded live. This logic is pure computation over
pandas DataFrames; no reason to move it to Rust.

## Phase 5 — AI layer (reflector + event analyst) (1 week)

Wire `ai/router.py`'s `reflect_failed_trade` and
`event_probability_estimate` into the trade-close hook. Reflections write
to the `reflections` table (already in the Rust journal schema) with
`accepted=0` until a human or the backtest gate approves them.

## Phase 6 — 3-week shadow demo

Unchanged from the original spec (§9): all adapters `dry_run=True`, perps
on Binance testnet, go/no-go criteria in §9.1. The one change worth
tracking explicitly during the demo: **zero risk-gate breaches** is now a
claim about Rust code with unit tests behind it, not a claim about
Python logic that could silently diverge between two call sites.

## Phase 7 — Fine-tuned reviewer (post-demo)

Unchanged (original spec §7.4): QLoRA on an 8B model using demo trade
records as labeled data. The reviewer can only reject, never approve —
approval is always the Rust risk engine's call.

## What NOT to port to Rust later

PySide6 GUI, backtester/ML ensemble (pandas/LightGBM/Optuna), AI router.
If a future profiling pass shows the DSL compiler itself is a bottleneck
(unlikely — it runs once per strategy version, not per tick), it's the one
candidate worth reconsidering.
