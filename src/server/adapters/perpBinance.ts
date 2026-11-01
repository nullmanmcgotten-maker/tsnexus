import crypto from "crypto";
import fetch from "node-fetch";

const TESTNET = process.env.BINANCE_TESTNET === "true";
const REST = TESTNET ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";
const KEY = process.env.BINANCE_API_KEY ?? "";
const SECRET = process.env.BINANCE_API_SECRET ?? "";

function sign(qs: string): string {
  return crypto.createHmac("sha256", SECRET).update(qs).digest("hex");
}

async function signedRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string | number> = {},
) {
  const ts = Date.now();
  const all = { ...params, timestamp: ts, recvWindow: 5000 };
  const qs = new URLSearchParams(all as Record<string, string>).toString();
  const sig = sign(qs);
  const url = `${REST}${path}?${qs}&signature=${sig}`;
  const r = await fetch(url, {
    method,
    headers: { "X-MBX-APIKEY": KEY },
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`binance ${r.status}: ${text}`);
  }
  return JSON.parse(text);
}

export async function accountBalanceUsd(): Promise<number> {
  const acc = await signedRequest("GET", "/fapi/v2/account");
  return parseFloat(acc.totalWalletBalance ?? "0");
}

export async function placeMarketOrder(
  symbol: string,
  side: "BUY" | "SELL",
  notionalUsd: number,
  dryRun: boolean,
) {
  const price = await publicMarkPrice(symbol);
  const qty = Number((notionalUsd / price).toFixed(3));

  if (dryRun) {
    return {
      order_id: `DRY-${Date.now()}`,
      status: "FILLED",
      filled_size: qty,
      avg_price: price,
      raw: { dryRun: true, mark: price },
    };
  }

  const resp = await signedRequest("POST", "/fapi/v1/order", {
    symbol,
    side,
    type: "MARKET",
    quantity: qty,
  });

  return {
    order_id: String(resp.orderId),
    status: resp.status === "FILLED" ? "FILLED" : "SUBMITTED",
    filled_size: parseFloat(resp.executedQty ?? "0"),
    avg_price: parseFloat(resp.avgPrice) || null,
    raw: resp,
  };
}

export async function publicMarkPrice(symbol: string): Promise<number> {
  const r = await fetch(`${REST}/fapi/v1/premiumIndex?symbol=${symbol}`);
  if (!r.ok) {
    throw new Error(`binance mark price ${r.status}`);
  }
  const j = await r.json();
  return parseFloat(j.markPrice ?? "0");
}
