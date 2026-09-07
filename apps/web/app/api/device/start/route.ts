/** POST /api/device/start — CLI begins a link. Returns a secret code + human user code. */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { newDeviceCode, newUserCode } from '@/lib/tokens';
import { DEMO, SITE_URL } from '@/lib/env';

const TTL_SEC = 600;

export async function POST() {
  if (DEMO) return Response.json({ error: 'leaderboard not configured' }, { status: 503 });
  const sb = supabaseAdmin();
  const code = newDeviceCode();
  const userCode = newUserCode();
  const { error } = await sb.from('device_codes').insert({
    code,
    user_code: userCode,
    expires_at: new Date(Date.now() + TTL_SEC * 1000).toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // Opportunistic cleanup.
  void sb.rpc('purge_device_codes');
  return Response.json({
    code,
    userCode,
    verifyUrl: `${SITE_URL}/link?code=${userCode}`,
    interval: 3,
    expiresIn: TTL_SEC,
  });
}
