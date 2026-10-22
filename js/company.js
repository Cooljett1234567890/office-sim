/* ===== company.js — finances, projects, hiring/firing, expansion, investors =====
 * All money is fictional. Formulas (documented in README too):
 *   daily revenue  = monthlyRevenue / 22 * qualityFactor(0.6..1.4) + completed project boosts
 *   daily expenses = sum(active salaries)/22 + operatingCost + facilities upkeep (0)
 *   hiring fee     = 1200 (desk, equipment, one (1) welcome plant)
 *   bonus          = player-chosen 500..2000, morale +, memory +
 *   project payout = budget * qualityMultiplier (S 1.25 / A 1.1 / B 1.0 / C 0.8 / F 0.5)
 *   deadline miss  = investor confidence hit + payout penalty already implicit (late completion)
 */
"use strict";

const Company = (() => {
  /* ---------- employees: creation ---------- */
  function genSkills(personality, role) {
    const base = SKILL_BASE[personality] || SKILL_BASE.social;
    const bias = ROLE_SKILL_BIAS[role] || { code: 0, design: 0, social: 0 };
    const s = {};
    for (const k of ["code", "design", "social"]) {
      const [lo, hi] = base[k];
      s[k] = clamp(Math.round(rnd(lo, hi) + (bias[k] || 0)), 5, 98);
    }
    return s;
  }

  function makeEmployee(def) {
    // def: {id?, first,last,role,personality,desk} — persistent-ready employee object
    const id = def.id || SAVE.nextEmpId++;
    const skills = def.skills || genSkills(def.personality, def.role);
    const e = {
      id,
      first: def.first, last: def.last, name: def.first + " " + def.last,
      role: def.role, personality: def.personality,
      ai: PERSONALITY_AI[def.personality] || PERSONALITY_AI.social,
      desk: def.desk, seed: Math.random() * 10,
      palette: def.palette || PALETTES[id % PALETTES.length],
      hairStyle: def.hairStyle || pick(["flat", "bun", "long", "flat", "curly"]),
      skills, salary: def.salary || PERSONALITY_SALARY[def.personality] || 5800,
      hiredDay: SIM.day, morale: 70, stress: 25,
      status: "active", assignment: def.assignment || null,
      memories: [], productivity: [], attendance: [],
      sickToday: false, warned: 0, promoted: 0,
      arrive: 8 * 60 + rnd(0, 50), lunchAt: 12 * 60 + rnd(0, 45), leaveAt: 17 * 60 + rnd(10, 55),
      isBoss: false, accessory: null,
      // runtime (stripped on save)
      x: 0, y: 0, state: "away", screen: "code", screenModeTyping: false,
      path: null, pathIdx: 0, intent: null, timer: 0, decisionTimer: rnd(2, 8),
      mood: "neutral", moving: false, sweat: false, blink: false, away: true, mugHot: false,
      caught: 0, pretendTimer: 0, stepAcc: 0, partner: null,
    };
    return e;
  }

  function registerEmployee(e, isNew) {
    e.persona = null;
    SIM.employees.push(e);
    Apps.Persona.ensure(e);
    VFS.seed(e);
    // existing coworkers notice
    if (isNew) {
      Memory.record("hired", [e], { role: e.role });
      const line = pick(CHAT_MEMORY_LINES.hired).replace("{target}", e.first);
      Apps.pushChat("general", pickColleagueName(), line);
      Persistence.markDirty();
    }
    return e;
  }

  function pickColleagueName() {
    const list = SIM.employees.filter(x => x.status === "active");
    return list.length ? pick(list).name : "Dana Whitfield";
  }

  /* ---------- hiring / firing ---------- */
  function freeDesks() {
    const used = new Set(SIM.employees.filter(e => e.status === "active" && e.desk >= 0).map(e => e.desk));
    return [...DESKS.keys()].filter(d => !used.has(d));
  }

  function genCandidates(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const first = pick(FIRST), last = pick(LAST);
      const role = pick(Object.keys(ROLE_SKILL_BIAS));
      const personality = pick(Object.keys(PERSONALITY_AI));
      const skills = genSkills(personality, role);
      out.push({
        first, last, name: first + " " + last, role, personality, skills,
        ask: PERSONALITY_SALARY[personality] + (skills.code + skills.design + skills.social) * 3 | 0,
        blurb: candidateBlurb(personality, skills),
      });
    }
    return out;
  }
  function candidateBlurb(personality, skills) {
    const bits = [];
    if (skills.code > 75) bits.push("strong code");
    if (skills.design > 75) bits.push("great design taste");
    if (skills.social > 75) bits.push("talks to anyone");
    if (personality === "slacker") bits.push("mentions 'work-life balance' a LOT");
    if (personality === "workaholic") bits.push("has not scheduled a vacation since 2019");
    if (personality === "perfectionist") bits.push("will die on a 1px hill");
    if (personality === "memeAddict") bits.push("portfolio is 40% memes");
    return bits.join(" · ") || "seems normal (suspicious)";
  }

  function hire(candidate) {
    if (SAVE.company.cash < 1200) return { ok: false, reason: "Not enough cash for the $1,200 onboarding kit." };
    const free = freeDesks();
    if (!free.length) return { ok: false, reason: "No free desks. Buy one from the Expansion tab ($1,800)." };
    const desk = free.includes(12 + SAVE.expandedDesks - 1) && SAVE.expandedDesks ? free[free.length - 1] : free[0];
    const e = makeEmployee({ first: candidate.first, last: candidate.last, role: candidate.role, personality: candidate.personality, skills: candidate.skills, desk, salary: candidate.ask });
    registerEmployee(e, true);
    SAVE.company.cash -= 1200;
    // seat them immediately if it's a workday
    e.away = false;
    const d = Employees.deskPos(e);
    e.x = SPOTS.exit.x; e.y = SPOTS.exit.y - 10;
    e.arrive = SIM.minutes + 1;
    unlockAchievement("hired");
    Persistence.write();
    return { ok: true, emp: e };
  }

  function fire(emp, reason) {
    if (!emp || emp.isPlayer) return { ok: false, reason: "You cannot fire yourself. HR checked." };
    emp.status = "fired";
    emp.away = true; emp.state = "away"; emp.path = null;
    if (emp.assignment) unassign(emp);
    SAVE.firedEmployees.push({ name: emp.name, role: emp.role, day: SIM.day, personality: emp.personality, reason: reason || "restructuring" });
    SIM.employees = SIM.employees.filter(x => x.id !== emp.id);
    Memory.record("fired", [emp], { reason: reason || "restructuring" });
    Memory.chatAboutEvent(Memory.eventById(SAVE.events[SAVE.events.length - 1].id));
    // coworkers react: fear for slackers, sadness for friends
    for (const o of SIM.employees) {
      if (o.status !== "active") continue;
      const aff = Memory.affinity(o, emp);
      if (aff > 15) { o.morale = clamp(o.morale - 6, 0, 100); Memory.adjustAffinity(o, emp, 0); }
      if (o.personality === "slacker") o.stress = clamp(o.stress + 8, 0, 100);
    }
    unlockAchievement("fired");
    Persistence.write();
    return { ok: true };
  }

  function unassign(emp) {
    const p = SAVE.projects.find(x => x.id === emp.assignment);
    if (p) p.assigned = p.assigned.filter(id => id !== emp.id);
    emp.assignment = null;
    Persistence.markDirty();
  }

  /* ---------- projects ---------- */
  function newProject(bp) {
    if (SAVE.company.cash < bp.cost) return { ok: false, reason: `Need $${bp.cost.toLocaleString()} upfront.` };
    SAVE.company.cash -= bp.cost;
    const p = {
      id: SAVE.nextProjectId++,
      bpId: bp.id,
      name: bp.name, desc: bp.desc,
      cost: bp.cost, budget: bp.budget, rep: bp.rep,
      workRequired: bp.work, workDone: 0, quality: 50,
      deadlineDay: SIM.day + bp.days,
      assigned: [], status: "active",
      startedDay: SIM.day,
    };
    SAVE.projects.push(p);
    Persistence.markDirty();
    return { ok: true, project: p };
  }

  function assign(emp, project) {
    if (emp.assignment) unassign(emp);
    project.assigned.push(emp.id);
    emp.assignment = project.id;
    emp.morale = clamp(emp.morale + 3, 0, 100);
    Persistence.markDirty();
  }
  function assignAuto(project) {
    // pick best-fit unassigned active employees up to +1 minStaff
    const pool = SIM.employees.filter(e => e.status === "active" && !e.assignment);
    pool.sort((a, b) => skillFit(b, project) - skillFit(a, project));
    const need = Math.max(0, (project.minNeeded || 1) - project.assigned.length);
    for (let i = 0; i < Math.min(need, pool.length); i++) assign(pool[i], project);
  }

  function skillFit(emp, project) {
    const tags = project.tags || [];
    let v = emp.skills.code * 0.5 + emp.skills.design * 0.25 + emp.skills.social * 0.25;
    if (tags.includes("ai") || tags.includes("research")) v = emp.skills.code * 0.8 + emp.skills.social * 0.2;
    if (tags.includes("web") || tags.includes("product")) v = emp.skills.code * 0.45 + emp.skills.design * 0.4 + emp.skills.social * 0.15;
    if (tags.includes("sales")) v = emp.skills.social * 0.7 + emp.skills.design * 0.3;
    return v;
  }

  function noteCodeEdit(emp) {
    const p = SAVE.projects.find(x => x.id === emp.assignment);
    if (!p) return;
    const now = Date.now();
    if (emp._lastCodeEdit && now - emp._lastCodeEdit < 30000) return;
    emp._lastCodeEdit = now;
    p.quality = clamp(p.quality + 1, 0, 100);
  }

  /* daily productivity tick — attribute-driven, not random */
  function progressDay() {
    for (const p of SAVE.projects.filter(x => x.status === "active")) {
      let qualitySum = 0, qualityN = 0;
      for (const id of p.assigned) {
        const e = empById(id);
        if (!e || e.status !== "active") continue;
        const fit = skillFit(e, p);
        let mult = 1;
        if (e.personality === "workaholic") mult *= 1.25;
        if (e.personality === "perfectionist") mult *= 0.85;
        if (e.personality === "slacker") mult *= 0.55;
        if (e.personality === "memeAddict") mult *= 0.8;
        if (e.personality === "gamer") mult *= 0.85;
        mult *= 0.6 + (e.morale / 100) * 0.55;         // morale matters
        mult *= 1.1 - (e.stress / 100) * 0.45;          // stress hurts
        if (e.sickToday) mult = 0;
        const daily = (14 + fit / 6) * mult * rnd(0.85, 1.15);
        p.workDone += daily;
        p.quality = p.quality * 0.96 + (fit * 0.4 + (e.personality === "perfectionist" ? 12 : 0) + (e.morale * 0.25)) * 0.04;
        qualitySum += fit; qualityN++;
        e.productivity.push({ day: SIM.day, points: Math.round(daily) });
        if (e.productivity.length > 14) e.productivity.shift();
      }
      if (!p.assigned.length) p.workDone += 2; // it never quite dies without staff
      // completion fires the moment work is done; missed deadlines eventually fail
      if (p.workDone >= p.workRequired) completeProject(p);
      else if (SIM.day > p.deadlineDay + 2) failProject(p, "blew past the deadline by 2 days");
    }
  }

  function completeProject(p) {
    p.status = "done";
    const grade = p.quality >= 78 ? "S" : p.quality >= 64 ? "A" : p.quality >= 48 ? "B" : "C";
    const mult = { S: 1.25, A: 1.1, B: 1.0, C: 0.8 }[grade];
    const payout = Math.round(p.budget * mult);
    SAVE.company.cash += payout;
    SAVE.company.reputation = clamp(SAVE.company.reputation + p.rep, 0, 100);
    SAVE.company.monthlyRevenue = Math.round(SAVE.company.monthlyRevenue * 1.03 + p.rep * 40);
    Memory.record("projectDone", p.assigned.map(id => empById(id)).filter(Boolean), { projectName: p.name, team: p.assigned, grade, payout });
    Memory.chatAboutEvent({ type: "projectDone", actors: p.assigned, data: { projectName: p.name } });
    for (const id of p.assigned) { const e = empById(id); if (e) { e.assignment = null; e.morale = clamp(e.morale + 12, 0, 100); e.stress = clamp(e.stress - 10, 0, 100); } }
    officeToast(`🚀 SHIPPED: ${p.name} — grade ${grade} — +$${payout.toLocaleString()}`, "gold");
    Audio2.chime();
    unlockAchievement("shipped");
    Investors.evaluate("projectDone", p);
    Persistence.write();
    return payout;
  }

  function failProject(p, why) {
    p.status = "failed";
    SAVE.company.reputation = clamp(SAVE.company.reputation - p.rep / 2, 0, 100);
    Memory.record("projectFailed", p.assigned.map(id => empById(id)).filter(Boolean), { projectName: p.name, team: p.assigned, why });
    Memory.chatAboutEvent({ type: "projectFailed", actors: p.assigned, data: { projectName: p.name } });
    for (const id of p.assigned) { const e = empById(id); if (e) { e.assignment = null; e.morale = clamp(e.morale - 8, 0, 100); e.stress = clamp(e.stress + 8, 0, 100); } }
    officeToast(`💥 FAILED: ${p.name} — ${why}`, "red");
    Investors.evaluate("projectFailed", p);
    Persistence.write();
  }

  /* ---------- finances ---------- */
  function qualityFactor() {
    const active = SAVE.projects.filter(p => p.status === "active");
    if (!active.length) return 1;
    return 0.6 + (active.reduce((s, p) => s + p.quality, 0) / active.length) / 100 * 0.8;
  }
  function salariesPerDay() { return SIM.employees.filter(e => e.status === "active").reduce((s, e) => s + e.salary, 0) / 22; }
  function runwayDays() {
    const net = dailyRevenue() - dailyExpenses();
    if (net >= 0) return "∞";
    return Math.max(0, Math.floor(SAVE.company.cash / -net));
  }
  function dailyRevenue() { return SAVE.company.monthlyRevenue / 22 * qualityFactor(); }
  function dailyExpenses() { return salariesPerDay() + SAVE.company.operatingCost; }

  function endOfDayFinance() {
    const rev = dailyRevenue(), exp = dailyExpenses();
    SAVE.company.cash += rev - exp;
    SAVE.company.ledger.push({ day: SIM.day, revenue: Math.round(rev), expenses: Math.round(exp), cash: Math.round(SAVE.company.cash) });
    if (SAVE.company.ledger.length > 40) SAVE.company.ledger.shift();
    if (SAVE.company.cash >= 100000) unlockAchievement("rich");
    if (SAVE.company.cash < 0) {
      officeToast("🚨 The account is OVERDRAWN. Investors are composing emails.", "red");
      Investors.evaluate("overdrawn", null);
    }
  }

  /* ---------- daily employee upkeep ---------- */
  function employeeDayTick() {
    for (const e of SIM.employees) {
      if (e.status !== "active") continue;
      // drift toward personality baseline
      const base = e.personality === "workaholic" ? 62 : e.personality === "slacker" ? 55 : 68;
      e.morale += (base - e.morale) * 0.15;
      e.stress += (20 - e.stress) * 0.2;
      if (e.stress > 80) e.morale -= 2;
      e.morale = clamp(e.morale, 0, 100);
      e.stress = clamp(e.stress, 0, 100);
      // sick chance
      e.sickToday = Math.random() < clamp((80 - e.morale) / 900 + (e.stress - 50) / 700, 0, 0.22);
      if (e.sickToday && Math.random() < 0.6) Apps.pushChat("general", e.name, pick(["calling in sick. the ceiling is fascinating today.", "sick day. it's the printer's fault somehow.", "not feeling it. taking a mental health day 💙"]));
      // attendance record
      e.attendance.push({ day: SIM.day, late: e.arrive > 9 * 60 + 15, sick: e.sickToday });
      if (e.attendance.length > 14) e.attendance.shift();
      // clamp schedules each day
      e.arrive = 8 * 60 + rnd(0, 50) + (e.sickToday ? 240 : 0);
      e.lunchAt = 12 * 60 + rnd(0, 45);
      e.leaveAt = 17 * 60 + rnd(10, 55) + (e.personality === "workaholic" ? 40 : 0);
    }
    Memory.dailyDrift();
  }

  function bonus(emp, amount) {
    amount = clamp(amount, 500, 2000);
    if (SAVE.company.cash < amount) return { ok: false, reason: "Not enough cash for that bonus." };
    SAVE.company.cash -= amount;
    emp.morale = clamp(emp.morale + Math.round(amount / 100), 0, 100);
    emp.stress = clamp(emp.stress - 8, 0, 100);
    Memory.record("bonus", [emp], { amount });
    officeToast(`💵 $${amount.toLocaleString()} bonus paid to ${emp.first}. Morale up.`, "gold");
    Persistence.write();
    return { ok: true };
  }

  function warn(emp) {
    emp.warned++;
    emp.morale = clamp(emp.morale - 15, 0, 100);
    emp.stress = clamp(emp.stress + 10, 0, 100);
    if (emp.personality === "slacker") emp.pWorkBoost = (emp.pWorkBoost || 0) + 0.35; // temporary behavior shift, decays in Employees
    Memory.record("warned", [emp], {});
    officeToast(`⚠️ ${emp.first} has been formally warned. ${pick(["They'll be fine. Probably.", "The eye twitch has begun.", "HR file updated (in crayon)."])}`);
    Persistence.write();
  }

  function promote(emp) {
    emp.promoted++;
    emp.salary = Math.round(emp.salary * 1.1);
    emp.morale = clamp(emp.morale + 25, 0, 100);
    emp.stress = clamp(emp.stress + 5, 0, 100);
    Memory.record("promoted", [emp], { title: "Senior " + emp.role });
    Memory.chatAboutEvent({ type: "promoted", actors: [emp.id], data: {} });
    // jealousy from low-affinity peers
    for (const o of SIM.employees) if (o !== emp && o.status === "active" && Memory.affinity(o, emp) < -10) o.morale -= 4;
    officeToast(`🏅 ${emp.name} promoted to Senior ${emp.role}! (+10% salary)`, "gold");
    Persistence.write();
  }

  /* ---------- expansion ---------- */
  function buyDesk() {
    if (SAVE.expandedDesks >= ANNEX_DESKS.length) return { ok: false, reason: "Annex is full. The architect suggests a second building (not implemented; the architect was fired)." };
    if (SAVE.company.cash < DESK_PRICE) return { ok: false, reason: "Need $" + DESK_PRICE.toLocaleString() + "." };
    SAVE.company.cash -= DESK_PRICE;
    DESKS.push(ANNEX_DESKS[SAVE.expandedDesks]);
    SAVE.expandedDesks++;
    officeToast("🪑 New desk installed in the annex. It smells like flat-pack.", "gold");
    Persistence.write();
    return { ok: true };
  }

  function buyFacility(f) {
    if (SAVE.facilities.includes(f.id)) return { ok: false, reason: "Already owned." };
    if (SAVE.company.cash < f.cost) return { ok: false, reason: "Need $" + f.cost.toLocaleString() + "." };
    SAVE.company.cash -= f.cost;
    SAVE.facilities.push(f.id);
    if (f.id === "plants2") for (const e of SIM.employees) e.morale = clamp(e.morale + 5, 0, 100);
    officeToast(`${f.icon} ${f.name} installed!`, "gold");
    Persistence.write();
    return { ok: true };
  }

  function isBoss(emp) { return !!(emp && (emp.isPlayer || emp.isBoss)); }

  /* seed initial projects for a fresh game */
  function seedFresh() {
    if (SAVE.projects.length) return;
    const bp = PROJECT_BLUEPRINTS[0];
    const p = newProject(bp);
    if (p.ok) {
      // auto-assign two best fits
      const pool = [...SIM.employees].sort((a, b) => skillFit(b, p.project) - skillFit(a, p.project));
      for (let i = 0; i < Math.min(2, pool.length); i++) assign(pool[i], p.project);
    }
    SAVE.projectOffers = PROJECT_BLUEPRINTS.filter(x => x.id !== bp.id).map(x => x.id);
  }

  function allProjects() { return SAVE.projects; }
  function activeProjects() { return SAVE.projects.filter(p => p.status === "active"); }
  function projectById(id) { return SAVE.projects.find(p => p.id === id); }

  return { makeEmployee, registerEmployee, genCandidates, hire, fire, freeDesks, newProject, assign, assignAuto, unassign, skillFit, noteCodeEdit, progressDay, completeProject, failProject, endOfDayFinance, employeeDayTick, bonus, warn, promote, buyDesk, buyFacility, isBoss, seedFresh, allProjects, activeProjects, projectById, dailyRevenue, dailyExpenses, runwayDays, salariesPerDay, qualityFactor };
})();

