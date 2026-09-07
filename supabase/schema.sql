-- tokseal leaderboard schema. Aggregate totals only; never message content.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  login       text not null,
  login_lower text generated always as (lower(login)) stored,
  github_id   bigint,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);
create unique index profiles_login_lower_idx on public.profiles (login_lower);
create unique index profiles_github_id_idx on public.profiles (github_id) where github_id is not null;

-- Mirror GitHub identity from auth.users into profiles on sign-up and on every sign-in.
create or replace function public.handle_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, login, github_id, name, avatar_url)
  values (
    new.id,
    coalesce(m ->> 'user_name', m ->> 'preferred_username', split_part(coalesce(new.email, new.id::text), '@', 1)),
    nullif(m ->> 'provider_id', '')::bigint,
    m ->> 'full_name',
    m ->> 'avatar_url'
  )
  on conflict (id) do update set
    login      = excluded.login,
    github_id  = coalesce(excluded.github_id, profiles.github_id),
    name       = excluded.name,
    avatar_url = excluded.avatar_url;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_auth_user();
create trigger on_auth_user_updated after update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_auth_user();

-- CLI tokens. Only the sha256 hash is stored.
create table public.api_tokens (
  token_hash   text primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index api_tokens_user_idx on public.api_tokens (user_id);

-- Device-link flow: CLI creates a row, user approves in the browser, CLI polls once for the token.
create table public.device_codes (
  code       text primary key,               -- secret, known only to the CLI
  user_code  text not null unique,           -- short code the human confirms
  user_id    uuid references public.profiles (id) on delete cascade,
  token      text,                           -- plaintext, handed to the CLI exactly once
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index device_codes_expires_idx on public.device_codes (expires_at);

-- One row per user: the latest opt-in submission.
create table public.submissions (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  grade         text not null,
  percentile    numeric(6,2) not null,
  total_tokens  bigint not null default 0,
  cost          numeric(14,4) not null default 0,
  message_count bigint not null default 0,
  active_days   int not null default 0,
  session_count int not null default 0,
  model_count   int not null default 0,
  clients       text[] not null default '{}',
  date_start    date,
  date_end      date,
  payload       jsonb not null,              -- validated Submission (see @tokseal/core)
  submitted_at  timestamptz not null default now()
);
create index submissions_rank_idx on public.submissions (percentile asc, total_tokens desc);

-- Public leaderboard view.
create view public.leaderboard as
  select p.login, p.name, p.avatar_url,
         s.grade, s.percentile, s.total_tokens, s.cost, s.message_count,
         s.active_days, s.session_count, s.model_count, s.clients,
         s.date_start, s.date_end, s.submitted_at, s.payload,
         rank() over (order by s.percentile asc, s.total_tokens desc) as rank
  from public.submissions s
  join public.profiles p on p.id = s.user_id;

-- RLS: profiles + submissions are public-readable; tokens/device codes are service-role only.
alter table public.profiles     enable row level security;
alter table public.submissions  enable row level security;
alter table public.api_tokens   enable row level security;
alter table public.device_codes enable row level security;

create policy "profiles are public"    on public.profiles    for select using (true);
create policy "submissions are public" on public.submissions for select using (true);
create policy "users delete own submission" on public.submissions for delete using (auth.uid() = user_id);

-- Housekeeping: purge expired device codes (call from a cron or lazily from the API).
create or replace function public.purge_device_codes() returns void language sql security definer as $$
  delete from public.device_codes where expires_at < now();
$$;
-- Per-day usage history. Merged by (user, date) on every submit so the record
-- outlives local log cleanup (Claude Code deletes transcripts after 30 days).
-- Aggregate counts only — no content, no paths, no session ids.

create table public.usage_days (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  date          date not null,
  input         bigint not null default 0,
  output        bigint not null default 0,
  cache_read    bigint not null default 0,
  cache_write   bigint not null default 0,
  reasoning     bigint not null default 0,
  total_tokens  bigint generated always as (input + output + cache_read + cache_write + reasoning) stored,
  cost          numeric(14,4) not null default 0,
  message_count int not null default 0,
  session_count int not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, date)
);
create index usage_days_date_idx on public.usage_days (date);

alter table public.usage_days enable row level security;
create policy "usage days are public" on public.usage_days for select using (true);

-- Submissions now carry both all-time (from usage_days) and the 30-day window the grade is based on.
alter table public.submissions
  add column window_days     int not null default 30,
  add column window_tokens   bigint not null default 0,
  add column window_cost     numeric(14,4) not null default 0,
  add column window_messages bigint not null default 0,
  add column window_active   int not null default 0,
  add column window_sessions int not null default 0,
  add column streak_days     int not null default 0;

-- Leaderboard view: include the new columns.
drop view public.leaderboard;
create view public.leaderboard as
  select p.login, p.name, p.avatar_url,
         s.grade, s.percentile, s.total_tokens, s.cost, s.message_count,
         s.active_days, s.session_count, s.model_count, s.clients,
         s.window_days, s.window_tokens, s.window_active, s.streak_days,
         s.date_start, s.date_end, s.submitted_at, s.payload,
         rank() over (order by s.percentile asc, s.window_tokens desc, s.total_tokens desc) as rank
  from public.submissions s
  join public.profiles p on p.id = s.user_id;
-- Trust layer: flagged submissions, audit log of every submit, rank excludes flagged rows.

alter table public.submissions
  add column flagged      boolean not null default false,
  add column flag_reasons text[] not null default '{}';

create table public.submission_log (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  submitted_at   timestamptz not null default now(),
  days_count     int not null,
  changed_days   jsonb not null default '[]',   -- [{date, before, after}] tokens, only days that changed >1%
  all_time_tokens bigint not null,
  window_tokens  bigint not null,
  grade          text not null,
  flags          text[] not null default '{}',
  cost_ratio     numeric(8,4) not null default 1, -- server-priced / client-priced
  client_version text
);
create index submission_log_user_idx on public.submission_log (user_id, submitted_at desc);
alter table public.submission_log enable row level security;
create policy "users read own log" on public.submission_log for select using (auth.uid() = user_id);

drop view public.leaderboard;
create view public.leaderboard as
  select p.login, p.name, p.avatar_url,
         s.grade, s.percentile, s.total_tokens, s.cost, s.message_count,
         s.active_days, s.session_count, s.model_count, s.clients,
         s.window_days, s.window_tokens, s.window_active, s.streak_days,
         s.flagged, s.flag_reasons,
         s.date_start, s.date_end, s.submitted_at, s.payload,
         case when s.flagged then null
              else rank() over (partition by s.flagged order by s.percentile asc, s.window_tokens desc, s.total_tokens desc) end as rank
  from public.submissions s
  join public.profiles p on p.id = s.user_id;
