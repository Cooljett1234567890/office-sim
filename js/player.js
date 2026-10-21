/* ===== player.js — character creation, the boss as a physical character, interactions ===== */
"use strict";

const Player = (() => {
  const SKINS = ["#f7d7b5", "#f2c9a4", "#e0ac82", "#c68863", "#a06a42", "#7c4a26"];
  const HAIRS = ["flat", "bun", "long", "curly", "bald"];
  const HAIRCOLORS = ["#2f2a33", "#6b4a2f", "#c9c3b8", "#3a2f4a", "#8a5a2b", "#b04a3a"];
  const OUTFITS = ["#4f5d8cff", "#e5647c", "#2f6f5f", "#7c5cff", "#b4540a", "#3a3f4c", "#0e7490", "#7c2d3a"];
  const ACCS = ["none", "glasses", "tie", "badge", "watch"];

  let entity = null;
  let follow = true;
  const keys = {};
  let nearest = null;

  /* ---------- character creation ---------- */
  function needsCreation() { return !SAVE.player; }

  function showCreator() {
    SIM.paused = true;
    const cc = $("#charcreator");
    cc.classList.remove("hidden");
    const opts = { name: "", skin: 1, hair: 0, hairColor: 0, outfit: 0, acc: 0, personality: "workaholic" };
    const canvas = $("#ccCanvas"), cctx = canvas.getContext("2d");

    function dotRow(container, items, colors, sel, cb) {
      container.innerHTML = "";
      items.forEach((it, i) => {
        const d = el("div", "accent-dot" + (i === sel ? " sel" : ""));
        if (colors) d.style.background = it;
        else d.textContent = it;
        d.addEventListener("click", () => { cb(i); showCreator_refresh(); Audio2.click(); });
        container.appendChild(d);
      });
    }
    function labelRow(container, items, sel, cb) {
      container.innerHTML = "";
      items.forEach((it, i) => {
        const b = el("button", "btn" + (i === sel ? " on" : ""), it);
        b.addEventListener("click", () => { cb(i); showCreator_refresh(); Audio2.click(); });
        container.appendChild(b);
      });
    }
    function showCreator_refresh() {
      // redraw dots selection
      dotRow($("#ccSkin"), SKINS, true, opts.skin, i => opts.skin = i);
      labelRow($("#ccHair"), HAIRS, opts.hair, i => opts.hair = i);
      dotRow($("#ccHairColor"), HAIRCOLORS, true, opts.hairColor, i => opts.hairColor = i);
      dotRow($("#ccOutfit"), OUTFITS, true, opts.outfit, i => opts.outfit = i);
      labelRow($("#ccAcc"), ACCS, opts.acc, i => opts.acc = i);
      // preview
      cctx.clearRect(0, 0, canvas.width, canvas.height);
      cctx.fillStyle = "#1b2030"; cctx.fillRect(0, 0, canvas.width, canvas.height);
      Office.drawPersonPreview(cctx, canvas.width / 2, canvas.height / 2 + 60, 3.2, {
        skin: SKINS[opts.skin], hair: HAIRCOLORS[opts.hairColor], body: OUTFITS[opts.outfit],
        hairStyle: HAIRS[opts.hair], accessory: ACCS[opts.acc] === "none" ? null : ACCS[opts.acc],
        mood: "happy",
      });
      const nm = $("#ccName").value.trim();
      $("#ccNameTag").textContent = nm || "New Boss";
    }
    $("#ccName").addEventListener("input", showCreator_refresh);
    $("#ccPersonality").addEventListener("change", e => { opts.personality = e.target.value; });
    $("#ccStart").addEventListener("click", () => {
      const name = ($("#ccName").value.trim() || "Jordan Vale");
      SAVE.player = {
        name, first: name.split(" ")[0],
        skin: opts.skin, hair: opts.hair, hairColor: opts.hairColor, outfit: opts.outfit,
        accessory: ACCS[opts.acc] === "none" ? null : ACCS[opts.acc],
        personality: opts.personality,
      };
      Persistence.write();
      cc.classList.add("hidden");
      SIM.paused = false;
      spawn();
      unlockAchievement("boss");
      Memory.record("founded", [entity], { founder: name });
      Apps.pushChat("general", "Dana Whitfield", `Everyone welcome our new ${name}! ${SAVE.player.personality === "coffeeAddict" ? "They already know about the coffee machine. Concerning." : "The llama farm retirement was, quote, 'for the best'."}`);
      Apps.pushChat("random", pickColleague(), "the founder left for a llama farm. a LLAMA farm. i have questions but no one will answer them");
      officeToast(`👔 You are now the boss of Synergy Labs. Walk with WASD. Press E near people and objects.`, "gold");
    });
    showCreator_refresh();
  }

  function pickColleague() { const l = SIM.employees.filter(e => e.status === "active"); return l.length ? pick(l).name : "Greg Bell"; }

  /* ---------- entity ---------- */
  function spawn() {
    const p = SAVE.player;
    entity = {
      id: 0, isPlayer: true,
      name: p.name, first: p.first, role: "Director",
      personality: p.personality,
      palette: { body: OUTFITS[p.outfit], hair: HAIRCOLORS[p.hairColor], skin: SKINS[p.skin] },
      hairStyle: HAIRS[p.hair],
      accessory: p.accessory,
      desk: -1,
      x: BOSS_DESK.x, y: BOSS_DESK.y + 48,
      state: "desk", screen: "sheet", screenModeTyping: true,
      path: null, pathIdx: 0, intent: null, timer: 0,
      mood: "happy", moving: false, sweat: false, blink: false,
      away: false, mugHot: false, seated: true,
      memories: [], morale: 80, stress: 20, salary: 0, warned: 0, promoted: 0,
      caught: 0, pretendTimer: 0, stepAcc: 0, partner: null,
      sickToday: false, arrive: 0, lunchAt: 9999, leaveAt: 9999,
    };
    Apps.Persona.ensure(entity);
    SIM.player = entity;
  }

  function init() {
    if (needsCreation()) showCreator();
    else spawn();
  }

  /* ---------- movement & collision ---------- */
  function obstacles() {
    const obs = [];
    for (const d of DESKS) obs.push({ x: d.x - 55, y: d.y - 26, w: 110, h: 90 });
    obs.push({ x: BOSS_DESK.x - 55, y: BOSS_DESK.y - 26, w: 110, h: 90 });
    obs.push({ x: 40, y: 90, w: 360, h: 60 });          // kitchen counter
    obs.push({ x: 285, y: 78, w: 70, h: 115 });          // fridge
    obs.push({ x: 210, y: 395, w: 195, h: 70 });         // lunch table
    obs.push({ x: 78, y: 655, w: 185, h: 80 });          // sofa
    obs.push({ x: 1518, y: 915, w: 45, h: 100 });        // water cooler
    obs.push({ x: 1500, y: 230, w: 300, h: 165 });       // meeting table
    for (const [x, y] of [[520, 130], [1250, 130], [60, 540], [70, 940], [1850, 520], [300, 1010], [1640, 940]]) obs.push({ x: x - 16, y: y - 24, w: 32, h: 55 });
    return obs;
  }

  function collides(x, y) {
    for (const o of obstacles()) {
      if (x > o.x - 12 && x < o.x + o.w + 12 && y > o.y - 20 && y < o.y + o.h + 24) return true;
    }
    if (x < 40 || x > WORLD.w - 40 || y < 100 || y > WORLD.h - 30) return true;
    return false;
  }

  function update(dts) {
    if (!entity || Desktop.isOpen) return;
    const typing = document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
    if (typing) { entity.moving = false; return; }
    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    if ((dx || dy) && entity.state === "desk") entity.state = "idle"; // get up and walk
    if (entity.state === "desk") { entity.moving = false; return; }
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const sp = 135 * dts;
      const nx = entity.x + dx / len * sp, ny = entity.y + dy / len * sp;
      const stuck = collides(entity.x, entity.y); // seated inside furniture: allow escaping
      if (stuck || !collides(nx, entity.y)) entity.x = nx;
      if (stuck || !collides(entity.x, ny)) entity.y = ny;
      entity.moving = true;
      entity.stepAcc += sp;
      if (entity.stepAcc > 30) { entity.stepAcc = 0; Audio2.step(0.05); }
      // walking near a slacking employee triggers pretend-mode
      for (const e of SIM.employees) {
        if (e.status !== "active" || e.away) continue;
        if ((e.state === "youtube" || e.state === "asleep") && Math.hypot(e.x - entity.x, e.y - entity.y) < 120) {
          e._bossNear = true;
        }
      }
    } else entity.moving = false;
  }

  /* ---------- interaction scanning ---------- */
  function findNearest() {
    if (!entity) return null;
    let best = null, bd = 78;
    for (const e of SIM.employees) {
      if (e.status !== "active" || e.away) continue;
      const d = Math.hypot(e.x - entity.x, e.y - entity.y);
      if (d < bd) { best = { kind: "employee", emp: e, label: "Talk to " + e.first }; bd = d; }
    }
    const dd = Math.hypot(BOSS_DESK.x - entity.x, BOSS_DESK.y - entity.y);
    if (dd < 90 && dd < bd) { best = { kind: "owndesk", label: entity.state === "desk" ? "Stand up / use PC" : "Sit at your desk" }; bd = dd; }
    const c = Math.hypot(150 - entity.x, 320 - entity.y);
    if (c < 70 && c < bd) { best = { kind: "coffee", label: "Use the coffee machine" }; bd = c; }
    const p = Math.hypot(350 - entity.x, 320 - entity.y);
    if (p < 70 && p < bd) { best = { kind: "printer", label: "Print a financial report" }; bd = p; }
    const m = Math.hypot(1650 - entity.x, 315 - entity.y);
    if (m < 110 && m < bd) { best = { kind: "meeting", label: "Call an all-hands meeting" }; bd = m; }
    const a = Math.hypot(170 - entity.x, 695 - entity.y);
    if (a < 80 && a < bd && SAVE.facilities.includes("arcade")) { best = { kind: "arcade", label: "De-stress at the arcade" }; bd = a; }
    const w = Math.hypot(1850 - entity.x, 590 - entity.y);
    if (w < 80 && w < bd) { best = { kind: "whiteboard", label: "Study the project board" }; bd = w; }
    return best;
  }

  function hint() { nearest = findNearest(); return nearest ? nearest.label : null; }

  function interact() {
    if (!entity) return;
    if (Desktop.isOpen) { Desktop.close(); return; }
    const n = findNearest();
    if (!n) return;
    Audio2.click();
    switch (n.kind) {
      case "employee": Interact.showEmployee(n.emp); break;
      case "owndesk":
        if (entity.state === "desk") { Desktop.open(entity); }
        else { entity.state = "desk"; entity.x = BOSS_DESK.x; entity.y = BOSS_DESK.y + 48; entity.screen = "sheet"; Audio2.pop(); }
        break;
      case "coffee": doCoffee(); break;
      case "printer": doPrinter(); break;
      case "meeting": Interact.showMeeting(); break;
      case "arcade": doArcade(); break;
      case "whiteboard": Interact.showProjects(); break;
    }
  }

  function doCoffee() {
    if (entity._coffeeCd && Date.now() - entity._coffeeCd < 20000) { officeToast("☕ You've had enough coffee. The machine is concerned."); return; }
    entity._coffeeCd = Date.now();
    Audio2.coffeeOn();
    setTimeout(() => Audio2.coffeeOff(), 2500);
    entity.stress = clamp(entity.stress - 8, 0, 100);
    entity.morale = clamp(entity.morale + 4, 0, 100);
    officeToast("☕ Espresso acquired. Leadership +2.");
    unlockAchievement("coffee");
  }
  function doPrinter() {
    Audio2.printerBurst();
    const path = "Documents/financial_report_day" + SIM.day + ".txt";
    VFS.writeFile(entity, path, {
      type: "txt",
      content: Company.reportText(),
    });
    officeToast("🖨️ Financial report printed to your Documents folder.");
  }
  function doArcade() {
    entity.stress = clamp(entity.stress - 15, 0, 100);
    entity.morale = clamp(entity.morale + 6, 0, 100);
    Audio2.chime();
    officeToast("🕹️ You beat the high score in 41 seconds. The staff pretend to be impressed.");
  }

  function standUp() {
    if (entity.state === "desk") { entity.state = "idle"; entity.moving = false; Audio2.swoosh(); }
  }

  return { init, spawn, update, entity: () => entity, keys, hint, interact, findNearest, standUp, get follow() { return follow; }, set follow(v) { follow = v; }, SKINS, HAIRS, HAIRCOLORS, OUTFITS, ACCS, obstacles };
})();

