/* ===== events.js — day cycle, meetings, random office events ===== */
"use strict";

/* office-level toast (top right of the office view) */
function officeToast(text, cls) {
  const t = el("div", "toast" + (cls ? " " + cls : ""), text);
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; }, 5200);
  setTimeout(() => t.remove(), 5700);
  if (SAVE.notifLog) { SAVE.notifLog.push({ t: fmtTime(SIM.minutes), text }); if (SAVE.notifLog.length > 60) SAVE.notifLog.shift(); }
}

const Events = (() => {
  const fired = {};          // per-day one-shot flags
  let fireDrillReturn = 0;
  let outageEnd = 0, coffeeEnd = 0;
  let birthdayDone = false, birthdayPerson = null, birthdayEnd = 0;
  let meetingActive = false;

  function flag(k) { const key = SIM.day + ":" + k; if (fired[key]) return false; fired[key] = true; return true; }

  function banner(text, ms) {
    const b = $("#hud-event");
    b.textContent = text;
    b.classList.remove("hidden");
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.add("hidden"), ms || 6000);
  }

  function update(dt) {
    /* ---- clock ---- */
    if (!SIM.paused) {
      SIM.minutes += dt * (SIM.speed / 60);
      if (SIM.minutes >= 24 * 60) endDay();
    }
    updateClockHud();

    /* ---- daily schedule ---- */
    // morning arrivals happen in employees.js
    if (SIM.minutes >= 10 * 60 + 30 && SIM.minutes < 10 * 60 + 45) {
      if (!meetingActive && flag("meeting")) startMeeting();
    } else if (meetingActive && SIM.minutes >= 10 * 60 + 45) {
      endMeeting();
    }

    // lunch waves 12:00-13:00
    if (SIM.minutes >= 12 * 60 && SIM.minutes < 13 * 60) {
      for (const e of SIM.employees) {
        if (!e.away && e.lunchAt <= SIM.minutes && !e.lunched && e.state !== "fire" && e.state !== "meeting" && e.state !== "walk") {
          e.lunched = true;
          Employees.sendToLunch(e);
        }
      }
    }

    // random events during work hours (~1-2 per day)
    if (SIM.minutes > 10 * 60 + 45 && SIM.minutes < 17 * 60) {
      if (Math.random() < dt * 0.0025) {
        const pool = ["fire", "outage", "coffee", "tipoff", "argument"];
        const choice = pick(pool);
        if (choice === "fire" && flag("fire")) startFire();
        else if (choice === "outage" && flag("outage")) startOutage();
        else if (choice === "coffee" && flag("coffee")) startCoffeeBroke();
        else if (choice === "tipoff") startTipoff();
        else if (choice === "argument") startArgument();
      }
    }

    // birthday at 15:00
    if (SIM.minutes >= 15 * 60 && !birthdayDone && flag("birthday")) startBirthday();
    if (birthdayDone && SIM.minutes >= birthdayEnd) birthdayDone = false;

    /* ---- ongoing event resolutions ---- */
    if (SIM.event) {
      const now = performance.now();
      if (SIM.event.type === "fire" && now > fireDrillReturn) endFire();
      if (SIM.event.type === "outage" && now > outageEnd) endOutage();
      if (SIM.event.type === "coffeeBroke" && now > coffeeEnd) endCoffeeBroke();
    }
  }

  /* ---------- meetings ---------- */
  function startMeeting() {
    meetingActive = true;
    let i = 0;
    for (const e of SIM.employees) {
      if (e.away) continue;
      Employees.goToMeeting(e, MEETING_SEATS[i % MEETING_SEATS.length]); i++;
    }
    banner("📋 Daily standup — Quantum Room");
    officeToast("Standup starting in the Quantum Room. Attendance: mandatory-ish.");
    Apps2.note("meeting", "Standup: GLASSWING v0.9 at 94.2%. Someone will ask about the memory leak again.");
    if (window.Apps && Apps.pushChat) Apps.pushChat("general", "Priya Raman", "Standup time! Quantum room 🏃");
  }
  function endMeeting() {
    meetingActive = false;
    for (const e of SIM.employees) if (!e.away && e.state === "meeting") Employees.endMeeting(e);
  }

  /* ---------- fire drill ---------- */
  function startFire() {
    SIM.event = { type: "fire" };
    fireDrillReturn = performance.now() + 15000;
    Audio2.alarm();
    banner("🚨 FIRE DRILL — proceed to the exit!", 15000);
    for (const e of SIM.employees) if (!e.away) Employees.startFireDrill(e);
    officeToast("This is not a drill. (It is a drill.)", "red");
    if (window.Apps && Apps.pushChat) Apps.pushChat("general", "Dana Whitfield", "FIRE DRILL. OUT. NOW. 🚨");
    Memory.record("drill", [], {});
  }
  function endFire() {
    const wasFire = SIM.event && SIM.event.type === "fire";
    SIM.event = null;
    if (wasFire) {
      for (const e of SIM.employees) if (!e.away) Employees.endFireDrill(e);
      unlockAchievement("fireDrill");
      banner("✅ Drill complete — back to work", 4000);
    }
  }

  /* ---------- internet outage ---------- */
  function startOutage() {
    SIM.event = { type: "outage" };
    outageEnd = performance.now() + rnd(25, 45) * 1000;
    banner("🔌 INTERNET OUTAGE — IT is on it", 8000);
    for (const e of SIM.employees) if (!e.away) Employees.internetOutage(e);
    officeToast("IT: 'Have you tried turning the router off and on?' Yes. Yes we have.", "red");
    unlockAchievement("outage");
    if (window.Apps && Apps.pushChat) Apps.pushChat("engineering", "Nico Duran", "upstream fiber is down. vendor says 20 min. we're survivors now");
    Apps2.note("net", "Internet outage in progress. Cloud sync paused. Slackers rejoice.");
  }
  function endOutage() {
    if (SIM.event && SIM.event.type === "outage") SIM.event = null;
    for (const e of SIM.employees) if (!e.away) Employees.internetBack(e);
    banner("🌐 Internet restored", 4000);
    officeToast("The router has been turned off and on. All is well.");
  }

  /* ---------- coffee machine breaks ---------- */
  function startCoffeeBroke() {
    SIM.event = { type: "coffeeBroke" };
    coffeeEnd = performance.now() + rnd(40, 70) * 1000;
    Audio2.coffeeOff();
    banner("☕ Coffee machine is DOWN", 8000);
    officeToast("Coffee machine error: 'descale me… if you dare'. IT has been notified. IT is afraid.", "red");
    if (window.Apps && Apps.pushChat) Apps.pushChat("random", "Nico Duran", "THE MACHINE IS DOWN. I REPEAT. THE MACHINE IS DOWN ☠️");
  }
  function endCoffeeBroke() {
    if (SIM.event && SIM.event.type === "coffeeBroke") SIM.event = null;
    banner("☕ Coffee machine revived", 4000);
    officeToast("Coffee restored. Productivity up 340%.");
  }

  /* ---------- coworker tipoff / workplace drama ---------- */
  function startTipoff() {
    const watchers = SIM.employees.filter(e => !e.away && e.state === "youtube");
    if (!watchers.length) return;
    const victim = pick(watchers);
    const reporter = pick(SIM.employees.filter(e => e !== victim && e.status === "active"));
    if (!reporter) return;
    officeToast(`👀 ${reporter.first} whispers: "${victim.first} is watching ${pick(["redstone tutorials", "a Minecraft series", "'just one video'", "coding (allegedly)"])} again."`);
    Memory.bumpJoke("caughtScreens", victim.id);
    Apps.pushChat(pick(["random", "memes"]), reporter.name, `${victim.first} is doing 'research' again. This is my witness statement. 📝`);
  }

  function startArgument() {
    const active = SIM.employees.filter(e => e.status === "active" && !e.away);
    if (active.length < 2) return;
    // arguments happen between people who already don't get along (or rarely, randomly)
    let a = null, b = null;
    for (let i = 0; i < 14; i++) {
      const x = pick(active), y = pick(active);
      if (x !== y && Memory.affinity(x, y) < -5) { a = x; b = y; break; }
    }
    if (!a) { a = pick(active); b = pick(active.filter(e => e !== a)); if (!b) return; }
    Memory.adjustAffinity(a, b, -6);
    Memory.record("argument", [a, b], { topic: pick(["the thermostat", "tabs vs spaces", "the last slice of pizza", "whose turn it is to feed Biscuit", "a semicolon"]) });
    Apps.pushChat(pick(["random", "engineering"]), a.name, `${b.first} and I are having a professional disagreement. In the Parking Lot of Feelings.`);
    if (Math.random() < 0.5) Apps.pushChat("random", pickColleagueName(), "someone said the thermostat argument got 'loud'. HR has been notified. HR is Dana. Dana is tired.");
  }

  function pickColleagueName() {
    const list = SIM.employees.filter(x => x.status === "active");
    return list.length ? pick(list).name : "Dana Whitfield";
  }

  /* ---------- birthday ---------- */
  function startBirthday() {
    const alive = SIM.employees.filter(e => !e.away && e.status === "active");
    if (!alive.length) { birthdayDone = true; birthdayEnd = SIM.minutes + 30; return; }
    birthdayDone = true;
    birthdayPerson = pick(alive);
    birthdayEnd = SIM.minutes + 90;
    banner(`🎂 It's ${birthdayPerson.first}'s birthday!`, 9000);
    officeToast(`🎂 It's ${birthdayPerson.name}'s birthday! Cake in the kitchen. Biscuit is not invited (again).`, "gold");
    Audio2.chime();
    Memory.record("birthday", [birthdayPerson], {});
    if (window.Apps && Apps.pushChat) Apps.pushChat("general", "Faye Haddad", `🎂🎂🎂 HAPPY BIRTHDAY ${birthdayPerson.first.toUpperCase()} 🎂🎂🎂 cake in the kitchen!`);
    Apps2.note("bday", `Birthday celebration in the kitchen for ${birthdayPerson.first}. Cake status: loaded.`);
    setTimeout(() => unlockAchievement("birthday"), 4000);
  }

  /* ---------- day rollover ---------- */
  function endDay() {
    if (endDay._running) return;
    endDay._running = true;
    // end-of-day systems run on the closing day
    Company.progressDay();
    Company.endOfDayFinance();
    Investors.dailyDrift();
    const fade = $("#day-fade");
    fade.classList.add("show");
    setTimeout(() => {
      SIM.day++; SIM.minutes = 8 * 60;
      SAVE.day = SIM.day; SAVE.minutes = SIM.minutes;
      Employees.resetDay();
      Company.employeeDayTick();
      SIM.event = null; meetingActive = false; birthdayDone = false;
      // check player promises
      for (const pr of SAVE.promises.filter(p => !p.met)) {
        if (SIM.day > pr.dueDay) {
          pr.broken = true;
          Memory.record("promiseBroken", [], { text: pr.text });
          for (const inv of SAVE.investors) inv.confidence = clamp(inv.confidence - (pr.investor === inv.id ? 12 : 3), 0, 100);
          officeToast(`💔 Promise broken: "${pr.text}". Investors noticed.`, "red");
        }
      }
      Persistence.write();
      fade.querySelector(".fade-text").textContent = `— Day ${SIM.day} —`;
      setTimeout(() => { fade.classList.remove("show"); endDay._running = false; }, 900);
      writeSave();
      officeToast(`☀️ Day ${SIM.day}. ${DAYS[(SIM.day - 1) % 5]}. Cash: $${Math.round(SAVE.company.cash).toLocaleString()}. Fresh coffee. Fresh bugs.`);
    }, 1300);
  }

  function updateClockHud() {
    const t = fmtTime(SIM.minutes);
    $("#hud-clock .hud-time").textContent = t;
    $("#hud-clock .hud-day").textContent = `${DAYS[(SIM.day - 1) % 5]} · Day ${SIM.day}`;
    const dc = $("#dt-clock"), dd = $("#dt-date");
    if (dc) {
      dc.textContent = t;
      const d = new Date(2026, 0, (SIM.day - 1) % 28 + 1);
      dd.textContent = `${DAYS[(SIM.day - 1) % 5].slice(0, 3)} ${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  return { update, banner };
})();
