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
