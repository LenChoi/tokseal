/**
 * Demo data used when no Supabase project is configured (local dev, previews).
 * Clearly labeled in the UI. Not real people.
 */
import { gradeFromTotals, totalsFromDays, windowDays, type Submission, type SubmissionDay } from '@tokseal/core';
import type { LeaderboardRow, Profile } from './db';

const END = '2026-09-07';
const DAY = 86_400_000;

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

function mkDays(seed: number, span: number, dailyTokens: number, activity: number): SubmissionDay[] {
  const r = rng(seed);
  const out: SubmissionDay[] = [];
  const endMs = Date.parse(END);
  for (let i = span - 1; i >= 0; i--) {
    const date = new Date(endMs - i * DAY).toISOString().slice(0, 10);
    const dow = new Date(endMs - i * DAY).getUTCDay();
    const active = r() < (dow === 0 || dow === 6 ? activity * 0.5 : activity);
    if (!active) continue;
    const t = dailyTokens * (0.3 + r() * 1.6);
    out.push({
      date, input: t * 0.04, output: t * 0.02, cacheRead: t * 0.9, cacheWrite: t * 0.04, reasoning: 0,
      cost: t / 1e6 * 0.62, messageCount: Math.round(t / 300_000), sessionCount: 1 + Math.floor(r() * 4),
    });
  }
  return out;
}

function mk(login: string, seed: number, span: number, dailyTokens: number, activity: number): { profile: Profile; submission: Submission } {
  const days = mkDays(seed, span, dailyTokens, activity);
  const totals = totalsFromDays(days.map((d) => ({ ...d })));
  const g = gradeFromTotals(totalsFromDays(windowDays(days.map((d) => ({ ...d })), 30, END)));
  const models: Submission['models'] = [
    { client: 'claude', model: 'claude-opus-5', messageCount: Math.round(totals.messageCount * 0.6), cost: totals.cost * 0.7, input: totals.input * 0.6, output: totals.output * 0.6, cacheRead: totals.cacheRead * 0.6, cacheWrite: totals.cacheWrite * 0.6, reasoning: 0 },
    { client: 'claude', model: 'claude-fable-5-1', messageCount: Math.round(totals.messageCount * 0.4), cost: totals.cost * 0.3, input: totals.input * 0.4, output: totals.output * 0.4, cacheRead: totals.cacheRead * 0.4, cacheWrite: totals.cacheWrite * 0.4, reasoning: 0 },
  ];
  return {
    profile: { login, name: null, avatar_url: null },
    submission: {
      version: 2, grade: g.level, percentile: Number(g.percentile.toFixed(2)), totals, models, days, clients: ['claude'],
      dateRange: { start: days[0]?.date ?? null, end: days.at(-1)?.date ?? null },
      generatedAt: `${END}T09:00:00.000Z`,
    },
  };
}

export const DEMO_USERS = [
  mk('demo-sora', 11, 300, 1_400_000_000, 0.95),
  mk('demo-kai', 12, 220, 700_000_000, 0.85),
  mk('demo-mina', 13, 180, 450_000_000, 0.8),
  mk('demo-len', 14, 60, 420_000_000, 0.9),
  mk('demo-juno', 15, 120, 180_000_000, 0.6),
  mk('demo-ari', 16, 90, 90_000_000, 0.5),
  mk('demo-noa', 17, 40, 40_000_000, 0.3),
];

function streakOf(days: SubmissionDay[]) {
  const set = new Set(days.filter((d) => d.messageCount > 0).map((d) => d.date));
  let n = 0;
  for (let ms = Date.parse(END); set.has(new Date(ms).toISOString().slice(0, 10)); ms -= DAY) n++;
  return n;
}

export function demoLeaderboard(): LeaderboardRow[] {
  return DEMO_USERS
    .slice()
    .sort((a, b) => a.submission.percentile - b.submission.percentile || b.submission.totals.totalTokens - a.submission.totals.totalTokens)
    .map((u, i) => ({
      ...u.profile, rank: i + 1, submission: u.submission, submittedAt: u.submission.generatedAt,
      allTime: { tokens: u.submission.totals.totalTokens, cost: u.submission.totals.cost, messages: u.submission.totals.messageCount, activeDays: u.submission.totals.activeDays },
      streak: streakOf(u.submission.days),
      flagged: u.profile.login === 'demo-noa',
      flagReasons: u.profile.login === 'demo-noa' ? ['2026-09-01: 31.0B tokens in one day (demo)'] : [],
    }));
}

export function demoUser(login: string) {
  return demoLeaderboard().find((u) => u.login.toLowerCase() === login.toLowerCase()) ?? null;
}
