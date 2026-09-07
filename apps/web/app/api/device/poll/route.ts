/** POST /api/device/poll {code} — 202 until approved; then returns the token exactly once. */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEMO } from '@/lib/env';

export async function POST(req: Request) {
  if (DEMO) return Response.json({ error: 'leaderboard not configured' }, { status: 503 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || typeof code !== 'string') return Response.json({ error: 'bad request' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data } = await sb
    .from('device_codes')
    .select('token, expires_at, user_id, profiles(login)')
    .eq('code', code)
    .maybeSingle();
  if (!data) return Response.json({ error: 'unknown code' }, { status: 404 });
  if (new Date(data.expires_at as string) < new Date()) {
    await sb.from('device_codes').delete().eq('code', code);
    return Response.json({ error: 'expired' }, { status: 410 });
  }
  if (!data.token) return new Response(null, { status: 202 });

  // One-time hand-off: delete the row so the plaintext token never lingers.
  await sb.from('device_codes').delete().eq('code', code);
  const login = (data.profiles as unknown as { login: string } | null)?.login ?? '';
  return Response.json({ token: data.token, login });
}
