/* ============================================================
   F.All Cup II — Team Builder + League Manager  (ES module)
   Two modes, driven by team.is_locked:
     • creation — budget draft (1,150k, tier SPP, positional caps, one skill/player)
     • league   — treasury management (add/remove/injure players, per-player SPP,
                  multiple skills, MNG/dead status, niggling). Identity locked.
   Reads catalogue from public.fallcup_team_build + public.fallcup_positionals.
   Engine exposed as window.FALLCUP_ENGINE.
   ============================================================ */

const B = (window.FALLCUP && window.FALLCUP.build) || {};
const D = window.FALLCUP || {};
const money = n => (n == null ? '—' : (n / 1000).toLocaleString() + 'k');
const plus  = n => (n == null || n === '' ? '–' : (typeof n === 'number' ? n + '+' : n));
const uid   = () => Math.random().toString(36).slice(2, 9);
const TOURNEY = 'fall-cup-ii';

const skillInc  = t => (t === 'secondary' ? B.skillValue.secondary : B.skillValue.primary);
const skillCost = t => (t === 'secondary' ? B.secondarySkillCost : B.chosenPrimaryCost);

/* ---------------- ENGINE (pure) ---------------- */
const ENGINE = {
  pool(team)   { return team.startingSpp != null ? team.startingSpp : ((B.tierSpp && B.tierSpp[team.tier]) || 0); },
  budget(team) { return team.budget != null ? team.budget : B.budget; },
  live(team)   { return (team.players || []).filter(p => p.status !== 'dead'); },

  playerValue(p) { return (p.base_cost || 0) + (p.skills || []).reduce((s, k) => s + skillInc(k.type), 0); },
  playerSkillSpp(p) { return (p.skills || []).reduce((s, k) => s + skillCost(k.type), 0); },
  lowCostLinemen(team) { return !!team && (team.specialRules || []).some(r => String(r).toLowerCase().includes('low cost linemen')); },
  // Team-Value contribution: with "Low Cost Linemen", a lineman's BASE cost is
  // excluded from TV (they still cost full gold to buy; skills still count).
  playerTV(p, team) {
    const base = (ENGINE.lowCostLinemen(team) && p.is_lineman) ? 0 : (p.base_cost || 0);
    return base + (p.skills || []).reduce((s, k) => s + skillInc(k.type), 0);
  },

  staffValue(team) {
    return (team.rerolls || 0) * (team.rerollCost || 0)
      + (team.apothecary ? B.apothecaryCost : 0)
      + (team.assistant_coaches || 0) * B.staffCost
      + (team.cheerleaders || 0) * B.staffCost;
  },
  // CTV = live players' TV contribution (incl. skills, less Low-Cost-Linemen base) + staff.
  ctv(team) { return ENGINE.live(team).reduce((s, p) => s + ENGINE.playerTV(p, team), 0) + ENGINE.staffValue(team); },

  // creation budget: live player BASE costs + staff + extra fans (skills are free SPP)
  goldSpent(team) {
    return ENGINE.live(team).reduce((s, p) => s + (p.base_cost || 0), 0)
      + ENGINE.staffValue(team) + ((team.dedicated_fans || 1) - 1) * B.fansCostPerStep;
  },
  treasuryCreation(team) { return ENGINE.budget(team) - ENGINE.goldSpent(team); },
  // creation SPP pool used = skills' SPP + banked SPP
  sppUsed(team) { return (team.players || []).reduce((s, p) => s + ENGINE.playerSkillSpp(p) + (p.spp || 0), 0); },

  countByPosition(team) {
    const m = {}; for (const p of ENGINE.live(team)) m[p.position_title] = (m[p.position_title] || 0) + 1; return m;
  },
  maxFor(team, cat, title) {
    const pl = (team.players || []).find(p => p.position_title === title && p.max_count != null);
    if (pl) return pl.max_count;
    const c = cat && cat.positionals && cat.positionals.find(x => x.title === title);
    return c ? c.max_count : null;
  },

  validate(team, cat) {
    const errors = [], warnings = [];
    const players = team.players || [], live = ENGINE.live(team);
    if (!team.tier) errors.push('Pick a team so the tier and SPP are set.');
    if ((team.leagues || []).length > 1 && !team.league) errors.push('Choose a league — it sets which stars and mercs you can hire.');

    const fCap = team.is_locked ? B.fansLeagueMax : B.fansMax;
    if ((team.dedicated_fans || 1) > fCap) errors.push(`Dedicated Fans max is ${fCap}${team.is_locked ? ' (league)' : ' at creation (1 free + 3 bought)'}.`);

    // positional & group caps (both modes)
    const counts = ENGINE.countByPosition(team);
    for (const title of Object.keys(counts)) {
      const mx = ENGINE.maxFor(team, cat, title);
      if (mx != null && counts[title] > mx) errors.push(`Too many ${title}: ${counts[title]} of max ${mx}.`);
    }
    const groups = {};
    for (const p of live) if (p.group_name) { groups[p.group_name] = groups[p.group_name] || { n: 0, max: p.group_max }; groups[p.group_name].n++; }
    for (const [g, val] of Object.entries(groups)) if (val.max != null && val.n > val.max) errors.push(`Too many ${g}: ${val.n} of max ${val.max}.`);

    if (live.length > 16) errors.push(`A team may have at most 16 players (have ${live.length}).`);
    if (live.length < 11) warnings.push(`You need 11 players to field a team (have ${live.length}).`);

    if (!team.is_locked) {
      // ---- creation rules ----
      const spent = ENGINE.goldSpent(team), budget = ENGINE.budget(team);
      if (spent > budget) errors.push(`Over budget by ${money(spent - budget)} (spent ${money(spent)} of ${money(budget)}).`);
      const used = ENGINE.sppUsed(team), pool = ENGINE.pool(team);
      if (used > pool) errors.push(`Over SPP by ${used - pool} (used ${used} of ${pool}).`);
      if (players.filter(p => (p.skills || []).some(k => k.type === 'secondary')).length > 1)
        errors.push('Only one player may take a Secondary skill.');
      for (const p of players) {
        if ((p.skills || []).length > 1) errors.push(`${p.position_title} has more than one starting skill.`);
        if ((p.spp || 0) > B.sppPerPlayerCap) errors.push(`${p.position_title} has ${p.spp} SPP (max ${B.sppPerPlayerCap} per player).`);
      }
    } else {
      // ---- league rules ----
      if ((team.treasury || 0) < 0) errors.push('Treasury is negative.');
      if (players.some(p => (p.spp || 0) < 0)) errors.push('A player has negative SPP.');
    }
    return { errors, warnings, ok: errors.length === 0 };
  },
};
window.FALLCUP_ENGINE = ENGINE;

