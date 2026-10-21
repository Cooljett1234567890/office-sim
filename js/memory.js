/* ===== memory.js — structured events, employee memories, relationships, running jokes =====
 * Events: structured records in SAVE.events (capped). Each employee stores compact memory
 * references {eventId, w} where w = emotional weight. Relevance decides who keeps what.
 */
"use strict";

const Memory = (() => {
  const CAP_EVENTS = 240;
  const CAP_MEMORIES = 36;

  /* ---------- structured events ---------- */
  function record(type, actors, data, opts) {
    opts = opts || {};
    const ev = {
      id: SAVE.nextEventId++,
      type,
      day: SIM.day,
      time: fmtTime(SIM.minutes),
      actors: actors.map(a => a && a.id),           // employee/player ids
      data: data || {},
    };
    SAVE.events.push(ev);
    if (SAVE.events.length > CAP_EVENTS) SAVE.events.splice(0, SAVE.events.length - CAP_EVENTS);
    // distribute memories
    for (const a of actors) {
      if (!a || a.isPlayer) continue;
      const w = weightFor(type, a, actors, data);
      if (w > 0) remember(a, ev.id, w);
    }
    // observers: nearby employees remember lighter versions of social events
    if (opts.observers !== false && SOCIAL_EVENTS.has(type)) {
      for (const e of SIM.employees) {
        if (e.status !== "active" || actors.includes(e)) continue;
        if (Math.random() < 0.5) remember(e, ev.id, 1);
      }
    }
    Persistence.markDirty();
    return ev;
  }

  const SOCIAL_EVENTS = new Set(["caught", "caughtRepeat", "promoted", "fired", "hired", "birthday", "projectDone", "projectFailed", "argument", "warned", "bonus", "meeting"]);

  function weightFor(type, self, actors, data) {
    switch (type) {
      case "caught": case "caughtRepeat": return actors[0] === self ? 5 : 2;
      case "warned": return actors[0] === self ? 6 : 1;
      case "bonus": return actors[0] === self ? 7 : 2;
      case "promoted": return actors[0] === self ? 8 : 2;
      case "fired": return actors[0] === self ? 10 : 4;
      case "hired": return actors[0] === self ? 6 : 2;
      case "birthday": return 3;
      case "projectDone": case "projectFailed": return (data.team || []).includes(self.id) ? 6 : 2;
      case "argument": return actors.includes(self) ? 6 : 1;
      case "promise": case "promiseKept": case "promiseBroken": return 5;
      case "drill": return 2;
      case "outage": return 2;
      case "coffeeBroke": return 2;
      default: return 1;
    }
  }

  function remember(emp, eventId, w) {
    if (!emp.memories) emp.memories = [];
    // never duplicate the same event
    if (emp.memories.some(m => m.e === eventId)) return;
    emp.memories.push({ e: eventId, w, d: SIM.day });
    if (emp.memories.length > CAP_MEMORIES) {
      // forget the least emotionally significant old memory
      emp.memories.sort((a, b) => (b.w + recency(b)) - (a.w + recency(a)));
      emp.memories.length = CAP_MEMORIES;
    }
    Persistence.markDirty();
  }
  function recency(m) { return Math.max(0, 3 - (SIM.day - m.d) / 3); }

  function eventById(id) { return SAVE.events.find(e => e.id === id); }
  function memoriesOf(emp) {
    return (emp.memories || []).map(m => ({ mem: m, ev: eventById(m.e) })).filter(x => x.ev);
  }

  /* ---------- relationships ---------- */
  function affinity(a, b) {
    if (a.isPlayer || b.isPlayer) return SAVE.company.reputation || 50;
    const k = relKey(a.id, b.id);
    return SAVE.relationships[k] !== undefined ? SAVE.relationships[k] : 0;
  }
  function adjustAffinity(a, b, delta) {
    if (a.isPlayer || b.isPlayer) return;
    const k = relKey(a.id, b.id);
    SAVE.relationships[k] = clamp((SAVE.relationships[k] || 0) + delta, -100, 100);
    Persistence.markDirty();
  }
  function relLabel(v) {
    if (v > 45) return "close friends";
    if (v > 15) return "friendly";
    if (v > -15) return "civil";
    if (v > -45) return "tense";
    return "feuding";
  }

  // coworkers drift: friendships between same-aisle neighbors, personality kinship
  function dailyDrift() {
    for (let i = 0; i < SIM.employees.length; i++) {
      for (let j = i + 1; j < SIM.employees.length; j++) {
        const a = SIM.employees[i], b = SIM.employees[j];
        if (a.status !== "active" || b.status !== "active") continue;
        let d = 0;
        if (Math.abs(deskRow(a) - deskRow(b)) <= 1 && a.personality === b.personality) d = 0.4;
        else if (a.personality === b.personality) d = 0.15;
        if (a.personality === "perfectionist" && b.personality === "slacker") d = -0.2;
        if (a.personality === "workaholic" && b.personality === "slacker") d = -0.15;
        if (d) adjustAffinity(a, b, d);
      }
    }
  }
  function deskRow(e) { const d = Employees.deskPos(e); return Math.round(d.y / 100); }

  /* ---------- running jokes ---------- */
  /* def: {id, min1, min2, min3, lines: {1:[],2:[],3:[]}} — stages build with repeated triggers */
  const JOKE_DEFS = {
    caughtScreens: { label: n => "The " + n + " 'Research' Saga", mins: [2, 4, 6],
      lines: {
        1: ["Okay |{target}|. The 'spreadsheet' has a play button.", "|{target}| is doing 'market research' again 👀"],
        2: ["New rule: |{target}|'s monitor gets a curtain.", "Someone made a meme of |{target}| alt-tabbing. It's in #memes obviously.", "Paint masterpiece: '|{target}| The Series — Season {n}'."],
        3: ["|{target}| has embraced it. The desk now has a 'DO NOT DISTURB: RESEARCH' sign.", "HR has stopped filing reports about |{target}|. They've started laminating them.", "Breaking: |{target}| promoted to 'Head of Cursor Studies' (self-appointed)."],
      } },
    coffeeDrama: { label: n => "The Coffee Machine Chronicles", mins: [2, 3, 4],
      lines: {
        1: ["|{target}| is staring at the coffee machine like it owes them money.", "The machine broke and |{target}| took it personally."],
        2: ["|{target}| has a backup coffee strategy. It involves three mugs and denial.", "Morale update: |{target}| has written a strongly-worded letter to the machine."],
        3: ["|{target}| has been granted a personal espresso shrine. Facilities disapproves. Facilities fears.", "The machine and |{target}| have reached an understanding. Nobody asks questions."],
      } },
    printerChant: { label: n => "The Printer's Mystery Chant", mins: [2, 3, 5],
      lines: {
        1: ["The printer is chanting again. |{target}| says it's 'probably fine'.", "IT ticket #4402 reopened: 'printer still knows things'."],
        2: ["|{target}| tried to ask the printer what it wants. It printed a single 'NO'.", "New intern theory: the printer is training its own model. |{target}| believes it."],
        3: ["The printer's chant has synced with the office clock. |{target}| refuses to be alone with it.", "IT has declared the printer a 'load-bearing entity'. Nobody touches it now."],
      } },
  };

  function bumpJoke(id, targetId) {
    const j = SAVE.jokes[id] || (SAVE.jokes[id] = { count: 0, stage: 0, lastDay: 0, targetId: null });
    j.count++;
    if (targetId) j.targetId = targetId;
    j.lastDay = SIM.day;
    const def = JOKE_DEFS[id];
    if (def) {
      for (let s = def.mins.length; s >= 1; s--) {
        if (j.count >= def.mins[s - 1] && j.stage < s) {
          j.stage = s;
          if (s >= 3) unlockAchievement("joke");
          announceJoke(id, def, s);
          break;
        }
      }
    }
    Persistence.markDirty();
  }

  function announceJoke(id, def, stage) {
    const target = getEmp(SAVE.jokes[id].targetId);
    const tmpl = pick(def.lines[stage] || []);
    if (!tmpl) return;
    const text = tmpl.replace("{target}", target ? target.first : "someone").replace("{n}", SAVE.jokes[id].count);
    Apps.pushChat(pick(["random", "memes"]), pickColleagueName(), text);
    // stage-2 paint meme: someone creates meme file about the target
    if (stage === 2 && target) {
      const artist = pickColleague(target);
      if (artist) {
        const name = VFS.uniqueName(artist, "Pictures", "meme_" + (target.first.toLowerCase()), "png");
        VFS.writeFile(artist, "Pictures/" + name, { type: "img", seed: 100 + (SAVE.jokes[id].count * 7), memeAbout: target.id, content: "(procedural meme)" });
        Apps.pushChat("memes", artist.name, "I made art. It's in my Pictures. You're welcome. 🖼️");
      }
    }
    if (stage === 3 && target) {
      target.morale = clamp(target.morale + 4, 0, 100);
      const ev = record("jokePeak", [target], { joke: id });
      Memory.react && null;
    }
  }
  function pickColleagueName() { const e = pick(SIM.employees.filter(x => x.status === "active")); return e ? e.name : "Greg Bell"; }
  function pickColleague(not) { const c = SIM.employees.filter(x => x.status === "active" && x !== not); return c.length ? pick(c) : null; }

  function status() {
    const rows = [];
    for (const [id, j] of Object.entries(SAVE.jokes)) {
      const def = JOKE_DEFS[id];
      if (!def || !j.count) continue;
      const target = getEmp(j.targetId);
      rows.push(`${def.label(j.count)} — stage ${j.stage}/3 (×${j.count}, about ${target ? target.first : "?"})`);
    }
    return rows.join("\n") || "";
  }

  /* ---------- dialogue for talk interactions ---------- */
  function talkLines(emp) {
    const out = [];
    // personality baseline
    out.push(pick(TALK_LINES[emp.personality] || TALK_LINES.social));
    // memory-driven lines (most emotionally weighted recent memory)
    const mems = memoriesOf(emp).sort((a, b) => b.mem.w + recency(b.mem) - a.mem.w - recency(a.mem));
    const m = mems[0];
    if (m) {
      const ev = m.ev;
      const self = ev.actors && ev.actors[0] === emp.id;
      const others = (ev.actors || []).map(id => getEmp(id)).filter(Boolean);
      switch (ev.type) {
        case "caught": if (self) out.push(pick(MEMORY_REACT.caught)); break;
        case "warned": if (self) out.push(pick(MEMORY_REACT.warned)); break;
        case "bonus": if (self) out.push(pick(MEMORY_REACT.bonus)); break;
        case "promoted": if (self) out.push(pick(MEMORY_REACT.promoted)); break;
        case "fired": out.push("Still thinking about " + (others[0] ? others[0].first : "them") + ". " + pick(MEMORY_REACT.firedPeer)); break;
        case "projectDone": out.push(pick(MEMORY_REACT.projectDone)); break;
        case "projectFailed": out.push(pick(MEMORY_REACT.projectFailed)); break;
        case "promiseBroken": out.push("You said things would be different. About " + (ev.data.text || "that thing") + "."); break;
      }
    }
    // morale/stress flavor
    if (emp.stress > 70) out.push(pick(["I'm fine. The eye twitch is decorative.", "If one more ticket comes in, I'm joining the printer."]));
    if (emp.morale < 35) out.push(pick(["Everything is... fine? It's fine.", "I keep the resume updated. For cardio."]));
    // running jokes involving them
    for (const [id, j] of Object.entries(SAVE.jokes)) {
      if (j.targetId === emp.id && j.stage >= 2 && Math.random() < 0.5) {
        const def = JOKE_DEFS[id];
        if (def && def.lines[j.stage]) out.push(pick(def.lines[j.stage]).replace("{target}", emp.first).replace("{n}", j.count));
      }
    }
    return out.filter(Boolean).slice(0, 3);
  }

  /* chat flavor referencing real events, called from events.js */
  function chatAboutEvent(ev) {
    const pool = CHAT_MEMORY_LINES[ev.type];
    if (!pool) return;
    const target = getEmp(ev.actors && ev.actors[0]);
    const line = pick(pool)
      .replace("{target}", target ? target.first : "someone")
      .replace("{project}", ev.data.projectName || "the thing");
    Apps.pushChat(pick(["random", "general"]), pickColleagueName(), line);
  }

  /* ---------- discoveries (secrets) ---------- */
  /* specific virtual files / triggers that count as discoveries */
  const SECRET_FILES = {
    "Documents/nightjar_brief.txt": "secret:nightjar",
    "Documents/salary_compare.xlsx": "secret:payroll",
    "Documents/how_to_look_busy.txt": "secret:busy",
  };
  function discover(id, emp) {
    if (!id) return;
    if (SAVE.discoveries.includes(id)) return;
    SAVE.discoveries.push(id);
    Persistence.markDirty();
    officeToast("🔎 Noted something " + (emp && !emp.isPlayer ? "on " + emp.first + "'s machine… " : "…") + "(" + SAVE.discoveries.length + " threads noticed)");
    unlockAchievement("secret1");
    if (SAVE.discoveries.length >= SECRET_TOTAL) unlockAchievement("secretall");
  }
  function discoverPath(path, emp) {
    const id = SECRET_FILES[path];
    if (id) discover(id, emp);
  }
  const SECRET_TOTAL = 5; // nightjar, payroll, haunted, greg's readme, busy field guide

  return { record, eventById, memoriesOf, affinity, adjustAffinity, relLabel, dailyDrift, bumpJoke, status, talkLines, chatAboutEvent, discover, discoverPath, SECRET_FILES, JOKE_DEFS, SECRET_TOTAL };
})();


/* alias: jokes engine is part of Memory */
const Jokes = Memory;
