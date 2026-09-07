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