/* ---------- investors (SAVE.investors) ---------- */
const Investors = (() => {
  function evaluate(what, payload) {
    // adjust confidence from real company state; called after meaningful events
    const cash = SAVE.company.cash;
    const rep = SAVE.company.reputation;
    for (const inv of SAVE.investors) {
      let d = 0;
      switch (inv.style) {
        case "growth":    d += what === "projectDone" ? 6 : what === "projectFailed" ? -9 : what === "funding" ? 4 : what === "overdrawn" ? -14 : 0; break;
        case "tech":      d += what === "projectDone" ? (payload && payload.grade === "S" ? 9 : payload && payload.grade === "C" ? -2 : 4) : what === "projectFailed" ? -7 : what === "code" ? 2 : 0; break;
        case "cautious":  d += what === "overdrawn" ? -16 : cash > 30000 ? 3 : cash < 8000 ? -6 : 0; break;
        case "impatient": d += what === "projectDone" ? 7 : what === "projectFailed" ? -12 : what === "deadlineMissed" ? -8 : 0; break;
      }
      if (rep > 60) d += 0.5; if (rep < 35) d -= 0.5;
      inv.confidence = clamp(inv.confidence + d, 0, 100);
      inv.history.push({ day: SIM.day, what, d: Math.round(d * 10) / 10 });
      if (inv.history.length > 20) inv.history.shift();
    }
    Persistence.markDirty();
    checkWarnings();
  }

  function checkWarnings() {
    for (const inv of SAVE.investors) {
      if (inv.confidence < 25 && !inv.warned) {
        inv.warned = true;
        officeToast(`📉 ${INVESTOR_DEFS[inv.id].name.split("—")[0].trim()} is losing confidence in Synergy Labs. Meet them before it's too late.`, "red");
      }
      if (inv.confidence >= 40) inv.warned = false;
      if (inv.confidence <= 5 && inv.invested > 0) {
        // withdraw: pulls remaining capital support — revenue drops
        inv.withdrew = true;
        inv.invested_at_withdraw = inv.invested;
        SAVE.company.monthlyRevenue = Math.round(SAVE.company.monthlyRevenue * 0.85);
        inv.invested = 0;
        officeToast(`💔 ${INVESTOR_DEFS[inv.id].name.split("—")[0].trim()} HAS WITHDRAWN. Revenue outlook down. Rebuild trust to win them back.`, "red");
        Apps.pushChat("general", "Dana Whitfield", "I am not saying panic. I am saying the investor call is now 'mandatory'.");
        Investors.evaluate("overdrawn", null);
      }
      if (inv.withdrew && inv.confidence > 65) { inv.withdrew = false; inv.invested = inv.invested_at_withdraw || 5000; officeToast(`🤝 ${INVESTOR_DEFS[inv.id].name.split("—")[0].trim()} is reinvesting!`, "gold"); }
    }
  }

  function requestFunding(inv, amount) {
    const def = INVESTOR_DEFS[inv.id];
    const avgConf = inv.confidence;
    const rep = SAVE.company.reputation;
    const growth = SAVE.company.monthlyRevenue;
    let chance = 0.15 + avgConf / 130 + rep / 260 + Math.min(growth, 90000) / 400000;
    if (inv.withdrew) chance *= 0.3;
    const ok = Math.random() < chance;
    if (ok) {
      const given = Math.round(amount * (0.8 + Math.random() * 0.5));
      SAVE.company.cash += given;
      inv.invested += given;
      inv.confidence = clamp(inv.confidence + 5, 0, 100);
      unlockAchievement("funding");
      Persistence.write();
      return { ok: true, given, line: pick(def.lines.happy) };
    }
    inv.confidence = clamp(inv.confidence - 4, 0, 100);
    Persistence.write();
    return { ok: false, line: pick(def.lines.angry), hint: fundingHint(inv) };
  }

  function fundingHint(inv) {
    switch (inv.style) {
      case "growth": return "They want the revenue graph pointing up. Ship things.";
      case "tech": return "They want quality. Finish projects with high grades.";
      case "cautious": return "They want cash reserves. Stop bleeding money.";
      case "impatient": return "They want deadlines met. Deliver before day " + (SIM.day + 2) + ".";
    }
  }

  function dailyDrift() {
    // passive drift toward fundamentals so confidence isn't static
    const rev = Company.dailyRevenue(), exp = Company.dailyExpenses();
    for (const inv of SAVE.investors) {
      let d = 0;
      if (rev > exp) d += 0.3; else d -= 0.4;
      if (inv.style === "growth" && rev > exp) d += 0.4;
      if (inv.style === "cautious" && SAVE.company.cash < 10000) d -= 0.8;
      inv.confidence = clamp(inv.confidence + d, 0, 100);
    }
    checkWarnings();
    Persistence.markDirty();
  }

  function averageConfidence() { return SAVE.investors.reduce((s, i) => s + i.confidence, 0) / SAVE.investors.length; }

  return { evaluate, requestFunding, dailyDrift, averageConfidence, checkWarnings };
})();
