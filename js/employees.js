/* ===== employees.js — behavior AI, personalities, pathing ===== */
"use strict";

const Employees = (() => {
  let nextId = 1;

  function makeEmp(def, deskIdx) {
    const [first, last, role, personality] = def;
    const ai = PERSONALITY_AI[personality];
    return {
      id: nextId++, first, last, name: `${first} ${last}`, role, personality,
      ai, desk: deskIdx, seed: Math.random() * 10,
      palette: PALETTES[(nextId - 1) % PALETTES.length],
      hairStyle: pick(["flat", "bun", "long", "flat", "curly"]),
      x: (DESKS[deskIdx] || BOSS_DESK).x, y: (DESKS[deskIdx] || BOSS_DESK).y + 48,
      state: "away", screen: "code", screenModeTyping: false,
      path: null, pathIdx: 0, intent: null, timer: 0, decisionTimer: rnd(2, 8),
      mood: "neutral", moving: false, sweat: false, blink: false,
      away: true, mugHot: false,
      arrive: 8 * 60 + rnd(0, 50), lunchAt: 12 * 60 + rnd(0, 45), leaveAt: 17 * 60 + rnd(10, 55),
      caught: 0, pretendTimer: 0, stepAcc: 0, partner: null,
    };
  }

  function create() {
    if (SAVE.employees && SAVE.employees.length) {
      SIM.employees = SAVE.employees.map(s => hydrate(s)).filter(e => e.status === "active");
    } else {
      SIM.employees = CREW_DEF.map(d => Company.makeEmployee({ first: d[0], last: d[1], role: d[2], personality: d[3], desk: d[4] }));
      for (const e of SIM.employees) e.persona = null;
      Persistence.markDirty();
    }
  }

  /* rebuild a runtime employee from its saved persistent slice */
  function hydrate(s) {
    const e = Company.makeEmployee({
      id: s.id,
      first: s.first, last: s.last, role: s.role, personality: s.personality, desk: s.desk,
      skills: s.skills, salary: s.salary, palette: s.palette, hairStyle: s.hairStyle,
    });
    for (const k of ["morale", "stress", "status", "assignment", "memories", "productivity", "attendance", "warned", "promoted", "hiredDay", "sickToday", "accessory", "caught"]) {
      if (s[k] !== undefined) e[k] = s[k];
    }
    return e;
  }

  const deskPos = e => (e.desk >= 0 ? DESKS[e.desk] : BOSS_DESK);
  const seatPos = e => { const d = deskPos(e); return { x: d.x, y: d.y + 48 }; };

  /* ---------- pathing ---------- */
  function nearestLane(x) { return LANES.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a, LANES[0]); }
  function nearestAisle(y) {
    const rows = [AISLES.top, AISLES.mid1, AISLES.mid2, AISLES.main];
    return rows.reduce((a, b) => Math.abs(b - y) < Math.abs(a - y) ? b : a, rows[0]);
  }
  function routeTo(e, target, via) {
    const rows = [AISLES.top, AISLES.mid1, AISLES.mid2, AISLES.main];
    const near = (val, arr) => arr.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a, arr[0]);
    const path = [];
    const seat = seatPos(e);
    const atDesk = !e.moving && Math.hypot(e.x - seat.x, e.y - seat.y) < 8;
    const start = atDesk ? seat : { x: e.x, y: e.y };
    path.push(start);
    // step 1: to nearest clear aisle row
    const aisleY = near(start.y + (atDesk ? 55 : 20), rows);
    path.push({ x: start.x, y: aisleY });
    if (via) {
      // interior destination (e.g. meeting room): enter via the door, then straight to the target
      path.push({ x: via.x, y: aisleY });
      path.push(via);
      path.push({ x: target.x, y: target.y });
    } else {
      // step 2: along the aisle to the nearest vertical lane
      const lane = nearestLane(start.x + (target.x - start.x) * 0.5);
      path.push({ x: lane, y: aisleY });
      // step 3: vertical to the target's aisle row
      const targetAisle = near(target.y, rows);
      if (Math.abs(targetAisle - aisleY) > 4) {
        path.push({ x: lane, y: targetAisle });
        path.push({ x: target.x, y: targetAisle });
      }
      // step 4: to the target
      path.push({ x: target.x, y: target.y });
    }
    e.path = path.filter((p, i) => i === 0 || Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) > 3);
    e.pathIdx = 0;
  }

  function walkTo(e, target, intent, via) {
    routeTo(e, target, via);
    e.intent = intent; e.state = "walk"; e.moving = true; e.timer = 0;
  }

  /* ---------- decisions ---------- */
  function decide(e) {
    const ai = e.ai;
    const r = Math.random();
    // schedule overrides
    if ((e.personality === "workaholic" || (e.pWorkBoost || 0) > 0) && r < ai.pWork + (e.pWorkBoost || 0)) return actWork(e);
    let acc = 0;
    const table = [["coffee", ai.pCoffee], ["window", ai.pWindow], ["chat", ai.pChat], ["youtube", ai.pYoutube], ["sleep", ai.pSleep], ["walk", ai.pWalk], ["work", ai.pWork]];
    for (const [act, w] of table) {
      acc += w;
      if (r < acc) {
        if (act === "coffee") return actCoffee(e);
        if (act === "window") return actWindow(e);
        if (act === "chat") return actChat(e);
        if (act === "youtube") return actYoutube(e);
        if (act === "sleep") return actSleep(e);
        if (act === "walk") return actWalk(e);
        return actWork(e);
      }
    }
    return actWork(e);
  }

  function actWork(e) {
    e.state = "desk"; e.screen = pick(["code", "code", "sheet", "chat", "code", "sheet"]);
    e.screenModeTyping = e.screen !== "chat";
    e.timer = 0; e.decisionTimer = rnd(8, 25) * (e.personality === "workaholic" ? 1.6 : 1);
    e.mood = "neutral";
  }
  function actYoutube(e) {
    e.screen = "video"; e.screenModeTyping = false; e.state = "youtube";
    e.mood = "happy"; e.timer = 0;
    e.decisionTimer = rnd(25, 60);
  }
  function actSleep(e) {
    e.state = "asleep"; e.screen = "off"; e.screenModeTyping = false;
    e.timer = 0; e.decisionTimer = rnd(20, 45);
    Apps2.noteSnooze(e);
  }
  function actCoffee(e) {
    if (SIM.event && SIM.event.type === "coffeeBroke") return actWork(e);
    walkTo(e, SPOTS.coffee, "coffee");
  }
  function actWindow(e) {
    walkTo(e, pick([SPOTS.window1, SPOTS.window2, SPOTS.window3]), "gaze");
  }
  function actWalk(e) {
    const targets = [SPOTS.printer, SPOTS.water, SPOTS.sofa, SPOTS.whiteboard, SPOTS.fridge];
    walkTo(e, pick(targets), "stretch");
  }
  function actChat(e) {
    // find partner seated at desk
    const partners = SIM.employees.filter(o => o !== e && !o.away && o.state === "desk" && o.desk >= 0);
    if (!partners.length) return actWalk(e);
    const p = pick(partners);
    const d = deskPos(p);
    walkTo(e, { x: d.x + (d.x < 900 ? 62 : -62), y: d.y + 60 }, "chat", null);
    e.partner = p;
  }

  function bossNear(e) {
    const p = SIM.player;
    if (!p) return false;
    return Math.hypot(p.x - e.x, p.y - e.y) < 130;
  }

  /* ---------- update ---------- */
  function update(dt) {
    const all = [...SIM.employees].filter(Boolean);
    for (const e of all) {
      // arrival
      if (e.away) {
        if (!e.sickToday && SIM.minutes >= e.arrive && SIM.minutes < e.leaveAt) {
          e.away = false;
          const d = deskPos(e);
          e.x = SPOTS.exit.x + rnd(-40, 40); e.y = SPOTS.exit.y - 10;
          walkTo(e, seatPos(e), "arrive");
          if (Math.random() < 0.25) Apps2.note("arrive", `${e.name} just walked in.`);
        }
        continue;
      }
      // leaving time
      if (!e.isBoss && SIM.minutes >= e.leaveAt && e.state !== "walk" && e.state !== "fire" && e.state !== "leave" && (!SIM.event || SIM.event.type !== "fire")) {
        walkTo(e, SPOTS.exit, "leave");
        Apps2.note("leave", `${e.name} is heading home for the day. 👋`);
        continue;
      }
      // boss intimidation — the player IS the boss now
      if (e.state !== "pretend" && e.state !== "fire" && e.state !== "meeting") {
        if (bossNear(e) && (e.state === "youtube" || e.state === "asleep")) {
          startPretend(e);
        }
      }
      if (e.pretendTimer > 0) {
        e.pretendTimer -= dt;
        if (e.pretendTimer <= 0 && e.state === "pretend") actYoutubeResumeOrWork(e);
      }
      e.sweat = bossNear(e) && (e.personality === "slacker" || e.caught > 0) && e.state !== "walk";

      switch (e.state) {
        case "walk": stepWalk(e, dt); break;
        case "desk": case "youtube": case "pretend":
          e.timer += dt; e.decisionTimer -= dt;
          if (e.pWorkBoost > 0) e.pWorkBoost = Math.max(0, e.pWorkBoost - dt * 0.01);
          if (Math.random() < dt * 6) Audio2.type();
          if (e.state === "youtube" && Math.random() < dt * 0.05) e.mood = pick(["happy", "happy", "neutral"]);
          if (e.decisionTimer <= 0) { if (!e.isBoss) decide(e); else e.decisionTimer = 9999; }
          break;
        case "asleep":
          e.timer += dt; e.decisionTimer -= dt;
          if (e.decisionTimer <= 0 || bossNear(e)) { actWork(e); }
          break;
        case "coffee":
          e.timer += dt;
          if (e.timer < 3.5) { if (!e.brewing) { e.brewing = true; Audio2.coffeeOn(); } }
          else if (e.brewing) { e.brewing = false; Audio2.coffeeOff(); e.mugHot = true; e.state = "sip"; e.timer = 0; e.decisionTimer = rnd(6, 12); }
          break;
        case "sip":
          e.timer += dt; e.decisionTimer -= dt;
          if (Math.random() < dt * 0.3) e.mugHot = true;
          if (e.decisionTimer <= 0) { e.mugHot = false; walkTo(e, seatPos(e), "arrive"); }
          break;
        case "gaze":
          e.timer += dt; e.decisionTimer -= dt;
          e.mood = "happy";
          if (e.decisionTimer <= 0) walkTo(e, seatPos(e), "arrive");
          break;
        case "chat":
          e.timer += dt; e.decisionTimer -= dt;
          if (Math.random() < dt * 0.8) Audio2.chatter(camDistVol(e));
          if (e.decisionTimer <= 0) {
            if (e.partner && e.partner.state !== "walk" && !e.partner.away) e.partner.screen = "chat";
            e.partner = null;
            walkTo(e, seatPos(e), "arrive");
          }
          break;
        case "stretch":
          e.timer += dt; e.decisionTimer -= dt;
          if (e.decisionTimer <= 0) walkTo(e, seatPos(e), "arrive");
          break;
        case "lunch":
          e.timer += dt; e.decisionTimer -= dt;
          if (Math.random() < dt * 0.4) Audio2.chatter(camDistVol(e));
          if (e.decisionTimer <= 0) walkTo(e, seatPos(e), "arrive");
          break;
        case "meeting":
          e.timer += dt;
          break;
        case "fire":
          stepWalk(e, dt);
          break;
        case "wait":
          e.timer += dt;
          break;
        case "leave":
          stepWalk(e, dt);
          break;
      }
    }
    // sick employees just… aren't around. lunch/leaving handled above
  }

  function actYoutubeResumeOrWork(e) { e.state = "youtube"; e.screen = "video"; e.decisionTimer = rnd(15, 40); }

  function startPretend(e) {
    const wasSlacking = e.state === "youtube" || e.state === "asleep";
    e.state = "pretend"; e.screen = "sheet"; e.screenModeTyping = true;
    e.pretendTimer = rnd(14, 26); e.mood = "panicked"; e.sweat = true; e.caught++;
    if (wasSlacking) {
      // the boss physically walked in on them — record it and feed the joke machine
      Memory.record(e.caught > 1 ? "caughtRepeat" : "caught", [e], { day: SIM.day });
      Jokes.bumpJoke("caughtScreens", e.id);
      Apps2.note("caught", `You walked in on ${e.first} — the alt-tab was audible.`);
    }
  }

  function camDistVol(e) {
    const c = Office.cam;
    const d = Math.hypot(e.x - c.x, e.y - c.y);
    return clamp(0.06 - d / 2400, 0, 0.06);
  }

  function stepWalk(e, dt) {
    if (!e.path || e.pathIdx >= e.path.length) { onArrive(e); return; }
    const t = e.path[e.pathIdx];
    const dx = t.x - e.x, dy = t.y - e.y;
    const dist = Math.hypot(dx, dy);
    const speed = e.state === "fire" ? 95 : 62;
    if (dist < 4) { e.pathIdx++; if (e.pathIdx >= e.path.length) onArrive(e); return; }
    e.x += dx / dist * speed * dt; e.y += dy / dist * speed * dt;
    e.x = clamp(e.x, 40, WORLD.w - 40); e.y = clamp(e.y, 105, WORLD.h - 34);
    e.stepAcc += dt * speed;
    if (e.stepAcc > 34) { e.stepAcc = 0; Audio2.step(camDistVol(e) * 2.4); }
  }

  function onArrive(e) {
    e.moving = false; e.path = null;
    switch (e.intent) {
      case "arrive": case null: actWork(e); break;
      case "coffee": e.state = "coffee"; e.timer = 0; unlockCoffee(); break;
      case "gaze": e.state = "gaze"; e.decisionTimer = rnd(8, 18); break;
      case "stretch": e.state = "stretch"; e.decisionTimer = rnd(6, 14); break;
      case "chat": e.state = "chat"; e.decisionTimer = rnd(10, 22); e.mood = "happy";
        if (e.partner) { e.partner.screen = "chat"; e.partner.mood = "happy"; } break;
      case "lunch": e.state = "lunch"; e.decisionTimer = rnd(22, 40); break;
      case "meeting": e.state = "meeting"; e.screen = "present"; break;
      case "fire": e.state = "wait"; e.timer = 0; if (SIM.event && SIM.event.type === "fire") e.evacuated = true; break;
      case "leave": e.away = true; e.state = "away"; e.screen = "off"; break;
      case "patrol": e.state = "patrol"; e.timer = 0; break;
      default: actWork(e);
    }
  }

  let coffeeSeen = 0;
  function unlockCoffee() { coffeeSeen++; if (coffeeSeen >= 1) unlockAchievement("coffee"); }

  /* ---------- boss ---------- */
  function updateBoss(b, dt) {
    if (b.away) return;
    if (b.state === "walk") { stepWalk(b, dt); return; }
    b.timer += dt;
    if (b.state === "patrol") {
      if (b.timer > rnd(5, 11)) walkTo(b, seatPos(b), "arrive");
      return;
    }
    if (b.state === "desk" && b.timer > b.patrolIn) {
      b.patrolIn = rnd(70, 140);
      const target = { x: rnd(350, 1450), y: pick([AISLES.mid1 + 55, AISLES.mid2 + 55, AISLES.main]) };
      walkTo(b, target, "patrol");
    }
  }

  /* ---------- meeting & event control ---------- */
  function goToMeeting(e, seat) {
    e.partner = null; e.pretendTimer = 0;
    walkTo(e, seat, "meeting", MEETING_DOOR);
  }
  function endMeeting(e) { walkTo(e, seatPos(e), "arrive"); }
  function startFireDrill(e) {
    e.partner = null; e.pretendTimer = 0;
    if (e.state === "coffee" || e.state === "sip") { Audio2.coffeeOff(); e.brewing = false; e.mugHot = false; }
    walkTo(e, { x: SPOTS.exit.x + rnd(-90, 90), y: SPOTS.exit.y - 6 }, "fire");
    e.mood = "panicked";
  }
  function endFireDrill(e) {
    e.mood = "neutral";
    walkTo(e, seatPos(e), "arrive");
  }
  function sendToLunch(e) {
    if (e.state === "walk") return;
    walkTo(e, { x: SPOTS.lunch.x + rnd(-45, 45), y: SPOTS.lunch.y + rnd(0, 18) }, "lunch");
  }
  function internetOutage(e) {
    if (e.state === "desk" || e.state === "pretend") {
      e.screen = pick(["chat", "code", "off"]);
      e.mood = "annoyed";
      e.decisionTimer = Math.min(e.decisionTimer || 999, rnd(6, 14));
    }
    if (e.state === "youtube") { e.screen = "off"; e.mood = "annoyed"; e.decisionTimer = Math.min(e.decisionTimer || 999, rnd(4, 8)); }
  }
  function internetBack(e) { if (e.state === "desk" && e.screen === "off") e.screen = "code"; e.mood = "neutral"; }

  /* day reset */
  function resetDay() {
    for (const e of [...SIM.employees, SIM.player]) {
      if (!e) continue;
      e.away = true; e.state = "away"; e.path = null; e.screen = "code";
      e.mood = "neutral"; e.partner = null; e.pretendTimer = 0; e.lunched = false; e.mugHot = false;
      if (e.isPlayer) { e.away = false; e.state = "desk"; e.x = seatPos(e).x; e.y = seatPos(e).y; continue; }
      e.x = seatPos(e).x; e.y = seatPos(e).y;
    }
  }

  /* snooze tracking for achievement */
  const snoozed = new Set();
  function noteSnooze(e) {
    snoozed.add(e.id);
    if (snoozed.size >= 1) unlockAchievement("snooze");
  }

  function extWalk(e, target, intent) {
    if (e.state === "walk" || e.state === "fire" || e.state === "meeting") return;
    walkTo(e, target, intent);
  }

  return { create, update, goToMeeting, endMeeting, startFireDrill, endFireDrill, sendToLunch, internetOutage, internetBack, resetDay, deskPos, seatPos, extWalk };
})();

/* apps2 shim: notifications from behavior layer (defined later, guarded) */
var Apps2 = {
  note(kind, text) { if (window.Apps && Apps.officeNote) Apps.officeNote(kind, text); },
  noteSnooze() { unlockAchievement("snooze"); },
};
