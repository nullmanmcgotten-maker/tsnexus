const SIDECAR = "http://127.0.0.1:8001";

export async function polymarketQuote(
  tokenId: string,
  side: string,
  price: number,
  size: number,
  dryRun: boolean,
) {
  const r = await fetch(`${SIDECAR}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token_id: tokenId, side, price, size, dry_run: dryRun }),
  });
  if (!r.ok) {
    throw new Error(`poly quote ${r.status}`);
  }
  return r.json();
}

export async function polymarketBook(tokenId: string) {
  const r = await fetch(`${SIDECAR}/book/${tokenId}`);
  return r.json();
}

export async function polymarketHealth() {
  const r = await fetch(`${SIDECAR}/health`);
  return r.json();
}
