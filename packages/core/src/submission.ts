/**
 * Opt-in leaderboard payload. This is the *only* thing `tokseal submit` ever
 * uploads: aggregate totals, per-model totals, the grade, and a date range.
 * No message content, no file paths, no project names, no session ids.
 *
 * `reportFromSubmission` rebuilds a minimal UsageReport so the hosted
 * `/api/card` can reuse the exact same `renderCard` as the CLI.
 */

import type { DayBucket, UsageReport, UsageRow } from './types.js';
import type { Grade } from './grade.js';

export const SUBMISSION_VERSION = 2;

export type SubmissionModel = {
  client: string;
  model: string;
  estimated?: boolean;
  messageCount: number;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
};

/** One day of aggregate usage. No content, no paths, no session ids — counts only. */
export type SubmissionDay = {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  cost: number;
  messageCount: number;
  sessionCount: number;
};

export type Submission = {
  version: number;
  grade: Grade['level'];
  percentile: number;
  totals: UsageReport['totals'];
  models: SubmissionModel[];
  /** Per-day buckets. The server merges these by date so history survives local log cleanup. */
  days: SubmissionDay[];
  /** Estimated-only sources (Kiro, imports). Displayed with "~", never ranked. */
  estimated?: UsageReport['totals'];
  clients: string[];
  dateRange: UsageReport['dateRange'];
  generatedAt: string;
};

export function toSubmission(report: UsageReport, g: Grade): Submission {
  return {
    version: SUBMISSION_VERSION,
    grade: g.level,
    percentile: Number(g.percentile.toFixed(2)),
    totals: { ...report.totals },
    models: report.rows.map((r) => ({
      client: r.client,
      model: r.model,
      ...(r.estimated ? { estimated: true } : {}),
      messageCount: r.messageCount,
      cost: Number(r.cost.toFixed(4)),
      input: r.input,
      output: r.output,
      cacheRead: r.cacheRead,
      cacheWrite: r.cacheWrite,
      reasoning: r.reasoning,
    })),
    days: report.days.map((d) => ({
      date: d.date,
      input: d.input, output: d.output, cacheRead: d.cacheRead, cacheWrite: d.cacheWrite, reasoning: d.reasoning,
      cost: Number(d.cost.toFixed(4)), messageCount: d.messageCount, sessionCount: d.sessionCount,
    })),
    clients: [...report.clients],
    ...(report.estimated.totalTokens > 0 ? { estimated: { ...report.estimated } } : {}),
    dateRange: { ...report.dateRange },
    generatedAt: report.generatedAt,
  };
}

export function daysFromSubmission(s: Submission): DayBucket[] {
  return s.days.map((d) => ({ ...d }));
}

/** Rebuild enough of a UsageReport (no per-day buckets) to render a card. */
export function reportFromSubmission(s: Submission): UsageReport {
  const rows: UsageRow[] = s.models.map((m) => ({ ...m, estimated: !!m.estimated, priced: m.cost > 0 }));
  const zeroT: UsageReport['totals'] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, cost: 0, messageCount: 0, activeDays: 0, sessionCount: 0 };
  return {
    rows,
    days: daysFromSubmission(s),
    totals: { ...s.totals },
    estimated: { ...zeroT, ...(s.estimated ?? {}) },
    dateRange: { ...s.dateRange },
    clients: [...s.clients],
    models: [...new Set(s.models.map((m) => m.model))].sort(),
    generatedAt: s.generatedAt,
  };
}

