/* ============================================================
   F.All Cup II — Supabase client + auth
   ES module. Include AFTER config.js:
     <script src="assets/js/config.js"></script>
     <script type="module" src="assets/js/supabase.js"></script>
   Exposes window.FALLCUP_DB and fires window event "fallcup:auth".
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.FALLCUP_CONFIG || {};
const configured =
  !!cfg.SUPABASE_URL && !!cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_URL.includes('YOUR_') && !cfg.SUPABASE_ANON_KEY.includes('YOUR_');

const sb = configured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

let currentUser = null;
let currentProfile = null;

async function refreshProfile() {
  if (!sb || !currentUser) { currentProfile = null; return; }
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  currentProfile = data || null;
}

function fire() {
  window.dispatchEvent(new CustomEvent('fallcup:auth', {
    detail: { user: currentUser, profile: currentProfile, configured },
  }));
  paintNav();
}

const escapeText = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* paint the nav account slot to reflect the current session */
function paintNav() {
  const slot = document.getElementById('nav-account');
  if (!slot) return;
  if (currentUser) {
    const name = (currentProfile && currentProfile.display_name) || currentUser.email || 'Coach';
    const admin = api.isAdmin() ? '<a href="admin.html" class="acct-admin" title="Admin">🛡️</a>' : '';
    slot.classList.add('signed-in');
    slot.innerHTML = '<span class="acct-name" title="Signed in as ' + escapeText(name) + '">👤 ' + escapeText(name) + '</span>' +
      admin + '<a href="#" id="nav-logout" class="acct-logout">Log out</a>';
    const lo = document.getElementById('nav-logout');
    if (lo) lo.onclick = async (e) => { e.preventDefault(); await api.signOut(); location.reload(); };
  } else {
    slot.classList.remove('signed-in');
    slot.innerHTML = '<a href="login.html">Login</a>';
  }
}

const api = {
  sb,
  configured,
  get user() { return currentUser; },
  get profile() { return currentProfile; },
  isAdmin() { return !!currentProfile?.is_admin; },

  async signInDiscord() {
    if (!sb) return;
    return sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.href } });
  },
  async signInEmail(email) {
    if (!sb) return { error: { message: 'Backend not configured.' } };
    return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
  },
  async signOut() { if (sb) await sb.auth.signOut(); currentUser = null; currentProfile = null; },

  /* resolves to the signed-in user, or null. Fires fallcup:auth. */
  async ready() {
    if (!sb) { fire(); return null; }
    const { data } = await sb.auth.getSession();
    currentUser = data?.session?.user || null;
    await refreshProfile();
    fire();
    return currentUser;
  },

  onChange(cb) { window.addEventListener('fallcup:auth', (e) => cb(e.detail)); },
};

window.FALLCUP_DB = api;

if (sb) {
  sb.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    await refreshProfile();
    fire();
  });
}

// paint once the shared nav exists, then again when the session resolves
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintNav);
else paintNav();

api.ready();
