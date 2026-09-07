/**
 * tokseal grade — a single letter that says "how seriously does this person
 * lean on AI coding tools." Built from four signals so it can't be gamed by one
 * metric alone, and smoothed with an exponential CDF (the same shape
 * github-readme-stats uses for its rank) so there are no hard cliffs.
 *
 * The grade is computed over a rolling window (default 30 days) so people with
 * different log-retention settings are comparable — Claude Code deletes local
 * transcripts after 30 days by default. Medians encode what a solidly-active
 * AI coding user looks like over one such window.
 */

import type { DayBucket, Totals, UsageReport } from './types.js';

const LEVELS = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'] as const;
const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];

export const GRADE_WINDOW_DAYS = 30;

export type GradeLevel = (typeof LEVELS)[number];

export type Grade = {
  level: GradeLevel;
  percentile: number; // top X%
  windowDays: number;
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

/** Medians for a 30-day window. */
const MEDIANS = { tokens: 800_000_000, activeDays: 5, messages: 2_500, sessions: 25 };

export function gradeFromTotals(t: Pick<Totals, 'totalTokens' | 'activeDays' | 'messageCount' | 'sessionCount'>, windowDays = GRADE_WINDOW_DAYS): Grade {
  const signals: Record<string, Signal> = {
    tokens: { value: t.totalTokens, median: MEDIANS.tokens, weight: 3 },
    activeDays: { value: t.activeDays, median: MEDIANS.activeDays, weight: 3 },
    messages: { value: t.messageCount, median: MEDIANS.messages, weight: 2 },
    sessions: { value: t.sessionCount, median: MEDIANS.sessions, weight: 1 },
  };
  let acc = 0;
  let total = 0;
  for (const s of Object.values(signals)) {
    acc += s.weight * cdf(s.value / s.median);
    total += s.weight;
  }
  const percentile = (1 - acc / total) * 100;
  const level = LEVELS[THRESHOLDS.findIndex((th) => percentile <= th)] ?? 'C';
  return {
    level,
    percentile,
    windowDays,
    signals: { tokens: t.totalTokens, activeDays: t.activeDays, messages: t.messageCount, sessions: t.sessionCount },
  };
}

/** Sum day buckets into Totals. */
export function totalsFromDays(days: DayBucket[]): Totals {
  const t: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, cost: 0, messageCount: 0, activeDays: 0, sessionCount: 0 };
  for (const d of days) {
    t.input += d.input; t.output += d.output; t.cacheRead += d.cacheRead; t.cacheWrite += d.cacheWrite; t.reasoning += d.reasoning;
    t.cost += d.cost; t.messageCount += d.messageCount; t.sessionCount += d.sessionCount;
    if (d.messageCount > 0) t.activeDays++;
  }
  t.totalTokens = t.input + t.output + t.cacheRead + t.cacheWrite + t.reasoning;
  return t;
}

/** Day buckets within the last `windowDays` days ending at `end` (YYYY-MM-DD, default today UTC). */
export function windowDays(days: DayBucket[], windowSize = GRADE_WINDOW_DAYS, end?: string): DayBucket[] {
  const endDate = end ?? new Date().toISOString().slice(0, 10);
  const startMs = Date.parse(endDate) - (windowSize - 1) * 86_400_000;
  const start = new Date(startMs).toISOString().slice(0, 10);
  return days.filter((d) => d.date >= start && d.date <= endDate);
}

/** Grade a local report over its trailing 30-day window (falls back to totals when no day data). */
export function grade(report: UsageReport): Grade {
  if (report.days.length === 0) return gradeFromTotals(report.totals);
  const end = report.dateRange.end ?? undefined;
  return gradeFromTotals(totalsFromDays(windowDays(report.days, GRADE_WINDOW_DAYS, end)));
}
