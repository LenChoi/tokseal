/** GET /auth/signin?next=/path — start GitHub OAuth via Supabase. */
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { SITE_URL, DEMO } from '@/lib/env';

export async function GET(req: Request) {
  if (DEMO) redirect('/?error=demo');
  const next = new URL(req.url).searchParams.get('next') ?? '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(safeNext)}`, scopes: 'read:user' },
  });
  if (error || !data.url) redirect('/?error=oauth');
  redirect(data.url);
}
