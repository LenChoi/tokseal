/**
 * Server-side defenses for self-reported usage. None of this can *prove* a
 * number is real (the source is a local log file), so the goal is to make
 * crude forgery fail loudly and subtle forgery visible:
 *
 *  1. reprice():   cost is recomputed from tokens with the bundled price table;
 *                  the client's cost is discarded.
 *  2. sanityCheck(): physical impossibilities → reject; implausible → flag.
 *  3. anomalyCheck(): sudden jumps versus the user's own history → flag.
 *
 * Flagged rows stay on the profile but are shown as UNVERIFIED and excluded
 * from ranking. Thresholds are deliberately generous: false rejections hurt
 * more than a few flagged cheaters.
 */

import { costFor } from './pricing.js';
import type { Submission, SubmissionDay } from './submission.js';

export type SanityResult = { errors: string[]; flags: string[] };

// --- hard limits (reject) ---------------------------------------------------
const MAX_TOKENS_PER_MESSAGE = 1_300_000; // 1M context + output + cache write, per API call
const MAX_OUTPUT_PER_DAY = 200_000_000;   // ~100 tok/s × 86400 s × ~20 parallel streams
const MAX_MESSAGES_PER_DAY = 50_000;
const MAX_SESSIONS_PER_DAY = 2_000;
const MAX_TOKENS_PER_DAY = 200_000_000_000; // 200B

// --- soft limits (flag as unverified) ---------------------------------------
const FLAG_TOKENS_PER_DAY = 25_000_000_000; // 25B/day
const FLAG_OUTPUT_PER_DAY = 40_000_000;
const FLAG_MESSAGES_PER_DAY = 15_000;
const FLAG_AVG_TOKENS_PER_MESSAGE = 1_000_000;

const dayTokens = (d: SubmissionDay) => d.input + d.output + d.cacheRead + d.cacheWrite + d.reasoning;

/** Recompute every cost from tokens. Returns a new Submission and the ratio applied to day costs. */
export function reprice(s: Submission): { submission: Submission; ratio: number; unpricedModels: string[] } {
  const unpricedModels: string[] = [];
  let modelTotal = 0;
  const models = s.models.map((m) => {
    const { cost, priced } = costFor(m.model, m);
    if (!priced) unpricedModels.push(m.model);
    modelTotal += cost;
    return { ...m, cost: Number(cost.toFixed(4)) };
  });
  // Day buckets carry no per-model split, so scale the client's day costs to the
  // server-priced total. If the client sent no cost at all, distribute by tokens.
  const clientDayTotal = s.days.reduce((a, d) => a + d.cost, 0);
  const tokenTotal = s.days.reduce((a, d) => a + dayTokens(d), 0);
  const ratio = clientDayTotal > 0 ? modelTotal / clientDayTotal : 0;
  const days = s.days.map((d) => ({
    ...d,
    cost: Number((clientDayTotal > 0 ? d.cost * ratio : tokenTotal > 0 ? (modelTotal * dayTokens(d)) / tokenTotal : 0).toFixed(4)),
  }));
  return {
    submission: { ...s, models, days, totals: { ...s.totals, cost: Number(modelTotal.toFixed(4)) } },
    ratio: clientDayTotal > 0 ? ratio : 1,
    unpricedModels,
  };
}