/* choosable skills for a player, from access codes → skillCategories */
function choosableSkills(p) {
  const cats = D.skillCategories || {};
  const uniq = codes => { const s = new Set(); (codes || []).forEach(c => (cats[c] || []).forEach(k => s.add(k))); return [...s]; };
  let prim = uniq(p.primary_access), sec = uniq(p.secondary_access);
  if (!prim.length && !sec.length) { const all = new Set(); Object.values(cats).forEach(a => a.forEach(k => all.add(k))); prim = [...all]; }
  const list = prim.sort().map(n => ({ name: n, kind: 'primary' }));
  sec.sort().forEach(n => { if (!prim.includes(n)) list.push({ name: n, kind: 'secondary' }); });
  return list;
}

/* ---------------- UI ---------------- */
const DB = window.FALLCUP_DB;
let CAT_TEAMS = null;
let POS = {};
let team = newTeam();
let leagueEdit = false;   // league mode: false = view sheet, true = management view

function newTeam() {
  return {
    id: null, bbTeamId: null, tournamentId: null, name: '', race: '', tier: null,
    startingSpp: null, budget: null, rerollCost: 0, specialRules: [], leagues: [], league: null,
    dedicated_fans: 1, rerolls: 0, apothecary: false, assistant_coaches: 0, cheerleaders: 0,
    treasury: 0, is_locked: false, players: [],
  };
}

const app = () => document.getElementById('builder-app');
const notice = (html, cls = '') => { app().innerHTML = `<div class="notice ${cls}">${html}</div>`; };

function boot() { if (!app()) return; DB.onChange(render); render({ configured: DB.configured, user: DB.user }); }

function render(state) {
  const configured = state?.configured ?? DB.configured;
  const user = state?.user ?? DB.user;
  const resolved = state?.resolved ?? DB.resolved;
  if (!configured) { notice('<h4>Backend not connected yet</h4><p class="muted mb0">Add your Supabase keys to <code>assets/js/config.js</code> and this lights up.</p>', 'wip'); return; }
  if (!user) {
    if (!resolved) { notice('<p class="muted mb0">Loading…</p>'); return; }   // don't flash the gate before the session is known
    app().innerHTML = `<div class="gate"><span class="card-icon">🔒</span><h3>Sign in to build your team</h3>
      <p class="muted">Rosters are private to each coach.</p>
      <a class="btn block discord" href="login.html">Continue with Discord</a>
      <a class="btn ghost block" href="login.html" style="margin-top:.6rem">Email magic link</a></div>`;
    return;
  }
  loadAndRender();
}

let loadingStarted = false;
async function loadAndRender() {
  if (loadingStarted) return; loadingStarted = true;
  notice('<p class="muted mb0">Loading your team and the catalogue…</p>');

  try {
    const { data, error } = await DB.sb.from('fallcup_team_build').select('*').eq('tournament_slug', TOURNEY).order('team_name');
    if (error) throw error;
    CAT_TEAMS = data || [];
  } catch (e) { CAT_TEAMS = []; }
  if (!CAT_TEAMS.length) {
    notice('<h4>Team catalogue not loaded yet</h4><p class="muted mb0">Run <code>deploy/setup_all.sql</code> then <code>deploy/02_seed_bb.sql</code> in Supabase, then reload.</p>', 'wip');
    return;
  }

  try {
    const { data: t } = await DB.sb.from('teams').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (t) {
      team = { ...newTeam(), id: t.id, bbTeamId: t.bb_team_id, tournamentId: t.tournament_id,
        name: t.name, race: t.race, tier: t.tier, startingSpp: t.starting_spp, budget: t.budget_gp,
        dedicated_fans: t.dedicated_fans, rerolls: t.rerolls, apothecary: t.apothecary,
        assistant_coaches: t.assistant_coaches, cheerleaders: t.cheerleaders,
        treasury: t.treasury || 0, is_locked: t.is_locked };
      const ct = CAT_TEAMS.find(x => x.team_id === t.bb_team_id);
      if (ct) { team.rerollCost = ct.reroll_cost || 0; team.specialRules = ct.special_rules || []; team.leagues = ct.leagues || []; await ensurePositionals(ct.team_id); }
      team.league = t.league || (team.leagues.length === 1 ? team.leagues[0] : null);
      const { data: rp } = await DB.sb.from('roster_players').select('*').eq('team_id', t.id).order('slot');
      const pos = POS[t.bb_team_id] || [];
      team.players = (rp || []).map(r => {
        const src = pos.find(x => x.id === r.positional_id) || {};
        let skills = Array.isArray(r.skills) ? r.skills : [];
        if (!skills.length && r.chosen_skills && r.chosen_skills[0])   // migrate old rows
          skills = [{ name: r.chosen_skills[0], type: r.is_secondary ? 'secondary' : 'primary' }];
        return { uid: uid(), positional_id: r.positional_id, position_title: r.position_title, base_cost: r.base_cost,
          ma: r.ma, st: r.st, ag: r.ag, pa: r.pa, av: r.av,
          max_count: src.max_count, group_name: src.group_name, group_max: src.group_max, is_lineman: src.is_lineman,
          primary_access: src.primary_access || [], secondary_access: src.secondary_access || [],
          name: r.player_name || '',
          skills, spp: r.spp || 0, status: r.status || 'active', niggling: r.niggling || 0, notes: r.notes || '' };
      });
    }
  } catch (e) { /* fresh */ }

  renderBuilder();
}

