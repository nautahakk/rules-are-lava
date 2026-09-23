create extension if not exists pgcrypto;

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  challenge_date date not null,
  round_index integer not null default 0 check (round_index >= 0),
  lives smallint not null default 3 check (lives between 0 and 3),
  score integer not null default 0 check (score >= 0),
  status text not null default 'active' check (status in ('active', 'completed')),
  deadline_at timestamptz,
  critter_name text not null check (char_length(critter_name) between 1 and 80),
  last_failed_rule_id text,
  last_failed_evaluator text check (last_failed_evaluator is null or last_failed_evaluator in ('deterministic', 'semantic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'active' and deadline_at is not null and lives > 0) or (status = 'completed' and deadline_at is null and lives = 0))
);

alter table public.runs enable row level security;
revoke all on public.runs from anon, authenticated;

create index runs_player_day_idx on public.runs (player_id, challenge_date, score desc);
create index runs_daily_board_idx on public.runs (challenge_date, status, score desc);

create view public.daily_best_scores with (security_invoker = true) as
select distinct on (challenge_date, player_id)
  id, player_id, challenge_date, score, critter_name, completed_at
from public.runs
where status = 'completed'
order by challenge_date, player_id, score desc, completed_at asc;

create view public.ranked_daily_scores with (security_invoker = true) as
select
  id, player_id, challenge_date, score, critter_name, completed_at,
  dense_rank() over (partition by challenge_date order by score desc) as rank
from public.daily_best_scores;

revoke all on public.daily_best_scores from anon, authenticated;
revoke all on public.ranked_daily_scores from anon, authenticated;
