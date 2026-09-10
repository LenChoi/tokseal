/** Read side of the leaderboard. Falls back to demo data when Supabase is not configured. */
import type { DayBucket, Submission } from '@tokseal/core';
import { DEMO } from './env';
import { supabaseAdmin } from './supabase-admin';

export type Profile = { login: string; name: string | null; avatar_url: string | null };
export type LeaderboardRow = Profile & {
  rank: number;
  submission: Submission;
  submittedAt: string;
  allTime: { tokens: number; cost: number; messages: number; activeDays: number };
  streak: number;
  flagged: boolean;
  flagReasons: string[];
};

type ViewRow = {
  login: string; name: string | null; avatar_url: string | null; rank: number | string;
  payload: Submission; submitted_at: string;
  total_tokens: number | string; cost: number | string; message_count: number | string; active_days: number; streak_days: number;
  flagged: boolean | null; flag_reasons: string[] | null;
};

function fromView(r: ViewRow): LeaderboardRow {
  return {
    login: r.login, name: r.name, avatar_url: r.avatar_url, rank: r.rank == null ? 0 : Number(r.rank),
    submission: r.payload, submittedAt: r.submitted_at,
    allTime: { tokens: Number(r.total_tokens), cost: Number(r.cost), messages: Number(r.message_count), activeDays: r.active_days },
    streak: r.streak_days ?? 0,
    flagged: !!r.flagged,
    flagReasons: r.flag_reasons ?? [],
  };
}

const COLS = 'login, name, avatar_url, rank, payload, submitted_at, total_tokens, cost, message_count, active_days, streak_days, flagged, flag_reasons';

export async function getLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  if (DEMO) return (await import('./demo')).demoLeaderboard().slice(0, limit);
  const { data, error } = await supabaseAdmin().from('leaderboard').select(COLS).order('flagged', { ascending: true }).order('rank', { ascending: true, nullsFirst: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as ViewRow[]).map(fromView);
}

export async function getUser(login: string): Promise<LeaderboardRow | null> {
  if (DEMO) return (await import('./demo')).demoUser(login);
  const { data, error } = await supabaseAdmin().from('leaderboard').select(COLS).ilike('login', login.replace(/[%_]/g, '')).maybeSingle();
  if (error) throw error;
  return data ? fromView(data as unknown as ViewRow) : null;
}

/** Full per-day history for a user (for the contribution graph). */
export async function getUserDays(login: string): Promise<{ login: string; days: DayBucket[]; updatedAt: string | null } | null> {
  if (DEMO) {
    const u = (await import('./demo')).demoUser(login);
    return u ? { login: u.login, days: u.submission.days.map((d) => ({ ...d })), updatedAt: u.submittedAt } : null;
  }
  const sb = supabaseAdmin();
  const { data: prof } = await sb.from('profiles').select('id, login').ilike('login', login.replace(/[%_]/g, '')).maybeSingle();
  if (!prof) return null;
  const { data: rows } = await sb.from('usage_days').select('*').eq('user_id', prof.id).order('date');
  const { data: sub } = await sb.from('submissions').select('submitted_at').eq('user_id', prof.id).maybeSingle();
  const days: DayBucket[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    date: String(r.date), input: Number(r.input), output: Number(r.output), cacheRead: Number(r.cache_read), cacheWrite: Number(r.cache_write),
    reasoning: Number(r.reasoning), cost: Number(r.cost), messageCount: Number(r.message_count), sessionCount: Number(r.session_count),
  }));
  return { login: prof.login as string, days, updatedAt: (sub?.submitted_at as string) ?? null };
}

export async function getSubmissionCount(): Promise<number> {
  if (DEMO) return (await import('./demo')).DEMO_USERS.length;
  const { count } = await supabaseAdmin().from('submissions').select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export type SeasonRow = { login: string; name: string | null; avatar_url: string | null; rank: number; tokens: number; cost: number; messages: number; activeDays: number; sessions: number };

/** Monthly season board (YYYY-MM, UTC). */
export async function getSeason(month: string): Promise<SeasonRow[]> {
  if (DEMO) {
    const rows = (await import('./demo')).demoLeaderboard();
    return rows.map((r) => {
      const days = r.submission.days.filter((d) => d.date.startsWith(month));
      const tokens = days.reduce((a, d) => a + d.input + d.output + d.cacheRead + d.cacheWrite + d.reasoning, 0);
      return { login: r.login, name: r.name, avatar_url: r.avatar_url, rank: 0, tokens, cost: days.reduce((a, d) => a + d.cost, 0), messages: days.reduce((a, d) => a + d.messageCount, 0), activeDays: days.filter((d) => d.messageCount > 0).length, sessions: days.reduce((a, d) => a + d.sessionCount, 0) };
    }).filter((r) => r.tokens > 0).sort((a, b) => b.tokens - a.tokens).map((r, i) => ({ ...r, rank: i + 1 }));
  }
  const { data, error } = await supabaseAdmin().rpc('season_leaderboard', { month });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    login: String(r.login), name: (r.name as string | null) ?? null, avatar_url: (r.avatar_url as string | null) ?? null, rank: Number(r.rank),
    tokens: Number(r.tokens), cost: Number(r.cost), messages: Number(r.messages), activeDays: Number(r.active_days), sessions: Number(r.sessions),
  }));
}