async function ensurePositionals(bbTeamId) {
  if (POS[bbTeamId]) return POS[bbTeamId];
  const { data } = await DB.sb.from('fallcup_positionals').select('*').eq('team_id', bbTeamId).order('cost', { ascending: false });
  POS[bbTeamId] = data || [];
  return POS[bbTeamId];
}

function renderBuilder() {
  const cat = CAT_TEAMS.find(t => t.team_id === team.bbTeamId);
  const v = ENGINE.validate(team, cat ? { positionals: POS[cat.team_id] } : null);
  const actions = `
    <div class="card" style="margin-top:1.2rem">
      <div class="pill-row" style="justify-content:space-between">
        <div class="pill-row">
          <button class="btn" id="b-save">Save</button>
          <button class="btn ghost" id="b-export">Export CTV</button>
          ${team.is_locked
            ? '<span class="badge official" title="This team is in league mode">🔒 League mode</span>'
            : '<button class="btn ghost" id="b-lock">🔒 Lock &amp; start league</button>'}
          ${team.is_locked ? '' : '<button class="btn ghost" id="b-reset">New team</button>'}
        </div>
        <div id="b-msg" class="small muted"></div>
      </div>
      ${validationBlock(v)}
    </div>`;

  if (team.is_locked && !leagueEdit) {
    // league VIEW — clean, read-only team sheet
    app().innerHTML = `${summaryBar()}
      <div class="stack" style="margin-top:1rem">
        ${leagueViewBar()}
        ${rosterViewTable()}
        ${inducementsPanel()}
      </div>`;
  } else if (team.is_locked) {
    // league EDIT — management view
    app().innerHTML = `${summaryBar()}
      <div class="pill-row" style="margin:1rem 0 .2rem;justify-content:space-between;align-items:center">
        <span class="eyebrow" style="margin:0">Editing roster</span>
        <button class="btn" id="b-done">✓ Done &amp; view</button>
      </div>
      <div class="stack">
        ${metaPanel()}
        ${rosterPanel(cat)}
        ${cataloguePanel(cat)}
        ${inducementsPanel()}
      </div>
      ${actions}`;
  } else {
    // creation
    app().innerHTML = `${summaryBar()}
      <div class="grid grid-2" style="align-items:start;margin-top:1rem">
        <div class="stack">${metaPanel()}${cataloguePanel(cat)}${inducementsPanel()}</div>
        <div class="stack">${rosterPanel(cat)}</div>
      </div>
      ${actions}`;
  }
  wire(cat);
}

function summaryBar() {
  const item = (l, v, c) => `<div class="bsum-item"><span class="bsum-l">${l}</span><b${c ? ` style="color:${c}"` : ''}>${v}</b></div>`;
  if (team.is_locked) {
    const t = team.treasury || 0;
    return `<div class="build-summary">
      ${item('Treasury', money(t), t < 0 ? 'var(--red)' : 'var(--accent-bright)')}
      ${item('Team value', money(ENGINE.ctv(team)))}
      ${item('Players', `${ENGINE.live(team).length}`)}
      ${item('Mode', '🔒 League')}
    </div>`;
  }
  const spent = ENGINE.goldSpent(team), rem = ENGINE.budget(team) - spent;
  const pct = Math.min(100, Math.max(0, spent / ENGINE.budget(team) * 100));
  const over = rem < 0;
  return `<div class="build-summary">
    ${item('Budget left', money(rem), over ? 'var(--red)' : 'var(--accent-bright)')}
    ${item('CTV', money(ENGINE.ctv(team)))}
    ${item('SPP', `${ENGINE.sppUsed(team)} / ${ENGINE.pool(team) || '—'}`)}
    ${item('Players', `${ENGINE.live(team).length} / 16`)}
    <div class="bsum-bar"><i style="width:${pct}%;background:${over ? 'var(--red)' : 'var(--accent-grad)'}"></i></div>
  </div>`;
}

function effectiveRules() { return (team.specialRules || []).concat(team.league ? [team.league] : []); }

function leagueControl() {
  const lg = team.leagues || [];
  if (!lg.length) return '';
  if (team.is_locked || lg.length === 1)
    return `<div class="small muted" style="margin-bottom:.8rem">League: <strong style="color:var(--accent-bright)">${escapeHtml(team.league || lg[0])}</strong></div>`;
  const opts = ['<option value="">— choose a league —</option>']
    .concat(lg.map(l => `<option value="${escapeHtml(l)}"${l === team.league ? ' selected' : ''}>${escapeHtml(l)}</option>`)).join('');
  return `<label class="small muted">League (this team must choose — affects which stars &amp; mercs you can hire)</label>
    <select id="m-league" style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);margin:.2rem 0 .8rem">${opts}</select>`;
}