/* ---------- world interaction panel ---------- */
const Interact = (() => {
  let panel, current = null;

  function init() { panel = $("#interact-panel"); }

  function close() { if (panel) { panel.classList.add("hidden"); panel.innerHTML = ""; } current = null; }

  function show(html) {
    panel.innerHTML = html;
    panel.classList.remove("hidden");
  }

  function positionAt(wx, wy) {
    const s = Office.worldToScreen(wx, wy);
    const elp = panel;
    elp.style.left = clamp(s.x + 30, 10, innerWidth - 350) + "px";
    elp.style.top = clamp(s.y - 60, 10, innerHeight - 380) + "px";
  }

  function portrait(emp) {
    const c = document.createElement("canvas");
    c.width = 90; c.height = 96; c.style.cssText = "border-radius:10px;background:#1b2030;flex-shrink:0";
    Office.drawPersonPreview(c.getContext("2d"), 45, 82, 1.9, { skin: emp.palette.skin, hair: emp.palette.hair, body: emp.palette.body, hairStyle: emp.hairStyle, accessory: emp.accessory, mood: emp.mood });
    return c;
  }

  function showEmployee(emp) {
    current = { type: "employee", emp };
    const perf = emp.productivity || [];
    const avg = perf.length ? Math.round(perf.reduce((s, p) => s + p.points, 0) / perf.length) : 0;
    const att = emp.attendance || [];
    const latePct = att.length ? Math.round(att.filter(a => a.late).length / att.length * 100) : 0;
    const proj = emp.assignment ? Company.projectById(emp.assignment) : null;
    const rels = SIM.employees.filter(o => o !== emp && o.status === "active")
      .map(o => ({ o, v: Memory.affinity(emp, o) }))
      .sort((a, b) => b.v - a.v);
    const best = rels[0], worst = rels[rels.length - 1];
    show(`
      <div class="ip-head"><b>${emp.name}</b><span class="ip-role">${emp.role} · $${emp.salary.toLocaleString()}/mo · hired day ${emp.hiredDay}</span></div>
      <div class="ip-body">
        <div class="ip-portrait"></div>
        <div class="ip-stats">
          <div>Morale <span class="bar"><span style="width:${emp.morale}%;background:#59c98f"></span></span> ${emp.morale | 0}%</div>
          <div>Stress <span class="bar"><span style="width:${emp.stress}%;background:#e57373"></span></span> ${emp.stress | 0}%</div>
          <div>Skills: code ${emp.skills.code} · design ${emp.skills.design} · social ${emp.skills.social}</div>
          <div>Productivity: ~${avg} pts/day · Late ${latePct}% · ${emp.sickToday ? "📞 out sick today" : "in office"}</div>
          <div>Assignment: <b>${proj ? proj.name : "unassigned"}</b></div>
          <div>Gets along with ${best.o.first} (${Memory.relLabel(best.v)})${worst.v < -10 ? ` · tense with ${worst.o.first} (${Memory.relLabel(worst.v)})` : ""}</div>
        </div>
      </div>
      <div class="ip-dialogue" id="ipTalk"></div>
      <div class="ip-actions">
        <button data-act="talk">💬 Talk</button>
        <button data-act="assign">📋 Assign to project</button>
        <button data-act="review">📝 Performance review</button>
        <button data-act="warn">⚠️ Warn</button>
        <button data-act="bonus">💵 Bonus ($500)</button>
        <button data-act="promote">🏅 Promote</button>
        <button data-act="fire" class="ip-danger">📦 Fire</button>
        <button data-act="follow">👀 Follow</button>
        <button data-act="close">✕ Close</button>
      </div>
      <div class="ip-sub" id="ipExtra"></div>
    `);
    panel.querySelector(".ip-portrait").appendChild(portrait(emp));
    positionAt(emp.x, emp.y - 40);
    wire(emp);
    doTalk(emp);
  }

  function doTalk(emp) {
    const lines = Memory.talkLines(emp);
    const box = panel.querySelector("#ipTalk");
    if (box) box.innerHTML = lines.map(l => `<div class="ip-line">“${l}”</div>`).join("");
  }

  function wire(emp) {
    panel.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
      const act = b.dataset.act;
      Audio2.click();
      if (act === "close") { close(); return; }
      if (act === "talk") { doTalk(emp); return; }
      if (act === "follow") { SIM.followId = emp.id; close(); return; }
      if (act === "assign") {
        const active = Company.activeProjects();
        if (!active.length) { showExtra("No active projects. Start one on the SynergyHQ dashboard (your PC)."); return; }
        const proj = active[0];
        Company.assign(emp, proj);
        Memory.record("assigned", [emp], { project: proj.id });
        showExtra(`Assigned to ${proj.name}. They pretended to be thrilled.`);
        return;
      }
      if (act === "review") {
        showExtra(`
          <b>Performance review — ${emp.name}</b><br>
          Recent output: ${(emp.productivity || []).map(p => p.points).join(", ") || "no data yet"}<br>
          ${latePctText(emp)}<br>
          Rate today's work:
          <span class="ip-stars">
            ${["😞", "😐", "🙂", "😃", "🤩"].map((f, i) => `<button data-stars="${i}" class="btn">${f}</button>`).join("")}
          </span>`);
        panel.querySelectorAll("[data-stars]").forEach(sb => sb.addEventListener("click", () => {
          const stars = +sb.dataset.stars;
          emp.morale = clamp(emp.morale + (stars - 2) * 6, 0, 100);
          emp.stress = clamp(emp.stress + (stars < 1 ? 5 : 0), 0, 100);
          if (stars >= 4) Memory.record("bonus", [emp], { amount: 0, praise: true });
          if (stars <= 1) Memory.record("warned", [emp], { soft: true });
          showExtra(`Review logged: ${["ouch", "fair", "fair", "good", "glowing"][stars]}. They noticed.`);
          Persistence.write();
        }));
        return;
      }
      if (act === "warn") { Company.warn(emp); showExtra("Warning delivered. HR file updated."); refresh(emp); return; }
      if (act === "bonus") { const r = Company.bonus(emp, 500); showExtra(r.ok ? "Bonus paid. Worth every cent." : r.reason); refresh(emp); return; }
      if (act === "promote") { Company.promote(emp); showExtra("Promotion processed. The desk stays humble."); refresh(emp); return; }
      if (act === "fire") {
        showExtra(`Really fire ${emp.name}? Coworkers WILL talk about this. <button data-fire="yes" class="btn ip-danger">Confirm</button> <button data-fire="no" class="btn">Cancel</button>`);
        panel.querySelector("[data-fire=yes]").addEventListener("click", () => {
          const r = Company.fire(emp);
          if (r.ok) close(); else showExtra(r.reason);
        });
        panel.querySelector("[data-fire=no]").addEventListener("click", () => showExtra("Close call."));
        return;
      }
    }));
  }
  function latePctText(emp) {
    const att = emp.attendance || [];
    const late = att.length ? Math.round(att.filter(a => a.late).length / att.length * 100) : 0;
    return `Attendance: ${att.length ? late + "% late recently" : "no history"}`;
  }
  function refresh(emp) { showEmployee(emp); }
  function showExtra(html) { const x = panel.querySelector("#ipExtra"); if (x) x.innerHTML = html; else panel.innerHTML += `<div class="ip-sub">${html}</div>`; }

  function showMeeting() {
    current = { type: "meeting" };
    show(`
      <div class="ip-head"><b>📋 Call an all-hands</b></div>
      <div class="ip-body"><div class="ip-stats">
        <div>The team gathers in the Quantum Room. Choose a vibe:</div>
      </div></div>
      <div class="ip-actions">
        <button data-m="update">🚀 Project update (+progress, +stress)</button>
        <button data-m="costs">💰 Cost-cutting talk (investor +, morale −)</button>
        <button data-m="fun">🎉 Team building (morale +, costs $300)</button>
      </div>
      <div class="ip-sub" id="ipExtra"></div>
    `);
    positionAt(1650, 315);
    panel.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => {
      Audio2.click();
      const m = b.dataset.m;
      if (m === "update") {
        for (const p of Company.activeProjects()) { p.workDone += 25; p.quality = clamp(p.quality + 1, 0, 100); }
        for (const e of SIM.employees) if (e.status === "active") { e.stress = clamp(e.stress + 4, 0, 100); }
        Memory.record("meeting", [], { kind: "update" });
        showExtra("You gave a crisp update. 25 progress on every active project. Some people zoned out.");
        officeToast("📋 All-hands: project update delivered.");
      } else if (m === "costs") {
        Investors.evaluate("costTalk", null);
        for (const inv of SAVE.investors) inv.confidence = clamp(inv.confidence + 3, 0, 100);
        for (const e of SIM.employees) if (e.status === "active") e.morale = clamp(e.morale - 6, 0, 100);
        Memory.record("meeting", [], { kind: "costs" });
        showExtra("Cost-cutting speech delivered. Investors exhale. Employees update resumes.");
        officeToast("💰 All-hands: belt-tightening announced.");
      } else if (m === "fun") {
        if (SAVE.company.cash < 300) { showExtra("Need $300 for the good snacks."); return; }
        SAVE.company.cash -= 300;
        for (const e of SIM.employees) if (e.status === "active") { e.morale = clamp(e.morale + 10, 0, 100); e.stress = clamp(e.stress - 6, 0, 100); }
        Memory.record("meeting", [], { kind: "fun" });
        showExtra("Team building complete. Someone cried at the trust fall. Positively.");
        officeToast("🎉 Team building: morale up, HR paperwork up.");
      }
      Persistence.write();
    }));
  }

  function showProjects() {
    current = { type: "projects" };
    const ps = Company.activeProjects();
    show(`
      <div class="ip-head"><b>📋 Project board</b></div>
      <div class="ip-body"><div class="ip-stats">
        ${ps.length ? ps.map(p => `<div><b>${p.name}</b> — ${Math.round(p.workDone / p.workRequired * 100)}% · due day ${p.deadlineDay} · quality ${p.quality | 0}/100<br><span class="bar" style="width:100%"><span style="width:${Math.min(100, p.workDone / p.workRequired * 100)}%;background:#4f8cff"></span></span></div>`).join("<br>") : "No active projects. Bold strategy."}
      </div></div>
      <div class="ip-actions"><button data-x="close">✕ Close</button><button data-x="dash">🖥 Open SynergyHQ on your PC</button></div>
    `);
    positionAt(1850, 590);
    panel.querySelector("[data-x=close]").addEventListener("click", close);
    panel.querySelector("[data-x=dash]").addEventListener("click", () => { close(); Desktop.open(SIM.player); Desktop.openApp("mgmt"); });
  }

  document.addEventListener("keydown", e => { if (e.key === "Escape" && current) close(); });

  return { init, close, showEmployee, showMeeting, showProjects, get open() { return !!current; } };
})();
