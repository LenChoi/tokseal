/**
 * POST /api/submit — Bearer <token>; body = Submission (v2).
 * Merges per-day buckets into usage_days, then recomputes all-time totals, the
 * 30-day window, the grade, and the streak server-side. The client's grade is
 * never trusted.
 */
import { validateSubmission, totalsFromDays, windowDays, gradeFromTotals, GRADE_WINDOW_DAYS, POPULATION_MIN, reprice, sanityCheck, anomalyCheck, type DayBucket } from '@tokseal/core';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashToken } from '@/lib/tokens';
import { DEMO, SITE_URL } from '@/lib/env';

const today = () => new Date().toISOString().slice(0, 10);

export async function POST(req: Request) {
  if (DEMO) return Response.json({ error: 'leaderboard not configured' }, { status: 503 });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token.startsWith('tsk_')) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const tokenHash = hashToken(token);
  const { data: tok } = await sb.from('api_tokens').select('user_id, last_used_at, profiles!inner(login)').eq('token_hash', tokenHash).maybeSingle();
  if (!tok) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (tok.last_used_at && Date.now() - Date.parse(tok.last_used_at as string) < 60_000)
    return Response.json({ error: 'rate limited: one submit per minute' }, { status: 429, headers: { 'retry-after': '60' } });
  const userId = tok.user_id as string;
  const login = (tok.profiles as unknown as { login: string }).login;

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid json' }, { status: 400 }); }
  const v = validateSubmission(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  // Defense 1: the client's cost is discarded; everything is repriced from tokens.
  const { submission: s, ratio: costRatio, unpricedModels } = reprice(v.value);
  // Defense 2: physical impossibilities are rejected; implausible values are flagged.
  const sane = sanityCheck(s);
  if (sane.errors.length) return Response.json({ error: 'rejected', reasons: sane.errors }, { status: 422 });
  const now = new Date().toISOString();

  // Defense 3: compare with what we already know about this user.
  const { data: priorRows } = await sb.from('usage_days').select('date, total_tokens').eq('user_id', userId);
  const priorMap = new Map<string, number>((priorRows ?? []).map((r: Record<string, unknown>) => [String(r.date), Number(r.total_tokens)]));
  const priorAllTime = [...priorMap.values()].reduce((a, b) => a + b, 0);
  const flags = [...sane.flags, ...anomalyCheck(s, { dayTokens: priorMap, allTimeTokens: priorAllTime })];
  const changedDays = s.days
    .map((d) => ({ date: d.date, before: priorMap.get(d.date) ?? 0, after: Math.round(d.input + d.output + d.cacheRead + d.cacheWrite + d.reasoning) }))
    .filter((c) => Math.abs(c.after - c.before) > Math.max(1000, c.before * 0.01));

  // 1. Merge days (local parse is authoritative for the dates it covers; future dates are dropped).
  const cutoff = today();
  const rows = s.days.filter((d) => d.date <= cutoff).map((d) => ({
    user_id: userId, date: d.date,
    input: Math.round(d.input), output: Math.round(d.output), cache_read: Math.round(d.cacheRead), cache_write: Math.round(d.cacheWrite),
    reasoning: Math.round(d.reasoning), cost: d.cost, message_count: Math.round(d.messageCount), session_count: Math.round(d.sessionCount),
    updated_at: now,
  }));
  if (rows.length) {
    const { error } = await sb.from('usage_days').upsert(rows, { onConflict: 'user_id,date' });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // 2. Recompute from the merged history.
  const { data: hist, error: he } = await sb.from('usage_days').select('*').eq('user_id', userId).order('date');
  if (he) return Response.json({ error: he.message }, { status: 500 });
  const days: DayBucket[] = (hist ?? []).map((r: Record<string, unknown>) => ({
    date: String(r.date), input: Number(r.input), output: Number(r.output), cacheRead: Number(r.cache_read), cacheWrite: Number(r.cache_write),
    reasoning: Number(r.reasoning), cost: Number(r.cost), messageCount: Number(r.message_count), sessionCount: Number(r.session_count),
  }));
  const allTime = totalsFromDays(days);
  const win = totalsFromDays(windowDays(days, GRADE_WINDOW_DAYS, cutoff));
  const g = gradeFromTotals(win);
  const active = new Set(days.filter((d) => d.messageCount > 0).map((d) => d.date));
  let streak = 0;
  for (let ms = Date.parse(cutoff); ; ms -= 86_400_000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    if (active.has(d)) streak++;
    else if (d === cutoff) continue;
    else break;
  }

  const payload = { ...s, grade: g.level, percentile: Number(g.percentile.toFixed(2)), totals: allTime, days: s.days };

  const { error } = await sb.from('submissions').upsert({
    user_id: userId,
    grade: g.level,
    percentile: Number(g.percentile.toFixed(2)),
    total_tokens: Math.round(allTime.totalTokens),
    cost: allTime.cost,
    message_count: Math.round(allTime.messageCount),
    active_days: allTime.activeDays,
    session_count: Math.round(allTime.sessionCount),
    model_count: new Set(s.models.map((m) => m.model)).size,
    clients: s.clients,
    date_start: days[0]?.date ?? s.dateRange.start,
    date_end: days.at(-1)?.date ?? s.dateRange.end,
    window_days: GRADE_WINDOW_DAYS,
    window_tokens: Math.round(win.totalTokens),
    window_cost: win.cost,
    window_messages: Math.round(win.messageCount),
    window_active: win.activeDays,
    window_sessions: Math.round(win.sessionCount),
    streak_days: streak,
    score: Number(g.score.toFixed(6)),
    flagged: flags.length > 0,
    flag_reasons: flags,
    payload,
    submitted_at: now,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Defense 4: audit trail of every submit (what changed, by how much).
  await sb.from('submission_log').insert({
    user_id: userId, submitted_at: now, days_count: s.days.length, changed_days: changedDays,
    all_time_tokens: Math.round(allTime.totalTokens), window_tokens: Math.round(win.totalTokens), grade: g.level,
    flags, cost_ratio: Number(costRatio.toFixed(4)), client_version: req.headers.get('x-tokseal-version'),
  });
  await sb.from('api_tokens').update({ last_used_at: now }).eq('token_hash', tokenHash);

  // Population grading: once enough users exist, percentiles come from the real distribution.
  let populationGraded = false;
  const { count } = await sb.from('submissions').select('*', { count: 'exact', head: true }).eq('flagged', false);
  if ((count ?? 0) >= POPULATION_MIN) {
    const { error: re } = await sb.rpc('regrade_all');
    populationGraded = !re;
  }
  const { data: finalRow } = await sb.from('submissions').select('grade, percentile').eq('user_id', userId).maybeSingle();

  return Response.json({
    ok: true,
    login,
    grade: (finalRow?.grade as string) ?? g.level,
    percentile: Number(finalRow?.percentile ?? g.percentile.toFixed(1)),
    populationGraded,
    allTimeTokens: Math.round(allTime.totalTokens),
    windowTokens: Math.round(win.totalTokens),
    streak,
    flags,
    unpricedModels,
    changedDays: changedDays.length,
    profileUrl: `${SITE_URL}/u/${login}`,
    cardUrl: `${SITE_URL}/api/card?user=${login}&theme=pixel`,
    graphUrl: `${SITE_URL}/api/graph?user=${login}`,
  });
}