function metaPanel() {
  const inputStyle = 'width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);margin:.2rem 0 .8rem';
  const step = (label, id, val, min, max) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:.3rem 0">
       <span class="small">${label}</span>
       <span class="pill-row">
         <button class="btn ghost" data-dec="${id}" style="padding:2px 10px">−</button>
         <strong style="min-width:2ch;text-align:center">${val}</strong>
         <button class="btn ghost" data-inc="${id}" data-max="${max}" data-min="${min}" style="padding:2px 10px">+</button>
       </span></div>`;
  const staff = `
    ${step('Dedicated Fans (max ' + (team.is_locked ? B.fansLeagueMax : B.fansMax) + ')', 'dedicated_fans', team.dedicated_fans, 1, team.is_locked ? B.fansLeagueMax : B.fansMax)}
    ${step('Team re-rolls', 'rerolls', team.rerolls, 0, 8)}
    ${step('Assistant coaches', 'assistant_coaches', team.assistant_coaches, 0, 12)}
    ${step('Cheerleaders', 'cheerleaders', team.cheerleaders, 0, 12)}
    <div style="display:flex;justify-content:space-between;align-items:center;margin:.3rem 0">
      <span class="small">Apothecary (${money(B.apothecaryCost)})</span>
      <button class="btn ${team.apothecary ? '' : 'ghost'}" id="m-apo" style="padding:4px 14px">${team.apothecary ? 'Yes' : 'No'}</button>
    </div>`;

  if (team.is_locked) {
    // identity is fixed in league mode; treasury is editable
    return `<div class="card">
      <h3 class="mt0">${escapeHtml(team.name)} <span class="muted small">— ${escapeHtml(team.race)} · Tier ${team.tier ?? '?'}</span></h3>
      ${leagueControl()}
      <label class="small muted">Treasury (gp)</label>
      <input id="m-treasury" type="number" step="1000" value="${team.treasury || 0}" style="${inputStyle}">
      ${staff}
      <p class="small muted mb0">Name, race and league are locked for the season. Adjust treasury as you earn/spend gold.</p>
    </div>`;
  }

  const opts = ['<option value="">— choose a team —</option>']
    .concat(CAT_TEAMS.map(t => `<option value="${t.team_id}"${t.team_id === team.bbTeamId ? ' selected' : ''}>${t.team_name} (T${t.effective_tier ?? t.gw_tier ?? '?'})</option>`)).join('');
  return `<div class="card">
    <h3 class="mt0">Team</h3>
    <label class="small muted">Team name</label>
    <input id="m-name" value="${escapeHtml(team.name)}" placeholder="e.g. Middenheim Maulers" style="${inputStyle}">
    <label class="small muted">Race / roster</label>
    <select id="m-race" style="${inputStyle}">${opts}</select>
    <div class="small muted" style="margin-bottom:.8rem">${team.tier ? `Tier ${team.tier} · ${ENGINE.pool(team)} SPP · budget ${money(ENGINE.budget(team))} · rerolls ${money(team.rerollCost)}` : 'Tier, SPP and budget set by team'}</div>
    ${leagueControl()}
    ${staff}
  </div>`;
}

function cataloguePanel(cat) {
  if (!cat) return '';
  const pos = POS[cat.team_id] || [];
  const counts = ENGINE.countByPosition(team);
  const groupN = {}; for (const p of ENGINE.live(team)) if (p.group_name) groupN[p.group_name] = (groupN[p.group_name] || 0) + 1;
  const rows = pos.map(p => {
    const have = counts[p.title] || 0;
    const capFull = p.max_count != null && have >= p.max_count;
    const grpFull = p.group_name && p.group_max != null && (groupN[p.group_name] || 0) >= p.group_max;
    const full = capFull || grpFull;
    const afford = team.is_locked ? true : ENGINE.treasuryCreation(team) >= p.cost;
    return `<tr>
      <td class="name">${p.title}<div class="small muted">${have}/${p.max_count ?? '16'}${p.group_name ? ' · ' + p.group_name : ''} · ${statLine(p)}</div></td>
      <td class="cost">${money(p.cost)}</td>
      <td class="num"><button class="btn ${full || !afford ? 'ghost' : ''}" data-add="${p.id}" ${full ? 'disabled' : ''} style="padding:4px 12px">${full ? 'Max' : 'Add'}</button></td>
    </tr>`;
  }).join('');
  return `<div class="card"><h3 class="mt0">Add players</h3>
    ${team.is_locked ? '<p class="small muted" style="margin-top:-.4rem">Buying in league — remember to deduct the cost from your treasury above.</p>' : ''}
    <div class="table-wrap"><table><thead><tr><th class="name">Position</th><th class="num">Cost</th><th class="num"></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

/* creation: one skill via combobox + banked SPP stepper */
function creationSkillCell(p) {
  if ((p.skills || []).length) {
    const k = p.skills[0];
    return `<div class="skill-chip"><strong>${escapeHtml(k.name)}</strong>
      <span class="muted small">${k.type === 'secondary' ? '12 SPP · Secondary' : '6 SPP · Primary'}</span>
      <button class="combo-clear" data-clear="${p.uid}" title="Remove skill">✕</button></div>`;
  }
  const opts = choosableSkills(p).map(o =>
    `<div class="combo-opt" data-pick="${p.uid}|${escapeHtml(o.name)}|${o.kind}">${o.name}<span class="muted small"> · ${o.kind === 'secondary' ? '12' : '6'} SPP</span></div>`).join('');
  return `
    <div class="spp-mini">SPP
      <button class="spp-btn" data-sppdec="${p.uid}">−</button><strong>${p.spp || 0}</strong><button class="spp-btn" data-sppinc="${p.uid}">+</button>
      <span class="muted small">banked</span>
    </div>
    <div class="combo"><input class="combo-input" placeholder="add a skill…" data-comboinput="${p.uid}" autocomplete="off">
      <div class="combo-list" data-combolist="${p.uid}">${opts || '<div class="combo-opt muted">no skills</div>'}</div></div>`;
}

/* league VIEW — read-only team header + roster sheet */
function leagueViewBar() {
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center">
      <div>
        <h2 class="mt0 mb0">${escapeHtml(team.name)}</h2>
        <div class="muted small">${escapeHtml(team.race)} · Tier ${team.tier ?? '?'}${team.league ? ' · ' + escapeHtml(team.league) : ''}</div>
      </div>
      <div class="pill-row">
        <button class="btn" id="b-edit">✏️ Edit roster</button>
        <button class="btn ghost" id="b-export">Export CTV</button>
      </div>
    </div>
    <div class="muted small" style="margin-top:.7rem">
      Re-rolls ${team.rerolls} · Apothecary ${team.apothecary ? 'yes' : 'no'} · Assistant coaches ${team.assistant_coaches} · Cheerleaders ${team.cheerleaders} · Dedicated Fans ${team.dedicated_fans}
    </div>
  </div>`;
}

function rosterViewTable() {
  if (!team.players.length) return `<div class="card"><h3 class="mt0">Roster</h3><p class="muted mb0">No players yet — press "Edit roster" to add some.</p></div>`;
  const label = { active: 'Active', mng: 'MNG', dead: 'Dead' };
  const rows = team.players.map((p, i) => {
    const dead = p.status === 'dead';
    const skills = (p.skills || []).map(k => k.name).join(', ') || '—';
    const notes = p.notes ? `<div class="small muted">${escapeHtml(p.notes)}</div>` : '';
    return `<tr${dead ? ' style="opacity:.5"' : ''}>
      <td class="num">${i + 1}</td>
      <td class="name">${escapeHtml(p.name || '—')}</td>
      <td>${escapeHtml(p.position_title)}</td>
      <td class="num">${p.ma ?? '—'}</td><td class="num">${p.st ?? '—'}</td>
      <td class="num">${plus(p.ag)}</td><td class="num">${plus(p.pa)}</td><td class="num">${plus(p.av)}</td>
      <td>${escapeHtml(skills)}${notes}</td>
      <td class="num">${p.spp || 0}</td>
      <td class="num">${label[p.status] || 'Active'}${p.niggling ? ' · Ngl ' + p.niggling : ''}</td>
      <td class="cost">${money(ENGINE.playerTV(p, team))}</td>
    </tr>`;
  }).join('');
  return `<div class="card"><h3 class="mt0">Roster</h3>
    <div class="table-wrap"><table>
      <thead><tr><th class="num">#</th><th class="name">Name</th><th>Position</th>
        <th class="num">MA</th><th class="num">ST</th><th class="num">AG</th><th class="num">PA</th><th class="num">AV</th>
        <th>Skills</th><th class="num">SPP</th><th>Status</th><th class="num">Value</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
}

function rosterPanel(cat) {
  if (!team.players.length) return `<div class="card"><h3 class="mt0">Roster</h3><p class="muted mb0">No players yet. ${team.is_locked ? 'Add players below.' : 'Pick a team, then add players from the left.'}</p></div>`;

  if (team.is_locked) {
    const cards = team.players.map((p, i) => leaguePlayerCard(p, i)).join('');
    return `<div class="card"><h3 class="mt0">Roster <span class="muted small">— league management</span></h3>
      <div class="stack">${cards}</div></div>`;
  }

  const rows = team.players.map((p, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td class="name">${p.position_title}<div class="small muted">${statLine(p)}</div></td>
      <td style="min-width:160px">${creationSkillCell(p)}</td>
      <td class="cost">${money(ENGINE.playerTV(p, team))}</td>
      <td class="num"><button class="btn ghost" data-del="${p.uid}" style="padding:2px 9px">✕</button></td>
    </tr>`).join('');
  return `<div class="card"><h3 class="mt0">Roster</h3>
    <p class="small muted" style="margin-top:-.4rem">Give SPP with the stepper (banked), or pick a skill to spend it. One player may take a Secondary (12 SPP).</p>
    <div class="table-wrap"><table><thead><tr><th class="num">#</th><th class="name">Position</th><th>SPP &amp; skill</th><th class="num">Value</th><th class="num"></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

/* league: rich per-player card */
function leaguePlayerCard(p, i) {
  const dead = p.status === 'dead';
  const statNum = (lbl, key, suffix) =>
    `<label class="lg-stat">${lbl}<input type="number" data-stat="${p.uid}|${key}" value="${p[key] ?? ''}" style="width:52px">${suffix || ''}</label>`;
  const skillChips = (p.skills || []).map((k, idx) =>
    `<span class="skill-chip" style="padding:3px 6px"><strong>${escapeHtml(k.name)}</strong><span class="muted small">${k.type === 'secondary' ? 'S' : 'P'}</span>
      <button class="combo-clear" data-skillrm="${p.uid}|${idx}" title="Remove (refunds SPP)">✕</button></span>`).join(' ');
  const opts = choosableSkills(p).map(o =>
    `<div class="combo-opt" data-pick="${p.uid}|${escapeHtml(o.name)}|${o.kind}">${o.name}<span class="muted small"> · ${o.kind === 'secondary' ? '12' : '6'} SPP</span></div>`).join('');
  const sel = (val, optsArr) => optsArr.map(([v, t]) => `<option value="${v}"${v === val ? ' selected' : ''}>${t}</option>`).join('');
  return `<div class="lg-card${dead ? ' dead' : ''}">
    <input class="lg-notes" data-pname="${p.uid}" value="${escapeHtml(p.name || '')}" placeholder="player name…" style="max-width:260px;margin-bottom:.5rem">
    <div class="lg-head">
      <div><strong>#${i + 1} ${escapeHtml(p.position_title)}</strong> <span class="muted small">· base ${money(p.base_cost)} · value ${money(ENGINE.playerTV(p, team))}</span></div>
      <div class="pill-row">
        <select data-status="${p.uid}" title="Status">${sel(p.status || 'active', [['active', 'Active'], ['mng', 'MNG'], ['dead', 'Dead']])}</select>
        <button class="btn ghost" data-del="${p.uid}" style="padding:2px 9px" title="Remove player">✕</button>
      </div>
    </div>
    <div class="lg-stats">
      ${statNum('MA', 'ma')} ${statNum('ST', 'st')} ${statNum('AG', 'ag', '+')} ${statNum('PA', 'pa', '+')} ${statNum('AV', 'av', '+')}
      <label class="lg-stat">Ngl
        <span class="pill-row"><button class="spp-btn" data-nigdec="${p.uid}">−</button><strong>${p.niggling || 0}</strong><button class="spp-btn" data-niginc="${p.uid}">+</button></span>
      </label>
      <label class="lg-stat">SPP<input type="number" data-sppset="${p.uid}" value="${p.spp || 0}" style="width:56px"></label>
    </div>
    <div class="lg-skills">
      <span class="small muted">Skills:</span> ${skillChips || '<span class="muted small">none</span>'}
      <span class="combo" style="display:inline-block;min-width:150px"><input class="combo-input" placeholder="add skill (spends SPP)…" data-comboinput="${p.uid}" autocomplete="off">
        <div class="combo-list" data-combolist="${p.uid}">${opts}</div></span>
    </div>
    <input class="lg-notes" data-notes="${p.uid}" value="${escapeHtml(p.notes || '')}" placeholder="injury / notes (e.g. Smashed Knee −1 MA)">
  </div>`;
}

function inducementsPanel() {
  const gStars = D.gnashStars || [], mercs = D.gnashMercs || [], banned = D.bannedStars || [];
  const generic = D.genericInducements || [], stars = D.starPlayers || [];
  const rules = new Set(effectiveRules().map(r => r.toLowerCase().trim()));
  const starCap = team.tier === 4 ? 2 : 1;
  const eligibleGnash = gStars.filter(s => (s.eligibleFor || []).some(tok => rules.has(String(tok).toLowerCase().trim())));
  const starEligible = s => {
    if (s.banned) return false;
    if (s.any) return true;
    if (s.anyExcept) return !s.anyExcept.some(t => rules.has(String(t).toLowerCase().trim()));
    return (s.plays || []).some(t => rules.has(String(t).toLowerCase().trim()));
  };
  const eligibleStars = stars.filter(starEligible);
  const priceRow = (n, c, note) => `<tr><td class="name">${escapeHtml(n)}${note ? `<div class="small muted">${escapeHtml(note)}</div>` : ''}</td><td class="cost">${c == null ? '—' : money(c)}</td></tr>`;
  const gnashRows = arr => arr.map(s => priceRow(s.name, s.cost)).join('');
  const genRows = generic.map(g => priceRow(g.name, g.cost, g.note)).join('');
  const starRows = stars.map(s => `<tr${s.banned ? ' style="opacity:.45"' : ''}><td class="name">${escapeHtml(s.name)}${s.banned ? ' <span class="badge banned">banned</span>' : ''}</td><td class="cost">${money(s.cost)}</td></tr>`).join('');
  const pick = team.tier ? '' : '<tr><td colspan="2" class="muted">Pick a team / league to see eligible stars.</td></tr>';
  return `<div class="card"><h3 class="mt0">Inducements you could hire</h3>
    <p class="small muted">Tier ${team.tier || '?'}: up to <strong>${starCap}</strong> star(s), <strong>2</strong> GNASH Mercs, plus rulebook stars, mercs &amp; inducements. Eligibility is filtered by your league &amp; special rules.</p>

    <h4>Star Players (eligible for your team)</h4>
    <div class="table-wrap"><table><thead><tr><th class="name">Star</th><th class="num">Induce</th></tr></thead>
      <tbody>${eligibleStars.length ? eligibleStars.map(s => priceRow(s.name, s.cost)).join('') : (pick || '<tr><td colspan="2" class="muted">No eligible rulebook stars for this league.</td></tr>')}</tbody></table></div>

    <h4 style="margin-top:1rem">GNASH Stars (eligible for your team)</h4>
    <div class="table-wrap"><table><thead><tr><th class="name">Star</th><th class="num">Induce</th></tr></thead>
      <tbody>${eligibleGnash.length ? gnashRows(eligibleGnash) : (pick || '<tr><td colspan="2" class="muted">No eligible GNASH stars for this league.</td></tr>')}</tbody></table></div>

    <h4 style="margin-top:1rem">GNASH Mercs (any team, up to 2)</h4>
    <div class="table-wrap"><table><thead><tr><th class="name">Merc</th><th class="num">Induce</th></tr></thead><tbody>${gnashRows(mercs)}</tbody></table></div>

    <h4 style="margin-top:1rem">Generic inducements</h4>
    <div class="table-wrap"><table><thead><tr><th class="name">Inducement</th><th class="num">Cost</th></tr></thead><tbody>${genRows}</tbody></table></div>

    <details style="margin-top:1rem"><summary style="cursor:pointer"><strong>All BB2025 Star Players (${stars.length}) — reference</strong></summary>
      <p class="small muted" style="margin:.5rem 0">Mega-stars are banned in the F.All Cup.</p>
      <div class="table-wrap"><table><thead><tr><th class="name">Star</th><th class="num">Induce</th></tr></thead><tbody>${starRows}</tbody></table></div>
    </details>

    ${banned.length ? `<p class="small muted" style="margin-top:.6rem">Banned mega-stars: ${banned.join(', ')}.</p>` : ''}</div>`;
}

function validationBlock(v) {
  if (!v.errors.length && !v.warnings.length) return `<p class="small" style="color:var(--green);margin:.8rem 0 0">✓ Legal roster.</p>`;
  return `<ul style="margin:.8rem 0 0;padding-left:1.1rem">${v.errors.map(x => `<li style="color:var(--red)">${x}</li>`).join('')}${v.warnings.map(x => `<li class="muted">${x}</li>`).join('')}</ul>`;
}

function statLine(p) { return `MA ${p.ma ?? '—'} · ST ${p.st ?? '—'} · AG ${plus(p.ag)} · PA ${plus(p.pa)} · AV ${plus(p.av)}`; }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------------- events ---------------- */
function wire(cat) {
  const $ = id => document.getElementById(id);
  const num = v => { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

  const nameEl = $('m-name'); if (nameEl) nameEl.addEventListener('input', e => { team.name = e.target.value; });
  const raceEl = $('m-race');
  if (raceEl) raceEl.addEventListener('change', async e => {
    const id = e.target.value ? Number(e.target.value) : null;
    const ct = CAT_TEAMS.find(t => t.team_id === id);
    team.bbTeamId = id; team.race = ct?.team_name || '';
    team.tier = ct?.effective_tier ?? ct?.gw_tier ?? null;
    team.startingSpp = ct?.starting_spp ?? null; team.budget = ct?.budget_gp ?? null;
    team.tournamentId = ct?.tournament_id ?? null; team.rerollCost = ct?.reroll_cost || 0;
    team.specialRules = ct?.special_rules || []; team.leagues = ct?.leagues || [];
    team.league = team.leagues.length === 1 ? team.leagues[0] : null;
    team.players = [];
    if (ct) await ensurePositionals(ct.team_id);
    renderBuilder();
  });
  const lgEl = $('m-league'); if (lgEl) lgEl.addEventListener('change', e => { team.league = e.target.value || null; renderBuilder(); });
  const trEl = $('m-treasury'); if (trEl) trEl.addEventListener('change', e => { team.treasury = num(e.target.value) || 0; renderBuilder(); });

  document.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.inc; team[k] = Math.min(+b.dataset.max, (team[k] || 0) + 1); renderBuilder(); }));
  document.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.dec, min = k === 'dedicated_fans' ? 1 : 0; team[k] = Math.max(min, (team[k] || 0) - 1); renderBuilder(); }));
  const apo = $('m-apo'); if (apo) apo.addEventListener('click', () => { team.apothecary = !team.apothecary; renderBuilder(); });

  document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const pos = (POS[cat.team_id] || []).find(p => String(p.id) === b.dataset.add);
    if (!pos) return;
    team.players.push({ uid: uid(), positional_id: pos.id, position_title: pos.title, base_cost: pos.cost,
      ma: pos.ma, st: pos.st, ag: pos.ag, pa: pos.pa, av: pos.av,
      max_count: pos.max_count, group_name: pos.group_name, group_max: pos.group_max, is_lineman: pos.is_lineman,
      primary_access: pos.primary_access, secondary_access: pos.secondary_access,
      name: '', skills: [], spp: 0, status: 'active', niggling: 0, notes: '' });
    renderBuilder();
  }));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { team.players = team.players.filter(p => p.uid !== b.dataset.del); renderBuilder(); }));

  // creation banked-SPP steppers + clear
  document.querySelectorAll('[data-sppinc]').forEach(b => b.addEventListener('click', () => { const p = pById(b.dataset.sppinc); if (p) { p.spp = Math.min(B.sppPerPlayerCap, (p.spp || 0) + 1); renderBuilder(); } }));
  document.querySelectorAll('[data-sppdec]').forEach(b => b.addEventListener('click', () => { const p = pById(b.dataset.sppdec); if (p) { p.spp = Math.max(0, (p.spp || 0) - 1); renderBuilder(); } }));
  document.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => { const p = pById(b.dataset.clear); if (p) { p.skills = []; renderBuilder(); } }));

  // league per-player controls
  document.querySelectorAll('[data-status]').forEach(s => s.addEventListener('change', e => { const p = pById(s.dataset.status); if (p) { p.status = e.target.value; renderBuilder(); } }));
  document.querySelectorAll('[data-stat]').forEach(inp => inp.addEventListener('change', e => { const [id, key] = inp.dataset.stat.split('|'); const p = pById(id); if (p) { p[key] = num(e.target.value); } }));
  document.querySelectorAll('[data-sppset]').forEach(inp => inp.addEventListener('change', e => { const p = pById(inp.dataset.sppset); if (p) { p.spp = num(e.target.value) || 0; renderBuilder(); } }));
  document.querySelectorAll('[data-notes]').forEach(inp => inp.addEventListener('change', e => { const p = pById(inp.dataset.notes); if (p) p.notes = e.target.value; }));
  document.querySelectorAll('[data-pname]').forEach(inp => inp.addEventListener('change', e => { const p = pById(inp.dataset.pname); if (p) p.name = e.target.value; }));
  document.querySelectorAll('[data-niginc]').forEach(b => b.addEventListener('click', () => { const p = pById(b.dataset.niginc); if (p) { p.niggling = Math.min(9, (p.niggling || 0) + 1); renderBuilder(); } }));
  document.querySelectorAll('[data-nigdec]').forEach(b => b.addEventListener('click', () => { const p = pById(b.dataset.nigdec); if (p) { p.niggling = Math.max(0, (p.niggling || 0) - 1); renderBuilder(); } }));
  document.querySelectorAll('[data-skillrm]').forEach(b => b.addEventListener('click', () => {
    const [id, idx] = b.dataset.skillrm.split('|'); const p = pById(id);
    if (p) { const k = p.skills[+idx]; if (k) { p.spp = (p.spp || 0) + skillCost(k.type); p.skills.splice(+idx, 1); } renderBuilder(); }
  }));

  // searchable skill combobox (both modes)
  document.querySelectorAll('[data-comboinput]').forEach(inp => {
    const id = inp.dataset.comboinput;
    const listEl = document.querySelector(`[data-combolist="${id}"]`);
    const place = () => { const r = inp.getBoundingClientRect(); listEl.style.left = r.left + 'px'; listEl.style.top = (r.bottom + 3) + 'px'; listEl.style.width = Math.max(r.width, 180) + 'px'; };
    const open = () => { place(); listEl.classList.add('open'); };
    inp.addEventListener('focus', open);
    inp.addEventListener('input', () => { const q = inp.value.toLowerCase(); listEl.querySelectorAll('.combo-opt').forEach(o => { o.style.display = o.textContent.toLowerCase().includes(q) ? '' : 'none'; }); open(); });
    inp.addEventListener('blur', () => setTimeout(() => listEl.classList.remove('open'), 150));
  });
  document.querySelectorAll('.combo-opt[data-pick]').forEach(o => o.addEventListener('mousedown', e => {
    e.preventDefault();
    const [id, name, kind] = o.dataset.pick.split('|'); const p = pById(id); if (!p) return;
    if (team.is_locked) {
      const cost = skillCost(kind);
      if ((p.spp || 0) < cost) { const m = $('b-msg'); if (m) { m.style.color = 'var(--red)'; m.textContent = `${p.position_title} needs ${cost} SPP for that skill (has ${p.spp || 0}).`; } return; }
      p.spp -= cost; p.skills.push({ name, type: kind });
    } else {
      p.skills = [{ name, type: kind }];   // creation: one skill
    }
    renderBuilder();
  }));

  $('b-save')?.addEventListener('click', save);
  $('b-export')?.addEventListener('click', exportCTV);
  $('b-lock')?.addEventListener('click', lockAndStart);
  $('b-edit')?.addEventListener('click', () => { leagueEdit = true; renderBuilder(); });
  $('b-done')?.addEventListener('click', leagueDone);
  $('b-reset')?.addEventListener('click', () => { team = newTeam(); renderBuilder(); });
}

