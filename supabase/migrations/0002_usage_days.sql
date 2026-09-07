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
