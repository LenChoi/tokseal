/**
 * Model pricing in USD per 1,000,000 tokens.
 *
 * MVP ships a small bundled table for Claude models. Values are matched
 * case-insensitively; an exact key wins, otherwise a prefix match is tried.
 * Unknown models resolve to `null` and are counted at $0 (tokens still count),
 * mirroring how a leaderboard must never invent a cost it cannot defend.
 *
 * TODO(post-MVP): sync from a maintained source (e.g. LiteLLM) at build time.
 */

export type PricePerMillion = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

// Keys are lowercased model ids.
const TABLE: Record<string, PricePerMillion> = {
  // Opus 5 / 4.8 tier (per public pricing snapshots).
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  // Fable (mid) tier — Sonnet-class estimate; refine when authoritative.
  'claude-fable-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-fable-5-1': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  // Classic tiers.
  'claude-3-5-sonnet': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-3-7-sonnet': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-4': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-3-opus': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-3-5-haiku': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },

  // OpenAI (Codex CLI). Cache write is free on OpenAI; cached input is discounted.
  'gpt-5': { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
  'gpt-5-mini': { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0 },
  'gpt-5-nano': { input: 0.05, output: 0.4, cacheRead: 0.005, cacheWrite: 0 },
  'gpt-5-codex': { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
  'gpt-4.1': { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6, cacheRead: 0.1, cacheWrite: 0 },
  'gpt-4o': { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 0 },
  'o3': { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
  'o4-mini': { input: 1.1, output: 4.4, cacheRead: 0.275, cacheWrite: 0 },
  'codex-mini': { input: 1.5, output: 6, cacheRead: 0.375, cacheWrite: 0 },

  // Google (Gemini CLI). Standard-tier (≤200K prompt) rates.
  'gemini-2.5-pro': { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 0 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4, cacheRead: 0.01, cacheWrite: 0 },
  'gemini-3-pro': { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
  'gemini-3.1-pro': { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
  'gemini-3-flash': { input: 0.5, output: 3, cacheRead: 0.05, cacheWrite: 0 },

  // Alibaba (Qwen Code). Qwen3-Coder via DashScope, approximate.
  'qwen3-coder': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 0 },
  'qwen3-coder-plus': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 0 },
};

export function resolvePrice(model: string): PricePerMillion | null {
  const key = model.toLowerCase();
  if (TABLE[key]) return TABLE[key];
  // Prefix match: longest bundled key that the model id starts with.
  let best: { len: number; price: PricePerMillion } | null = null;
  for (const [k, price] of Object.entries(TABLE)) {
    if (key.startsWith(k) && (!best || k.length > best.len)) {
      best = { len: k.length, price };
    }
  }
  return best?.price ?? null;
}

const PER_TOKEN = 1 / 1_000_000;

export function costFor(
  model: string,
  t: { input: number; output: number; cacheRead: number; cacheWrite: number },
): { cost: number; priced: boolean } {
  const p = resolvePrice(model);
  if (!p) return { cost: 0, priced: false };
  const cost =
    (t.input * p.input +
      t.output * p.output +
      t.cacheRead * p.cacheRead +
      t.cacheWrite * p.cacheWrite) *
    PER_TOKEN;
  return { cost, priced: true };
}
