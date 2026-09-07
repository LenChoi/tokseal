# Supabase setup

1. Create a project at https://supabase.com (free tier is fine).
2. **Auth → Providers → GitHub**: enable it, paste a GitHub OAuth App's client id/secret.
   The GitHub OAuth App's callback URL is `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Auth → URL Configuration**: set Site URL to your deployment (e.g. `https://tokseal.dev`)
   and add `https://tokseal.dev/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs.
4. Apply `migrations/0001_init.sql` (SQL editor, or `supabase db push` with the CLI).
5. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the URL, anon key,
   and service role key from **Settings → API**.
