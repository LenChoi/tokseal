/** Daily: re-derive every percentile from the population (no-op below POPULATION_MIN users). */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEMO } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('unauthorized', { status: 401 });
  if (DEMO) return Response.json({ ok: false, reason: 'demo' });
  const { data, error } = await supabaseAdmin().rpc('regrade_all');
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, population: data });
}
