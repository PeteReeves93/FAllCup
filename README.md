# GNASHBBL F.All Cup II — website

A local Blood Bowl league site: rules, star players, mercenaries, kick-off table,
fixtures, results/standings, and a private team builder. Static frontend +
Supabase (Postgres, Auth, Row Level Security). Amber-on-charcoal theme from the logo.

---

## ▶ Go live

Your Supabase URL + publishable key are already in `assets/js/config.js` (the publishable key
is public by design — safe to commit).

**A. Database (Supabase → SQL Editor):**
1. Paste all of **`deploy/setup_all.sql`** → **Run** (reset + reference schema + app layer).
2. Paste all of **`deploy/02_seed_bb.sql`** → **Run** (catalogue: 30 teams, 159 positionals, 89 skills).
3. Paste all of **`deploy/patches.sql`** → **Run** (incremental columns/policies; idempotent —
   harmless if `setup_all` already included them).

**B. Auth:** Authentication → Providers → **Discord** → enable (Discord app client id/secret).
Add your live URL under Authentication → URL Configuration → **Redirect URLs**.

**C. Deploy the site (Cloudflare Pages):**
1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Pages** → Connect to Git → pick the repo.
3. Build command: **none**. Output directory: **`/`** (root). Deploy → you get a `*.pages.dev` URL.
   (The `_headers` file sets security headers and keeps JS/CSS from serving stale.)
4. Put that `*.pages.dev` URL into Supabase's Discord **Redirect URLs** (step B).

**D. Make yourself admin:** open the site, sign in once, then in the SQL Editor run
`update public.profiles set is_admin = true where id = auth.uid();`

Then it's live. First run: add Entries and Fixtures from the Admin page; coaches sign in and
build their teams.

---

## Architecture (reconciled tonight)

Two layers, one database:

- **Reference layer** `bb.*` + `tournament*` (from `deploy/01_schema.sql`, seeded by
  `deploy/02_seed_bb.sql`) — the shared, reusable BB2025 catalogue: teams, positionals,
  skills, GW tiers, and the FAll Cup's budget + tier→SPP ladder with per-tournament tier
  overrides. One place to fix; every app reads it.
- **App layer** `public.*` (from `deploy/03_app.sql`) — coach accounts, **private rosters**
  (RLS: `owner_id = auth.uid()` — a coach only ever sees their own), plus the public
  competition record: entries, fixtures, results and an auto-computing standings view.

The frontend reads the catalogue through two views — `public.fallcup_team_build` (team →
effective tier, starting SPP, budget, reroll cost) and `bb.positional_detail` (positionals +
starting skills + group caps) — so the builder enforces budget, SPP (6/player, the single
12-SPP secondary), positional and Big-Guy-group caps, and computes CTV.

## Status

Fully wired and verified offline. Live once you run the two SQL scripts above.

| Area | State |
|------|-------|
| Public pages (home, rules, stars, mercs, kick-off) | ✅ Live (static) |
| Reference catalogue (`bb.*`, 30 teams) | ✅ Seed ready (`deploy/02_seed_bb.sql`) |
| Auth (Discord + magic link) | ✅ Built — enable Discord provider |
| Team Builder (real catalogue, budget/SPP/CTV/save) | ✅ Built |
| Fixtures / Results / Standings | ✅ Built |
| Admin desk | ✅ Built — grant yourself admin (step 4) |

## Structure

```
FAll Cup/
├── *.html                       # pages
├── assets/
│   ├── css/styles.css           # theme
│   └── js/
│       ├── data.js              # public reference data (stars, mercs, kick-off)
│       ├── site.js              # nav + footer + renderers
│       ├── config.js            # Supabase URL + publishable key (filled in)
│       ├── supabase.js          # client + auth
│       ├── builder.js           # team-builder engine + UI (unit-tested)
│       ├── league.js            # fixtures / results / standings
│       └── admin.js             # Admin tools
└── deploy/                      # ← canonical database migrations
    ├── setup_all.sql            # RUN 1: reset + reference schema + app layer
    ├── 02_seed_bb.sql           # RUN 2: the catalogue (30 teams)
    ├── 00_reset.sql 01_schema.sql 03_app.sql   # the pieces setup_all bundles
    ├── 02_seed_sample.sql       # 5-team sample (testing)
    └── gen_seed.py              # regenerate 02_seed_bb.sql from the Sevens JSON
```

## Verified offline

`node --check` on all scripts; link/asset integrity; SQL structural + ordering checks
(quoting, parens, dependency order); **12 engine tests including an end-to-end draft against
the real Orc roster parsed from the seed** — a legal 11-player team, the Troll max-1 cap, the
Big-Guy group cap, over-budget and over-SPP detection, and the single-secondary rule.

## Deploy the site

Push to Git → Cloudflare Pages → connect repo → no build command, output dir `/` → `*.pages.dev` URL.
(Add that URL to Supabase Auth redirect URLs.)

## To confirm / spot-check

- **League scoring** — standings use Win 3 / Draw 1 / Loss 0. Change in `03_app.sql` (the
  `standings` view) if you score differently.
- **GNASH Stars** — do they share the 1-or-2 star allowance, or sit in their own pool?
- **Beatrix Kiddo AV** — blank in the source doc.
- **Catalogue accuracy** — the seed rows are marked "Imported from Blood Bowl Base — check
  against your own copy." Worth a spot-check of a couple of teams' costs/skills before the draw.

## Provenance

Reference catalogue generated from your Sevens-project JSON (`gen_seed.py` → `02_seed_bb.sql`).
Rules, stars, mercs and kick-off content transcribed from *The Second GNASHBBL F.All Cup.docx*,
*GNASH ALL-STARS F All Cupp II.docx*, *new mercs FAC2.pdf*. See `CHANGELOG.md` for tonight's
reconciliation.
