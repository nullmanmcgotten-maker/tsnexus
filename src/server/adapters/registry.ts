const JUP = process.env.JUPITER_KEY
  ? "https://api.jup.ag/swap/v1"
  : "https://lite-api.jup.ag/swap/v1";
const JUP_KEY = process.env.JUPITER_KEY;
const COINSCAN_KEY = process.env.COINSCAN_API_KEY ?? "";

let scansToday = 0;
let scansDay = new Date().toISOString().slice(0, 10);

function bumpScanCounter() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== scansDay) {
    scansDay = today;
    scansToday = 0;
  }
  if (scansToday >= 25) {
    throw new Error("coinscan_daily_limit");
  }
  scansToday += 1;
}

export async function safetyScan(mint: string) {
  bumpScanCounter();
  const r = await fetch(`https://api.coinscan.dev/v1/token/${mint}?network=solana`, {
    headers: { "x-api-key": COINSCAN_KEY },
  });
  if (!r.ok) {
    throw new Error(`coinscan ${r.status}`);
  }
  const s: any = await r.json();
  const reasons: string[] = [];
  if ((s.ai_predictions?.p_rug ?? 0) > 0.15) reasons.push("p_rug");
  if ((s.holders?.bundle_pct ?? 0) > 0.40) reasons.push("bundle");
  if ((s.holders?.sniper_pct ?? 0) > 0.30) reasons.push("sniper");
  if (!s.lp_lock?.locked) reasons.push("lp_unlocked");
  if (s.flags?.honeypot) reasons.push("honeypot");
  return { passed: reasons.length === 0, reasons, raw: s };
}

export async function jupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps = 300,
) {
  const u = new URL(`${JUP}/quote`);
  u.searchParams.set("inputMint", inputMint);
  u.searchParams.set("outputMint", outputMint);
  u.searchParams.set("amount", String(amountLamports));
  u.searchParams.set("slippageBps", String(slippageBps));

  const headers: Record<string, string> = {};
  if (JUP_KEY) headers["x-api-key"] = JUP_KEY;

  const r = await fetch(u.toString(), { headers });
  if (!r.ok) {
    throw new Error(`jup quote ${r.status}`);
  }
  return r.json();
}

export async function getPriorityFee(accountKeys: string[]) {
  const rpc = process.env.SOLANA_RPC ?? "";
  if (!rpc) return 0;

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getRecentPrioritizationFees",
    params: [accountKeys.slice(0, 20)],
  };

  const r = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const j: any = await r.json();
  const fees = (j.result ?? []).map((x: any) => x.prioritizationFee);
  fees.sort((a: number, b: number) => a - b);
  return fees[Math.floor(fees.length / 2)] ?? 0;
}

export async function memecoinSwap(
  inputMint: string,
  outputMint: string,
  notionalUsd: number,
  dryRun = true,
) {
  const solPrice = await getSolPriceUsd();
  const lamports = Math.floor((notionalUsd / solPrice) * 1e9);
  const q = await jupiterQuote(inputMint, outputMint, lamports);

  if (dryRun) {
    return {
      order_id: `DRY-MEME-${Date.now()}`,
      status: "FILLED",
      filled_size: Number(q.outAmount) / 1e9,
      avg_price: notionalUsd / (Number(q.outAmount) / 1e9),
      raw: { dryRun: true, quote: q },
    };
  }

  throw new Error("live_memecoin_disabled_until_go_nogo");
}

async function getSolPriceUsd() {
  const r = await fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot");
  const j: any = await r.json();
  return parseFloat(j.data.amount);
}
