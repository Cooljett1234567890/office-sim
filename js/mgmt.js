/* ===== mgmt.js — management applications on the boss's AcornOS ===== */
"use strict";

/* ---------- SynergyHQ dashboard ---------- */
Apps.registry.mgmt = {
  title: "SynergyHQ", icon: "📊", w: 860, h: 580,
  render(body, w, emp) {
    body.innerHTML = `<div class="settings">
      <div class="set-nav"></div>
      <div class="set-body"></div>
    </div>`;
    const nav = body.querySelector(".set-nav"), page = body.querySelector(".set-body");
    const tabs = [["overview", "📈 Overview"], ["projects", "🚀 Projects"], ["roster", "🧑‍🤝‍🧑 Roster"], ["expansion", "🏗 Expansion"], ["reports", "📝 Reports"], ["save", "💾 Save"]];
    let cur = w.args.tab || "overview";
    function renderNav() {
      nav.innerHTML = "";
      for (const [id, label] of tabs) {
        const d = el("div", id === cur ? "active" : "", label);
        d.addEventListener("click", () => { cur = id; renderNav(); renderPage(); Audio2.click(); });
        nav.appendChild(d);
      }
    }
    function renderPage() {
      page.innerHTML = "";
      if (cur === "overview") pageOverview();
      else if (cur === "projects") pageProjects();
      else if (cur === "roster") pageRoster();
      else if (cur === "expansion") pageExpansion();
      else if (cur === "reports") pageReports();
      else if (cur === "save") pageSave();
    }

    /* ----- overview ----- */
    function pageOverview() {
      const c = SAVE.company;
      page.appendChild(el("h2", "", `Company Overview — Day ${SIM.day}`));
      const stats = el("div", "hq-grid");
      stats.innerHTML = `
        <div class="hq-stat"><div class="hq-num ${c.cash < 5000 ? "neg" : ""}">$${Math.round(c.cash).toLocaleString()}</div><div class="hq-lbl">Cash</div></div>
        <div class="hq-stat"><div class="hq-num">${Company.runwayDays()}</div><div class="hq-lbl">Runway</div></div>
        <div class="hq-stat"><div class="hq-num">$${Math.round(Company.dailyRevenue()).toLocaleString()}</div><div class="hq-lbl">Daily revenue</div></div>
        <div class="hq-stat"><div class="hq-num">$${Math.round(Company.dailyExpenses()).toLocaleString()}</div><div class="hq-lbl">Daily expenses</div></div>
        <div class="hq-stat"><div class="hq-num">${c.reputation}</div><div class="hq-lbl">Reputation</div></div>
        <div class="hq-stat"><div class="hq-num">${Math.round(Investors.averageConfidence())}%</div><div class="hq-lbl">Avg investor confidence</div></div>
      `;
      page.appendChild(stats);
      // cash sparkline
      const cv = el("canvas", "");
      cv.width = 760; cv.height = 160; cv.style.cssText = "width:100%;background:rgba(0,0,0,.25);border-radius:10px;margin-top:10px";
      page.appendChild(cv);
      const ctx2 = cv.getContext("2d");
      const led = c.ledger.slice(-30);
      if (led.length > 1) {
        const min = Math.min(...led.map(l => l.cash)), max = Math.max(...led.map(l => l.cash));
        const px = i => 20 + i / (led.length - 1) * (cv.width - 40);
        const py = v => cv.height - 20 - (v - min) / Math.max(1, max - min) * (cv.height - 40);
        ctx2.strokeStyle = "#4f8cff"; ctx2.lineWidth = 2; ctx2.beginPath();
        led.forEach((l, i) => i ? ctx2.lineTo(px(i), py(l.cash)) : ctx2.moveTo(px(i), py(l.cash)));
        ctx2.stroke();
        ctx2.fillStyle = "#9aa0b4"; ctx2.font = "11px Segoe UI";
        ctx2.fillText(`$${Math.round(max).toLocaleString()}`, 8, 14);
        ctx2.fillText(`$${Math.round(min).toLocaleString()}`, 8, cv.height - 6);
      } else {
        ctx2.fillStyle = "#9aa0b4"; ctx2.font = "13px Segoe UI";
        ctx2.fillText("Ledger fills in as days pass. Finance is a patient art.", 20, 80);
      }
      // quick alerts
      const alerts = [];
      if (c.cash < 5000) alerts.push("🚨 Cash is critically low.");
      const late = Company.activeProjects().filter(p => SIM.day >= p.deadlineDay);
      if (late.length) alerts.push(`⏰ ${late.length} project(s) past deadline.`);
      for (const inv of SAVE.investors) if (inv.confidence < 30) alerts.push(`📉 ${INVESTOR_DEFS[inv.id].name.split("—")[0].trim()} confidence is at ${inv.confidence | 0}%.`);
      if (alerts.length) page.appendChild(el("div", "hq-alerts", alerts.join("<br>")));
    }

    /* ----- projects ----- */
    function pageProjects() {
      page.appendChild(el("h2", "", "Projects"));
      for (const p of SAVE.projects.filter(x => x.status === "active")) {
        const pct = Math.min(100, p.workDone / p.workRequired * 100);
        const daysLeft = p.deadlineDay - SIM.day;
        const card = el("div", "wi-card-dark");
        card.innerHTML = `
          <b>${p.name}</b> ${daysLeft < 1 ? '<span class="hq-tag red">DUE TODAY</span>' : daysLeft <= 1 ? `<span class="hq-tag red">${daysLeft} day left</span>` : `<span class="hq-tag">${daysLeft} days left</span>`}
          <div class="hq-progress"><span style="width:${pct}%"></span></div>
          <div class="hq-muted">${Math.round(p.workDone)}/${p.workRequired} work · quality ${p.quality | 0}/100 · payout $${p.budget.toLocaleString()} · team: ${p.assigned.map(id => (getEmp(id) || { first: "?" }).first).join(", ") || "unassigned"}</div>
          <div class="ip-actions" style="padding:6px 0 0">
            <button data-assign="${p.id}">＋ Auto-assign best fit</button>
            <button data-ask="${p.id}">🤝 Ask investor for deadline extension</button>
          </div>`;
        page.appendChild(card);
      }
      for (const p of SAVE.projects.filter(x => x.status !== "active").slice(-4)) {
        page.appendChild(el("div", "hq-muted", `${p.status === "done" ? "✅" : "💥"} ${p.name} — ${p.status === "done" ? "shipped" : "failed"} (day ${p.deadlineDay})`));
      }
      // offers
      page.appendChild(el("h3", "", "New project blueprints"));
      const offers = SAVE.projectOffers.length ? SAVE.projectOffers : PROJECT_BLUEPRINTS.filter(b => !SAVE.projects.some(p => p.bpId === b.id && p.status === "active")).map(b => b.id);
      for (const bpId of offers) {
        const bp = PROJECT_BLUEPRINTS.find(x => x.id === bpId);
        if (!bp) continue;
        const card = el("div", "wi-card-dark");
        card.innerHTML = `<b>${bp.name}</b> <span class="hq-tag">${bp.tags.join(", ")}</span><br>
          <span class="hq-muted">${bp.desc}</span><br>
          <span class="hq-muted">Cost $${bp.cost.toLocaleString()} · Payout ~$${bp.budget.toLocaleString()} · ${bp.work} work · ${bp.days} day deadline · needs ${bp.minStaff}</span>
          <div class="ip-actions" style="padding:6px 0 0"><button data-start="${bp.id}">▶ Start project</button></div>`;
        page.appendChild(card);
      }
      page.querySelectorAll("[data-start]").forEach(b => b.addEventListener("click", () => {
        const bp = PROJECT_BLUEPRINTS.find(x => x.id === b.dataset.start);
        const r = Company.newProject(bp);
        if (r.ok) { Company.assignAuto(r.project); officeToast(`🚀 Project started: ${bp.name}`); renderPage(); }
        else showErr(page, r.reason);
      }));
      page.querySelectorAll("[data-assign]").forEach(b => b.addEventListener("click", () => {
        const p = Company.projectById(+b.dataset.assign);
        Company.assignAuto(p);
        officeToast(`📋 Auto-assigned to ${p.name}.`);
        renderPage();
      }));
      page.querySelectorAll("[data-ask]").forEach(b => b.addEventListener("click", () => {
        const p = Company.projectById(+b.dataset.ask);
        p.deadlineDay += 2;
        for (const inv of SAVE.investors) inv.confidence = clamp(inv.confidence - 3, 0, 100);
        officeToast(`🤝 ${p.name} deadline extended by 2 days. Investors sighed audibly.`);
        Investors.evaluate("deadlineMissed", null);
        renderPage();
      }));
    }

    /* ----- roster ----- */
    function pageRoster() {
      page.appendChild(el("h2", "", `Roster — ${SIM.employees.filter(e => e.status === "active").length} active`));
      for (const e of SIM.employees.filter(x => x.status === "active")) {
        const proj = e.assignment ? Company.projectById(e.assignment) : null;
        const card = el("div", "wi-card-dark roster-row");
        card.innerHTML = `
          <b>${e.name}</b> <span class="hq-tag">${e.role}</span> <span class="hq-muted">$${e.salary.toLocaleString()}/mo · day ${e.hiredDay}</span><br>
          <span class="hq-muted">morale ${e.morale | 0}% · stress ${e.stress | 0}% · code ${e.skills.code} design ${e.skills.design} social ${e.skills.social} · ${e.sickToday ? "out sick" : "present"} · on: <b>${proj ? proj.name : "—"}</b></span>
          <div class="ip-actions" style="padding:6px 0 0">
            <button data-a="bonus">💵 +$500 bonus</button>
            <button data-a="promote">🏅 Promote</button>
            <button data-a="warn">⚠️ Warn</button>
            <button data-a="fire" class="ip-danger">📦 Fire</button>
          </div>`;
        page.appendChild(card);
        card.querySelector('[data-a="bonus"]').addEventListener("click", () => { const r = Company.bonus(e, 500); if (!r.ok) showErr(page, r.reason); renderPage(); });
        card.querySelector('[data-a="promote"]').addEventListener("click", () => { Company.promote(e); renderPage(); });
        card.querySelector('[data-a="warn"]').addEventListener("click", () => { Company.warn(e); renderPage(); });
        card.querySelector('[data-a="fire"]').addEventListener("click", () => {
          if (confirm(`Fire ${e.name}? Coworkers will remember this.`)) { Company.fire(e); renderPage(); }
        });
      }
      if (SAVE.firedEmployees.length) {
        page.appendChild(el("h3", "", "Former employees (the wall of quiet)"));
        for (const f of SAVE.firedEmployees) page.appendChild(el("div", "hq-muted", `📦 ${f.name} — ${f.role} — fired day ${f.day} (${f.reason})`));
      }
    }

    /* ----- expansion ----- */
    function pageExpansion() {
      page.appendChild(el("h2", "", "Expansion & Facilities"));
      const deskCard = el("div", "wi-card-dark");
      deskCard.innerHTML = `<b>🪑 Annex desk</b> — $${DESK_PRICE.toLocaleString()}<br><span class="hq-muted">Adds a real desk + computer to the annex. Required for hiring beyond ${DESKS.length} seats.</span><br><span class="hq-muted">Owned: ${SAVE.expandedDesks}/${ANNEX_DESKS.length} · Free desks now: ${Company.freeDesks().length}</span>
        <div class="ip-actions" style="padding:6px 0 0"><button id="buyDesk">🛒 Order desk</button></div>`;
      page.appendChild(deskCard);
      page.querySelector("#buyDesk").addEventListener("click", () => { const r = Company.buyDesk(); if (!r.ok) showErr(page, r.reason); renderPage(); });
      for (const f of FACILITIES) {
        const owned = SAVE.facilities.includes(f.id);
        const card = el("div", "wi-card-dark");
        card.innerHTML = `<b>${f.icon} ${f.name}</b> — $${f.cost.toLocaleString()} ${owned ? '<span class="hq-tag">owned</span>' : ""}<br><span class="hq-muted">${f.desc}</span>
          <div class="ip-actions" style="padding:6px 0 0">${owned ? "" : `<button data-f="${f.id}">🛒 Buy</button>`}</div>`;
        page.appendChild(card);
        const b = card.querySelector(`[data-f="${f.id}"]`);
        if (b) b.addEventListener("click", () => { const r = Company.buyFacility(f); if (!r.ok) showErr(page, r.reason); renderPage(); });
      }
    }

    /* ----- reports ----- */
    function pageReports() {
      page.appendChild(el("h2", "", "Financial report"));
      page.appendChild(el("div", "viewer-body code", Company.reportText()));
    }

    /* ----- save ----- */
    function pageSave() {
      page.appendChild(el("h2", "", "Save management"));
      const b1 = el("button", "btn", "💾 Save now");
      b1.addEventListener("click", () => { writeSave(); officeToast("💾 Game saved."); });
      const b2 = el("button", "btn", "📤 Export save");
      const ta = el("textarea", "inp", "");
      ta.style.cssText = "width:100%;height:120px;margin-top:8px;font-family:Consolas,monospace;font-size:11px";
      b2.addEventListener("click", () => { ta.value = Persistence.exportSave(); ta.select(); try { document.execCommand("copy"); } catch (e) {} });
      const b3 = el("button", "btn", "📥 Import save");
      b3.addEventListener("click", () => {
        try {
          const s = Persistence.importSave(ta.value);
          SAVE = s; writeSave(); location.reload();
        } catch (e) { alert("Import failed: " + e.message); }
      });
      const b4 = el("button", "btn ip-danger", "🗑 New game (wipes save)");
      b4.addEventListener("click", () => {
        if (confirm("Wipe this save and start a brand-new company? The memories… will literally be gone.")) {
          Persistence.wipe(); location.reload();
        }
      });
      const row = el("div", "set-row");
      row.append(b1, " ", b2, " ", b3, " ", b4);
      page.appendChild(row);
      page.appendChild(el("div", "set-row", "<label>Save JSON (export/import)</label>"));
      page.appendChild(ta);
      page.appendChild(el("p", "hq-muted", "Saves are versioned. Old saves migrate automatically — your Day-N office, memories, files and finances all survive updates."));
    }

    renderNav(); renderPage();
  },
};

