/** POST /api/submit — Bearer <token>; body = Submission. Upserts the caller's row. */
import { validateSubmission } from '@tokseal/core';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashToken } from '@/lib/tokens';
import { DEMO, SITE_URL } from '@/lib/env';

export async function POST(req: Request) {
  if (DEMO) return Response.json({ error: 'leaderboard not configured' }, { status: 503 });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token.startsWith('tsk_')) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: tok } = await sb
    .from('api_tokens')
    .select('user_id, profiles!inner(login)')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!tok) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const userId = tok.user_id as string;
  const login = (tok.profiles as unknown as { login: string }).login;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }
  const v = validateSubmission(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  const s = v.value;

  const { error } = await sb.from('submissions').upsert({
    user_id: userId,
    grade: s.grade,
    percentile: s.percentile,
    total_tokens: Math.round(s.totals.totalTokens),
    cost: s.totals.cost,
    message_count: Math.round(s.totals.messageCount),
    active_days: Math.round(s.totals.activeDays),
    session_count: Math.round(s.totals.sessionCount),
    model_count: new Set(s.models.map((m) => m.model)).size,
    clients: s.clients,
    date_start: s.dateRange.start,
    date_end: s.dateRange.end,
    payload: s,
    submitted_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await sb.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('token_hash', hashToken(token));

  return Response.json({
    ok: true,
    login,
    profileUrl: `${SITE_URL}/u/${login}`,
    cardUrl: `${SITE_URL}/api/card?user=${login}&theme=pixel`,
  });
}
