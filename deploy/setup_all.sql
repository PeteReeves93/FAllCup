-- ============================================================
-- F.All Cup II — SCHEMA SETUP (reset + reference + app layer)
-- Paste & Run this, THEN paste & Run 02_seed_bb.sql (the catalogue).
-- Idempotent. Generated 2026-09-02.
-- ============================================================

-- >>>>>>>>>> 00_reset.sql >>>>>>>>>>

-- =====================================================================
--  F.All Cup II — 00_reset.sql
--  Clean slate so the rebuild is consistent no matter which earlier
--  schema is currently in the database. SAFE: the project has no real
--  data yet (no coach accounts, rosters, fixtures or results exist).
--  Run this FIRST, then 01_schema.sql, 03_app.sql, then 02_seed_bb.sql.
-- =====================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop view  if exists public.standings           cascade;
drop view  if exists public.fallcup_team_build   cascade;
drop view  if exists public.fallcup_positionals  cascade;
drop table if exists public.results              cascade;
drop table if exists public.fixtures             cascade;
drop table if exists public.entries              cascade;
drop table if exists public.roster_players       cascade;
drop table if exists public.teams                cascade;
drop table if exists public.profiles             cascade;

drop view  if exists public.tournament_team_build cascade;
drop table if exists public.tournament_tier_spp   cascade;
drop table if exists public.tournament_team_tier  cascade;
drop table if exists public.tournament            cascade;

drop function if exists public.is_admin()                  cascade;
drop function if exists public.handle_new_user()           cascade;
drop function if exists public.touch_updated_at()          cascade;
drop function if exists public.effective_tier(bigint,bigint) cascade;

