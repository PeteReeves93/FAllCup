/* ============================================================
   F.All Cup II — Admin tools (ES module, admin-gated)
   Manage entries, fixtures, results; read all rosters to validate.
   All writes are admin-only (enforced by RLS; UI mirrors it).
   ============================================================ */

const DB = window.FALLCUP_DB;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => (n == null ? '—' : (n / 1000).toLocaleString() + 'k');
const app = () => document.getElementById('admin-app');

let entries = [], profiles = {};

function boot() {
  if (!app()) return;
  DB.onChange(render);
  render({ configured: DB.configured, user: DB.user });
}

function render(state) {
  const configured = state?.configured ?? DB.configured;
  const user = state?.user ?? DB.user;
  if (!configured) { app().innerHTML = notice('Backend not connected yet — add Supabase keys to config.js.', 'wip'); return; }
  if (!user) { app().innerHTML = gate(); return; }
  if (!DB.isAdmin()) {
    app().innerHTML = notice('You are signed in, but this account is not an admin. Set <code>is_admin = true</code> on your profile row to get access.', 'wip');
    return;
  }
  loadAll();
}

function gate() {
  return `<div class="gate"><span class="card-icon">🛡️</span><h3>Sign in as an admin</h3>
    <a class="btn block discord" href="login.html">Continue with Discord</a></div>`;
}
function notice(t, cls = '') { return `<div class="notice ${cls}">${t}</div>`; }

async function loadAll() {
  const sb = DB.sb;
  const [{ data: en }, { data: pr }] = await Promise.all([
    sb.from('entries').select('*').order('team_name'),
    sb.from('profiles').select('id,display_name'),
  ]);
  entries = en || [];
  profiles = Object.fromEntries((pr || []).map(p => [p.id, p.display_name]));
  const [{ data: fx }, { data: res }, { data: teams }] = await Promise.all([
    sb.from('fixtures').select('*').order('round_no'),
    sb.from('results').select('*').order('played_on', { ascending: false }),
    sb.from('teams').select('*').order('updated_at', { ascending: false }),
  ]);
  paint(fx || [], res || [], teams || []);
}

function entryOptions(sel) {
  return ['<option value="">— team —</option>']
    .concat(entries.map(e => `<option value="${e.id}"${e.id === sel ? ' selected' : ''}>${esc(e.team_name)}</option>`)).join('');
}

function paint(fixtures, results, teams) {
  app().innerHTML = `
  <div class="stack">
    <div class="card">
      <h3 class="mt0">Entries</h3>
      <div id="entries-list"></div>
      <div class="pill-row" style="margin-top:.8rem;gap:6px">
        <input id="e-name" placeholder="Team name" style="${inp()}">
        <input id="e-coach" placeholder="Coach" style="${inp()};max-width:140px">
        <input id="e-race" placeholder="Race" style="${inp()};max-width:140px">
        <input id="e-tier" type="number" min="1" max="4" placeholder="Tier" style="${inp()};max-width:80px">
        <button class="btn" id="e-add">Add entry</button>
      </div>
    </div>

    <div class="card">
      <h3 class="mt0">Add fixture</h3>
      <div class="pill-row" style="gap:6px">
        <input id="f-round" type="number" min="1" placeholder="Round #" style="${inp()};max-width:100px">
        <input id="f-label" placeholder="Label (Round Robin)" style="${inp()};max-width:160px">
        <select id="f-home" style="${inp()}">${entryOptions()}</select>
        <select id="f-away" style="${inp()}">${entryOptions()}</select>
        <input id="f-window" placeholder="Date window" style="${inp()};max-width:160px">
        <button class="btn" id="f-add">Add</button>
      </div>
      <div id="fixtures-list" style="margin-top:.8rem"></div>
    </div>

    <div class="card">
      <h3 class="mt0">Enter result</h3>
      <div class="pill-row" style="gap:6px;align-items:center">
        <select id="r-home" style="${inp()}">${entryOptions()}</select>
        <input id="r-htd" type="number" min="0" value="0" title="Home TD" style="${inp()};max-width:70px">
        <span class="muted">–</span>
        <input id="r-atd" type="number" min="0" value="0" title="Away TD" style="${inp()};max-width:70px">
        <select id="r-away" style="${inp()}">${entryOptions()}</select>
      </div>
      <div class="pill-row" style="gap:6px;margin-top:6px;align-items:center">
        <input id="r-hcas" type="number" min="0" value="0" title="Home cas" style="${inp()};max-width:80px" placeholder="H cas">
        <input id="r-acas" type="number" min="0" value="0" title="Away cas" style="${inp()};max-width:80px" placeholder="A cas">
        <select id="r-forfeit" style="${inp()};max-width:150px"><option value="">Played normally</option><option value="home">Forfeit: home loses</option><option value="away">Forfeit: away loses</option><option value="double">Double forfeit</option></select>
        <input id="r-date" type="date" style="${inp()};max-width:160px">
        <button class="btn" id="r-add">Save result</button>
      </div>
      <div id="results-list" style="margin-top:.8rem"></div>
    </div>

    <div class="card">
      <h3 class="mt0">Rosters (read-all, validation)</h3>
      <div id="rosters-list"></div>
    </div>
    <div id="admin-msg" class="small muted"></div>
  </div>`;

  renderEntries();
  renderFixtures(fixtures);
  renderResults(results);
  renderRosters(teams);
  wire();
}

