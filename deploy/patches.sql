-- =====================================================================
--  F.All Cup II — incremental patches on top of setup_all.sql
--  Run this ONCE in the Supabase SQL Editor. Idempotent — safe to re-run,
--  and safe even if you already ran the earlier league snippet.
--  (Fresh installs from setup_all.sql already include all of this.)
-- =====================================================================

-- 1) League choice on saved teams (e.g. Ogre → Badlands Brawl / Worlds Edge Superleague)
alter table public.teams add column if not exists league text;

-- 2) Dedicated Fans: DB allows 1..7 (league max). The builder enforces the
--    creation cap of 4 (1 free + up to 3 bought); teams grow to 7 through play.
alter table public.teams drop constraint if exists teams_dedicated_fans_check;
alter table public.teams add  constraint teams_dedicated_fans_check check (dedicated_fans between 1 and 7);

-- 3) Let admins edit any team (e.g. flip it to in-league) — widen the RLS write check.
drop policy if exists teams_owner_all on public.teams;
create policy teams_owner_all on public.teams
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- 4) League-mode per-player fields: status (active/mng/dead), niggling injuries,
--    notes, multiple skills (jsonb [{name,type}]), and current unspent SPP.
alter table public.roster_players add column if not exists status      text    not null default 'active';
alter table public.roster_players add column if not exists niggling    smallint not null default 0;
alter table public.roster_players add column if not exists notes       text;
alter table public.roster_players add column if not exists skills      jsonb   not null default '[]'::jsonb;
alter table public.roster_players add column if not exists spp         smallint not null default 0;
alter table public.roster_players add column if not exists player_name text;

-- 5) Match-stat tracking on results + coach-submitted results.
alter table public.results add column if not exists submitted_by       uuid default auth.uid();
alter table public.results add column if not exists home_crowd_surfs   smallint not null default 0;
alter table public.results add column if not exists away_crowd_surfs   smallint not null default 0;
alter table public.results add column if not exists home_ttm_td        smallint not null default 0;  -- successful Throw Team-mate TDs
alter table public.results add column if not exists away_ttm_td        smallint not null default 0;
alter table public.results add column if not exists home_ttm_cas       smallint not null default 0;  -- failed TTM (thrown player cas)
alter table public.results add column if not exists away_ttm_cas       smallint not null default 0;
alter table public.results add column if not exists home_fouls         smallint not null default 0;  -- successful fouls
alter table public.results add column if not exists away_fouls         smallint not null default 0;
alter table public.results add column if not exists home_foul_sendoffs smallint not null default 0;  -- sent off for a foul
alter table public.results add column if not exists away_foul_sendoffs smallint not null default 0;
alter table public.results add column if not exists home_tripwire      smallint not null default 0;  -- trip wire failings
alter table public.results add column if not exists away_tripwire      smallint not null default 0;

-- Coaches (any signed-in user) may SUBMIT results; admins may edit/delete.
drop policy if exists results_admin_write  on public.results;
drop policy if exists results_coach_insert on public.results;
drop policy if exists results_admin_all    on public.results;
create policy results_coach_insert on public.results for insert to authenticated with check (true);
create policy results_admin_all    on public.results for all    to authenticated using (public.is_admin()) with check (public.is_admin());
