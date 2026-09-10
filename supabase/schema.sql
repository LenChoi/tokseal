-- tokseal schema (0001 + 0002 + 0003 folded into one file; this is exactly what was applied on 2026-09-07)

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

create table public.api_tokens (
  token_hash   text primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index api_tokens_user_idx on public.api_tokens (user_id);

create table public.device_codes (
  code       text primary key,
  user_code  text not null unique,
  user_id    uuid references public.profiles (id) on delete cascade,
  token      text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index device_codes_expires_idx on public.device_codes (expires_at);

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
  payload       jsonb not null,
  submitted_at  timestamptz not null default now(),
  window_days     int not null default 30,
  window_tokens   bigint not null default 0,
  window_cost     numeric(14,4) not null default 0,
  window_messages bigint not null default 0,
  window_active   int not null default 0,
  window_sessions int not null default 0,
  streak_days     int not null default 0,
  flagged      boolean not null default false,
  flag_reasons text[] not null default '{}'
);
create index submissions_rank_idx on public.submissions (percentile asc, total_tokens desc);

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

create table public.submission_log (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  submitted_at   timestamptz not null default now(),
  days_count     int not null,
  changed_days   jsonb not null default '[]',
  all_time_tokens bigint not null,
  window_tokens  bigint not null,
  grade          text not null,
  flags          text[] not null default '{}',
  cost_ratio     numeric(8,4) not null default 1,
  client_version text
);
create index submission_log_user_idx on public.submission_log (user_id, submitted_at desc);

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

alter table public.profiles       enable row level security;
alter table public.submissions    enable row level security;
alter table public.api_tokens     enable row level security;
alter table public.device_codes   enable row level security;
alter table public.usage_days     enable row level security;
alter table public.submission_log enable row level security;

create policy "profiles are public"    on public.profiles    for select using (true);
create policy "submissions are public" on public.submissions for select using (true);
create policy "users delete own submission" on public.submissions for delete using (auth.uid() = user_id);
create policy "usage days are public" on public.usage_days for select using (true);
create policy "users read own log" on public.submission_log for select using (auth.uid() = user_id);

create or replace function public.purge_device_codes() returns void language sql security definer as $$
  delete from public.device_codes where expires_at < now();
$$;
-- Distribution-based grading. Each submission stores the raw blended score;
-- once at least 50 unflagged users exist, percentiles are re-derived from the
-- real population (percent_rank of score) instead of fixed medians.

alter table public.submissions add column score numeric(8,6) not null default 0;

create or replace function public.regrade_all() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.submissions where not flagged;
  if n < 50 then return n; end if;
  with ranked as (
    select user_id, 100.0 * (rank() over (order by score desc) - 1) / greatest(n - 1, 1) as pct
    from public.submissions where not flagged
  )
  update public.submissions s
     set percentile = greatest(0.01, round(r.pct::numeric, 2)),
         grade = case when r.pct <= 1 then 'S' when r.pct <= 12.5 then 'A+' when r.pct <= 25 then 'A'
                      when r.pct <= 37.5 then 'A-' when r.pct <= 50 then 'B+' when r.pct <= 62.5 then 'B'
                      when r.pct <= 75 then 'B-' when r.pct <= 87.5 then 'C+' else 'C' end,
         payload = jsonb_set(jsonb_set(s.payload, '{percentile}', to_jsonb(greatest(0.01, round(r.pct::numeric, 2)))), '{grade}',
                   to_jsonb(case when r.pct <= 1 then 'S' when r.pct <= 12.5 then 'A+' when r.pct <= 25 then 'A'
                      when r.pct <= 37.5 then 'A-' when r.pct <= 50 then 'B+' when r.pct <= 62.5 then 'B'
                      when r.pct <= 75 then 'B-' when r.pct <= 87.5 then 'C+' else 'C' end))
    from ranked r where r.user_id = s.user_id;
  return n;
end $$;
-- Monthly season board: rank by tokens used within one calendar month (UTC), from usage_days.
create or replace function public.season_leaderboard(month text)
returns table (login text, name text, avatar_url text, tokens bigint, cost numeric, messages bigint, active_days int, sessions bigint, rank bigint)
language sql security definer set search_path = public stable as $$
  with m as (select to_date(month || '-01', 'YYYY-MM-DD') as start),
  agg as (
    select d.user_id, sum(d.total_tokens)::bigint as tokens, sum(d.cost) as cost, sum(d.message_count)::bigint as messages,
           count(*) filter (where d.message_count > 0)::int as active_days, sum(d.session_count)::bigint as sessions
    from public.usage_days d, m
    where d.date >= m.start and d.date < (m.start + interval '1 month')
    group by d.user_id
  )
  select p.login, p.name, p.avatar_url, a.tokens, a.cost, a.messages, a.active_days, a.sessions,
         rank() over (order by a.tokens desc) as rank
  from agg a
  join public.profiles p on p.id = a.user_id
  left join public.submissions s on s.user_id = a.user_id
  where coalesce(s.flagged, false) = false and a.tokens > 0
  order by a.tokens desc
  limit 200;
$$;
