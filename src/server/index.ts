import { describe, expect, it, vi } from "vitest";
import * as perp from "../src/server/adapters/perpBinance";
import * as meme from "../src/server/adapters/solanaMemecoin";
import * as poly from "../src/server/adapters/polymarketClob";

describe("adapter contract", () => {
  it("perp dry-run does not POST", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const r = await perp.placeMarketOrder("BTCUSDT", "BUY", 100, true);
    expect(r.status).toBe("FILLED");
    const orderCalls = spy.mock.calls.filter((c) => String(c[0]).includes("/fapi/v1/order"));
    expect(orderCalls.length).toBe(0);
    spy.mockRestore();
  });

  it("memecoin live path is disabled", async () => {
    await expect(
      meme.memecoinSwap(
        "So11111111111111111111111111111111111111112",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        10,
        false,
      ),
    ).rejects.toThrow(/live_memecoin_disabled/);
  });

  it("notional matches price * size", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        mid: 0.64,
        bids: [{ price: 0.63, size: 2 }],
        asks: [{ price: 0.65, size: 2 }],
      }),
    })) as any;

    const quote = await poly.polymarketQuote("POLY-TEST", "BUY", 0.65, 2, true);
    expect(Math.abs(quote.notional_usd - quote.price * quote.size)).toBeLessThanOrEqual(0.01);
    globalThis.fetch = originalFetch;
  });
});
