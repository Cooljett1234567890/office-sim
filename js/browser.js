/* ===== browser.js — tabbed browser with fake sites + real YouTube embeds ===== */
"use strict";

(() => {
  const BOOKMARKS = [
    { label: "🏢 Intranet", url: "intranet.home" },
    { label: "📖 Wiki", url: "intranet.wiki/onboarding" },
    { label: "🧑‍💼 HR Portal", url: "hr.portal" },
    { label: "👾 Redddit", url: "redd.it" },
    { label: "📺 CatPipe", url: "catpipe.tv" },
    { label: "🎫 Tickets", url: "ticket.sys" },
  ];

  Apps.registry.browser = {
    title: "Browser", icon: "🌐", w: 900, h: 600,
    render(body, w, emp) {
      body.innerHTML = `<div class="browser">
        <div class="br-tabs"></div>
        <div class="br-bar">
          <button class="br-nav b-back" title="Back">◀</button>
          <button class="br-nav b-fwd" title="Forward">▶</button>
          <button class="br-nav b-home" title="Home">⌂</button>
          <input class="br-url" spellcheck="false">
        </div>
        <div class="br-bookmarks"></div>
        <div class="br-page"></div>
      </div>`;
      const tabsEl = body.querySelector(".br-tabs"), urlEl = body.querySelector(".br-url"),
            pageEl = body.querySelector(".br-page");
      const tabs = [];
      let curTab = null;

      function newTab(url, activate = true) {
        const tab = { url: null, hist: [], idx: -1, title: "New tab" };
        tabs.push(tab);
        if (activate) curTab = tab;
        if (url) navigate(url, tab);
        renderTabs();
        return tab;
      }
      function closeTab(tab) {
        const i = tabs.indexOf(tab);
        tabs.splice(i, 1);
        if (!tabs.length) { w.node.querySelector(".close").click(); return; }
        if (curTab === tab) curTab = tabs[Math.max(0, i - 1)];
        renderTabs(); show(curTab.url);
      }
      function navigate(url, tab = curTab, push = true) {
        if (!tab) tab = newTab(null, true);
        if (push) { tab.hist = tab.hist.slice(0, tab.idx + 1); tab.hist.push(url); tab.idx = tab.hist.length - 1; }
        tab.url = url;
        const pg = resolvePage(url);
        tab.title = pg ? pg.title : url.startsWith("search:") ? decodeURIComponent(url.slice(7)) : url;
        renderTabs(); show(url);
        emp.persona.history.push(url);
        if (emp.persona.history.length > 30) emp.persona.history.shift();
      }
      function resolvePage(url) {
        if (url && url.startsWith("watch:")) return { title: "Watching", render: (p, e, go) => watchPage(p, e, go, url.slice(6)) };
        if (url && url.startsWith("search:")) return PAGES.search(url.slice(7));
        return PAGES[url];
      }
      function show(url) {
        urlEl.value = url === null ? "" : url;
        pageEl.innerHTML = "";
        const page = resolvePage(url);
        if (page) { page.render(pageEl, emp, u => navigate(u)); }
        else {
          pageEl.innerHTML = `<div class="web"><div class="article">
            <h1>🔌 This page can't be reached</h1>
            <p><b>${url || "about:blank"}</b> is not on the SynergyNet allowlist.</p>
            <p>IT has blocked this site for "productivity reasons". The allowlist has 7 sites. You found 6.</p>
            <p><a href="#" data-url="intranet.home">← back to the intranet</a></p>
          </div></div>`;
          wireLinks(pageEl, u => navigate(u));
        }
      }
      function renderTabs() {
        tabsEl.innerHTML = "";
        for (const tab of tabs) {
          const t = el("div", "br-tab" + (tab === curTab ? " active" : ""), `<span>🌐</span><span>${tab.title}</span><span class="x">✕</span>`);
          t.addEventListener("click", e => { if (e.target.classList.contains("x")) { closeTab(tab); } else { curTab = tab; renderTabs(); show(tab.url); } });
          tabsEl.appendChild(t);
        }
      }
      // toolbar
      body.querySelector(".b-back").addEventListener("click", () => { if (curTab && curTab.idx > 0) { curTab.idx--; navigate(curTab.hist[curTab.idx], curTab, false); } });
      body.querySelector(".b-fwd").addEventListener("click", () => { if (curTab && curTab.idx < curTab.hist.length - 1) { curTab.idx++; navigate(curTab.hist[curTab.idx], curTab, false); } });
      body.querySelector(".b-home").addEventListener("click", () => navigate("intranet.home"));
      urlEl.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        const v = urlEl.value.trim().toLowerCase();
        if (!v) return;
        Audio2.key();
        if (resolvePage(v)) navigate(v);
        else if (v.includes("youtube") || v.includes("catpipe")) navigate("catpipe.tv");
        else navigate("search:" + v);
      });
      // bookmarks
      const bm = body.querySelector(".br-bookmarks");
      for (const b of BOOKMARKS) {
        const btn = el("button", "br-bm", b.label);
        btn.addEventListener("click", () => { Audio2.click(); navigate(b.url); });
        bm.appendChild(btn);
      }
      // restore last url or home
      const argsUrl = w.args.url || (w.args.home ? "intranet.home" : null);
      newTab(argsUrl || "intranet.home");
    },
    onArgs(win, args) { /* future deep links */ },
  };

  function wireLinks(root, go) {
    root.querySelectorAll("[data-url]").forEach(a => {
      a.addEventListener("click", e => { e.preventDefault(); Audio2.click(); go(a.dataset.url); });
    });
  }

  /* ================= fake site renderers ================= */
  const PAGES = {
    "intranet.home": {
      title: "Synergy Intranet",
      render(page, emp, go) {
        const day = (SIM.day - 1) % 5;
        page.innerHTML = `<div class="web web-intranet">
          <div class="wi-header">
            <span class="logo">✳️ Synergy Intranet</span>
            <span class="wi-nav"><a href="#" data-url="intranet.wiki/onboarding">Wiki</a><a href="#" data-url="hr.portal">HR</a><a href="#" data-url="ticket.sys">Tickets</a><a href="#" data-url="redd.it">Lounge</a></span>
          </div>
          <div class="wi-body">
            <div class="wi-card"><h3>📌 Announcements</h3>
              <p><span class="wi-tag eng">eng</span>GLASSWING v0.9 shipped — 94.2% on evals. Confetti is in the kitchen.</p>
              <p><span class="wi-tag hr">hr</span>Fire drill ${SIM.day % 2 ? "Thursday" : "next Thursday"}. It's mandatory. The alarm is not a suggestion.</p>
              <p><span class="wi-tag fun">fun</span>Ping-pong bracket signups close Friday. Current champion: Biscuit (disqualified, still champion).</p>
            </div>
            <div class="wi-card"><h3>🍜 Cafeteria — this week</h3>
              <table class="wi-menu">${INTRANET.lunchMenu.map((r, i) => `<tr style="${i === day ? "font-weight:700" : ""}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}</table>
              <p style="font-size:11px;color:#889">Friday is taco day. HR is not liable for the line.</p>
            </div>
            <div class="wi-card"><h3>Quick links</h3>
              <p><a href="#" data-url="intranet.wiki/ai-model">Project GLASSWING notes</a> · <a href="#" data-url="intranet.wiki/brand">Brand guidelines</a> · <a href="#" data-url="intranet.wiki/onboarding">Onboarding</a> · <a href="#" data-url="catpipe.tv">CatPipe (approved video platform™)</a></p>
            </div>
            <div class="wi-card"><h3>🚀 Project updates</h3>
              ${(SAVE.projects.filter(p => p.status === "active").map(p => `<p><span class="wi-tag eng">${Math.round(p.workDone / p.workRequired * 100)}%</span><b>${p.name}</b> — due day ${p.deadlineDay}</p>`).join("") || "<p>No active projects. The wiki editor is getting restless.</p>")}
            </div>
            <div class="wi-card" style="background:#fffbe6"><h3>☕ Coffee machine status</h3>
              <p id="coffee-status">Checking…</p>
            </div>
          </div></div>`;
        const cs = page.querySelector("#coffee-status");
        cs.innerHTML = SIM.event && SIM.event.type === "coffeeBroke"
          ? "❌ <b>DOWN.</b> A technician has been dispatched. The technician is hiding."
          : "✅ <b>Operational.</b> Pods remaining: yes. Morale: pending.";
        wireLinks(page, go);
      },
    },

    "hr.portal": {
      title: "HR Portal",
      render(page, emp, go) {
        page.innerHTML = `<div class="web web-intranet"><div class="wi-header" style="background:linear-gradient(90deg,#c0392b,#e67e22)"><span class="logo">🧑‍💼 HR Portal</span></div>
          <div class="wi-body">
            <div class="wi-card"><h3>Your benefits</h3>
              <p>• Dental: ✅ &nbsp; Vision: ✅ &nbsp; Emotional support keyboard: <b>pending review</b></p>
              <p>• PTO days: 23 (see individual email for passive-aggressive reminder)</p>
            </div>
            <div class="wi-card"><h3>Latest from Dana</h3>
              ${INTRANET.hrEmails.slice(0, 3).map(m => `<p><b>${m.subject}</b></p><p style="white-space:pre-wrap">${m.body}</p><hr style="border:none;border-top:1px solid #eee;margin:10px 0">`).join("")}
            </div>
            <div class="wi-card"><h3>Office policy highlights</h3>
              <p>§4.1 — The microwave beep may be muted. The smell may not.</p>
              <p>§7.2 — "Quick sync" meetings must be under 15 minutes or the organizer owes everyone pastries.</p>
              <p>§9.9 — Do not challenge Biscuit to a staring contest. You will lose.</p>
            </div>
          </div></div>`;
      },
    },

    "ticket.sys": {
      title: "Ticket System",
      render(page, emp, go) {
        page.innerHTML = `<div class="web web-intranet"><div class="wi-header" style="background:#334"><span class="logo">🎫 IT Tickets</span></div>
          <div class="wi-body">
            ${[["#4402", "Printer emits low-frequency chanting", "OPEN", "#e67e22"],
               ["#4415", "PR review requested 3 days ago", "OPEN", "#e67e22"],
               ["#4471", "Printer possessed (dup of #4402)", "RESOLVED", "#27ae60"],
               ["#4488", "Coffee machine wants a firmware update", "WONTFIX", "#888"],
               ["#4501", "Intern submitted PR titled 'oops'", "OPEN", "#e67e22"],
               ["#4512", "GLASSWING keeps signing emails 'Warm regards, GLASSWING'", "WONTFIX", "#888"]]
              .map(t => `<div class="wi-card"><b>${t[0]}</b> — ${t[1]} <span class="wi-tag" style="background:${t[3]}22;color:${t[3]}">${t[2]}</span></div>`).join("")}
            <div class="wi-card"><button class="btn" style="background:#4f8cff;color:#fff;border:none" id="new-ticket">＋ New ticket</button>
            <span id="ticket-msg" style="margin-left:10px;font-size:12px;color:#666"></span></div>
          </div></div>`;
        page.querySelector("#new-ticket").addEventListener("click", () => {
          page.querySelector("#ticket-msg").textContent = "Ticket #" + (4500 + ((Math.random() * 900) | 0)) + " created. IT responds in 2-5 business eternities.";
          Audio2.pop();
        });
      },
    },

    "redd.it": {
      title: "Redddit",
      render(page, emp, go) {
        const live = (Apps.CHATS.random || []).slice(-3).map(m => ({
          votes: (100 + ((Math.random() * 900) | 0)) + "", user: "u/" + m.who.split(" ")[0].toLowerCase(), title: m.text, body: "", comments: [],
        }));
        const posts = [...live, ...INTRANET.reddit.staticPosts];
        page.innerHTML = `<div class="web"><div class="rd-header">👾 Redddit <span class="rd-sub">r/SynergyLabs · ${12 + ((Math.random() * 40) | 0)} online (mostly hiding)</span></div>
          <div class="rd-body">
            ${posts.map(p => `<div class="rd-post">
              <div class="votes">▲ ${p.votes}</div>
              <div class="title">${p.title}</div>
              <div class="meta">posted by ${p.user} · ${1 + ((Math.random() * 8) | 0)}h ago</div>
              ${p.body ? `<p style="font-size:13px;margin-top:6px">${p.body}</p>` : ""}
              ${(p.comments || []).map(c => `<div class="comments"><div class="rd-cmt"><span class="who">${c[0]}</span><br>${c[1]}</div></div>`).join("")}
            </div>`).join("")}
          </div></div>`;
        unlockAchievement("gossip");
      },
    },

    "catpipe.tv": {
      title: "CatPipe",
      render(page, emp, go) {
        page.innerHTML = `<div class="web"><div class="vt-header"><span class="vt-logo">▶ CatPipe</span><span style="color:#888;font-size:12px">the only video platform IT approves of</span></div>
          <div class="vt-body"><div class="vt-grid">
            ${VIDEOS.map(v => `<div class="vt-card" data-vid="${v.id}">
              <div class="vt-thumb" style="background:${v.bg}"><span>${v.emoji}</span><span class="dur">${v.dur}</span></div>
              <div class="vt-title">${v.title}</div>
              <div class="vt-meta">${v.chan} · ${v.tag}</div>
            </div>`).join("")}
          </div></div></div>`;
        page.querySelectorAll(".vt-card").forEach(c => {
          c.addEventListener("click", () => { Audio2.click(); go("watch:" + c.dataset.vid); });
        });
      },
    },

    "intranet.wiki/onboarding": { title: "Wiki: Onboarding", render: wikiPage("onboarding") },
    "intranet.wiki/brand": { title: "Wiki: Brand", render: wikiPage("brand") },
    "intranet.wiki/ai-model": { title: "Wiki: GLASSWING", render: wikiPage("ai-model") },

    "watch:dQw4w9WgXcQ": null, // handled by watch: prefix
  };

  function wikiPage(key) {
    return (page, emp, go) => {
      const p = INTRANET.wikiPages[key];
      page.innerHTML = `<div class="web web-intranet"><div class="wi-header"><span class="logo">📖 Synergy Wiki</span></div>
        <div class="wi-body"><div class="wi-card"><h3>${p.title}</h3><p style="white-space:pre-wrap">${p.body}</p></div>
        <p><a href="#" data-url="intranet.home">← intranet home</a></p></div></div>`;
      wireLinks(page, go);
    };
  }

  /* watch pages (any watch:ID) */
  const realWatch = PAGES["intranet.wiki/onboarding"]; // keep reference intact
  PAGES["watch:dQw4w9WgXcQ"] = watchPage;
  function watchPage(page, emp, go, vid) {
    if (!vid) return;
    const v = VIDEOS.find(x => x.id === vid) || { id: vid, title: "Video", chan: "YouTube", emoji: "🎬", bg: "#222" };
    page.innerHTML = `<div class="web"><div class="vt-body vt-watch">
      <div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${v.title}"></iframe></div>
      <h1>${v.title}</h1>
      <div class="chan">${v.chan} · via CatPipe (approved™) · <a href="#" data-url="catpipe.tv">← all videos</a></div>
      <p style="color:#888;font-size:12px;margin-top:8px">If the video doesn't load, IT has blocked youTube again. Try the intranet. Or work.</p>
    </div></div>`;
    unlockAchievement("youtube");
    SAVE.stats.videosWatched++;
    if (vid === "dQw4w9WgXcQ") unlockAchievement("rick");
    wireLinks(page, go);
  }

  /* search */
  PAGES.search = (query) => ({
    title: query,
    render(page, emp, go) {
      const q = query;
      const results = [];
      if (q.includes("look busy") || q.includes("pretend")) {
        results.push({ t: "HOW TO LOOK BUSY — field guide (PDF)", u: "intranet.wiki/onboarding › productivity", d: "The definitive guide. Step 4 is the most important. Do not print. Dana reads the print logs." , go: "search:how to look busy secret" });
      }
      if (q.includes("cat") || q.includes("video") || q.includes("youtube")) {
        results.push({ t: "CatPipe — approved video platform™", u: "catpipe.tv", d: "12 videos about cats, redstone, and the passage of time." });
      }
      if (q.includes("coffee")) results.push({ t: "Coffee machine descaling guide", u: "ticket.sys › #4488", d: "Warning: the machine remembers. It always remembers." });
      if (q.includes("ai") || q.includes("attention")) results.push({ t: "Project GLASSWING — internal notes", u: "intranet.wiki/ai-model", d: "94.2% on evals. 100% on signing emails 'Warm regards, GLASSWING'." });
      results.push(
        { t: q + " — Synergy Wiki results", u: "intranet.wiki/onboarding", d: `The wiki has opinions about "${q}". Most of them end in a fire drill.` },
        { t: `${q} | Redddit discussions`, u: "redd.it", d: "342 comments. 340 are jokes. 2 are HR complaints." },
        { t: `Buy ${q} online`, u: "blocked.by.it", d: "This domain is blocked. IT's allowlist has 7 sites. This is not one of them." },
      );
      page.innerHTML = `<div class="web"><div class="sr-body">
        <div class="sr-logo"><b>Goo</b><b>gle</b><b>-ish</b><b> (</b><b>call </b><b>it )</b></div>
        <div style="font-size:12px;color:#777;margin-bottom:14px">About ${100 + ((Math.random() * 9000) | 0)} results (0.${1 + ((Math.random() * 8) | 0)} seconds, filtered by IT)</div>
        ${results.map(r => `<div class="sr-res"><div class="u">${r.u}</div><div class="t" data-url="${r.go || r.u}">${r.t}</div><div class="d">${r.d}</div></div>`).join("")}
      </div></div>`;
      wireLinks(page, (url) => {
        if (url && url.startsWith("search:")) { const inner = url.slice(7); if (inner.includes("secret")) { Desktop.openApp("busysim"); unlockAchievement("busy"); return; } PAGES.search(inner).render(page, emp, go); return; }
        go(url);
      });
    },
  });

  /* resolve pages at show() time: watch: and search: are dynamic */
  const origShow = null;
  // monkey-patch registry browser render already wired; patch the page lookup used in show()
  const _PAGES = PAGES;
  Apps.registry.browser._pages = PAGES;
})();
