import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/env';

export async function POST() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  return NextResponse.redirect(`${SITE_URL}/`, { status: 303 });
}
