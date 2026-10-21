/* ===== persist.js — centralized versioned persistence layer =====
 * Save format:
 *   v1 (legacy): {day, minutes, achievements[], stats, settings, notifLog[]}
 *   v2 (current): everything in SAVE_VERSIONS.v2 shape (see DEFAULT_SAVE)
 * Migration runs on load; unknown versions are rejected, corrupted saves fall
 * back to defaults while preserving a backup copy under key + ".backup".
 */
"use strict";

const SAVE_KEY = "synergy.office.v1";      // legacy + current slot (versioned inside)
const SAVE_VERSION = 2;

function defaultSave() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    savedAt: Date.now(),
    day: 1, minutes: 8 * 60,
    achievements: [],
    stats: { pcsOpened: 0, uniquePcs: [], videosWatched: 0, secretsFound: [], coffeePc: 0 },
    settings: { sound: true, wallpaper: 0, accent: 0, dark: true },
    notifLog: [],

    // v2 — company & story
    player: null,                 // {name, skin, hair, hairColor, outfit, accessory, personality} or null (not created yet)
    elenaDeparted: false,
    company: {
      cash: 52000,
      seedFunding: 50000,
      monthlyRevenue: 54000,      // baseline product revenue
      operatingCost: 650,         // per workday
      ledger: [],                 // {day, revenue, expenses, cash, note}
      reputation: 50,
    },
    investors: [
      { id: "growth",  invested: 30000, confidence: 62, style: "growth",  metDay: 0, promises: [], history: [] },
      { id: "tech",    invested: 15000, confidence: 70, style: "tech",    metDay: 0, promises: [], history: [] },
      { id: "cautious",invested: 5000,  confidence: 58, style: "cautious",metDay: 0, promises: [], history: [] },
      { id: "impatient",invested: 0,    confidence: 50, style: "impatient", metDay: 0, promises: [], history: [] },
    ],
    projects: [],                 // see Company.newProject
    nextProjectId: 1,
    projectOffers: [],            // purchasable project blueprints

    employees: [],                // persistent slices of live employee objects
    nextEmpId: 14,                // boss(13) + 12 crew consumed ids 1..13
    relationships: {},            // "a:b" (sorted) -> affinity
    events: [],                   // capped structured event history
    nextEventId: 1,
    jokes: {},                    // id -> {count, stage, lastDay, targetId}
    discoveries: [],

    vfs: {},                      // empId -> file tree
    stickies: {},                 // empId -> [{text,color}]
    mail: {},                     // empId -> [mail]
    chats: null,                  // {channel: [{who, when, text}]} seeded lazily
    browsing: {},                 // empId -> {history: []}
    persona: {},                  // empId -> {wallpaper}
    firedEmployees: [],           // minimal records for history
    expandedDesks: 0,             // purchased annex desks
    facilities: [],               // ids of purchased facilities
    promises: [],                 // player promises to investors {id, text, dueDay, met:false}
  };
}

/* employees are stored as whitelisted persistent keys */
const EMP_PERSIST_KEYS = ["id","first","last","name","role","personality","desk","palette","hairStyle",
  "skills","salary","hiredDay","morale","stress","status","assignment","memories","productivity",
  "attendance","sickToday","warned","promoted","arrive","lunchAt","leaveAt","accessory","isBoss","gen"];

function stripEmployee(e) {
  const o = {};
  for (const k of EMP_PERSIST_KEYS) if (e[k] !== undefined) o[k] = e[k];
  return o;
}

const Persistence = (() => {
  let dirty = false, autosaveAcc = 0;

  function validate(d) {
    return d && typeof d === "object" && typeof d.day === "number" && typeof d.minutes === "number";
  }

  function migrate(d) {
    if (!d.version) { /* ---- v1 -> v2 ---- */
      const v2 = defaultSave();
      v2.createdAt = Date.now();
      for (const k of ["day", "minutes", "achievements", "stats", "settings", "notifLog"]) {
        if (d[k] !== undefined) v2[k] = d[k];
      }
      v2.stats = Object.assign(defaultSave().stats, d.stats || {});
      d = v2;
    }
    /* forward-safe defaults for any missing v2 field (never wipe progress) */
    const def = defaultSave();
    for (const k of Object.keys(def)) {
      if (d[k] === undefined) d[k] = def[k];
    }
    if (!Array.isArray(d.company.ledger)) d.company.ledger = [];
    if (!Array.isArray(d.events)) d.events = [];
    d.version = SAVE_VERSION;
    return d;
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return { save: defaultSave(), fresh: true }; }
    if (!raw) return { save: defaultSave(), fresh: true };
    try {
      const parsed = JSON.parse(raw);
      if (!validate(parsed)) throw new Error("invalid shape");
      return { save: migrate(parsed), fresh: false };
    } catch (e) {
      try { localStorage.setItem(SAVE_KEY + ".backup", raw); } catch (e2) {}
      return { save: defaultSave(), fresh: true, corrupted: true };
    }
  }

  function write() {
    try {
      const data = Object.assign({}, SAVE);
      data.day = SIM.day; data.minutes = SIM.minutes;   // clock is live in SIM
      data.savedAt = Date.now();
      data.employees = (SIM.employees || []).map(stripEmployee);
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      dirty = false;
      return true;
    } catch (e) {
      /* quota exceeded: drop heaviest optional payloads and retry once */
      try {
        const data = Object.assign({}, SAVE);
        data.day = SIM.day; data.minutes = SIM.minutes;
        data.savedAt = Date.now();
        data.employees = (SIM.employees || []).map(stripEmployee);
        for (const id of Object.keys(data.vfs || {})) {
          pruneVfs(data.vfs[id]);
        }
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        dirty = false;
        return true;
      } catch (e2) { return false; }
    }
  }

  function pruneVfs(tree, depth) {
    depth = depth || 0;
    let removed = false;
    for (const k of Object.keys(tree)) {
      const f = tree[k];
      if (f && f.type === "img" && f.dataURL && f.dataURL.length > 40000) { delete f.dataURL; removed = true; }
      if (f && f.type === "folder" && f.children) removed = pruneVfs(f.children, depth + 1) || removed;
    }
    return removed;
  }

  function tick(dts) {
    autosaveAcc += dts;
    if (autosaveAcc > 20) { autosaveAcc = 0; write(); }
  }
  function markDirty() { dirty = true; }
  function flushIfDirty() { if (dirty) write(); }

  function exportSave() {
    const data = Object.assign({}, SAVE);
    data.savedAt = Date.now();
    data.employees = (SIM.employees || []).map(stripEmployee);
    return JSON.stringify(data);
  }
  function importSave(json) {
    const parsed = JSON.parse(json);
    if (!validate(parsed)) throw new Error("Not a Synergy Labs save file");
    const migrated = migrate(parsed);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(migrated)); } catch (e) {}
    return migrated;
  }
  function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  return { load, write, tick, markDirty, flushIfDirty, exportSave, importSave, wipe, SAVE_VERSION };
})();