async function leagueDone() {
  const cat = CAT_TEAMS.find(t => t.team_id === team.bbTeamId);
  const v = ENGINE.validate(team, cat ? { positionals: POS[cat.team_id] } : null);
  const msg = document.getElementById('b-msg');
  if (!v.ok) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Fix the errors before finishing.'; } return; }
  await save();
  leagueEdit = false;
  renderBuilder();
}

function pById(id) { return team.players.find(p => p.uid === id); }

async function save() {
  const msg = document.getElementById('b-msg');
  const cat = CAT_TEAMS.find(t => t.team_id === team.bbTeamId);
  const v = ENGINE.validate(team, cat ? { positionals: POS[cat.team_id] } : null);
  if (!team.name) { msg.textContent = 'Give your team a name first.'; return; }
  if (!team.bbTeamId) { msg.textContent = 'Pick a team first.'; return; }
  if (!v.ok) { msg.style.color = 'var(--red)'; msg.textContent = 'Fix the errors before saving.'; return; }
  msg.style.color = ''; msg.textContent = 'Saving…';
  try {
    const payload = {
      name: team.name, race: team.race, league: team.league, bb_team_id: team.bbTeamId, tournament_id: team.tournamentId,
      tier: team.tier, starting_spp: team.startingSpp, budget_gp: team.budget,
      treasury: team.is_locked ? (team.treasury || 0) : ENGINE.treasuryCreation(team),
      dedicated_fans: team.dedicated_fans, rerolls: team.rerolls, apothecary: team.apothecary,
      assistant_coaches: team.assistant_coaches, cheerleaders: team.cheerleaders,
      is_locked: team.is_locked, declared_ctv: ENGINE.ctv(team),
    };
    if (team.id) payload.id = team.id;
    const { data, error } = await DB.sb.from('teams').upsert(payload).select().single();
    if (error) throw error;
    team.id = data.id;
    await DB.sb.from('roster_players').delete().eq('team_id', team.id);
    const rows = team.players.map((p, i) => ({
      team_id: team.id, slot: i + 1, positional_id: p.positional_id, position_title: p.position_title, base_cost: p.base_cost,
      player_name: p.name || null,
      skills: p.skills || [], spp: p.spp || 0, status: p.status || 'active', niggling: p.niggling || 0, notes: p.notes || null,
      chosen_skills: (p.skills || []).map(k => k.name), is_secondary: (p.skills || []).some(k => k.type === 'secondary'),
      spp_spent: ENGINE.playerSkillSpp(p), ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av,
    }));
    if (rows.length) { const r = await DB.sb.from('roster_players').insert(rows); if (r.error) throw r.error; }
    msg.style.color = 'var(--green)'; msg.textContent = 'Saved ✓';
  } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = 'Save failed: ' + (e.message || e); }
}

