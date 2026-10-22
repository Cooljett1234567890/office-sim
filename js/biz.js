/* ===== biz.js — GLASSWING product launch economy & interactive investor meetings =====
 * Extends (never duplicates) the existing systems:
 *   - money flows through Company.endOfDayFinance (day-keyed, idempotent)
 *   - confidence changes flow through Investors.evaluate / requestFunding
 *   - promises live in SAVE.promises and reuse the existing broken-promise machinery
 *   - meeting history lives in SAVE.meetings; product state in SAVE.product
 */
"use strict";

/* ---------- GLASSWING product economy ---------- */
const Product = (() => {
  const GLASSWING_BPID = "glasswing10";
  const LAUNCH_COST = 2000;

  /* conv = share of customers who actually pay; price = $/customer/month */
  const MODELS = [
    { id: "free_b2b",  name: "Free core + business subscriptions", price: 340, conv: 0.35, adoption: 1.2,  churn: 0.030, opFixed: 210, opPerCust: 2.2, vol: 0.20, rep: 5,  minQuality: 55, lumpy: 0,
      blurb: "Fast adoption, thin margins. Business seats pay the bills.", appeal: { growth: 2, tech: 0, cautious: -1, impatient: 0 } },
    { id: "tiers",     name: "Paid subscription tiers",            price: 190, conv: 0.90, adoption: 0.75, churn: 0.022, opFixed: 160, opPerCust: 1.6, vol: 0.14, rep: 3,  minQuality: 62, lumpy: 0,
      blurb: "Steady revenue per user, slower top-of-funnel.", appeal: { growth: 1, tech: 0, cautious: 1, impatient: 0 } },
    { id: "enterprise",name: "Enterprise licensing",               price: 900, conv: 1.00, adoption: 0.08, churn: 0.012, opFixed: 420, opPerCust: 3.4, vol: 0.30, rep: 4,  minQuality: 70, lumpy: 1,
      blurb: "Few, huge contracts. High support load, lumpy payments.", appeal: { growth: 0, tech: 0, cautious: 2, impatient: -1 } },
    { id: "freemium",  name: "Free launch + premium features",     price: 120, conv: 0.25, adoption: 1.6,  churn: 0.040, opFixed: 120, opPerCust: 1.1, vol: 0.22, rep: 7,  minQuality: 50, lumpy: 0,
      blurb: "Maximum reach, weak monetization until upgrades land.", appeal: { growth: 2, tech: 1, cautious: -1, impatient: 1 } },
  ];

  function model(id) { return MODELS.find(m => m.id === id) || null; }

  function ensure() {
    if (!SAVE.product) {
      SAVE.product = {
        launched: false, launchDay: null, monetization: null, earlyAccess: false,
        quality: 50, customers: 0, satisfaction: 70, bugs: 0, marketing: 0,
        totalRevenue: 0, totalCosts: 0, totalProfit: 0, dayRevenue: 0, dayCosts: 0,
        history: [], lastProcessedDay: 0, lastActionDay: {}, lastBugReportDay: 0,
      };
    }
    const p = SAVE.product;
    p.history = Array.isArray(p.history) ? p.history : [];
    p.lastActionDay = p.lastActionDay || {};
    return p;
  }

  function glasswing() {
    return SAVE.projects.find(p => p.bpId === GLASSWING_BPID && p.status !== "failed") || null;
  }

  /* launch readiness: shipped project required; strong active projects may go early-access */
  function readiness() {
    const gp = glasswing();
    if (!gp) return { ok: false, reason: "The GLASSWING v1.0 project has not been started. Find it under Projects → blueprints.", project: null, mode: null };
    if (SAVE.product && SAVE.product.launched) return { ok: true, reason: "Launched.", project: gp, mode: "launched" };
    if (gp.status === "done") return { ok: true, reason: "GLASSWING v1.0 shipped — ready for public launch.", project: gp, mode: "full" };
    if (gp.status === "active") {
      const pct = gp.workDone / gp.workRequired;
      if (pct >= 0.85 && gp.quality >= 50) return { ok: true, reason: "Early access: build is " + Math.round(pct * 100) + "% done — risky but launchable.", project: gp, mode: "early" };
      return { ok: false, reason: `Build is only ${Math.round(pct * 100)}% done (needs 100%, or ≥85% + quality 50+ for early access).`, project: gp, mode: null };
    }
    return { ok: false, reason: "GLASSWING v1.0 failed. A v1.1 rescue project does not exist (yet).", project: gp, mode: null };
  }

  function demandFactor(p) {
    const rep = SAVE.company.reputation;
    const conf = Investors.averageConfidence();
    return (0.55 + p.quality / 110) * (0.6 + rep / 110) * (0.85 + conf / 340);
  }

  function mrr(p) {
    p = p || SAVE.product;
    const m = p ? model(p.monetization) : null;
    if (!p || !p.launched || !m) return 0;
    return p.customers * m.price / 30 * m.conv;
  }

  /* one simulated day of product business — guarded so it can never run twice for one day */
  function dailyTick(day) {
    const p = SAVE.product;
    if (!p || !p.launched) return { revenue: 0, costs: 0, skipped: true };
    if (p.lastProcessedDay === day) return { revenue: 0, costs: 0, skipped: true };
    p.lastProcessedDay = day;
    const m = model(p.monetization);
    const daysSinceLaunch = day - p.launchDay;

    // decay marketing, satisfaction pull, bug accumulation
    p.marketing = Math.max(0, p.marketing * 0.97);
    const supportRecent = (day - (p.lastActionDay.support || -99)) <= 3;
    if (Math.random() < 0.25 + (100 - p.quality) / 180) {
      p.bugs = Math.min(25, p.bugs + (supportRecent ? 0.5 : 1));
    }
    const satTarget = 58 + p.quality * 0.25 - p.bugs * 1.6 + (supportRecent ? 6 : 0);
    p.satisfaction = clamp(p.satisfaction + (satTarget - p.satisfaction) * 0.3, 5, 98);

    // customer flows
    const churnRate = m.churn * (1.7 - p.satisfaction / 100) * (p.satisfaction < 35 ? 1.5 : 1);
    const lost = Math.min(p.customers, Math.round(p.customers * churnRate));
    const mMult = 1 + p.marketing * 0.3;
    const satF = 0.5 + p.satisfaction / 100 * 0.7;
    const qF = 0.6 + p.quality / 100 * 0.6;
    const hype = daysSinceLaunch <= 2 ? 1.5 : 1;    // launch-window bump
    const gained = Math.max(0, Math.round(m.adoption * 6 * demandFactor(p) * mMult * satF * qF * hype * rnd(0.8, 1.2)));
    p.customers = Math.max(0, p.customers - lost + gained);

    // money (monthly price → daily; enterprise pays in lumps)
    let rev = p.customers * m.price / 30 * m.conv * rnd(1 - m.vol, 1 + m.vol);
    if (m.lumpy) rev = p.customers * m.price / 30 * m.conv * (Math.random() < 0.18 ? rnd(2.5, 4) : rnd(0.2, 0.8));
    if (p.satisfaction < 35) rev *= 0.85;           // angry customers, refunds
    const costs = m.opFixed + p.customers * m.opPerCust + p.bugs * 14;
    rev = Math.max(0, Math.round(rev));
    const cost = Math.round(costs);

    p.dayRevenue = rev; p.dayCosts = cost;
    p.totalRevenue += rev; p.totalCosts += cost; p.totalProfit += rev - cost;
    p.history.push({ day, revenue: rev, costs: cost, customers: p.customers, mrr: Math.round(mrr(p)) });
    if (p.history.length > 40) p.history.shift();

    // reputation & investor consequences
    if (rev - cost > 800) SAVE.company.reputation = clamp(SAVE.company.reputation + 0.2, 0, 100);
    if (p.satisfaction < 30 && SAVE.company.reputation > 10) SAVE.company.reputation = clamp(SAVE.company.reputation - 0.3, 0, 100);
    if (p.bugs >= 10 && day - (p.lastBugReportDay || -99) >= 3) {
      p.lastBugReportDay = day;
      Investors.evaluate("bugs", null);
      officeToast(`🐞 GLASSWING has ${Math.round(p.bugs)} open bugs. Support tickets are piling up.`, "red");
    }
    if (mrr(p) >= 20000) unlockAchievement("mrr");
    Persistence.markDirty();
    return { revenue: rev, costs: cost, skipped: false, gained, lost };
  }

  function revenuePerDay() { const p = SAVE.product; return (p && p.launched) ? p.dayRevenue || 0 : 0; }
  function costPerDay() { const p = SAVE.product; return (p && p.launched) ? p.dayCosts || 0 : 0; }

  /* 30-day estimate ranges from current factors — explicitly an estimate */
  function forecast(mId) {
    const m = model(mId);
    const gp = glasswing();
    const q = gp ? gp.quality : 50;
    const fake = { quality: q, monetization: mId, customers: 0, satisfaction: clamp(q * 0.55 + 25 + SAVE.company.reputation * 0.15, 20, 95), bugs: 0, marketing: 0 };
    const churnRate = m.churn * (1.7 - fake.satisfaction / 100);
    const daily = m.adoption * 6 * demandFactor(fake) * satF(fake) * (0.6 + q / 100 * 0.6);
    const equil = Math.round(daily / Math.max(0.004, churnRate));
    const day1 = Math.round(daily * 4);
    const custs = [Math.round(day1 + (equil - day1) * 0.4), Math.round(day1 + (equil - day1) * 0.9)];
    const mrrLo = Math.round(custs[0] * m.price / 30 * m.conv * 30);
    const mrrHi = Math.round(custs[1] * m.price / 30 * m.conv * 30);
    const costLo = Math.round((m.opFixed + custs[0] * m.opPerCust) * 30);
    const costHi = Math.round((m.opFixed + custs[1] * m.opPerCust) * 30);
    return { custs, mrrLo, mrrHi, costLo, costHi, equil };
    function satF(x) { return 0.5 + x.satisfaction / 100 * 0.7; }
  }

  function launch(mId, early) {
    const r = readiness();
    if (!r.ok || r.mode === "launched") return { ok: false, reason: SAVE.product && SAVE.product.launched ? "GLASSWING is already live." : r.reason };
    const m = model(mId);
    if (!m) return { ok: false, reason: "Pick a monetization model first." };
    if (m.minQuality > r.project.quality && !early) return { ok: false, reason: `${m.name} needs build quality ${m.minQuality}+ (yours is ${r.project.quality | 0}). Ship more polish or choose a launch-friendlier model.` };
    if (SAVE.company.cash < LAUNCH_COST) return { ok: false, reason: `Launch costs $${LAUNCH_COST.toLocaleString()} (hosting + launch event). Not enough cash.` };
    const p = ensure();
    SAVE.company.cash -= LAUNCH_COST;
    p.launched = true;
    p.launchDay = SIM.day;
    p.monetization = m.id;
    p.earlyAccess = !!early && r.mode === "early";
    p.quality = Math.round(r.project.quality);
    p.customers = Math.max(3, Math.round(8 * m.adoption * (0.5 + p.quality / 80) * (p.earlyAccess ? 0.55 : 1)));
    p.satisfaction = clamp(p.quality * 0.55 + 25 + SAVE.company.reputation * 0.15 - (p.earlyAccess ? 8 : 0), 20, 95);
    p.bugs = p.earlyAccess ? 2 : 0;
    SAVE.company.reputation = clamp(SAVE.company.reputation + m.rep - (p.earlyAccess ? 2 : 0), 0, 100);
    Investors.evaluate("launch", { quality: p.quality, model: m.id });
    Memory.record("launch", [], { model: m.name, early: p.earlyAccess, quality: p.quality });
    Apps.pushChat("general", "Dana Whitfield", p.earlyAccess
      ? "GLASSWING is in early access. Support inbox: open. pray.png"
      : `GLASSWING IS LIVE. ${m.name}. Marketing says 'AI-first synergized productivity'. I say: we shipped.`);
    officeToast(p.earlyAccess
      ? `🛰 GLASSWING early access launched (${m.name}) — expect turbulence.`
      : `🛰 GLASSWING launched! ${m.name}. The servers are nervous.`, "gold");
    unlockAchievement("launch");
    Persistence.write();
    return { ok: true, product: p, model: m };
  }

  /* post-launch levers — cash costs, cooldowns, real effects */
  function marketing() {
    const p = ensure();
    if (!p.launched) return { ok: false, reason: "Nothing to market before launch." };
    const cool = 2 - (SIM.day - (p.lastActionDay.marketing || -99));
    if (cool > 0) return { ok: false, reason: `Marketing needs ${cool} more day(s) to plan the next push.` };
    if (SAVE.company.cash < 1500) return { ok: false, reason: "Marketing push costs $1,500." };
    SAVE.company.cash -= 1500;
    p.lastActionDay.marketing = SIM.day;
    p.marketing = Math.min(3, p.marketing + 1);
    officeToast("📣 Marketing push live. The internet has opinions.", "gold");
    Persistence.markDirty();
    return { ok: true };
  }
  function support() {
    const p = ensure();
    if (!p.launched) return { ok: false, reason: "No customers to support yet." };
    const cool = 2 - (SIM.day - (p.lastActionDay.support || -99));
    if (cool > 0) return { ok: false, reason: `Support rotation rests ${cool} more day(s).` };
    if (SAVE.company.cash < 900) return { ok: false, reason: "Support push costs $900." };
    SAVE.company.cash -= 900;
    p.lastActionDay.support = SIM.day;
    p.bugs = Math.max(0, p.bugs - 2);
    p.satisfaction = clamp(p.satisfaction + 6, 5, 98);
    officeToast("🧰 Support push: tickets crushed, bugs patched, customers mollified.");
    Persistence.markDirty();
    return { ok: true };
  }
  function upgrade() {
    const p = ensure();
    if (!p.launched) return { ok: false, reason: "Upgrade what, exactly?" };
    const cool = 4 - (SIM.day - (p.lastActionDay.upgrade || -99));
    if (cool > 0) return { ok: false, reason: `Engineering needs ${cool} more day(s) on the next release.` };
    if (SAVE.company.cash < 4000) return { ok: false, reason: "Product upgrade costs $4,000." };
    SAVE.company.cash -= 4000;
    p.lastActionDay.upgrade = SIM.day;
    p.quality = clamp(p.quality + 8, 0, 96);
    p.bugs = Math.max(0, p.bugs - 4);
    p.satisfaction = clamp(p.satisfaction + 4, 5, 98);
    officeToast("⬆ GLASSWING vNext deployed. Changelog has 41 emojis.", "gold");
    Persistence.markDirty();
    return { ok: true };
  }

  function status() { return (SAVE.product && SAVE.product.launched) ? SAVE.product : null; }
  function summary() {
    const p = ensure();
    const m = model(p.monetization);
    return {
      launched: p.launched, launchDay: p.launchDay, earlyAccess: p.earlyAccess,
      modelName: m ? m.name : "—", customers: p.customers, mrr: mrr(p),
      satisfaction: p.satisfaction, bugs: Math.round(p.bugs), marketing: p.marketing,
      dayRevenue: p.dayRevenue, dayCosts: p.dayCosts,
      totalRevenue: p.totalRevenue, totalCosts: p.totalCosts, totalProfit: p.totalProfit,
      quality: p.quality, history: p.history.slice(-10),
    };
  }

  return { ensure, readiness, launch, dailyTick, revenuePerDay, costPerDay, status, summary, forecast, MODELS, model, marketing, support, upgrade, mrr, GLASSWING_BPID, LAUNCH_COST };
})();

