# Changelog

## Evening session — schema reconciliation + full wiring

Your other chat had produced a cleaner, more complete database foundation in `deploy/`,
including the **full BB2025 catalogue** (30 teams, 159 positionals, 89 skills) generated from
the Sevens JSON. Tonight I adopted that as the canonical reference layer and built the rest of
the app on top of it.

**Adopted (from the `deploy/` chat), unchanged:**

- `deploy/01_schema.sql` — `bb.*` reference schema (numeric team ids, GW tier, positional
  groups, normalised skills) + `tournament` config (budget, tier→SPP, per-tournament tier
  overrides) + the `tournament_team_build` view.
- `deploy/02_seed_bb.sql` — the catalogue seed.
- `deploy/gen_seed.py`, `deploy/02_seed_sample.sql`.

**Added (my app layer, in their style):**

- `deploy/03_app.sql` — `public.profiles / teams / roster_players / entries / fixtures /
  results`, the `standings` view, `is_admin()`, triggers, and **RLS** (private rosters by
  owner, admin read-all, public-read reference/results). Plus two convenience read-views the
  frontend uses: `bb.positional_detail` and `public.fallcup_team_build`.
- `deploy/00_reset.sql` — a guarded clean-slate drop so the rebuild is consistent regardless of
  which earlier schema was in the database (safe: no coach/roster/result data exists yet).
- `deploy/setup_all.sql` — one-paste bundle of reset + schema + app layer.

**Rewired the frontend to the unified schema:**

- `builder.js` — now reads the real catalogue: team picker, effective tier, starting SPP and
  budget from `fallcup_team_build`; positionals, numeric stats (rendered `3+`), starting skills
  and Big-Guy group caps from `bb.positional_detail`. Enforces budget, SPP (6/player + the one
  12-SPP secondary), positional and group maxima, and CTV. Saves to `public.teams` /
  `roster_players` by `bb_team_id`. Inducement eligibility reads from `data.js`.
- `admin.js`, `league.js`, `data.js` — unchanged; they already targeted the app-layer tables,
  which I kept identical.

**Retired** the earlier `db/` schema/loader (superseded by `deploy/`), and removed a stray
temp file.

**Not done (needs the live database, which I can't reach from here):** running the SQL,
Discord OAuth, and live sign-in / save / results testing. See the go-live steps in `README.md`.