export function gradeFromSubmission(s: Submission): Grade {
  return {
    level: s.grade,
    percentile: s.percentile,
    score: 1 - s.percentile / 100,
    windowDays: 30,
    signals: {
      tokens: s.totals.totalTokens,
      activeDays: s.totals.activeDays,
      messages: s.totals.messageCount,
      sessions: s.totals.sessionCount,
    },
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;

/** Strict validation for the server. Returns a normalized copy or an error string. */
export function validateSubmission(input: unknown): { ok: true; value: Submission } | { ok: false; error: string } {
  const x = input as Record<string, unknown>;
  if (!x || typeof x !== 'object') return { ok: false, error: 'not an object' };
  if (x.version !== SUBMISSION_VERSION) return { ok: false, error: 'unsupported version' };
  const LEVELS = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];
  if (!LEVELS.includes(x.grade as string)) return { ok: false, error: 'bad grade' };
  if (!isNum(x.percentile) || x.percentile > 100) return { ok: false, error: 'bad percentile' };

  const t = x.totals as Record<string, unknown>;
  const totalKeys = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'totalTokens', 'cost', 'messageCount', 'activeDays', 'sessionCount'] as const;
  if (!t || typeof t !== 'object') return { ok: false, error: 'bad totals' };
  for (const k of totalKeys) if (!isNum(t[k])) return { ok: false, error: `bad totals.${k}` };

  if (!Array.isArray(x.models) || x.models.length > 100) return { ok: false, error: 'bad models' };
  const models: SubmissionModel[] = [];
  for (const m of x.models as Record<string, unknown>[]) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'bad model row' };
    if (!isStr(m.client, 40) || !isStr(m.model, 120)) return { ok: false, error: 'bad model id' };
    for (const k of ['messageCount', 'cost', 'input', 'output', 'cacheRead', 'cacheWrite', 'reasoning'] as const)
      if (!isNum(m[k])) return { ok: false, error: `bad model.${k}` };
    models.push({
      client: m.client, model: m.model,
      ...(m.estimated === true ? { estimated: true } : {}),
      messageCount: m.messageCount as number, cost: m.cost as number,
      input: m.input as number, output: m.output as number,
      cacheRead: m.cacheRead as number, cacheWrite: m.cacheWrite as number, reasoning: m.reasoning as number,
    });
  }

  if (!Array.isArray(x.days) || x.days.length > 400) return { ok: false, error: 'bad days' };
  const days: SubmissionDay[] = [];
  const seen = new Set<string>();
  for (const d of x.days as Record<string, unknown>[]) {
    if (!d || typeof d !== 'object') return { ok: false, error: 'bad day' };
    if (!isStr(d.date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || seen.has(d.date)) return { ok: false, error: 'bad day.date' };
    seen.add(d.date);
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'cost', 'messageCount', 'sessionCount'] as const)
      if (!isNum(d[k])) return { ok: false, error: `bad day.${k}` };
    days.push({
      date: d.date, input: d.input as number, output: d.output as number, cacheRead: d.cacheRead as number,
      cacheWrite: d.cacheWrite as number, reasoning: d.reasoning as number, cost: d.cost as number,
      messageCount: d.messageCount as number, sessionCount: d.sessionCount as number,
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  if (!Array.isArray(x.clients) || !x.clients.every((c) => isStr(c, 40)) || x.clients.length > 20)
    return { ok: false, error: 'bad clients' };

  let estimated: Submission['estimated'];
  if (x.estimated !== undefined) {
    const e = x.estimated as Record<string, unknown>;
    if (!e || typeof e !== 'object') return { ok: false, error: 'bad estimated' };
    for (const k of totalKeys) if (!isNum(e[k])) return { ok: false, error: `bad estimated.${k}` };
    estimated = Object.fromEntries(totalKeys.map((k) => [k, e[k] as number])) as Submission['totals'];
  }

  const dr = x.dateRange as Record<string, unknown>;
  const isDate = (v: unknown) => v === null || (isStr(v, 10) && /^\d{4}-\d{2}-\d{2}$/.test(v));
  if (!dr || !isDate(dr.start) || !isDate(dr.end)) return { ok: false, error: 'bad dateRange' };

  return {
    ok: true,
    value: {
      version: SUBMISSION_VERSION,
      grade: x.grade as Submission['grade'],
      percentile: x.percentile,
      totals: Object.fromEntries(totalKeys.map((k) => [k, t[k] as number])) as Submission['totals'],
      models,
      days,
      clients: x.clients as string[],
      ...(estimated ? { estimated } : {}),
      dateRange: { start: dr.start as string | null, end: dr.end as string | null },
      generatedAt: isStr(x.generatedAt, 40) ? x.generatedAt : new Date().toISOString(),
    },
  };
}
