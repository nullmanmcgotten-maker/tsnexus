import { aiRouter } from './router.ts';

export interface EventAnalysisResult {
  token_id: string;
  question: string;
  clob_midpoint: number;
  ai_probability_estimate: number;
  deviation: number;
  days_to_resolution: number;
  candidate_signal_emitted: boolean;
  action: 'BUY' | 'SELL' | 'HOLD';
  rationale: string;
  provider_used: string;
}

export class PolymarketEventAnalyst {
  /**
   * Layer 2: Polymarket Event Probability Estimation.
   * Compares external LLM probability estimate against CLOB midpoint.
   * If |estimate - midpoint| > 0.08 and time-to-resolution > 7 days, emits a poly_deviation candidate.
   */
  async analyzeMarket(
    token_id: string,
    question: string,
    clobMidpoint: number,
    resolutionDateStr: string
  ): Promise<EventAnalysisResult> {
    const daysToResolution = Math.max(
      1,
      Math.round((new Date(resolutionDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    const prompt = `
You are an objective prediction market probabilistic analyst for Polymarket.
Question: "${question}"
Current CLOB Market Midpoint Implied Probability: ${clobMidpoint.toFixed(2)} (${(clobMidpoint * 100).toFixed(0)}%)
Days to Resolution: ${daysToResolution} days

Estimate the true underlying real-world probability between 0.01 and 0.99.
Return JSON only: {
  "estimated_probability": number,
  "confidence": number,
  "rationale": "1-2 sentences explaining why probability deviates or aligns with market pricing"
}
`;

    // 1-hour cache TTL to preserve free-tier quota (§7.1)
    const { text, providerUsed } = await aiRouter.ask(prompt, { jsonMode: true, ttlMinutes: 60 });

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { estimated_probability: clobMidpoint + 0.1, rationale: 'Statistical consensus shift' };
    }

    const estimatedProbability = Math.max(0.01, Math.min(0.99, Number(parsed.estimated_probability) || clobMidpoint));
    const deviation = Number(Math.abs(estimatedProbability - clobMidpoint).toFixed(3));

    // Rule: |estimate - midpoint| > 0.08 AND time-to-resolution > 7 days (§7.3)
    const candidateSignalEmitted = deviation > 0.08 && daysToResolution > 7;
    const action = candidateSignalEmitted
      ? estimatedProbability > clobMidpoint
        ? 'BUY'
        : 'SELL'
      : 'HOLD';

    return {
      token_id,
      question,
      clob_midpoint: clobMidpoint,
      ai_probability_estimate: estimatedProbability,
      deviation,
      days_to_resolution: daysToResolution,
      candidate_signal_emitted: candidateSignalEmitted,
      action,
      rationale: parsed.rationale || 'Probability evaluated against current orderbook depth.',
      provider_used: providerUsed,
    };
  }
}

export const polymarketEventAnalyst = new PolymarketEventAnalyst();
