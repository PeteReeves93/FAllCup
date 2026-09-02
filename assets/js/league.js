/* ============================================================
   F.All Cup II — fixtures, results, standings (public read) +
   coach result submission. ES module.
   ============================================================ */

const DB = window.FALLCUP_DB;
const page = document.body.getAttribute('data-page');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const emptyNotice = t => `<div class="notice"><p class="muted mb0">${esc(t)}</p></div>`;

// full stat set for the submit form (column = home_<key> / away_<key>)
const STAT_KEYS = [
  ['td', 'Touchdowns'], ['cas', 'Casualties'], ['crowd_surfs', 'Crowd surfs'],
  ['ttm_td', 'TTM TDs'], ['ttm_cas', 'TTM cas (failed throw)'],
  ['fouls', 'Fouls'], ['foul_sendoffs', 'Foul send-offs'], ['tripwire', 'Trip wire fails'],
];
// extras shown under a result (TD/cas already appear in the main row)
const STAT_EXTRA = STAT_KEYS.filter(([k]) => k !== 'td' && k !== 'cas');

let SB = null, ENTRIES = [], BYID = {};

async function boot() {
  if (!DB || !DB.configured || !DB.sb) {
    // backend not connected — replace the "Loading…" placeholders
    ['fixtures-app', 'standings-app', 'results-app'].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = emptyNotice('Backend not connected yet.');
    });
    return;
  }
  SB = DB.sb;
  const { data: entries } = await SB.from('entries').select('id,team_name,coach_name,tier,race').order('team_name');
  ENTRIES = entries || [];
  BYID = Object.fromEntries(ENTRIES.map(e => [e.id, e]));
  const cell = id => { const e = BYID[id]; return `${esc(e?.team_name || 'TBD')}${e?.race ? `<div class="small muted">${esc(e.race)}</div>` : ''}`; };

  if (page === 'fixtures') await renderFixtures(cell);
  if (page === 'results') {
    await renderResults(cell);
    DB.onChange(renderSubmit);   // show/hide the submit form as auth resolves
    renderSubmit();
  }
}

async function renderFixtures(cell) {
  const host = document.getElementById('fixtures-app');
  if (!host) return;
  const { data: fx, error } = await SB.from('fixtures').select('*').order('round_no').order('created_at');
  if (error) return;
  if (!fx || !fx.length) { host.innerHTML = emptyNotice('No fixtures posted yet. They appear here once the draw is made.'); return; }
  const byRound = {};
  for (const f of fx) { (byRound[f.round_no] ||= []).push(f); }
  host.innerHTML = Object.keys(byRound).sort((a, b) => a - b).map(rn => {
    const list = byRound[rn];
    const label = (list[0] && list[0].round_label) || 'Round Robin';
    const rows = list.map((f, i) => `<tr>
      <td class="num">${i + 1}</td><td class="name">${cell(f.home_entry)}</td><td class="name">${cell(f.away_entry)}</td><td class="muted">${esc(f.date_window || '')}</td>
    </tr>`).join('');
    return `<h3 style="margin-top:1.6rem">Round ${esc(rn)} <span class="muted" style="font-size:.7em">${esc(label)}</span></h3>
      <div class="table-wrap"><table><thead><tr><th class="num">#</th><th class="name">Home</th><th class="name">Away</th><th>Date window</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

async function renderResults(cell) {
  const sHost = document.getElementById('standings-app');
  if (sHost) {
    const { data: st } = await SB.from('standings').select('*');
    const rows = (st || []).sort((a, b) => b.points - a.points || b.td_diff - a.td_diff || b.cas_for - a.cas_for || a.team_name.localeCompare(b.team_name));
    if (!rows.length) sHost.innerHTML = emptyNotice('No results in yet, so the table is empty.');
    else sHost.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th class="num">#</th><th class="name">Team</th><th class="num">P</th><th class="num">W</th><th class="num">D</th><th class="num">L</th><th class="num">TD+</th><th class="num">TD−</th><th class="num">Diff</th><th class="num">Cas</th><th class="num">Pts</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td class="name">${esc(r.team_name)}${BYID[r.entry_id]?.race ? `<div class="small muted">${esc(BYID[r.entry_id].race)}</div>` : ''}</td>
        <td class="num">${r.played}</td><td class="num">${r.won}</td><td class="num">${r.drawn}</td><td class="num">${r.lost}</td>
        <td class="num">${r.td_for}</td><td class="num">${r.td_against}</td><td class="num">${r.td_diff}</td><td class="num">${r.cas_for}</td>
        <td class="num"><strong style="color:var(--accent-bright)">${r.points}</strong></td></tr>`).join('')}</tbody></table></div>`;
  }

  const rHost = document.getElementById('results-app');
  if (rHost) {
    const { data: res } = await SB.from('results').select('*').order('played_on', { ascending: false }).limit(80);
    if (!res || !res.length) { rHost.innerHTML = emptyNotice('No matches played yet.'); return; }
    rHost.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th class="name">Home</th><th class="num">Score</th><th class="name">Away</th><th class="num">Cas</th><th>Date</th></tr></thead>
      <tbody>${res.map(m => {
        const extra = STAT_EXTRA.filter(([k]) => (m['home_' + k] || 0) || (m['away_' + k] || 0)).map(([k, l]) => `${l} ${m['home_' + k] || 0}–${m['away_' + k] || 0}`).join(' · ');
        return `<tr>
          <td class="name">${cell(m.home_entry)}</td>
          <td class="num">${m.forfeit ? 'F' : m.home_td} – ${m.forfeit ? 'F' : m.away_td}</td>
          <td class="name">${cell(m.away_entry)}</td>
          <td class="num">${m.home_cas}–${m.away_cas}</td>
          <td class="muted">${esc(m.played_on || '')}</td></tr>
          ${extra ? `<tr><td colspan="5" class="small muted" style="padding-top:0">${extra}</td></tr>` : ''}`;
      }).join('')}</tbody></table></div>`;
  }
}

