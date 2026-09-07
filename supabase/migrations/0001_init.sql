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
