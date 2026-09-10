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
