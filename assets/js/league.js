/* ============================================================
   F.All Cup II — fixtures, results & standings (public, read-only)
   ES module. Renders live data when the backend is configured;
   otherwise leaves the static "not wired yet" stub in place.
   ============================================================ */

const DB = window.FALLCUP_DB;
const page = document.body.getAttribute('data-page');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function boot() {
  if (!DB || !DB.configured || !DB.sb) return;      // keep static stub
  const sb = DB.sb;

  const { data: entries } = await sb.from('entries').select('id,team_name,coach_name,tier,race');
  const byId = Object.fromEntries((entries || []).map(e => [e.id, e]));
  const cell = id => { const e = byId[id]; return `${esc(e?.team_name || 'TBD')}${e?.race ? `<div class="small muted">${esc(e.race)}</div>` : ''}`; };

  if (page === 'fixtures') await renderFixtures(sb, cell);
  if (page === 'results')  await renderResults(sb, byId, cell);
}

async function renderFixtures(sb, cell) {
  const host = document.getElementById('fixtures-app');
  if (!host) return;
  const { data: fx, error } = await sb.from('fixtures').select('*').order('round_no').order('created_at');
  if (error) return;
  if (!fx || !fx.length) { host.innerHTML = emptyNotice('No fixtures posted yet. They appear here once the draw is made.'); return; }

  const byRound = {};
  for (const f of fx) { const k = `${f.round_no}::${f.round_label || 'Round'}`; (byRound[k] ||= []).push(f); }

  host.innerHTML = Object.entries(byRound).map(([k, list]) => {
    const label = k.split('::')[1];
    const rows = list.map((f, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td class="name">${cell(f.home_entry)}</td>
      <td class="name">${cell(f.away_entry)}</td>
      <td class="muted">${esc(f.date_window || '')}</td>
    </tr>`).join('');
    return `<h3 style="margin-top:1.6rem">${esc(label)}</h3>
      <div class="table-wrap"><table><thead><tr><th class="num">#</th><th class="name">Home</th><th class="name">Away</th><th>Date window</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

async function renderResults(sb, byId, cell) {
  // standings
  const sHost = document.getElementById('standings-app');
  if (sHost) {
    const { data: st } = await sb.from('standings').select('*');
    const rows = (st || []).sort((a, b) =>
      b.points - a.points || b.td_diff - a.td_diff || b.cas_for - a.cas_for || a.team_name.localeCompare(b.team_name));
    if (!rows.length) sHost.innerHTML = emptyNotice('No results in yet, so the table is empty.');
    else sHost.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th class="num">#</th><th class="name">Team</th><th class="num">P</th><th class="num">W</th><th class="num">D</th><th class="num">L</th><th class="num">TD+</th><th class="num">TD−</th><th class="num">Diff</th><th class="num">Cas</th><th class="num">Pts</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td class="name">${esc(r.team_name)}${byId[r.entry_id]?.race ? `<div class="small muted">${esc(byId[r.entry_id].race)}</div>` : ''}</td>
        <td class="num">${r.played}</td><td class="num">${r.won}</td><td class="num">${r.drawn}</td><td class="num">${r.lost}</td>
        <td class="num">${r.td_for}</td><td class="num">${r.td_against}</td><td class="num">${r.td_diff}</td><td class="num">${r.cas_for}</td>
        <td class="num"><strong style="color:var(--accent-bright)">${r.points}</strong></td></tr>`).join('')}</tbody></table></div>`;
  }

  // latest results
  const rHost = document.getElementById('results-app');
  if (rHost) {
    const { data: res } = await sb.from('results').select('*').order('played_on', { ascending: false }).limit(50);
    if (!res || !res.length) { rHost.innerHTML = emptyNotice('No matches played yet.'); return; }
    rHost.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th class="name">Home</th><th class="num">Score</th><th class="name">Away</th><th class="num">Cas</th><th>Date</th></tr></thead>
      <tbody>${res.map(m => `<tr>
        <td class="name">${cell(m.home_entry)}</td>
        <td class="num">${m.forfeit ? 'F' : m.home_td} – ${m.forfeit ? 'F' : m.away_td}</td>
        <td class="name">${cell(m.away_entry)}</td>
        <td class="num">${m.home_cas}–${m.away_cas}</td>
        <td class="muted">${esc(m.played_on || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }
}

function emptyNotice(t) { return `<div class="notice"><p class="muted mb0">${esc(t)}</p></div>`; }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
