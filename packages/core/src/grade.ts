/**
 * tokseal grade — a single letter that says "how seriously does this person
 * lean on AI coding tools." Built from four local signals so it can't be gamed
 * by one metric alone, and smoothed with an exponential CDF (the same shape
 * github-readme-stats uses for its rank) so there are no hard cliffs.
 *
 * Percentile is "top X%" — lower is better. Medians below are the tuning knobs;
 * they encode what a solidly-active AI coding user looks like.
 */

import type { UsageReport } from './types.js';

const LEVELS = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'] as const;
const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];

export type Grade = {
  level: (typeof LEVELS)[number];
  percentile: number; // top X%
  signals: {
    tokens: number;
    activeDays: number;
    messages: number;
    sessions: number;
  };
};

// exponential CDF: diminishing returns, saturates near 1.
const cdf = (x: number) => 1 - 2 ** -x;

type Signal = { value: number; median: number; weight: number };

export function grade(report: UsageReport): Grade {
  const t = report.totals;
  const signals: Record<string, Signal> = {
    tokens: { value: t.totalTokens, median: 2_000_000_000, weight: 3 },
    activeDays: { value: t.activeDays, median: 40, weight: 3 },
    messages: { value: t.messageCount, median: 6_000, weight: 2 },
    sessions: { value: t.sessionCount, median: 250, weight: 1 },
  };

  let acc = 0;
  let total = 0;
  for (const s of Object.values(signals)) {
    acc += s.weight * cdf(s.value / s.median);
    total += s.weight;
  }
  const rank = 1 - acc / total;
  const percentile = rank * 100;
  const level = LEVELS[THRESHOLDS.findIndex((th) => percentile <= th)] ?? 'C';

  return {
    level,
    percentile,
    signals: {
      tokens: signals.tokens.value,
      activeDays: signals.activeDays.value,
      messages: signals.messages.value,
      sessions: signals.sessions.value,
    },
  };
}
