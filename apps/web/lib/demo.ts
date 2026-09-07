/**
 * Demo data used when no Supabase project is configured (local dev, previews).
 * Clearly labeled in the UI. Not real people.
 */
import type { Submission } from '@tokseal/core';
import type { LeaderboardRow, Profile } from './db';

function mk(login: string, grade: Submission['grade'], pct: number, tokens: number, cost: number, days: number, msgs: number, sessions: number): { profile: Profile; submission: Submission } {
  const models: Submission['models'] = [
    { client: 'claude', model: 'claude-opus-5', messageCount: Math.round(msgs * 0.6), cost: cost * 0.7, input: tokens * 0.02, output: tokens * 0.01, cacheRead: tokens * 0.55, cacheWrite: tokens * 0.02, reasoning: 0 },
    { client: 'claude', model: 'claude-fable-5-1', messageCount: Math.round(msgs * 0.4), cost: cost * 0.3, input: tokens * 0.02, output: tokens * 0.01, cacheRead: tokens * 0.35, cacheWrite: tokens * 0.02, reasoning: 0 },
  ];
  return {
    profile: { login, name: null, avatar_url: null },
    submission: {
      version: 1, grade, percentile: pct,
      totals: { input: tokens * 0.04, output: tokens * 0.02, cacheRead: tokens * 0.9, cacheWrite: tokens * 0.04, reasoning: 0, totalTokens: tokens, cost, messageCount: msgs, activeDays: days, sessionCount: sessions },
      models, clients: ['claude'],
      dateRange: { start: '2026-06-01', end: '2026-09-07' },
      generatedAt: '2026-09-07T00:00:00.000Z',
    },
  };
}

export const DEMO_USERS = [
  mk('demo-sora', 'S', 0.8, 41_200_000_000, 24_100, 96, 118_000, 640),
  mk('demo-kai', 'A+', 9.1, 18_400_000_000, 11_300, 70, 64_000, 410),
  mk('demo-mina', 'A', 18.4, 12_100_000_000, 7_400, 58, 41_000, 300),
  mk('demo-len', 'A-', 29.0, 14_000_000_000, 8_300, 34, 47_200, 28),
  mk('demo-juno', 'B+', 44.2, 4_800_000_000, 3_100, 31, 19_500, 120),
  mk('demo-ari', 'B', 57.9, 2_100_000_000, 1_400, 22, 9_800, 60),
  mk('demo-noa', 'C+', 80.3, 600_000_000, 420, 9, 2_600, 14),
];

export function demoLeaderboard(): LeaderboardRow[] {
  return DEMO_USERS
    .slice()
    .sort((a, b) => a.submission.percentile - b.submission.percentile)
    .map((u, i) => ({ ...u.profile, rank: i + 1, submission: u.submission }));
}

export function demoUser(login: string) {
  return demoLeaderboard().find((u) => u.login.toLowerCase() === login.toLowerCase()) ?? null;
}
