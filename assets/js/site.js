/* ============================================================
   GNASHBBL F.All Cup II — shared UI: nav, footer, renderers
   Each page: <body data-page="rules"> ... <script src="assets/js/data.js">
              <script src="assets/js/site.js">
   ============================================================ */
(function () {
  "use strict";

  var NAV = [
    { key: "home",     label: "Home",         href: "index.html" },
    { key: "rules",    label: "Rules",        href: "rules.html" },
    { key: "stars",    label: "Star Players", href: "stars.html" },
    { key: "mercs",    label: "Mercs",        href: "mercs.html" },
    { key: "kickoff",  label: "Kick-Off",     href: "kickoff.html" },
    { key: "fixtures", label: "Fixtures",     href: "fixtures.html" },
    { key: "results",  label: "Results",      href: "results.html" },
    { key: "builder",  label: "Team Builder", href: "builder.html", cta: true },
    { key: "login",    label: "Login",        href: "login.html" },
  ];

  var page = document.body.getAttribute("data-page") || "";

  /* ---------- header ---------- */
  function buildHeader() {
    var links = NAV.map(function (n) {
      if (n.key === "login") {
        // account slot — supabase.js fills this with the signed-in state
        return '<span class="nav-account" id="nav-account"><a href="login.html"' +
               (page === "login" ? ' class="active"' : "") + '>Login</a></span>';
      }
      var cls = [];
      if (n.key === page) cls.push("active");
      if (n.cta) cls.push("cta");
      return '<a href="' + n.href + '"' + (cls.length ? ' class="' + cls.join(" ") + '"' : "") + '>' + n.label + "</a>";
    }).join("");

    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<div class="nav-inner">' +
        '<a class="brand" href="index.html">' +
          '<img src="assets/img/logo.png" alt="F.All Cup II crest">' +
          '<span class="brand-name">F.ALL CUP <span>II</span></span>' +
        "</a>" +
        '<button class="nav-toggle" aria-label="Menu" aria-expanded="false">&#9776;</button>' +
        '<nav class="nav-links">' + links + "</nav>" +
      "</div>";
    document.body.insertBefore(header, document.body.firstChild);

    var toggle = header.querySelector(".nav-toggle");
    var menu = header.querySelector(".nav-links");
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- footer ---------- */
  function buildFooter() {
    var f = document.createElement("footer");
    f.className = "site-footer";
    f.innerHTML =
      '<div class="footer-inner">' +
        "<div>GNASHBBL <strong>F.All Cup II</strong> &middot; Est. Aug 2026 &middot; A local Blood Bowl league</div>" +
        '<div><a href="rules.html">Rules</a> &middot; <a href="fixtures.html">Fixtures</a> &middot; <a href="results.html">Results</a> &middot; <a href="admin.html">Admin</a></div>' +
      "</div>";
    document.body.appendChild(f);
  }

  /* ---------- render helpers (read from window.FALLCUP) ---------- */
  var D = window.FALLCUP || {};

  function statRow(p) {
    return (
      '<tr>' +
        '<td class="name">' + p.name + (p.note ? ' <span class="badge mng" title="' + p.note + '">verify</span>' : "") +
          '<div class="small muted">' + p.type + "</div></td>" +
        '<td class="num">' + p.ma + "</td>" +
        '<td class="num">' + p.st + "</td>" +
        '<td class="num">' + p.ag + "</td>" +
        '<td class="num">' + p.pa + "</td>" +
        '<td class="num">' + p.av + "</td>" +
        "<td>" + p.skills + (p.playsFor ? '<div class="small muted" style="margin-top:.35rem">Plays for: ' + p.playsFor + "</div>" : "") + "</td>" +
        '<td class="cost">' + (p.cost / 1000) + "k</td>" +
      "</tr>"
    );
  }

  function playerTable(list) {
    return (
      '<div class="table-wrap"><table>' +
        '<thead><tr class="stat-head">' +
          '<th class="name">Player</th><th class="num">MA</th><th class="num">ST</th>' +
          '<th class="num">AG</th><th class="num">PA</th><th class="num">AV</th>' +
          "<th>Skills &amp; Traits</th><th class=\"num\">Induce</th>" +
        "</tr></thead><tbody>" +
        list.map(statRow).join("") +
      "</tbody></table></div>"
    );
  }

  var R = {
    stars: function (el) { el.innerHTML = playerTable(D.gnashStars || []); },
    mercs: function (el) { el.innerHTML = playerTable(D.gnashMercs || []); },

    keyDates: function (el) {
      el.innerHTML = '<div class="key-dates">' + (D.keyDates || []).map(function (k) {
        return '<div class="key-date"><div class="d">' + k.d + '</div><div class="l">' + k.l + "</div></div>";
      }).join("") + "</div>";
    },

    banned: function (el) {
      el.innerHTML = '<div class="pill-row">' + (D.bannedStars || []).map(function (b) {
        return '<span class="badge banned">' + b + "</span>";
      }).join("") + "</div>";
    },

    inducements: function (el) {
      var rows = (D.inducements || []).map(function (i) {
        return "<tr><td class=\"name\">" + i.tiers + "</td>" +
          '<td class="num">' + (i.twoStars ? "1 or 2" : "1") + "</td>" +
          '<td class="num">' + i.gnashMercs + "</td>" +
          '<td class="num">' + i.megaStars + "</td>" +
          "<td class=\"num\">" + (i.rulebookMercs ? "Yes" : "No") + "</td></tr>";
      }).join("");
      el.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
        "<th class=\"name\">Tier</th><th class=\"num\">Stars / GNASH Stars</th><th class=\"num\">GNASH Mercs</th>" +
        "<th class=\"num\">Mega-Stars</th><th class=\"num\">Rulebook Mercs</th>" +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    },

    kickoff: function (el) {
      var rows = (D.kickoff || []).map(function (k) {
        return '<tr><td class="num"><strong style="color:var(--accent-bright)">' + k.roll + "</strong></td>" +
          '<td class="name">' + k.name + "</td><td>" + k.desc + "</td></tr>";
      }).join("");
      el.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
        '<th class="num">2D6</th><th class="name">Event</th><th>Effect</th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    },

    tiers: function (el) {
      var t = (D.build && D.build.tierSpp) || {};
      el.innerHTML = '<div class="key-dates">' + [1, 2, 3, 4].map(function (n) {
        return '<div class="key-date"><div class="d">Tier ' + n + '</div><div class="l">' + (t[n] || "?") + " starting SPP</div></div>";
      }).join("") + "</div>";
    },
  };

  /* ---------- kick-off roller ---------- */
  function wireRoller() {
    var btn = document.getElementById("roll-kickoff");
    if (!btn) return;
    var out = document.getElementById("dice-result");
    var name = document.getElementById("dice-outcome");
    var desc = document.getElementById("dice-desc");
    btn.addEventListener("click", function () {
      var d1 = 1 + Math.floor(Math.random() * 6);
      var d2 = 1 + Math.floor(Math.random() * 6);
      var total = d1 + d2;
      var ev = (D.kickoff || []).find(function (k) { return k.roll === total; }) || {};
      out.textContent = "🎲 " + d1 + " + " + d2 + " = " + total;
      name.textContent = ev.name || "";
      if (desc) desc.textContent = ev.desc || "";
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    buildHeader();
    buildFooter();
    // run any renderers whose target elements exist
    document.querySelectorAll("[data-render]").forEach(function (el) {
      var fn = R[el.getAttribute("data-render")];
      if (fn) fn(el);
    });
    wireRoller();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
