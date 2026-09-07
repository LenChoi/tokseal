/** Read side of the leaderboard. Falls back to demo data when Supabase is not configured. */
import type { Submission } from '@tokseal/core';
import { DEMO } from './env';
import { supabaseAdmin } from './supabase-admin';

export type Profile = { login: string; name: string | null; avatar_url: string | null };
export type LeaderboardRow = Profile & { rank: number; submission: Submission };

type SubRow = {
  user_id: string;
  payload: Submission;
  submitted_at: string;
  profiles: { login: string; name: string | null; avatar_url: string | null } | null;
};

export async function getLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  if (DEMO) return (await import('./demo')).demoLeaderboard().slice(0, limit);
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('submissions')
    .select('user_id, payload, submitted_at, profiles!inner(login, name, avatar_url)')
    .order('percentile', { ascending: true })
    .order('total_tokens', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as SubRow[]).map((r, i) => ({
    login: r.profiles!.login,
    name: r.profiles!.name,
    avatar_url: r.profiles!.avatar_url,
    rank: i + 1,
    submission: r.payload,
  }));
}

export async function getUser(login: string): Promise<LeaderboardRow | null> {
  if (DEMO) return (await import('./demo')).demoUser(login);
  const { data, error } = await supabaseAdmin()
    .from('leaderboard')
    .select('login, name, avatar_url, rank, payload')
    .ilike('login', login.replace(/[%_]/g, ''))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    login: data.login as string,
    name: (data.name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    rank: Number(data.rank),
    submission: data.payload as Submission,
  };
}

export async function getSubmissionCount(): Promise<number> {
  if (DEMO) return (await import('./demo')).DEMO_USERS.length;
  const { count } = await supabaseAdmin().from('submissions').select('*', { count: 'exact', head: true });
  return count ?? 0;
}