-- removes any earlier bb.* (this project's reference schema), text-id or bigint
drop schema if exists bb cascade;


-- >>>>>>>>>> 01_schema.sql >>>>>>>>>>

-- =====================================================================
--  FAll Cup / GNASHBBL  —  Increment 1
--  Reference catalogue (schema `bb`) + tournament + tier overlay.
--  Target: Supabase / PostgreSQL.  Safe to re-run.
--
--  Model recap:
--    * bb.*                -> shared, reusable Blood Bowl reference data.
--                            One place to fix; every app reads it.
--    * bb.team.gw_tier     -> GW-current tier, as of bb.ruleset.tiers_asof.
--    * tournament_team_tier-> per-competition override.
--                            effective tier = COALESCE(override, gw_tier).
--    * tournament_tier_spp -> tier -> starting SPP for a competition
--                            (FAll Cup: 30 / 36 / 42 / 48).
--
--  User teams, RLS-by-owner, fixtures & results come in later increments,
--  when we build those features. This file is just the data foundation.
-- =====================================================================

create schema if not exists bb;

-- ---------------------------------------------------------------------
--  Editions / rulesets
-- ---------------------------------------------------------------------
create table if not exists bb.ruleset (
  id          text primary key,            -- e.g. 'BB2025'
  name        text not null,
  tiers_asof  date,                        -- snapshot date behind gw_tier values
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Skill dictionary (canonical names; player skills FK to this)
-- ---------------------------------------------------------------------
create table if not exists bb.skill (
  name        text primary key,            -- canonical, e.g. 'Throw Team-mate'
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Teams (edition-scoped reference rows)
-- ---------------------------------------------------------------------
create table if not exists bb.team (
  id                bigint generated always as identity primary key,
  ruleset_id        text not null references bb.ruleset(id),
  name              text not null,
  gw_tier           smallint,              -- GW-current, as of ruleset.tiers_asof
  reroll_cost       integer,
  allows_apothecary boolean not null default true,
  active            boolean not null default true,
  leagues           text[]  not null default '{}',
  special_rules     text[]  not null default '{}',
  notes             text,
  created_at        timestamptz not null default now(),
  unique (ruleset_id, name)
);

-- ---------------------------------------------------------------------
--  Positional groups (e.g. "Big Guys", max 1 or 3)
-- ---------------------------------------------------------------------
create table if not exists bb.positional_group (
  id         bigint generated always as identity primary key,
  team_id    bigint not null references bb.team(id) on delete cascade,
  name       text not null,
  max_count  smallint,
  unique (team_id, name)
);

-- ---------------------------------------------------------------------
--  Positionals
--  max_count NULL  -> "0-16" (limited only by squad size)
--  pa NULL         -> player has no Passing characteristic
-- ---------------------------------------------------------------------
create table if not exists bb.positional (
  id               bigint generated always as identity primary key,
  team_id          bigint not null references bb.team(id) on delete cascade,
  title            text not null,
  cost             integer not null,
  ma smallint, st smallint, ag smallint, pa smallint, av smallint,
  max_count        smallint,
  is_lineman       boolean not null default false,
  primary_access   text[] not null default '{}',
  secondary_access text[] not null default '{}',
  group_id         bigint references bb.positional_group(id) on delete set null,
  can_be_raised    boolean not null default false,
  unique (team_id, title)
);

-- player -> starting skills
create table if not exists bb.positional_skill (
  positional_id bigint not null references bb.positional(id) on delete cascade,
  skill         text   not null references bb.skill(name),
  primary key (positional_id, skill)
);

-- ---------------------------------------------------------------------
--  Tournaments (public schema) + tier overlay
-- ---------------------------------------------------------------------
create table if not exists tournament (
  id          bigint generated always as identity primary key,
  slug        text unique not null,        -- 'fall-cup-ii'
  name        text not null,
  ruleset_id  text not null references bb.ruleset(id),
  budget_gp   integer not null,            -- 1,150,000
  created_at  timestamptz not null default now()
);

-- per-tournament override; team_id + tournament_id already carry provenance,
-- so the value column is just `tier`.
create table if not exists tournament_team_tier (
  tournament_id bigint  not null references tournament(id) on delete cascade,
  team_id       bigint  not null references bb.team(id)     on delete cascade,
  tier          smallint not null,
  primary key (tournament_id, team_id)
);

create table if not exists tournament_tier_spp (
  tournament_id bigint  not null references tournament(id) on delete cascade,
  tier          smallint not null,
  starting_spp  smallint not null,
  primary key (tournament_id, tier)
);

-- effective tier = override if present, else GW-current
create or replace function effective_tier(p_tournament_id bigint, p_team_id bigint)
returns smallint language sql stable as $$
  select coalesce(
    (select tier    from tournament_team_tier
       where tournament_id = p_tournament_id and team_id = p_team_id),
    (select gw_tier from bb.team where id = p_team_id)
  );
$$;

-- convenience view: every team's effective tier + starting SPP for a tournament
create or replace view tournament_team_build as
  select
    t.id                                    as tournament_id,
    t.slug                                  as tournament_slug,
    bt.id                                   as team_id,
    bt.name                                 as team_name,
    bt.gw_tier                              as gw_tier,
    effective_tier(t.id, bt.id)             as effective_tier,
    s.starting_spp                          as starting_spp,
    t.budget_gp                             as budget_gp
  from tournament t
  join bb.team bt on bt.ruleset_id = t.ruleset_id and bt.active
  left join tournament_tier_spp s
         on s.tournament_id = t.id
        and s.tier = effective_tier(t.id, bt.id);

-- ---------------------------------------------------------------------
--  Exposure + RLS
--  Reference & tournament config are public-read.
--  Writes have no anon/authenticated policy -> only the service role
--  (Supabase dashboard, seed script) can write. Add admin write later.
--  NB: also add `bb` under Settings -> API -> Exposed schemas in Supabase.
-- ---------------------------------------------------------------------
grant usage on schema bb to anon, authenticated;
grant select on all tables in schema bb to anon, authenticated;
alter default privileges in schema bb grant select on tables to anon, authenticated;
grant select on tournament, tournament_team_tier, tournament_tier_spp to anon, authenticated;
grant select on tournament_team_build to anon, authenticated;

do $$
declare r record;
begin
  for r in
    select 'bb'::text as s, tablename as t from pg_tables where schemaname = 'bb'
    union all
    select 'public', unnest(array['tournament','tournament_team_tier','tournament_tier_spp'])
  loop
    execute format('alter table %I.%I enable row level security;', r.s, r.t);
    execute format(
      'drop policy if exists %I on %I.%I;', 'read_all_'||r.t, r.s, r.t);
    execute format(
      'create policy %I on %I.%I for select to anon, authenticated using (true);',
      'read_all_'||r.t, r.s, r.t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  Seed: BB2025 ruleset + the FAll Cup tournament + its SPP ladder
--  tiers_asof = today (the "take as current" load date).
-- ---------------------------------------------------------------------
insert into bb.ruleset (id, name, tiers_asof) values
  ('BB2025', 'Warhammer Blood Bowl Season Edition 2025', current_date)
on conflict (id) do update
  set name = excluded.name, tiers_asof = excluded.tiers_asof;

insert into tournament (slug, name, ruleset_id, budget_gp) values
  ('fall-cup-ii', 'The Second GNASHBBL F. All Cup', 'BB2025', 1150000)
on conflict (slug) do update
  set name = excluded.name, ruleset_id = excluded.ruleset_id, budget_gp = excluded.budget_gp;

insert into tournament_tier_spp (tournament_id, tier, starting_spp)
select t.id, v.tier, v.spp
from tournament t
cross join (values (1,30),(2,36),(3,42),(4,48)) as v(tier, spp)
where t.slug = 'fall-cup-ii'
on conflict (tournament_id, tier) do update set starting_spp = excluded.starting_spp;


-- >>>>>>>>>> 03_app.sql >>>>>>>>>>

-- =====================================================================
--  F.All Cup II — 03_app.sql  (Increment 2: accounts, private rosters,
--  competition results) — layered on 01_schema.sql (bb.* + tournament).
--  Run AFTER 00_reset.sql + 01_schema.sql. Idempotent.
--
--  The load-bearing rule: a coach only ever sees their own roster
--  (RLS: owner_id = auth.uid()). Reference/results are public-read.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  profiles (one per auth user)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  discord_handle text,
  is_admin       boolean not null default false,
  created_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(
    new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_name', split_part(coalesce(new.email,'coach'),'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- admin check (defined AFTER profiles; security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
--  Reference read-views (public) so the frontend does simple queries
-- ---------------------------------------------------------------------
-- positional + aggregated starting skills + its group cap, in one row.
-- Lives in PUBLIC (not bb) so the frontend never needs the bb schema exposed
-- to the Data API — the view reads bb.* with owner rights.
create or replace view public.fallcup_positionals as
  select p.id, p.team_id, p.title, p.cost, p.ma, p.st, p.ag, p.pa, p.av,
         p.max_count, p.is_lineman, p.primary_access, p.secondary_access,
         p.can_be_raised, g.name as group_name, g.max_count as group_max,
         coalesce(array_agg(ps.skill order by ps.skill)
                  filter (where ps.skill is not null), '{}') as skills
  from bb.positional p
  left join bb.positional_group g on g.id = p.group_id
  left join bb.positional_skill ps on ps.positional_id = p.id
  group by p.id, g.name, g.max_count;

grant select on public.fallcup_positionals to anon, authenticated;

-- one row per team for the FAll Cup: effective tier, starting SPP, budget,
-- reroll cost and special rules — everything the builder's picker needs.
create or replace view public.fallcup_team_build as
  select b.tournament_id, b.tournament_slug, b.team_id, b.team_name, b.gw_tier,
         b.effective_tier, b.starting_spp, b.budget_gp,
         t.reroll_cost, t.special_rules, t.leagues
  from public.tournament_team_build b
  join bb.team t on t.id = b.team_id;

grant select on public.fallcup_team_build to anon, authenticated;

-- ---------------------------------------------------------------------
--  teams — a coach's PRIVATE working roster
-- ---------------------------------------------------------------------
create table if not exists public.teams (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tournament_id     bigint references public.tournament(id),
  bb_team_id        bigint references bb.team(id),
  name              text not null,
  race              text,                     -- team_name snapshot
  league            text,                     -- chosen league (teams that must pick one)
  tier              smallint,                 -- effective tier snapshot
  starting_spp      smallint,
  budget_gp         integer,
  treasury          integer not null default 0,
  dedicated_fans    smallint not null default 1 check (dedicated_fans between 1 and 7),  -- creation capped at 4 in the builder; league can reach 7
  rerolls           smallint not null default 0,
  apothecary        boolean  not null default false,
  assistant_coaches smallint not null default 0,
  cheerleaders      smallint not null default 0,
  declared_ctv      integer,
  is_locked         boolean  not null default false,
  reset_used        boolean  not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists teams_owner_idx on public.teams(owner_id);

create table if not exists public.roster_players (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  slot           smallint,
  positional_id  bigint references bb.positional(id),
  position_title text not null,               -- snapshot
  player_name    text,                        -- coach-assigned name (league)
  base_cost      integer not null default 0,
  spp_spent      smallint not null default 0,
  chosen_skills  text[]  not null default '{}',
  is_secondary   boolean not null default false,
  ma smallint, st smallint, ag smallint, pa smallint, av smallint,  -- current stats (editable in league)
  skills   jsonb    not null default '[]'::jsonb,   -- [{name, type}] — supports multiple skills in league
  spp      smallint not null default 0,             -- current unspent SPP
  status   text     not null default 'active',       -- active | mng | dead
  niggling smallint not null default 0,
  notes    text,
  created_at     timestamptz not null default now()
);
create index if not exists roster_team_idx on public.roster_players(team_id);

-- ---------------------------------------------------------------------
--  entries / fixtures / results  (public competition record)
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  team_name    text not null unique,
  coach_name   text,
  race         text,
  tier         smallint,
  declared_ctv integer,
  team_id      uuid references public.teams(id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.fixtures (
  id             uuid primary key default gen_random_uuid(),
  round_no       smallint not null,
  round_label    text default 'Round Robin',
  home_entry     uuid references public.entries(id) on delete set null,
  away_entry     uuid references public.entries(id) on delete set null,
  date_window    text,
  scheduled_from date,
  scheduled_to   date,
  created_at     timestamptz not null default now()
);
create index if not exists fixtures_round_idx on public.fixtures(round_no);

create table if not exists public.results (
  id          uuid primary key default gen_random_uuid(),
  fixture_id  uuid references public.fixtures(id) on delete set null,
  home_entry  uuid not null references public.entries(id) on delete cascade,
  away_entry  uuid not null references public.entries(id) on delete cascade,
  home_td     smallint not null default 0,
  away_td     smallint not null default 0,
  home_cas    smallint not null default 0,
  away_cas    smallint not null default 0,
  home_crowd_surfs   smallint not null default 0, away_crowd_surfs   smallint not null default 0,
  home_ttm_td        smallint not null default 0, away_ttm_td        smallint not null default 0,  -- successful TTM TDs
  home_ttm_cas       smallint not null default 0, away_ttm_cas       smallint not null default 0,  -- failed TTM (thrown player cas)
  home_fouls         smallint not null default 0, away_fouls         smallint not null default 0,  -- successful fouls
  home_foul_sendoffs smallint not null default 0, away_foul_sendoffs smallint not null default 0,  -- sent off for a foul
  home_tripwire      smallint not null default 0, away_tripwire      smallint not null default 0,  -- trip wire failings
  forfeit     text check (forfeit in ('home','away','double')),
  played_on   date,
  notes       text,
  submitted_by uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

-- standings computed from results (Win 3 / Draw 1 / Loss 0 — confirm scoring)
create or replace view public.standings as
with games as (
  select home_entry as entry, home_td as tf, away_td as ta, home_cas as cf,
         case when forfeit='home' then 'L' when forfeit='away' then 'W' when forfeit='double' then 'D'
              when home_td > away_td then 'W' when home_td < away_td then 'L' else 'D' end as res
  from public.results
  union all
  select away_entry, away_td, home_td, away_cas,
         case when forfeit='away' then 'L' when forfeit='home' then 'W' when forfeit='double' then 'D'
              when away_td > home_td then 'W' when away_td < home_td then 'L' else 'D' end
  from public.results
)
select e.id as entry_id, e.team_name, e.coach_name, e.tier,
  count(g.res) as played,
  count(*) filter (where g.res='W') as won,
  count(*) filter (where g.res='D') as drawn,
  count(*) filter (where g.res='L') as lost,
  coalesce(sum(g.tf),0) as td_for,
  coalesce(sum(g.ta),0) as td_against,
  coalesce(sum(g.tf),0)-coalesce(sum(g.ta),0) as td_diff,
  coalesce(sum(g.cf),0) as cas_for,
  count(*) filter (where g.res='W')*3 + count(*) filter (where g.res='D') as points
from public.entries e
left join games g on g.entry = e.id
where e.active
group by e.id, e.team_name, e.coach_name, e.tier;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists teams_touch on public.teams;
create trigger teams_touch before update on public.teams
  for each row execute function public.touch_updated_at();

-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.teams          enable row level security;
alter table public.roster_players enable row level security;
alter table public.entries        enable row level security;
alter table public.fixtures       enable row level security;
alter table public.results        enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists teams_owner_all on public.teams;
create policy teams_owner_all on public.teams
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());  -- admin may edit any team (e.g. set in-league)

drop policy if exists roster_owner_all on public.roster_players;
create policy roster_owner_all on public.roster_players
  for all
  using (exists (select 1 from public.teams t where t.id = roster_players.team_id
                 and (t.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.teams t where t.id = roster_players.team_id
                      and t.owner_id = auth.uid()));

drop policy if exists entries_public_read on public.entries;
create policy entries_public_read on public.entries for select using (true);
drop policy if exists entries_admin_write on public.entries;
create policy entries_admin_write on public.entries for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists fixtures_public_read on public.fixtures;
create policy fixtures_public_read on public.fixtures for select using (true);
drop policy if exists fixtures_admin_write on public.fixtures;
create policy fixtures_admin_write on public.fixtures for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists results_public_read on public.results;
create policy results_public_read on public.results for select using (true);
-- coaches (any signed-in user) may submit results; admins may edit/delete
drop policy if exists results_coach_insert on public.results;
create policy results_coach_insert on public.results for insert to authenticated with check (true);
drop policy if exists results_admin_all on public.results;
create policy results_admin_all on public.results for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- grants (RLS still governs rows)
grant usage on schema public to anon, authenticated;
grant select on public.entries, public.fixtures, public.results, public.standings to anon, authenticated;
grant select, insert, update, delete on public.teams, public.roster_players to authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update, delete on public.entries, public.fixtures, public.results to authenticated;

-- =====================================================================
--  Grant yourself admin after first sign-in:
--    update public.profiles set is_admin = true where id = auth.uid();
-- =====================================================================