async function lockAndStart() {
  const msg = document.getElementById('b-msg');
  const cat = CAT_TEAMS.find(t => t.team_id === team.bbTeamId);
  const v = ENGINE.validate(team, cat ? { positionals: POS[cat.team_id] } : null);
  if (!team.name || !team.bbTeamId) { msg.textContent = 'Name your team and pick a race first.'; return; }
  if (!v.ok) { msg.style.color = 'var(--red)'; msg.textContent = 'Fix the errors before locking.'; return; }
  if (!confirm('Lock this roster and switch to league mode?\n\nName, race and league are then fixed. You manage the team by treasury and can add/remove/injure players and level them up. (An admin can switch it back if needed.)')) return;
  team.is_locked = true;
  team.treasury = ENGINE.treasuryCreation(team);   // carry leftover gold into league treasury
  await save();
  renderBuilder();
}

function exportCTV() {
  const lines = [
    `${team.name || 'Unnamed team'} — ${team.race || '?'} (Tier ${team.tier || '?'})${team.league ? ' · ' + team.league : ''}`,
    `${team.is_locked ? 'Team value' : 'CTV'}: ${money(ENGINE.ctv(team))}${team.is_locked ? ' · Treasury: ' + money(team.treasury || 0) : ''}`,
    `Re-rolls: ${team.rerolls} · Apothecary: ${team.apothecary ? 'yes' : 'no'} · Coaches: ${team.assistant_coaches} · Cheerleaders: ${team.cheerleaders}`,
    `Dedicated Fans: ${team.dedicated_fans} (not in CTV) · Players: ${ENGINE.live(team).length}`,
  ];
  const msg = document.getElementById('b-msg');
  const say = (t, ok) => { if (msg) { msg.style.color = ok ? 'var(--green)' : ''; msg.textContent = t; } else alert(t); };
  navigator.clipboard?.writeText(lines.join('\n')).then(() => say('CTV summary copied to clipboard.', true), () => say(lines.join('\n'), false));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
