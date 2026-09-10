/**
 * Model pricing in USD per 1,000,000 tokens.
 *
 * Resolution order (first hit wins):
 *   1. user overrides set via setPriceOverrides() (the CLI loads
 *      ~/.config/tokseal/pricing.json)
 *   2. LiteLLM's table, synced into pricing-data.ts by `npm run sync-pricing`
 *   3. the small hand-maintained FALLBACK table below (models LiteLLM lacks)
 * Matching is case-insensitive: exact id, then the id with a "provider/"
 * prefix stripped, then the longest key the id starts with. Unknown models
 * resolve to null and are counted at $0 — tokens still count, but a
 * leaderboard must never invent a cost it cannot defend.
 */

import { LITELLM_PRICES } from './pricing-data.js';

export type PricePerMillion = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

// Keys are lowercased model ids. Only for models missing upstream.
const FALLBACK: Record<string, PricePerMillion> = {
  'qwen3-coder': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 0 },
  'qwen3-coder-plus': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 0 },
  'codex-mini': { input: 1.5, output: 6, cacheRead: 0.375, cacheWrite: 0 },
};

let overrides: Record<string, PricePerMillion> = {};

/** Replace user overrides (keys are model ids, values per-million USD). */
export function setPriceOverrides(table: Record<string, Partial<PricePerMillion>>) {
  overrides = {};
  for (const [k, v] of Object.entries(table)) {
    if (!v || typeof v !== 'object') continue;
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    overrides[k.toLowerCase()] = { input: n(v.input), output: n(v.output), cacheRead: n(v.cacheRead), cacheWrite: n(v.cacheWrite) };
  }
}

function lookup(table: Record<string, PricePerMillion>, key: string): PricePerMillion | null {
  if (table[key]) return table[key];
  const stripped = key.replace(/^[a-z0-9_.-]+\//, '');
  if (stripped !== key && table[stripped]) return table[stripped];
  let best: { len: number; price: PricePerMillion } | null = null;
  for (const [k, price] of Object.entries(table)) {
    if (k.length >= 4 && stripped.startsWith(k) && (!best || k.length > best.len)) best = { len: k.length, price };
  }
  return best?.price ?? null;
}

export function resolvePrice(model: string): PricePerMillion | null {
  const key = model.toLowerCase();
  return lookup(overrides, key) ?? lookup(LITELLM_PRICES, key) ?? lookup(FALLBACK, key);
}

export const PRICE_COUNT = Object.keys(LITELLM_PRICES).length;

const PER_TOKEN = 1 / 1_000_000;

export function costFor(
  model: string,
  t: { input: number; output: number; cacheRead: number; cacheWrite: number },
): { cost: number; priced: boolean } {
  const p = resolvePrice(model);
  if (!p) return { cost: 0, priced: false };
  const cost =
    (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheWrite * p.cacheWrite) * PER_TOKEN;
  return { cost, priced: true };
}
