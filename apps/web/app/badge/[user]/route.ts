/** GET /badge/<user> — short URL for the README badge (same options as /api/badge). */
import { badgeFor } from '@/app/api/badge/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ user: string }> }) {
  const { user } = await ctx.params;
  return badgeFor(user.replace(/\.svg$/i, ''), new URL(req.url).searchParams);
}
