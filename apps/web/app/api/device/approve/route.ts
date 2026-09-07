/** POST /api/device/approve (form) — signed-in user approves a user code; mints an API token. */
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashToken, newApiToken, normalizeUserCode } from '@/lib/tokens';
import { DEMO } from '@/lib/env';

export async function POST(req: Request) {
  if (DEMO) return Response.json({ error: 'leaderboard not configured' }, { status: 503 });
  const form = await req.formData();
  const userCode = normalizeUserCode(String(form.get('code') ?? ''));
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(userCode)) redirect(`/link?error=bad-code`);

  const session = await supabaseServer();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect(`/auth/signin?next=${encodeURIComponent(`/link?code=${userCode}`)}`);

  const sb = supabaseAdmin();
  const { data: dc } = await sb
    .from('device_codes')
    .select('code, expires_at, token')
    .eq('user_code', userCode)
    .maybeSingle();
  if (!dc || dc.token || new Date(dc.expires_at as string) < new Date()) redirect(`/link?error=expired`);

  const token = newApiToken();
  const { error: e1 } = await sb.from('api_tokens').insert({
    token_hash: hashToken(token),
    user_id: user.id,
    label: `cli ${new Date().toISOString().slice(0, 10)}`,
  });
  if (e1) redirect(`/link?error=server`);
  const { error: e2 } = await sb.from('device_codes').update({ token, user_id: user.id }).eq('code', dc.code);
  if (e2) redirect(`/link?error=server`);

  redirect(`/link?done=1`);
}
