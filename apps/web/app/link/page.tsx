import { DEMO } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase-server';
import { normalizeUserCode } from '@/lib/tokens';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Link CLI' };

type Props = { searchParams: Promise<{ code?: string; done?: string; error?: string }> };

export default async function LinkPage({ searchParams }: Props) {
  const sp = await searchParams;
  const code = sp.code ? normalizeUserCode(sp.code) : '';

  if (DEMO) {
    return <Shell><p className="text-muted">This deployment has no leaderboard configured.</p></Shell>;
  }
  if (sp.done) {
    return (
      <Shell>
        <p className="text-lg">✓ Linked. You can close this tab and return to your terminal.</p>
        <p className="mt-2 text-sm text-muted">Next: <code>tokseal submit</code></p>
      </Shell>
    );
  }

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const login = (user?.user_metadata?.user_name as string | undefined) ?? user?.email ?? null;
  const ERRORS: Record<string, string> = {
    'bad-code': 'That code does not look right.',
    expired: 'That code expired or was already used. Run tokseal login again.',
    auth: 'GitHub sign-in failed. Try again.',
    server: 'Something went wrong on our side. Try again.',
  };

  return (
    <Shell>
      {sp.error && <p className="px-panel mb-4 px-3 py-2 text-coral">{ERRORS[sp.error] ?? sp.error}</p>}
      {!user ? (
        <>
          <p className="text-muted">Sign in with GitHub to link this device. tokseal only reads your public profile (login and avatar).</p>
          <a
            href={`/auth/signin?next=${encodeURIComponent(`/link?code=${code}`)}`}
            className="px-btn px-btn--ghost mt-6"
          >
            Sign in with GitHub
          </a>
        </>
      ) : (
        <form method="post" action="/api/device/approve" className="space-y-4">
          <p className="text-sm text-muted">Signed in as <b className="text-fg">@{login}</b>.
            <button formAction="/auth/signout" className="ml-2 underline">not you?</button>
          </p>
          <label className="block text-sm">
            <span className="text-muted">Code shown in your terminal</span>
            <input
              name="code"
              defaultValue={code}
              placeholder="ABCD-EFGH"
              autoComplete="off"
              className="px-panel mt-2 w-full bg-ink px-3 py-3 font-pixel text-[14px] uppercase tracking-widest outline-none focus:px-panel--hi"
            />
          </label>
          <button className="px-btn">Approve this device</button>
          <p className="text-xs text-muted">
            Approving mints a CLI token for <b>@{login}</b>. The CLI will upload aggregate totals only when you run{' '}
            <code>tokseal submit</code>.
          </p>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-20">
      <p className="font-pixel text-[9px] uppercase tracking-[.25em] text-coral"><i className="px-dot" />player select</p>
      <h1 className="mt-3 text-[16px]">LINK YOUR CLI</h1>
      <div className="px-panel px-panel--hi mt-8 p-6">{children}</div>
    </div>
  );
}
