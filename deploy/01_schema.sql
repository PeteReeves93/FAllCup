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
