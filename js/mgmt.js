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
    const tabs = [["overview", "📈 Overview"], ["projects", "🚀 Projects"], ["teams", "👥 Teams"], ["launch", "🛰 GLASSWING"], ["roster", "🧑‍🤝‍🧑 Roster"], ["expansion", "🏗 Expansion"], ["reports", "📝 Reports"], ["save", "💾 Save"]];
    let cur = w.args.tab || "overview";
    let selProject = w.args.projectId || null;
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
      else if (cur === "teams") pageTeams();
      else if (cur === "launch") pageLaunch();
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
      const st = (window.Product && Product.status()) ? Product.summary() : null;
      stats.innerHTML = `
        <div class="hq-stat"><div class="hq-num ${c.cash < 5000 ? "neg" : ""}">$${Math.round(c.cash).toLocaleString()}</div><div class="hq-lbl">Cash</div></div>
        <div class="hq-stat"><div class="hq-num">${Company.runwayDays()}</div><div class="hq-lbl">Runway</div></div>
        <div class="hq-stat"><div class="hq-num">$${Math.round(Company.dailyRevenue()).toLocaleString()}</div><div class="hq-lbl">Daily revenue${st ? `<br><span style="font-size:10px">incl. GLASSWING $${Math.round(st.dayRevenue).toLocaleString()}</span>` : ""}</div></div>
        <div class="hq-stat"><div class="hq-num">$${Math.round(Company.dailyExpenses()).toLocaleString()}</div><div class="hq-lbl">Daily expenses${st ? `<br><span style="font-size:10px">incl. product $${Math.round(st.dayCosts).toLocaleString()}</span>` : ""}</div></div>
        <div class="hq-stat"><div class="hq-num">${c.reputation}</div><div class="hq-lbl">Reputation</div></div>
        <div class="hq-stat"><div class="hq-num">${Math.round(Investors.averageConfidence())}%</div><div class="hq-lbl">Avg investor confidence</div></div>
        ${st ? `<div class="hq-stat"><div class="hq-num">$${Math.round(st.mrr).toLocaleString()}</div><div class="hq-lbl">GLASSWING MRR</div></div><div class="hq-stat"><div class="hq-num">${st.customers.toLocaleString()}</div><div class="hq-lbl">GLASSWING customers</div></div>` : ""}
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
      if (window.Product && !Product.status()) {
        const rr = Product.readiness();
        if (rr.ok) alerts.push("🛰 GLASSWING is launch-ready — pick a monetization model in the 🛰 GLASSWING tab.");
      }
      const openPromises = SAVE.promises.filter(x => !x.met && !x.broken);
      if (openPromises.length) alerts.push(`🤞 ${openPromises.length} open investor promise(s): ${openPromises[0].text} (due day ${openPromises[0].dueDay}).`);
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
            <button data-team="${p.id}">👥 Manage team</button>
            <button data-assign="${p.id}">＋ Auto-assign best fit</button>
            <button data-ask="${p.id}">🤝 Ask investor for deadline extension</button>
            ${p.bpId === "glasswing10" ? '<button data-launch="1">🛰 Launch options</button>' : ""}
          </div>`;
        page.appendChild(card);
      }
      for (const p of SAVE.projects.filter(x => x.status !== "active").slice(-4)) {
        page.appendChild(el("div", "hq-muted", `${p.status === "done" ? "✅" : "💥"} ${p.name} — ${p.status === "done" ? "shipped" : "failed"} (day ${p.deadlineDay})${p.grade ? " — grade " + p.grade : ""}${p.status === "done" ? (p.onTime ? " · on time" : " · LATE") : ""}`));
      }
      // offers (never re-offer a blueprint that already shipped — completion payouts are one-time contracts)
      page.appendChild(el("h3", "", "New project blueprints"));
      const offers = SAVE.projectOffers.length ? SAVE.projectOffers.filter(id => !(PROJECT_BLUEPRINTS.find(x => x.id === id) && SAVE.projects.some(p => p.bpId === id && p.status !== "failed"))) : PROJECT_BLUEPRINTS.filter(b => !SAVE.projects.some(p => p.bpId === b.id && p.status !== "failed")).map(b => b.id);
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
      page.querySelectorAll("[data-team]").forEach(b => b.addEventListener("click", () => {
        selProject = +b.dataset.team; cur = "teams"; renderNav(); renderPage(); Audio2.click();
      }));
      page.querySelectorAll("[data-launch]").forEach(b => b.addEventListener("click", () => {
        cur = "launch"; renderNav(); renderPage(); Audio2.click();
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

    /* ----- project teams ----- */
    function pageTeams() {
      const actives = Company.activeProjects().slice().sort((a, b) => a.deadlineDay - b.deadlineDay || (a.workDone / a.workRequired) - (b.workDone / b.workRequired));
      page.appendChild(el("h2", "", "Project Teams"));
      if (!actives.length) { page.appendChild(el("div", "hq-muted", "No active projects. Start one under 🚀 Projects — blueprints are there.")); return; }
      if (!actives.some(x => x.id === selProject)) selProject = actives[0].id;
      const p = Company.projectById(selProject);
      const selRow = el("div", "set-row");
      const sel = el("select", "inp");
      for (const ap of actives) { const o = el("option"); o.value = ap.id; o.textContent = ap.name + " — due day " + ap.deadlineDay; if (ap.id === selProject) o.selected = true; sel.appendChild(o); }
      sel.addEventListener("change", () => { selProject = +sel.value; renderPage(); });
      selRow.appendChild(sel);
      page.appendChild(selRow);

      const pct = Math.min(100, p.workDone / p.workRequired * 100);
      const daysLeft = p.deadlineDay - SIM.day;
      const urgent = daysLeft <= 2 && pct < 75;
      const belowMin = p.assigned.length <= (p.minNeeded || 1);
      const sum = el("div", "wi-card-dark");
      sum.innerHTML = `
        <b>${p.name}</b> ${urgent ? '<span class="hq-tag red">URGENT</span>' : ""} ${daysLeft < 0 ? '<span class="hq-tag red">OVERDUE</span>' : ""} ${p.tags && p.tags.length ? `<span class="hq-tag">${p.tags.join(", ")}</span>` : ""}
        <div class="hq-progress"><span style="width:${pct}%"></span></div>
        <div class="hq-muted">${Math.round(pct)}% built · quality ${p.quality | 0}/100 · payout $${p.budget.toLocaleString()} · deadline day ${p.deadlineDay} (${daysLeft >= 0 ? daysLeft + " days left" : Math.abs(daysLeft) + " days overdue"}) · wants ${p.minNeeded || 1}+ staff · team ${p.assigned.length}</div>
        <div class="hq-muted">Changes apply immediately and never reset accumulated work or quality.</div>`;
      page.appendChild(sum);

      page.appendChild(el("h3", "", `Current team (${p.assigned.length})`));
      if (!p.assigned.length) page.appendChild(el("div", "hq-muted", "Nobody assigned — progress crawls at +2/day. Assign someone below."));
      for (const id of p.assigned) {
        const e = getEmp(id);
        const row = el("div", "wi-card-dark roster-row");
        if (!e) row.innerHTML = `<span class="hq-muted">former employee #${id} (slot is stale)</span> <button class="ip-danger" data-rm="${id}">✕ Clear slot</button>`;
        else row.innerHTML = `
          <b>${e.name}</b> <span class="hq-tag">${e.role}</span> <span class="hq-muted">code ${e.skills.code} · design ${e.skills.design} · social ${e.skills.social} · morale ${e.morale | 0}% · stress ${e.stress | 0}%${e.sickToday ? ' · <span class="hq-tag red">out sick</span>' : ""}</span>
          <div class="ip-actions"><button data-rm="${id}">✕ Remove from project</button></div>`;
        page.appendChild(row);
      }

      const crew = SIM.employees.filter(x => x.status === "active" && !x.isPlayer);
      let filter = "all";
      const toolbar = el("div", "ip-actions");
      const bAll = el("button", "btn", `All staff (${crew.length})`);
      const bUn = el("button", "btn", `Unassigned only (${crew.filter(x => !x.assignment).length})`);
      const bSug = el("button", "btn", `✨ Suggest team for ${p.name}`);
      toolbar.append(bAll, " ", bUn, " ", bSug);
      page.appendChild(el("h3", "", "Available staff"));
      page.appendChild(toolbar);
      const list = el("div");
      page.appendChild(list);

      function removalRisk() {
        const bits = [];
        if (belowMin) bits.push(`the team would drop to ${p.assigned.length - 1} (wants ${p.minNeeded || 1}+)`);
        if (urgent) bits.push("this project is URGENT and likely to miss its deadline");
        return bits;
      }
      function moveRisk(other) {
        const bits = [];
        if (other && other.assigned.length <= (other.minNeeded || 1)) bits.push(`${other.name} would fall below its minimum crew`);
        const oLeft = other.deadlineDay - SIM.day;
        if (other && oLeft <= 2 && (other.workDone / other.workRequired) < 0.75) bits.push(`${other.name} is urgent (day ${oLeft >= 0 ? oLeft : 0} left)`);
        return bits;
      }
      function renderStaff() {
        list.innerHTML = "";
        const pool = (filter === "unassigned" ? crew.filter(x => !x.assignment) : crew)
          .slice().sort((a, b) => (a.assignment ? 1 : 0) - (b.assignment ? 1 : 0) || Company.skillFit(b, p) - Company.skillFit(a, p));
        if (!pool.length) { list.appendChild(el("div", "hq-muted", "No staff match this filter.")); return; }
        for (const e of pool) {
          const other = e.assignment ? Company.projectById(e.assignment) : null;
          const row = el("div", "wi-card-dark roster-row");
          row.innerHTML = `
            <b>${e.name}</b> <span class="hq-tag">${e.role}</span> ${e.sickToday ? '<span class="hq-tag red">out sick today</span>' : ""} <span class="hq-muted">code ${e.skills.code} · design ${e.skills.design} · social ${e.skills.social} · morale ${e.morale | 0}% · stress ${e.stress | 0}%</span><br>
            <span class="hq-muted">${e.assignment ? (e.assignment === p.id ? "already on this project" : "on: <b>" + (other ? other.name : "?") + "</b>") : "unassigned"}</span>
            <div class="ip-actions">${e.assignment === p.id ? "" : `<button data-add="${e.id}">${e.assignment ? "⇄ Move here" : "＋ Add to project"}</button>`}</div>`;
          row.querySelector("[data-add]") && row.querySelector("[data-add]").addEventListener("click", () => {
            if (other) {
              const risks = moveRisk(other);
              const q = risks.length ? `Move ${e.name} off ${other.name}? This may hurt it: ${risks.join("; ")}.` : `Move ${e.name} from ${other.name} to ${p.name}?`;
              if (!confirm(q)) return;
            }
            Company.assign(e, p);   // assign() unassigns from any other project — a clean "move"
            officeToast(`👥 ${e.first} ${e.assignment === p.id ? "" : ""}→ ${p.name}.`);
            Memory.record("reassigned", [e], { project: p.name, from: other ? other.name : null });
            renderPage();
          });
          list.appendChild(row);
        }
      }
      bAll.addEventListener("click", () => { filter = "all"; renderStaff(); });
      bUn.addEventListener("click", () => { filter = "unassigned"; renderStaff(); });
      page.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => {
        const e = getEmp(+b.dataset.rm);
        const risks = removalRisk();
        if (e && confirm(risks.length ? `Remove ${e.name} from ${p.name}? WARNING: ${risks.join("; ")}.` : `Remove ${getEmp(+b.dataset.rm) ? getEmp(+b.dataset.rm).name : "this slot"} from ${p.name}?`)) {
          Company.unassign(e);
          officeToast(`👥 ${e.name} is unassigned.`);
          renderPage();
        } else if (!e && confirm("Clear this stale slot?")) { Company.unassign({ assignment: +b.dataset.rm }); renderPage(); }
      }));
      bSug.addEventListener("click", () => {
        const need = Math.max(p.minNeeded || 1, 1);
        const ranked = crew.slice().sort((a, b) => Company.skillFit(b, p) - Company.skillFit(a, p)).slice(0, need);
        if (!ranked.length) { showErr(page, "No active employees to suggest."); return; }
        const panel = el("div", "hq-alerts");
        panel.innerHTML = `✨ Suggested for <b>${p.name}</b> (best skill fit): <b>${ranked.map(x => x.name).join(", ")}</b>. ` +
          (ranked.some(x => x.assignment && x.assignment !== p.id) ? "Some are on other projects — moving them will weaken those. " : "") +
          `Apply? <button id="sugYes" class="btn">✅ Apply</button> <button id="sugNo" class="btn">✖ Cancel</button>`;
        page.appendChild(panel);
        panel.querySelector("#sugNo").addEventListener("click", () => panel.remove());
        panel.querySelector("#sugYes").addEventListener("click", () => {
          for (const e of ranked) if (e.assignment !== p.id) Company.assign(e, p);
          officeToast(`✨ Suggested team applied to ${p.name}.`);
          panel.remove(); renderPage();
        });
      });
      renderStaff();
    }

    /* ----- GLASSWING launch ----- */
    function pageLaunch() {
      page.appendChild(el("h2", "", "🛰 GLASSWING — Product Launch"));
      const st = Product.status();
      if (st) {
        const s = Product.summary();
        const m = Product.model(st.monetization);
        const card = el("div", "wi-card-dark");
        card.innerHTML = `
          <b>GLASSWING</b> <span class="hq-tag">${s.modelName}</span> ${s.earlyAccess ? '<span class="hq-tag red">EARLY ACCESS</span>' : ""} <span class="hq-tag">live since day ${s.launchDay}</span>
          <div class="hq-grid" style="margin-top:8px">
            <div class="hq-stat"><div class="hq-num">${s.customers.toLocaleString()}</div><div class="hq-lbl">Customers</div></div>
            <div class="hq-stat"><div class="hq-num">$${Math.round(s.mrr).toLocaleString()}</div><div class="hq-lbl">MRR (est.)</div></div>
            <div class="hq-stat"><div class="hq-num">$${Math.round(s.dayRevenue).toLocaleString()}</div><div class="hq-lbl">Yesterday revenue</div></div>
            <div class="hq-stat"><div class="hq-num">$${Math.round(s.dayCosts).toLocaleString()}</div><div class="hq-lbl">Yesterday costs</div></div>
            <div class="hq-stat"><div class="hq-num">${Math.round(s.satisfaction)}%</div><div class="hq-lbl">Satisfaction</div></div>
            <div class="hq-stat"><div class="hq-num ${s.bugs > 8 ? "neg" : ""}">${s.bugs}</div><div class="hq-lbl">Open bugs</div></div>
            <div class="hq-stat"><div class="hq-num">$${Math.round(s.totalRevenue).toLocaleString()}</div><div class="hq-lbl">Lifetime revenue</div></div>
            <div class="hq-stat"><div class="hq-num">$${Math.round(s.totalCosts).toLocaleString()}</div><div class="hq-lbl">Lifetime costs</div></div>
          </div>
          <div class="hq-muted">GLASSWING contributes <b>$${Math.round(s.dayRevenue).toLocaleString()}/day</b> to company revenue and <b>$${Math.round(s.dayCosts).toLocaleString()}/day</b> to expenses (see Overview). The v1.0 project's $26,000 completion payout was paid once, separately, by the project system.</div>`;
        page.appendChild(card);
        const acts = el("div", "ip-actions");
        acts.append(
          Object.assign(el("button", "btn", "📣 Marketing push ($1,500)"), {}),
          Object.assign(el("button", "btn", "🧰 Support push ($900)"), {}),
          Object.assign(el("button", "btn", "⬆ Ship upgrade ($4,000)"), {})
        );
        page.appendChild(acts);
        const [bm, bs, bu] = acts.querySelectorAll("button");
        bm.addEventListener("click", () => { const r = Product.marketing(); if (!r.ok) showErr(page, r.reason); renderPage(); });
        bs.addEventListener("click", () => { const r = Product.support(); if (!r.ok) showErr(page, r.reason); renderPage(); });
        bu.addEventListener("click", () => { const r = Product.upgrade(); if (!r.ok) showErr(page, r.reason); renderPage(); });
        page.appendChild(el("h3", "", "Recent days"));
        for (const h of s.history.slice().reverse()) {
          page.appendChild(el("div", "hq-muted", `Day ${h.day}: revenue $${h.revenue.toLocaleString()} · costs $${h.costs.toLocaleString()} · ${h.customers.toLocaleString()} customers · MRR ~$${h.mrr.toLocaleString()}`));
        }
        return;
      }
      const r = Product.readiness();
      if (!r.project) { page.appendChild(el("div", "hq-alerts", "⚠️ " + r.reason)); return; }
      const gp = r.project;
      const pct = Math.round(gp.workDone / gp.workRequired * 100);
      const rc = el("div", "wi-card-dark");
      rc.innerHTML = `
        <b>GLASSWING v1.0</b> ${gp.status === "done" ? '<span class="hq-tag">shipped</span>' : `<span class="hq-tag">${pct}% built</span>`}
        <div class="hq-progress"><span style="width:${Math.min(100, pct)}%"></span></div>
        <div class="hq-muted">Build quality ${gp.quality | 0}/100 · work ${Math.round(gp.workDone)}/${gp.workRequired} · ${r.reason}</div>
        <div class="hq-muted">The $26,000 contract payout is the project reward — it is paid once by the project system on completion. What you choose here is the <b>ongoing product business</b>: recurring revenue minus running costs.</div>`;
      page.appendChild(rc);
      if (!r.ok) return;
      page.appendChild(el("h3", "", "Choose a monetization model (forecasts are estimates)"));
      for (const m of Product.MODELS) {
        const f = Product.forecast(m.id);
        const card = el("div", "wi-card-dark");
        const fans = Object.entries(m.appeal).filter(x => x[1] > 0).map(x => x[0]).join(", ") || "nobody specific";
        card.innerHTML = `
          <b>${m.name}</b> <span class="hq-tag">needs quality ${m.minQuality}+</span> ${gp.quality < m.minQuality ? '<span class="hq-tag red">quality too low</span>' : ""}<br>
          <span class="hq-muted">${m.blurb}</span><br>
          <span class="hq-muted">30-day estimate: ${f.custs[0].toLocaleString()}–${f.custs[1].toLocaleString()} customers · MRR ~$${f.mrrLo.toLocaleString()}–$${f.mrrHi.toLocaleString()} · 30-day ops ~$${f.costLo.toLocaleString()}–$${f.costHi.toLocaleString()}</span><br>
          <span class="hq-muted">Assumes: quality ${gp.quality | 0}, reputation ${SAVE.company.reputation}, avg investor confidence ${Math.round(Investors.averageConfidence())}%. Actual demand swings with satisfaction, bugs and marketing.</span><br>
          <span class="hq-muted">Appeals to: ${fans} · launch cost $${Product.LAUNCH_COST.toLocaleString()}</span>
          <div class="ip-actions">
            <button data-go="${m.id}" ${gp.quality < m.minQuality ? "disabled" : ""}>🚀 Launch with this model</button>
            ${r.mode === "early" ? `<button data-early="${m.id}">🧪 Early-access launch (risky)</button>` : ""}
          </div>`;
        page.appendChild(card);
        card.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => doLaunch(b.dataset.go, false)));
        card.querySelectorAll("[data-early]").forEach(b => b.addEventListener("click", () => doLaunch(b.dataset.early, true)));
      }
      function doLaunch(mId, early) {
        const q = early
          ? "Launch GLASSWING in EARLY ACCESS?\n\nFewer customers, rougher quality, reputation risk — but revenue starts today."
          : "Launch GLASSWING publicly?\n\nThis starts the recurring-revenue business (revenue minus daily operating costs, applied by the daily economy). It does NOT re-pay the project contract.";
        if (!confirm(q)) return;
        const res = Product.launch(mId, early);
        if (res.ok) { renderPage(); }
        else showErr(page, res.reason);
      }
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
  title: "Investor Relations", icon: "🤝", w: 820, h: 560,
  render(body, w, emp) {
    body.innerHTML = `<div class="set-body" style="height:100%"></div>`;
    const page = body.querySelector(".set-body");
    let meetingId = null;
    let showHistory = {};

    function first(inv) { return INVESTOR_DEFS[inv.id].name.split("—")[0].trim(); }
    function moodFace(inv) { return inv.withdrew ? "🚪" : inv.confidence > 70 ? "🙂" : inv.confidence > 40 ? "😐" : "😠"; }
    function topicLabel(id) {
      const map = { growth: "📈 Revenue growth story", tech: "🔬 Engineering quality & innovation", safety: "🛡 Financial stability & safeguards", delivery: "⏱ Delivery plan & deadlines", launch: "🛰 GLASSWING launch & product plan", apology: "🤝 Sincere apology" };
      return map[id] || id;
    }
    function openPromises(inv) { return SAVE.promises.filter(x => x.investor === inv.id && !x.met && !x.broken); }
    function promiseLine(pr) {
      const st = pr.met ? `<span class="hq-tag">kept day ${pr.metDay || "?"}</span>` : pr.broken ? '<span class="hq-tag red">broken</span>' : `<span class="hq-tag ${SIM.day > pr.dueDay ? "red" : ""}">due day ${pr.dueDay}</span>`;
      return `<div class="hq-muted">🤞 "${pr.text}" ${st}</div>`;
    }

    function render() {
      page.innerHTML = "";
      page.appendChild(el("h2", "", `Investor Relations — avg confidence ${Math.round(Investors.averageConfidence())}%`));
      page.appendChild(el("div", "hq-muted", "One meeting per investor per day · funding asks cool down 3 days · overpromising can backfire or create binding commitments. Withdrawn investors can be won back with results, not tricks."));
      for (const inv of SAVE.investors) {
        if (meetingId === inv.id) { meetingScreen(inv); continue; }
        investorCard(inv);
      }
    }

    function investorCard(inv) {
      const def = INVESTOR_DEFS[inv.id];
      const card = el("div", "wi-card-dark");
      const cool = Investors.fundingCooldownLeft(inv);
      const met = inv.metDay ? ` · last met day ${inv.metDay}` : " · never met";
      card.innerHTML = `
        <b>${def.icon} ${def.name}</b> <span class="hq-tag">${def.style}</span> ${inv.withdrew ? '<span class="hq-tag red">WITHDRAWN</span>' : ""}<br>
        <span class="hq-muted">${def.bio}</span>
        <div class="hq-progress"><span style="width:${inv.confidence}%;background:${inv.confidence > 60 ? "#59c98f" : inv.confidence > 35 ? "#f0a45c" : "#e57373"}"></span></div>
        <div class="hq-muted">confidence ${inv.confidence | 0}% · invested $${(inv.invested || 0).toLocaleString()} · cares about: <b>${def.expect}</b> ${moodFace(inv)}<br>${met} · funding ask: ${cool > 0 ? `on cooldown (${cool}d)` : "available"}</div>
        <div class="ip-actions" style="padding:6px 0 0">
          <button data-meet="${inv.id}">🗓 Hold a meeting</button>
          <button data-quick="${inv.id}">📊 Quick quarterly report</button>
          <button data-hist="${inv.id}">📜 History</button>
        </div>
        <div class="ip-actions" style="padding:4px 0 0">
          <span class="hq-muted">Request funding:</span>
          <button data-fund="${inv.id}:5000" ${cool > 0 ? "disabled" : ""}>$5k</button>
          <button data-fund="${inv.id}:10000" ${cool > 0 ? "disabled" : ""}>$10k</button>
          <button data-fund="${inv.id}:25000" ${cool > 0 ? "disabled" : ""}>$25k</button>
          <span class="hq-muted" data-fundnote="${inv.id}">${cool > 0 ? "cooling down" : "bigger asks need more trust"}</span>
        </div>
        <div data-out="${inv.id}"></div>
        <div data-histbox="${inv.id}"></div>`;
      page.appendChild(card);
      card.querySelector(`[data-meet="${inv.id}"]`).addEventListener("click", () => { meetingId = inv.id; render(); Audio2.click(); });
      card.querySelector(`[data-quick="${inv.id}"]`).addEventListener("click", () => {
        const r = InvestorMeetings.quickReport(inv);
        const out = card.querySelector(`[data-out="${inv.id}"]`);
        if (!r.ok) { out.innerHTML = `<div class="hq-muted">⚠️ ${r.reason}</div>`; return; }
        out.innerHTML = outcomeHtml(r);
        Audio2.chime();
      });
      card.querySelectorAll("[data-fund]").forEach(b => b.addEventListener("click", () => {
        const [iid, amt] = b.dataset.fund.split(":");
        const target = SAVE.investors.find(x => x.id === iid);
        const r = Investors.requestFunding(target, +amt);
        const out = card.querySelector(`[data-out="${iid}"]`);
        if (r.ok) { out.innerHTML = `<div class="hq-alerts">✅ Approved! $${r.given.toLocaleString()} wired. “${r.line}”</div>`; officeToast(`💰 ${first(target)} invested $${r.given.toLocaleString()}!`, "gold"); }
        else out.innerHTML = `<div class="hq-muted">❌ ${r.line}<br>💡 ${r.hint || ""}${r.cooldown ? " (cooldown " + r.cooldown + "d)" : ""}</div>`;
        render();
      }));
      card.querySelector(`[data-hist="${inv.id}"]`).addEventListener("click", () => {
        showHistory[inv.id] = !showHistory[inv.id];
        const box = card.querySelector(`[data-histbox="${inv.id}"]`);
        if (!showHistory[inv.id]) { box.innerHTML = ""; return; }
        const meets = SAVE.meetings.filter(m => m.investor === inv.id).slice(-5).reverse();
        let html = meets.length ? meets.map(m => `<div class="hq-muted">Day ${m.day}: ${topicLabel(m.topic)}${m.over ? (m.caught ? " — <b>called out</b>" : " — overpromised") : ""} → confidence ${m.dConf >= 0 ? "+" : ""}${m.dConf}</div>`).join("") : '<div class="hq-muted">No meetings yet. Hold one — evidence beats vibes.</div>';
        const prs = SAVE.promises.filter(x => x.investor === inv.id);
        if (prs.length) html += "<br>" + prs.slice(-5).map(promiseLine).join("");
        box.innerHTML = html;
      });
    }

    function outcomeHtml(r) {
      const parts = [];
      parts.push(`<div class="hq-alerts">${r.dConf >= 0 ? "📈" : "📉"} Confidence ${r.dConf >= 0 ? "+" : ""}${r.dConf}${r.caught ? " — they caught the exaggeration (they will trust you less for a while)" : ""}</div>`);
      parts.push(`<div class="hq-muted">“${r.line}”</div>`);
      if (r.promise) parts.push(`<div class="hq-muted">🤞 Binding commitment created: "${r.promise.text}" — due day ${r.promise.dueDay}. Break it and confidence drops hard.</div>`);
      return parts.join("");
    }

    function meetingScreen(inv) {
      const def = INVESTOR_DEFS[inv.id];
      const wrap = el("div", "wi-card-dark");
      wrap.innerHTML = `
        <b>${def.icon} Meeting with ${first(inv)}</b> <span class="hq-tag">${def.style}</span> ${inv.withdrew ? '<span class="hq-tag red">WITHDRAWN</span>' : ""} <span class="hq-muted">confidence ${inv.confidence | 0}%</span><br>
        <span class="hq-muted">${def.bio} They respond to: <b>${def.expect}</b>. Pitch to their priorities — mismatched pitches land flat.</span>
        <div data-mout="${inv.id}" style="margin-top:8px"></div>
        <h3 style="margin:8px 0 4px">Pick your pitch</h3>
        <div data-topics="${inv.id}"></div>
        <div class="ip-actions" style="margin-top:8px">
          <button data-back="1">⬅ Back to investors</button>
          ${inv.withdrew ? '<button data-apology="1">🤝 Offer a sincere apology (small, honest gain)</button>' : ""}
        </div>`;
      page.appendChild(wrap);
      const tbox = wrap.querySelector(`[data-topics="${inv.id}"]`);
      const out = wrap.querySelector(`[data-mout="${inv.id}"]`);
      for (const t of InvestorMeetings.topics(inv)) {
        const row = el("div", "wi-card-dark roster-row");
        const fit = t.style === inv.style ? '<span class="hq-tag">their priority — strong match</span>' : t.match >= 1.05 ? '<span class="hq-tag">timely topic</span>' : t.match <= 0.6 ? '<span class="hq-tag red">off-priority for them</span>' : "";
        row.innerHTML = `
          <b>${t.label}</b> ${fit}<br>
          <span class="hq-muted">${t.evidence}</span><br>
          <span class="hq-muted">Evidence strength: ${"▮".repeat(Math.max(1, Math.round(t.strength * 10)))}${"▯".repeat(10 - Math.max(1, Math.round(t.strength * 10)))} ${Math.round(t.strength * 100)}%</span>
          <div class="ip-actions">
            <button data-t="${t.id}">🗣 Present honestly</button>
            <button data-to="${t.id}">🌙 Overpromise (bigger swing, real risk)</button>
          </div>`;
        tbox.appendChild(row);
        row.querySelector("[data-t]").addEventListener("click", () => runHold(inv, t.id, false, out, wrap));
        row.querySelector("[data-to]").addEventListener("click", () => runHold(inv, t.id, true, out, wrap));
      }
      wrap.querySelector("[data-back]").addEventListener("click", () => { meetingId = null; render(); });
      const ap = wrap.querySelector("[data-apology]");
      if (ap) ap.addEventListener("click", () => {
        const r = InvestorMeetings.apologize(inv);
        if (!r.ok) { out.innerHTML = `<div class="hq-muted">⚠️ ${r.reason}</div>`; return; }
        out.innerHTML = `<div class="hq-alerts">📈 Confidence +${r.dConf}</div><div class="hq-muted">“${r.line}”</div>`;
        Persistence.write();
      });
    }

    function runHold(inv, topicId, over, out, wrap) {
      const r = InvestorMeetings.hold(inv, topicId, over);
      if (!r.ok) { out.innerHTML = `<div class="hq-alerts">⚠️ ${r.reason}</div>`; return; }
      out.innerHTML = outcomeHtml(r);
      Audio2.chime();
      Persistence.write();
      // reflect the new confidence immediately, keep the outcome visible
      const head = page.querySelector("h2");
      if (head) head.textContent = `Investor Relations — avg confidence ${Math.round(Investors.averageConfidence())}%`;
      const conf = wrap && wrap.querySelector(".hq-muted");
      if (conf) conf.innerHTML = `${INVESTOR_DEFS[inv.id].bio} They respond to: <b>${INVESTOR_DEFS[inv.id].expect}</b>. Pitch to their priorities — mismatched pitches land flat. <b>confidence now ${inv.confidence | 0}%</b>`;
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