function showErr(page, msg) { page.appendChild(el("div", "hq-alerts", "⚠️ " + msg)); setTimeout(() => { const a = page.querySelector(".hq-alerts"); if (a) a.remove(); }, 3500); }

/* ---------- Investor Relations ---------- */
Apps.registry.ir = {
  title: "Investor Relations", icon: "🤝", w: 820, h: 540,
  render(body, w, emp) {
    body.innerHTML = `<div class="set-body" style="height:100%"></div>`;
    const page = body.querySelector(".set-body");
    function render() {
      page.innerHTML = "";
      page.appendChild(el("h2", "", `Investor Relations — avg confidence ${Math.round(Investors.averageConfidence())}%`));
      for (const inv of SAVE.investors) {
        const def = INVESTOR_DEFS[inv.id];
        const card = el("div", "wi-card-dark");
        const mood = inv.confidence > 70 ? "happy" : inv.confidence > 40 ? "neutral" : "angry";
        const moodFace = inv.withdrew ? "🚪" : mood === "happy" ? "🙂" : mood === "neutral" ? "😐" : "😠";
        card.innerHTML = `
          <b>${def.icon} ${def.name}</b> <span class="hq-tag">${def.style}</span> ${inv.withdrew ? '<span class="hq-tag red">WITHDRAWN</span>' : ""}<br>
          <span class="hq-muted">${def.bio}</span>
          <div class="hq-progress"><span style="width:${inv.confidence}%;background:${inv.confidence > 60 ? "#59c98f" : inv.confidence > 35 ? "#f0a45c" : "#e57373"}"></span></div>
          <div class="hq-muted">confidence ${inv.confidence | 0}% · invested $${inv.invested.toLocaleString()} · cares about: <b>${def.expect}</b> ${moodFace}</div>
          <div class="ip-actions" style="padding:6px 0 0">
            <button data-act="present">📊 Present quarterly report</button>
            <button data-act="funding">💰 Request $10,000</button>
            <button data-act="promise">🤞 Make a promise</button>
          </div>
          <div class="hq-muted" data-out="${inv.id}"></div>`;
        page.appendChild(card);
        card.querySelector('[data-act="present"]').addEventListener("click", () => {
          const rev = Company.dailyRevenue(), exp = Company.dailyExpenses();
          const active = Company.activeProjects();
          const avgQ = active.length ? active.reduce((s, p) => s + p.quality, 0) / active.length : 55;
          Investors.evaluate("projectDone", { grade: avgQ >= 64 ? "A" : "C" });
          const out = card.querySelector(`[data-out="${inv.id}"]`);
          out.innerHTML = `You presented: revenue $${Math.round(rev).toLocaleString()}/day, expenses $${Math.round(exp).toLocaleString()}/day, ${active.length} active projects.<br>“${pick(INVESTOR_DEFS[inv.id].lines[mood === "angry" ? "angry" : "happy"])}”`;
          Audio2.chime();
          Persistence.write();
        });
        card.querySelector('[data-act="funding"]').addEventListener("click", () => {
          const r = Investors.requestFunding(inv, 10000);
          const out = card.querySelector(`[data-out="${inv.id}"]`);
          if (r.ok) { out.innerHTML = `✅ Approved! $${r.given.toLocaleString()} wired. “${r.line}”`; officeToast(`💰 ${def.name.split("—")[0].trim()} invested $${r.given.toLocaleString()}!`, "gold"); }
          else out.innerHTML = `❌ Declined. “${r.line}”<br><span class="hq-muted">Hint: ${r.hint}</span>`;
        });
        card.querySelector('[data-act="promise"]').addEventListener("click", () => {
          const active = Company.activeProjects();
          if (!active.length) { out(); return; }
          const p = active[0];
          const pr = { id: "pr" + Date.now(), investor: inv.id, text: `Finish ${p.name} by day ${p.deadlineDay}`, dueDay: p.deadlineDay, projectId: p.id, met: false };
          SAVE.promises.push(pr);
          inv.promises.push(pr.id);
          const out = card.querySelector(`[data-out="${inv.id}"]`);
          out.innerHTML = `🤞 Promise made: “${pr.text}”. Break it and confidence drops hard.`;
          Memory.record("promise", [], { text: pr.text, investor: inv.id });
          Persistence.write();
        });
      }
      if (Investors.averageConfidence() > 70 && !SAVE.investors.some(i => i.id === "impatient" && i.invested > 0)) {
        const hook = el("div", "hq-alerts", "⚡ New investor interest! RicoTanaka (impatient angel) wants in — ask him for funding in his panel.");
        page.appendChild(hook);
      }
    }
    render();
  },
};