/* coach result submission — shown to signed-in users on the results page */
function renderSubmit(state) {
  const host = document.getElementById('submit-app');
  if (!host) return;
  const user = state?.user ?? DB.user;
  const configured = state?.configured ?? DB.configured;
  if (!configured) { host.innerHTML = ''; return; }
  if (!user) { host.innerHTML = `<p class="small muted"><a href="login.html">Sign in</a> to submit a match result.</p>`; return; }

  const ni = 'padding:5px;border-radius:6px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);width:64px;text-align:center';
  const sel = 'padding:8px 9px;border-radius:7px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);flex:1;min-width:120px';
  const opts = ['<option value="">— team —</option>'].concat(ENTRIES.map(e => `<option value="${e.id}">${esc(e.team_name)}</option>`)).join('');
  const statRows = STAT_KEYS.map(([k, l]) => `<tr><td class="small">${l}</td><td class="num"><input id="s-h-${k}" type="number" min="0" value="0" style="${ni}"></td><td class="num"><input id="s-a-${k}" type="number" min="0" value="0" style="${ni}"></td></tr>`).join('');
  host.innerHTML = `<details class="card" style="margin-bottom:1rem"><summary style="cursor:pointer"><strong>Report a match result</strong> <span class="muted small">— your result is added straight away; an admin can correct it</span></summary>
    <div class="pill-row" style="gap:6px;align-items:center;margin-top:.8rem">
      <select id="s-home" style="${sel}">${opts}</select><span class="muted">vs</span><select id="s-away" style="${sel}">${opts}</select>
    </div>
    <div class="table-wrap" style="margin-top:8px"><table><thead><tr><th class="name">Stat</th><th class="num">Home</th><th class="num">Away</th></tr></thead><tbody>${statRows}</tbody></table></div>
    <div class="pill-row" style="gap:6px;margin-top:6px;align-items:center">
      <select id="s-forfeit" style="${sel};max-width:160px;flex:none"><option value="">Played normally</option><option value="home">Forfeit: home loses</option><option value="away">Forfeit: away loses</option><option value="double">Double forfeit</option></select>
      <input id="s-date" type="date" style="${sel};max-width:160px;flex:none">
      <button class="btn" id="s-submit">Submit result</button>
      <span id="s-msg" class="small muted"></span>
    </div></details>`;

  const $ = id => document.getElementById(id);
  $('s-submit').addEventListener('click', async () => {
    const msg = $('s-msg');
    const home = $('s-home').value, away = $('s-away').value;
    if (!home || !away) { msg.textContent = 'Pick both teams.'; return; }
    if (home === away) { msg.textContent = 'Home and away must differ.'; return; }
    const payload = { home_entry: home, away_entry: away, forfeit: $('s-forfeit').value || null, played_on: $('s-date').value || null };
    STAT_KEYS.forEach(([k]) => { payload['home_' + k] = +$('s-h-' + k).value || 0; payload['away_' + k] = +$('s-a-' + k).value || 0; });
    msg.textContent = 'Submitting…';
    const { error } = await SB.from('results').insert(payload);
    if (error) { msg.style.color = 'var(--red)'; msg.textContent = 'Error: ' + error.message; return; }
    msg.style.color = 'var(--green)'; msg.textContent = 'Submitted — thanks!';
    await renderResults((id) => { const e = BYID[id]; return `${esc(e?.team_name || 'TBD')}${e?.race ? `<div class="small muted">${esc(e.race)}</div>` : ''}`; });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