function inp() { return 'padding:8px 9px;border-radius:7px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);flex:1;min-width:90px'; }

function renderEntries() {
  const host = document.getElementById('entries-list');
  if (!entries.length) { host.innerHTML = '<p class="muted small mb0">No entries yet — add one below.</p>'; return; }
  const ei = 'padding:5px 7px;border-radius:6px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);font-size:.85rem';
  host.innerHTML = `<p class="small muted" style="margin-top:0">Edit any field then Save, or ✕ to delete. Deleting removes the entry's results.</p><div class="table-wrap"><table><thead><tr><th class="name">Team</th><th>Coach</th><th>Race</th><th class="num">Tier</th><th class="num">Active</th><th class="num"></th></tr></thead><tbody>${entries.map(e => `<tr>
    <td><input data-ent="${e.id}|team_name" value="${esc(e.team_name)}" style="${ei};min-width:130px"></td>
    <td><input data-ent="${e.id}|coach_name" value="${esc(e.coach_name || '')}" style="${ei};min-width:100px"></td>
    <td><input data-ent="${e.id}|race" value="${esc(e.race || '')}" style="${ei};min-width:100px"></td>
    <td class="num"><input data-ent="${e.id}|tier" type="number" min="1" max="4" value="${e.tier ?? ''}" style="${ei};width:54px"></td>
    <td class="num"><button class="btn ghost" data-entactive="${e.id}" data-on="${e.active ? 1 : 0}" style="padding:2px 8px">${e.active ? '✓' : '—'}</button></td>
    <td class="num" style="white-space:nowrap"><button class="btn" data-entsave="${e.id}" style="padding:2px 10px">Save</button> <button class="btn ghost" data-entdel="${e.id}" style="padding:2px 8px" title="Delete entry">✕</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderFixtures(fx) {
  const host = document.getElementById('fixtures-list');
  const nameOf = id => entries.find(e => e.id === id)?.team_name || 'TBD';
  host.innerHTML = fx.length ? `<div class="table-wrap"><table><thead><tr><th class="num">R</th><th class="name">Home</th><th class="name">Away</th><th>Window</th></tr></thead><tbody>${fx.map(f => `<tr><td class="num">${f.round_no}</td><td class="name">${esc(nameOf(f.home_entry))}</td><td class="name">${esc(nameOf(f.away_entry))}</td><td class="muted">${esc(f.date_window || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small mb0">No fixtures yet.</p>';
}

function renderResults(res) {
  const host = document.getElementById('results-list');
  const nameOf = id => entries.find(e => e.id === id)?.team_name || '?';
  host.innerHTML = res.length ? `<div class="table-wrap"><table><thead><tr><th class="name">Home</th><th class="num">Score</th><th class="name">Away</th><th>Date</th></tr></thead><tbody>${res.map(m => `<tr><td class="name">${esc(nameOf(m.home_entry))}</td><td class="num">${m.forfeit ? 'F' : m.home_td}–${m.forfeit ? 'F' : m.away_td}</td><td class="name">${esc(nameOf(m.away_entry))}</td><td class="muted">${esc(m.played_on || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small mb0">No results yet.</p>';
}

function renderRosters(teams) {
  const host = document.getElementById('rosters-list');
  if (!teams.length) { host.innerHTML = '<p class="muted small mb0">No coach rosters saved yet.</p>'; return; }
  host.innerHTML = teams.map(t => `<details style="margin-bottom:.4rem">
    <summary style="cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <strong>${esc(t.name)}</strong>
      <span class="muted small">— ${esc(profiles[t.owner_id] || 'coach')} · Tier ${t.tier ?? '?'} · CTV ${money(t.declared_ctv)}</span>
      <span class="badge ${t.is_locked ? 'official' : ''}">${t.is_locked ? 'in league' : 'creation'}</span>
      <button class="btn ghost" data-locktoggle="${t.id}" data-locked="${t.is_locked ? 1 : 0}" style="padding:2px 10px;margin-left:auto">${t.is_locked ? 'Set to creation' : 'Set in-league'}</button>
    </summary>
    <div class="roster-detail small muted" data-team="${t.id}" style="padding:.5rem 0">Loading…</div>
  </details>`).join('');
  document.querySelectorAll('[data-locktoggle]').forEach(b => b.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    const newVal = b.dataset.locked !== '1';
    const { error } = await DB.sb.from('teams').update({ is_locked: newVal }).eq('id', b.dataset.locktoggle);
    const m = document.getElementById('admin-msg'); if (m) m.textContent = error ? ('Error: ' + error.message) : (newVal ? 'Team set to in-league (fans up to 7).' : 'Team set to creation (fans max 4).');
    if (!error) loadAll();
  }));
  document.querySelectorAll('details').forEach(d => d.addEventListener('toggle', async () => {
    if (!d.open) return;
    const box = d.querySelector('.roster-detail'); if (!box || box.dataset.loaded) return;
    const { data } = await DB.sb.from('roster_players').select('*').eq('team_id', box.dataset.team).order('slot');
    box.dataset.loaded = '1';
    box.innerHTML = (data && data.length) ? `<div class="table-wrap"><table><thead><tr><th class="num">#</th><th class="name">Position</th><th>Status</th><th>Skills</th><th class="num">SPP</th><th class="num">Ngl</th><th>Notes</th></tr></thead><tbody>${data.map(r => `<tr><td class="num">${r.slot}</td><td class="name">${esc(r.position_title)}</td><td>${esc(r.status || 'active')}</td><td>${esc((r.chosen_skills || []).join(', '))}</td><td class="num">${r.spp ?? 0}</td><td class="num">${r.niggling ?? 0}</td><td class="muted small">${esc(r.notes || '')}</td></tr>`).join('')}</tbody></table></div>` : 'Empty roster.';
  }));
}

function wire() {
  const $ = id => document.getElementById(id);
  const sb = DB.sb;
  const msg = t => { const m = $('admin-msg'); m.textContent = t; };

  $('e-add').addEventListener('click', async () => {
    const name = $('e-name').value.trim(); if (!name) return msg('Team name required.');
    const { error } = await sb.from('entries').insert({ team_name: name, coach_name: $('e-coach').value.trim() || null, race: $('e-race').value.trim() || null, tier: +$('e-tier').value || null });
    msg(error ? 'Error: ' + error.message : 'Entry added.'); if (!error) loadAll();
  });

  // edit / delete / toggle-active existing entries
  document.querySelectorAll('[data-entsave]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.entsave, get = f => document.querySelector(`[data-ent="${id}|${f}"]`);
    const name = get('team_name').value.trim(); if (!name) return msg('Team name required.');
    const { error } = await sb.from('entries').update({
      team_name: name, coach_name: get('coach_name').value.trim() || null,
      race: get('race').value.trim() || null, tier: +get('tier').value || null,
    }).eq('id', id);
    msg(error ? 'Error: ' + error.message : 'Entry updated.'); if (!error) loadAll();
  }));
  document.querySelectorAll('[data-entdel]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this entry? Its fixtures lose the reference and its results are removed.')) return;
    const { error } = await sb.from('entries').delete().eq('id', b.dataset.entdel);
    msg(error ? 'Error: ' + error.message : 'Entry deleted.'); if (!error) loadAll();
  }));
  document.querySelectorAll('[data-entactive]').forEach(b => b.addEventListener('click', async () => {
    const { error } = await sb.from('entries').update({ active: b.dataset.on !== '1' }).eq('id', b.dataset.entactive);
    msg(error ? 'Error: ' + error.message : 'Entry updated.'); if (!error) loadAll();
  }));

  $('f-add').addEventListener('click', async () => {
    const round = +$('f-round').value; if (!round) return msg('Round # required.');
    const { error } = await sb.from('fixtures').insert({ round_no: round, round_label: $('f-label').value.trim() || 'Round Robin', home_entry: $('f-home').value || null, away_entry: $('f-away').value || null, date_window: $('f-window').value.trim() || null });
    msg(error ? 'Error: ' + error.message : 'Fixture added.'); if (!error) loadAll();
  });

  $('r-add').addEventListener('click', async () => {
    const home = $('r-home').value, away = $('r-away').value;
    if (!home || !away) return msg('Pick both teams.');
    if (home === away) return msg('Home and away must differ.');
    const { error } = await sb.from('results').insert({
      home_entry: home, away_entry: away,
      home_td: +$('r-htd').value || 0, away_td: +$('r-atd').value || 0,
      home_cas: +$('r-hcas').value || 0, away_cas: +$('r-acas').value || 0,
      forfeit: $('r-forfeit').value || null, played_on: $('r-date').value || null,
    });
    msg(error ? 'Error: ' + error.message : 'Result saved — standings will update.'); if (!error) loadAll();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
