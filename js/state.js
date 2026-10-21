/* ===== state.js — persistence, achievements, global sim state ===== */
"use strict";

const SIM = {
  day: 1,
  minutes: 8 * 60,          // game minutes since midnight
  speed: 60,                // 1 real second = 1 game minute
  paused: false,
  employees: [],
  boss: null,               // deprecated NPC boss — the player is the boss now
  player: null,             // live player entity (Player module)
  event: null,              // active event object
  activeEventName: "",
  desktopOpenFor: null,     // employee id in desktop mode
  followId: null,
  selectedEmployee: null,
  mode: "office",           // office | desktop
};

let SAVE = null;
let SAVE_FRESH = false;

function loadSave() {
  const res = Persistence.load();
  SAVE = res.save;
  SAVE_FRESH = res.fresh;
  SIM.day = SAVE.day; SIM.minutes = SAVE.minutes;
  if (res.corrupted) officeToast("⚠️ Previous save was corrupted — a backup was kept and a fresh company was started.");
}

function writeSave() { Persistence.write(); }

window.addEventListener("beforeunload", () => Persistence.write());

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
  { id: "boss",      icon: "👔", name: "The New Boss",    desc: "Create your character and take over Synergy Labs." },
  { id: "hired",     icon: "🧑‍💼", name: "Welcome Aboard",  desc: "Hire your first employee." },
  { id: "fired",     icon: "📦", name: "HR Moment",       desc: "Fire an employee. They will remember." },
  { id: "shipped",   icon: "🚀", name: "It Ships!",       desc: "Complete a company project." },
  { id: "funding",   icon: "💰", name: "Dilated Rounds",  desc: "Convince an investor to give you more money." },
  { id: "rich",      icon: "🏦", name: "Runway Flex",     desc: "Hold $100,000 in company cash at once." },
  { id: "joke",      icon: "🤣", name: "Office Lore",     desc: "Let a running joke reach its final stage." },
  { id: "secret1",   icon: "🕵️", name: "Something's Off", desc: "Note your first contradiction around the office." },
  { id: "secretall", icon: "🧩", name: "Corporate Archaeologist", desc: "Uncover every hidden thread in the company." },
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

/* entity lookups */
function empById(id) { return SIM.employees.find(e => e.id === id) || null; }
function getEmp(id) {
  return SIM.employees.find(e => e.id === id) || (SIM.player && SIM.player.id === id ? SIM.player : null);
}
function relKey(a, b) { return Math.min(a, b) + ":" + Math.max(a, b); }