/* ---------- Hiring board ---------- */
Apps.registry.hire = {
  title: "Hiring Board", icon: "🧑‍💼", w: 700, h: 520,
  render(body, w, emp) {
    body.innerHTML = `<div class="set-body" style="height:100%"></div>`;
    const page = body.querySelector(".set-body");
    let candidates = Company.genCandidates(3);
    function render() {
      page.innerHTML = "";
      page.appendChild(el("h2", "", "Hiring Board"));
      page.appendChild(el("div", "hq-muted", `Onboarding kit: $1,200 · free desks: ${Company.freeDesks().length} ${Company.freeDesks().length ? "" : "— buy one in SynergyHQ → Expansion"}`));
      for (const cand of candidates) {
        const card = el("div", "wi-card-dark");
        card.innerHTML = `
          <b>${cand.name}</b> — ${cand.role} <span class="hq-tag">${cand.personality.replace(/([A-Z])/g, " $1").toLowerCase()}</span><br>
          <span class="hq-muted">${cand.blurb}</span><br>
          <span class="hq-muted">code ${cand.skills.code} · design ${cand.skills.design} · social ${cand.skills.social} · asking $${cand.ask.toLocaleString()}/mo</span>
          <div class="ip-actions" style="padding:6px 0 0"><button data-h="${candidates.indexOf(cand)}">✅ Hire</button></div>`;
        page.appendChild(card);
      }
      page.querySelectorAll("[data-h]").forEach(b => b.addEventListener("click", () => {
        const r = Company.hire(candidates[+b.dataset.h]);
        if (r.ok) {
          officeToast(`🧑‍💼 ${r.emp.name} hired as ${r.emp.role}! They start immediately.`, "gold");
          candidates = Company.genCandidates(3);
          render();
        } else showErr(page, r.reason);
      }));
      const refresh = el("button", "btn", "🔄 New candidate pool ($200)");
      refresh.addEventListener("click", () => {
        if (SAVE.company.cash < 200) { showErr(page, "Need $200 for the job-post boost."); return; }
        SAVE.company.cash -= 200;
        candidates = Company.genCandidates(3);
        render();
      });
      page.appendChild(el("div", "", "<br>"));
      page.appendChild(refresh);
    }
    render();
  },
};