/* ---------- interactive investor meetings ---------- */
const InvestorMeetings = (() => {
  function avg(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }

  function canMeet(inv) { return inv.lastMeetingDay !== SIM.day; }

  /* evidence-strength per topic, computed from live game state (0..1) */
  function strength(topicId) {
    const c = SAVE.company;
    switch (topicId) {
      case "growth": {
        const led = c.ledger.slice(-10);
        if (led.length < 4) return 0.35 + Math.min(0.2, c.monthlyRevenue / 400000);
        const half = Math.floor(led.length / 2);
        const a = avg(led.slice(0, half).map(l => l.revenue)), b = avg(led.slice(half).map(l => l.revenue));
        return clamp(0.45 + (b - a) / Math.max(1, a) * 3, 0.1, 0.95);
      }
      case "tech": {
        const act = Company.activeProjects();
        const q = act.length ? avg(act.map(p => p.quality)) : 50;
        const done = SAVE.projects.filter(p => p.status === "done");
        const best = done.length ? Math.max(...done.map(p => p.grade === "S" ? 95 : p.grade === "A" ? 80 : p.grade === "B" ? 65 : 45)) : 0;
        const crew = avg(SIM.employees.filter(e => e.status === "active").map(e => e.skills.code)) / 100;
        return clamp(0.1 + q / 150 + best / 320 + crew * 0.15, 0.1, 0.95);
      }
      case "safety": {
        const net = Company.dailyRevenue() - Company.dailyExpenses();
        const runway = net >= 0 ? 90 : clamp(c.cash / -net, 0, 90);
        return clamp(0.18 + runway / 110 + (net > 0 ? 0.18 : -0.05), 0.08, 0.95);
      }
      case "delivery": {
        const done = SAVE.projects.filter(p => p.status === "done");
        const onTime = done.filter(p => p.onTime).length;
        const act = Company.activeProjects();
        const pace = act.length ? avg(act.map(p => (p.workDone / Math.max(1, p.workRequired) * 100) / Math.max(1, SIM.day - p.startedDay + 1))) : 0;
        return clamp(0.18 + (done.length ? onTime / done.length : 0) * 0.5 + Math.min(pace, 16) / 16 * 0.3, 0.1, 0.95);
      }
      case "launch": {
        const r = Product.readiness();
        if (!r.project) return 0.2;
        if (Product.status()) {
          const s = Product.summary();
          const trend = s.history.length > 3 ? s.history[s.history.length - 1].mrr - s.history[0].mrr : 0;
          return clamp(0.3 + s.customers / 600 + trend / 4000 + s.satisfaction / 400, 0.15, 0.95);
        }
        const pct = r.project.workDone / r.project.workRequired;
        return clamp(0.15 + pct * 0.5 + r.project.quality / 300, 0.1, 0.8);
      }
    }
    return 0.3;
  }

  function evidenceText(topicId) {
    const c = SAVE.company;
    switch (topicId) {
      case "growth": {
        const led = c.ledger.slice(-10);
        if (led.length < 4) return `Monthly revenue $${c.monthlyRevenue.toLocaleString()}. The ledger is too young to show a trend.`;
        const half = Math.floor(led.length / 2);
        const a = Math.round(avg(led.slice(0, half).map(l => l.revenue))), b = Math.round(avg(led.slice(half).map(l => l.revenue)));
        return `Revenue/day trended $${a.toLocaleString()} → $${b.toLocaleString()} over the last ${led.length} days. Monthly revenue $${c.monthlyRevenue.toLocaleString()}.`;
      }
      case "tech": {
        const act = Company.activeProjects();
        const q = act.length ? Math.round(avg(act.map(p => p.quality))) : 50;
        const done = SAVE.projects.filter(p => p.status === "done");
        const grades = done.map(p => p.grade).filter(Boolean);
        return `Active build quality ${q}/100. Shipped: ${done.length ? done.length + " project(s)" + (grades.length ? " (best grade " + grades.sort().reverse()[0] + ")" : "") : "none yet"}.`;
      }
      case "safety": {
        const net = Math.round(Company.dailyRevenue() - Company.dailyExpenses());
        return `Cash $${Math.round(c.cash).toLocaleString()}, net $${net.toLocaleString()}/day, runway ${Company.runwayDays()} days, ${done2() ? "no overdraws recently" : "ledger shows stress"}.`;
      }
      case "delivery": {
        const done = SAVE.projects.filter(p => p.status === "done");
        const onTime = done.filter(p => p.onTime).length;
        const act = Company.activeProjects();
        const worst = act.length ? act.slice().sort((a, b) => (a.deadlineDay - a.workDone / a.workRequired * 0) - (b.deadlineDay - b.workDone / b.workRequired * 0))[0] : null;
        return `Shipped ${done.length ? onTime + "/" + done.length + " on time" : "nothing yet"}. ${act.length} in flight${worst ? `, nearest deadline: ${worst.name} day ${worst.deadlineDay}` : ""}.`;
      }
      case "launch": {
        const s = Product.status();
        if (s) { const sm = Product.summary(); return `GLASSWING live day ${s.launchDay}: ${sm.customers.toLocaleString()} customers, MRR ~$${Math.round(sm.mrr).toLocaleString()}, satisfaction ${Math.round(sm.satisfaction)}%.`; }
        const r = Product.readiness();
        return r.project ? `GLASSWING v1.0: ${Math.round(r.project.workDone / r.project.workRequired * 100)}% built, quality ${r.project.quality | 0}/100, ${r.ok ? "launch-ready" : "not launch-ready"}.` : "GLASSWING v1.0 not started.";
      }
    }
    return "";
    function done2() { return c.ledger.length < 3 || c.ledger.slice(-3).every(l => l.cash > 0); }
  }

  /* ordered most→least relevant for this investor's style */
  function topics(inv) {
    const defs = [
      { id: "growth",  style: "growth",  label: "📈 Revenue growth story" },
      { id: "tech",    style: "tech",    label: "🔬 Engineering quality & innovation" },
      { id: "safety",  style: "safety",  label: "🛡 Financial stability & safeguards" },
      { id: "delivery",style: "delivery",label: "⏱ Delivery plan & deadlines" },
      { id: "launch",  style: "launch",  label: "🛰 GLASSWING launch & product plan" },
    ];
    return defs.map(d => {
      const s = strength(d.id);
      const match = d.style === inv.style ? 1.35 : d.style === "launch" ? 1.1 : (inv.style === "growth" && d.id === "tech") || (inv.style === "cautious" && d.id === "growth") ? 0.55 : 0.8;
      return Object.assign(d, { strength: s, evidence: evidenceText(d.id), match });
    }).sort((a, b) => (b.style === inv.style) - (a.style === inv.style) || b.strength * b.match - a.strength * a.match);
  }

  function makePromise(inv, kind, text, dueDay, extra) {
    const pr = Object.assign({ id: "pr" + Date.now() + ((Math.random() * 999) | 0), investor: inv.id, text, dueDay, met: false, kind: kind || "project" }, extra || {});
    SAVE.promises.push(pr);
    inv.promises.push(pr.id);
    Memory.record("promise", [], { text: pr.text, investor: inv.id });
    return pr;
  }

  function overpromiseTarget(inv, topicId) {
    switch (topicId) {
      case "growth": { const target = Math.max(20000, Math.round((SAVE.company.monthlyRevenue * 1.5) / 5000) * 5000); return { kind: "revenue", text: `Reach $${target.toLocaleString()} monthly revenue by day ${SIM.day + 6}`, target, dueDay: SIM.day + 6 }; }
      case "delivery": { const act = Company.activeProjects(); const p = act[0]; if (!p) return null; return { kind: "project", text: `Ship ${p.name} by day ${p.deadlineDay}`, dueDay: p.deadlineDay, projectId: p.id }; }
      case "tech": { const act = Company.activeProjects(); const p = act.sort((a, b) => a.quality - b.quality)[0]; if (!p) return null; return { kind: "quality", text: `Raise ${p.name} quality above 75 by day ${SIM.day + 5}`, dueDay: SIM.day + 5, projectId: p.id, target: 75 }; }
      case "launch": { if (Product.status()) return null; return { kind: "launch", text: `Launch GLASSWING by day ${SIM.day + 4}`, dueDay: SIM.day + 4 }; }
      case "safety": { return { kind: "revenue", text: `Keep net positive cash flow for 5 days`, target: 0, dueDay: SIM.day + 5, safety: true, cashAt: SAVE.company.cash }; }
    }
    return null;
  }

  function hold(inv, topicId, over) {
    if (!canMeet(inv)) return { ok: false, reason: `${INVESTOR_DEFS[inv.id].name.split("—")[0].trim()} already met you today. One meeting per investor per day.` };
    const topic = topics(inv).find(t => t.id === topicId);
    if (!topic) return { ok: false, reason: "Unknown topic." };
    inv.lastMeetingDay = SIM.day;
    inv.metDay = SIM.day;
    const skeptical = SIM.day < (inv.skepticalUntil || 0);
    let dConf, line, caught = false, promise = null;
    const def = INVESTOR_DEFS[inv.id];
    const mood = inv.confidence > 70 ? "happy" : inv.confidence > 40 ? "angry" : "angry";

    if (over) {
      const caughtChance = clamp(0.78 - topic.strength * 0.72 - (inv.style === "cautious" ? 0.1 : 0), 0.08, 0.75);
      caught = Math.random() < caughtChance;
      if (caught) {
        dConf = -Math.round(rnd(6, 11) + (inv.confidence > 60 ? 2 : 0));
        inv.skepticalUntil = SIM.day + 5;
        line = pick([`${def.name.split("—")[0].trim()}: "I fact-checked you mid-sentence. Those numbers don't exist."`,
                     `${def.name.split("—")[0].trim()}: "Bold claims. Where is the evidence? …That's what I thought."`,
                     `${def.name.split("—")[0].trim()}: "You just promised my own spreadsheet back to me. Wrongly."`]);
      } else {
        dConf = Math.round(clamp(topic.strength * 9 * topic.match * 1.9 + rnd(1, 3), 2, 16));
        const tgt = overpromiseTarget(inv, topicId);
        if (tgt) promise = makePromise(inv, tgt.kind, tgt.text, tgt.dueDay, { projectId: tgt.projectId, target: tgt.target, safety: tgt.safety });
        line = pick([`${def.name.split("—")[0].trim()}: "NOW we're talking. Put it in writing — I will."`,
                     `${def.name.split("—")[0].trim()}: "That's the energy I fund. Clock's ticking on that promise."`,
                     `${def.name.split("—")[0].trim()}: "Big claims. I'll allow it. Once."`]);
      }
    } else {
      const repeat = inv.lastTopic === topicId ? 0.55 : 1;   // same pitch twice in a row lands flat
      dConf = Math.round(clamp(topic.strength * 9 * topic.match * repeat + rnd(-1.5, 1.5), -4, 14));
      line = dConf >= 6 ? pick(def.lines.happy)
        : dConf >= 1 ? pick([`${def.name.split("—")[0].trim()}: "Noted. credible-ish. Keep it coming."`, `${def.name.split("—")[0].trim()}: "Fine pitch. The bar was on the floor."`])
        : pick(def.lines.angry);
    }
    inv.lastTopic = topicId;
    inv.confidence = clamp(inv.confidence + dConf, 0, 100);
    inv.history.push({ day: SIM.day, what: over ? "overpromise" : "meeting", d: dConf });
    if (inv.history.length > 20) inv.history.shift();
    const rec = { id: "mt" + Date.now() + ((Math.random() * 999) | 0), day: SIM.day, investor: inv.id, topic: topicId, over: !!over, caught, dConf };
    SAVE.meetings.push(rec);
    if (SAVE.meetings.length > 40) SAVE.meetings.shift();
    Memory.record("investorMeeting", [], { investor: inv.id, topic: topicId, dConf });
    Persistence.write();
    return { ok: true, dConf, line, caught, promise, topic, skeptical };
  }

  /* withdrawn investors: rebuild trust (no auto-reinstate — existing checkWarnings handles that at >65) */
  function apologize(inv) {
    if (!inv.withdrew) return { ok: false, reason: "They haven't withdrawn — an apology would confuse everyone." };
    if (!canMeet(inv)) return { ok: false, reason: "You already met today." };
    inv.lastMeetingDay = SIM.day; inv.metDay = SIM.day;
    const dConf = Math.round(rnd(2, 5));
    inv.confidence = clamp(inv.confidence + dConf, 0, 100);
    inv.history.push({ day: SIM.day, what: "apology", d: dConf });
    SAVE.meetings.push({ id: "mt" + Date.now() + ((Math.random() * 999) | 0), day: SIM.day, investor: inv.id, topic: "apology", over: false, caught: false, dConf });
    Persistence.write();
    return { ok: true, dConf, line: `${INVESTOR_DEFS[inv.id].name.split("—")[0].trim()}: "…Apology accepted. Provisionally. Show me numbers, not sorry."` };
  }

  /* preserves the old one-click quarterly report, now with real stakes + cooldown */
  function quickReport(inv) {
    const map = { growth: "growth", tech: "tech", cautious: "safety", impatient: "delivery" };
    return hold(inv, map[inv.style] || "growth", false);
  }

  return { canMeet, topics, hold, apologize, quickReport, makePromise, strength };
})();

/* classic-script visibility for cross-file guards (company.js checks window.Product) */
window.Product = Product;
window.InvestorMeetings = InvestorMeetings;
