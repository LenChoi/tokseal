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
