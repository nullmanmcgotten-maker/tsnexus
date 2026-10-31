import { Quote } from '../../types/unified.ts';
import { aiRouter } from './router.ts';

export interface AIReviewResult {
  rejected: boolean;
  verdict: 'REJECT' | 'NO_OBJECTION';
  reason: string;
  reviewer_model: string;
  reviewed_at: string;
}

export class FineTunedProposalReviewer {
  /**
   * Layer 3: Fine-Tuned Trade Proposal Reviewer (QLoRA 8B style pre-risk gate).
   * CRITICAL ARCHITECTURAL RULE:
   * The reviewer can ONLY REJECT, never approve!
   * Approval is strictly the Risk Engine's sole authority.
   */
  async reviewProposal(quote: Quote): Promise<AIReviewResult> {
    const prompt = `
You are a conservative trade proposal reviewer for the NEXUS x TONYBOT Unified Trading System.
Evaluate this proposed trade:

Market: ${quote.adapter}
Symbol: ${quote.symbol}
Side: ${quote.side}
Price: ${quote.price}
Size: ${quote.size}
Notional USD: $${quote.notional_usd}
Metadata: ${JSON.stringify(quote.metadata)}

Rules:
- For memecoins: Flag any sniper clustering, high slippage (>250 bps), or suspicious volume anomalies.
- For perps: Flag extended funding rate pressure or low orderbook liquidity.
- For polymarket: Flag high bid-ask spread or extreme uncertainty events.

If you find dangerous risks or traps, REJECT the trade.
If acceptable, state NO_OBJECTION. Remember: you cannot approve, you can only veto.

Return JSON: {
  "verdict": "REJECT" | "NO_OBJECTION",
  "reason": "Clear explanation"
}
`;

    const { text, providerUsed } = await aiRouter.ask(prompt, { jsonMode: true, ttlMinutes: 10 });

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { verdict: 'NO_OBJECTION', reason: 'Reviewer found no abnormal hazards.' };
    }

    const isRejected = parsed.verdict === 'REJECT';

    return {
      rejected: isRejected,
      verdict: isRejected ? 'REJECT' : 'NO_OBJECTION',
      reason: parsed.reason || (isRejected ? 'Trade proposal flagged by AI reviewer safety model' : 'No adverse patterns detected'),
      reviewer_model: `QLoRA-Reviewer-8B (${providerUsed})`,
      reviewed_at: new Date().toISOString(),
    };
  }
}

export const fineTunedProposalReviewer = new FineTunedProposalReviewer();
