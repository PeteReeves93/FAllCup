-- =====================================================================
--  Run this ONE snippet in the Supabase SQL Editor to skip "expose bb".
--  It creates a public view over the catalogue, so the site reads
--  everything from the public schema (exposed by default) and you do
--  NOT need to add `bb` under Exposed schemas.
--  Safe to run after setup_all.sql + 02_seed_bb.sql. Idempotent.
-- =====================================================================
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
