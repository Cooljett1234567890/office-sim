/* ===== state.js — persistence, achievements, global sim state ===== */
"use strict";

const SIM = {
  day: 1,
  minutes: 8 * 60,          // game minutes since midnight
  speed: 60,                // 1 real second = 1 game minute
  paused: false,
  employees: [],
  boss: null,
  event: null,              // active event object
  activeEventName: "",
  desktopOpenFor: null,     // employee id in desktop mode
  followId: null,
  selectedEmployee: null,
};

const SAVE_KEY = "synergy.office.v1";

const DEFAULT_SAVE = () => ({
  day: 1, minutes: 8 * 60,
  achievements: [],
  stats: { pcsOpened: 0, uniquePcs: [], videosWatched: 0, secretsFound: [] },
  settings: { sound: true, wallpaper: 0, accent: 0, dark: true },
  notifLog: [],
});

let SAVE = DEFAULT_SAVE();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      SAVE = Object.assign(DEFAULT_SAVE(), data);
      SAVE.stats = Object.assign(DEFAULT_SAVE().stats, data.stats || {});
      SAVE.settings = Object.assign(DEFAULT_SAVE().settings, data.settings || {});
    }
  } catch (e) { /* corrupt save — start fresh */ }
  SIM.day = SAVE.day; SIM.minutes = SAVE.minutes;
}

let saveTimer = 0;
function tickSave(dt) {
  saveTimer += dt;
  if (saveTimer > 10) { saveTimer = 0; writeSave(); }
}
function writeSave() {
  try {
    SAVE.day = SIM.day; SAVE.minutes = SIM.minutes;
    localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
  } catch (e) { /* storage full/blocked */ }
}
window.addEventListener("beforeunload", writeSave);

/* ---------- achievements ---------- */
const ACHIEVEMENTS = [
  { id: "firstPC",   icon: "💻", name: "Tech Support",   desc: "Open your first employee PC." },
  { id: "fivePCs",   icon: "🖥️", name: "IT Auditor",     desc: "Open five different PCs." },
  { id: "youtube",   icon: "📺", name: "Caught in 4K",   desc: "Watch YouTube on an employee's computer." },
  { id: "busy",      icon: "📈", name: "Looking Busy",   desc: "Find the 'how to look busy' document." },
  { id: "fireDrill", icon: "🚨", name: "Orderly Evacuation", desc: "Survive a fire drill." },
  { id: "outage",    icon: "🔌", name: "Dark Ages",      desc: "Experience an internet outage." },
  { id: "coffee",    icon: "☕", name: "Barista",        desc: "Watch someone use the coffee machine." },
  { id: "night",     icon: "🌙", name: "Night Owl",      desc: "Peek at the office after 18:00." },
  { id: "gossip",    icon: "💬", name: "In the Group Chat", desc: "Read the office gossip channel." },
  { id: "paint",     icon: "🎨", name: "Picasso",        desc: "Draw something in Paint." },
  { id: "matrix",    icon: "🟩", name: "There Is No Spoon", desc: "Run a suspicious command in the terminal." },
  { id: "rick",      icon: "🕺", name: "Never Gonna…",   desc: "Play a certain 1987 hit." },
  { id: "mine",      icon: "💣", name: "Defused",        desc: "Win a game of Minesweeper." },
  { id: "birthday",  icon: "🎂", name: "Office Party",   desc: "Attend an office birthday." },
  { id: "snooze",    icon: "😴", name: "Do Not Disturb", desc: "Catch someone asleep at their desk." },
];

function unlockAchievement(id) {
  if (SAVE.achievements.includes(id)) return;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  SAVE.achievements.push(id);
  writeSave();
  officeToast(`${a.icon} Achievement unlocked — ${a.name}`, "gold");
  Audio2.chime();
}

/* ---------- helpers ---------- */
const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fmtTime = m => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