export function sanityCheck(s: Submission): SanityResult {
  const errors: string[] = [];
  const flags: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10); // UTC+14 slack

  for (const d of s.days) {
    const t = dayTokens(d);
    if (d.date > tomorrow) { errors.push(`${d.date}: future date`); continue; }
    if (t > MAX_TOKENS_PER_DAY) errors.push(`${d.date}: ${t} tokens exceeds daily maximum`);
    if (d.output > MAX_OUTPUT_PER_DAY) errors.push(`${d.date}: ${d.output} output tokens is physically impossible`);
    if (d.messageCount > MAX_MESSAGES_PER_DAY) errors.push(`${d.date}: ${d.messageCount} messages exceeds daily maximum`);
    if (d.sessionCount > MAX_SESSIONS_PER_DAY) errors.push(`${d.date}: ${d.sessionCount} sessions exceeds daily maximum`);
    if (t > 0 && d.messageCount === 0) errors.push(`${d.date}: tokens without messages`);
    if (d.messageCount > 0 && t > d.messageCount * MAX_TOKENS_PER_MESSAGE)
      errors.push(`${d.date}: ${Math.round(t / d.messageCount)} tokens per message exceeds the largest context window`);
    if (d.sessionCount > d.messageCount) errors.push(`${d.date}: more sessions than messages`);

    if (t > FLAG_TOKENS_PER_DAY) flags.push(`${d.date}: ${(t / 1e9).toFixed(1)}B tokens in one day`);
    if (d.output > FLAG_OUTPUT_PER_DAY) flags.push(`${d.date}: ${(d.output / 1e6).toFixed(0)}M output tokens in one day`);
    if (d.messageCount > FLAG_MESSAGES_PER_DAY) flags.push(`${d.date}: ${d.messageCount} messages in one day`);
    if (d.messageCount >= 20 && t / d.messageCount > FLAG_AVG_TOKENS_PER_MESSAGE)
      flags.push(`${d.date}: ${Math.round(t / d.messageCount / 1000)}K tokens per message on average`);
    if (d.date > today) flags.push(`${d.date}: dated tomorrow`);
  }

  // Totals must be consistent with days (within 2%) when days are present.
  if (s.days.length > 0) {
    const sum = s.days.reduce((a, d) => a + dayTokens(d), 0);
    const diff = Math.abs(sum - s.totals.totalTokens);
    if (diff > Math.max(1000, s.totals.totalTokens * 0.02)) errors.push(`totals.totalTokens (${s.totals.totalTokens}) does not match day sum (${sum})`);
    const msgs = s.days.reduce((a, d) => a + d.messageCount, 0);
    if (Math.abs(msgs - s.totals.messageCount) > Math.max(10, s.totals.messageCount * 0.02)) errors.push('totals.messageCount does not match day sum');
  }
  // Models must be consistent with totals.
  const modelTokens = s.models.reduce((a, m) => a + m.input + m.output + m.cacheRead + m.cacheWrite + m.reasoning, 0);
  if (s.models.length && Math.abs(modelTokens - s.totals.totalTokens) > Math.max(1000, s.totals.totalTokens * 0.02))
    errors.push('model breakdown does not match totals');

  return { errors, flags };
}

export type PriorHistory = {
  /** Existing per-day tokens on the server, keyed by date. */
  dayTokens: Map<string, number>;
  allTimeTokens: number;
};

/** Compare against what the server already knows about this user. */
export function anomalyCheck(s: Submission, prior: PriorHistory): string[] {
  const flags: string[] = [];
  const priorDays = [...prior.dayTokens.entries()];
  if (priorDays.length < 7) return flags; // not enough history to judge
  const priorMax = Math.max(...priorDays.map(([, t]) => t));

  // A day rewritten to many times its previous value.
  for (const d of s.days) {
    const before = prior.dayTokens.get(d.date);
    const after = dayTokens(d);
    if (before && before > 100_000_000 && after > before * 4) flags.push(`${d.date}: rewritten from ${(before / 1e9).toFixed(2)}B to ${(after / 1e9).toFixed(2)}B`);
    if (!before && after > priorMax * 5 && after > 5_000_000_000) flags.push(`${d.date}: ${(after / 1e9).toFixed(1)}B is 5× the previous busiest day`);
  }
  // All-time jumping by >3× in one submit.
  const incomingNew = s.days.filter((d) => !prior.dayTokens.has(d.date)).reduce((a, d) => a + dayTokens(d), 0);
  if (prior.allTimeTokens > 1_000_000_000 && incomingNew > prior.allTimeTokens * 3) flags.push(`all-time jumped ${(incomingNew / prior.allTimeTokens).toFixed(1)}× in one submit`);
  return flags;
}
