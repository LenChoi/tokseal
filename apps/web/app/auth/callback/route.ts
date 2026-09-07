/** GET /auth/callback?code=…&next=… — exchange the OAuth code for a session cookie. */
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/env';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${SITE_URL}${safeNext}`);
  }
  return NextResponse.redirect(`${SITE_URL}/link?error=auth`);
}
