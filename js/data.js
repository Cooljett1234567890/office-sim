/* ===== data.js — employees, personalities, content, world constants ===== */
"use strict";

/* ---------------- world layout constants (world px) ---------------- */
const WORLD = { w: 1920, h: 1080 };
const DESKS = [
  { x: 420,  y: 520 }, { x: 740,  y: 520 }, { x: 1060, y: 520 }, { x: 1380, y: 520 },
  { x: 420,  y: 700 }, { x: 740,  y: 700 }, { x: 1060, y: 700 }, { x: 1380, y: 700 },
  { x: 420,  y: 880 }, { x: 740,  y: 880 }, { x: 1060, y: 880 }, { x: 1380, y: 880 },
];
const AISLES = { top: 320, mid1: 620, mid2: 800, main: 990 };   // clear walking rows
const LANES  = [280, 560, 900, 1220];                           // clear vertical lanes (avoid meeting room)
const SPOTS = {
  coffee:   { x: 150,  y: 320 },
  fridge:   { x: 250,  y: 320 },
  printer:  { x: 340,  y: 320 },
  lunch:    { x: 300,  y: 360 },
  exit:     { x: 960,  y: 1042 },
  water:    { x: 1540, y: 990 },
  window1:  { x: 560,  y: 150 },
  window2:  { x: 800,  y: 150 },
  window3:  { x: 1040,y: 150 },
  whiteboard: { x: 1840, y: 620 },
  sofa:     { x: 180,  y: 770 },
};
const MEETING_DOOR = { x: 1520, y: 440 };
const MEETING_SEATS = [
  { x: 1600, y: 290 }, { x: 1690, y: 280 }, { x: 1780, y: 290 },
  { x: 1600, y: 380 }, { x: 1690, y: 395 }, { x: 1780, y: 380 },
];
const BOSS_DESK = { x: 1540, y: 700 };

/* ---------------- verified real YouTube videos ---------------- */
const VIDEOS = [
  { id: "B2esricKcE8",  title: "Redstone Builds Everyone Should Know",            chan: "Mumbo Jumbo",      tag: "Minecraft",   dur: "24:16", bg: "#3b6b3f", emoji: "⛏️" },
  { id: "u7lE0MG80qw",  title: "Surviving Your First Night! ▫ Minecraft Survival Guide [S2 Ep.1]", chan: "Pixlriffs", tag: "Minecraft", dur: "22:41", bg: "#4a5d3a", emoji: "🌙" },
  { id: "-uleG_Vecis",  title: "100+ Computer Science Concepts Explained",        chan: "Fireship",         tag: "Coding",      dur: "13:08", bg: "#2b2f4a", emoji: "🧠" },
  { id: "4RtUJkjrKMI",  title: "Surprise Video — What A Time To Be Alive!",       chan: "Two Minute Papers",tag: "AI",          dur: "8:03",  bg: "#1f3d5c", emoji: "🤖" },
  { id: "dQw4w9WgXcQ",  title: "Rick Astley — Never Gonna Give You Up",           chan: "Rick Astley",      tag: "Music",       dur: "3:33",  bg: "#4a2b4a", emoji: "🕺" },
  { id: "jNQXAC9IVRw",  title: "Me at the zoo",                                   chan: "jawed",            tag: "Classic",     dur: "0:19",  bg: "#5c5342", emoji: "🐘" },
];

/* ---------------- office names ---------------- */
const FIRST = ["Ava","Ben","Cleo","Dex","Eli","Faye","Gus","Hana","Iris","Jonas","Kira","Leo","Mona","Nico","Olive","Pia","Quinn","Ravi","Sana","Theo","Uma","Wren","Yara","Zed"];
const LAST = ["Chen","Okafor","Silva","Novak","Patel","Kim","Moreau","Baptiste","Iyer","Fox","Haddad","Mori","Lindqvist","Duran","Kowalski","Tanaka","Osei","Reyes"];

/* ---------------- fake intranet / web content ---------------- */
const INTRANET = {
  lunchMenu: [
    ["Mon", "Truffle mac & cheese", "Garden salad", "Miso soup"],
    ["Tue", "Korean beef bowls", "Kimchi slaw", "Tofu bibimbap"],
    ["Wed", "Wood-fired pizza day", "Caesar salad", "Tomato basil soup"],
    ["Thu", "Butter chicken", "Garlic naan", "Samosas"],
    ["Fri", "Taco bar 🌮", "Churros", "Horchata"],
  ],
  wikiPages: {
    "onboarding": { title: "Welcome to Synergy Labs 🎉", body: `Welcome aboard!\n\n• Standup is daily at 10:30 in the Quantum Room.\n• Coffee machine etiquette: if you take the last pod, you brew the next pot. This is enforced by honor and by Dana from HR.\n• The good snacks are on the second shelf. Yes, THAT shelf.\n• Office dog: Biscuit (golden retriever). Do not feed. He has opinions.` },
    "brand": { title: "Brand Guidelines", body: `Our logo is a slightly rounded square, like everything else in this company.\n\nPrimary color: "Optimistic Blue".\nSecondary: "Delay Purple" (named by the intern, we kept it).\n\nNever render the logo on a red background. Legal is still upset about the 2023 incident.` },
    "ai-model": { title: "Project GLASSWING — internal model notes", body: `STATUS: v0.9 — 94.2% on internal evals.\n\nKnown quirks:\n- Occasionally signs emails "Warm regards, GLASSWING".\n- Refuses to write haikus about databases. We don't know why.\n- MEMORY LEAK FIXED (finally) — thanks Priya.` },
  },
  hrEmails: [
    { from: "Dana Whitfield — HR", subject: "Reminder: Microwave Etiquette", body: "Team,\n\nIf your leftovers have achieved sentience, it is time to throw them away.\n\nThe fridge will be purged Friday at 4pm. The office is not responsible for lost worlds.\n\nWarm regards,\nDana" },
    { from: "Dana Whitfield — HR", subject: "Re: Re: FWD: fun cat picture", body: "Please use #memes for cat pictures.\n\nThis is the third time this month, Greg.\n\nWarm regards,\nDana" },
    { from: "IT — Ticket #4471", subject: "[RESOLVED] Printer possessed", body: "The printer has been exorcised.\n\nRoot cause: someone plugged a personal espresso machine into the UPS. Espresso machine has been confiscated. It lives in IT now.\n\n— IT" },
    { from: "Facilities", subject: "Fire drill Thursday 11:00", body: "This is NOT a drill.\n\nWell. It IS a drill. But you should treat it like it's not a drill.\n\nAssembly point: the parking lot, near the badminton net.\n\n— Facilities" },
    { from: "CEO — Priya Raman", subject: "All-hands notes 🎉", body: "Team,\n\nWe closed our Series A. There will be cake. There will also be a mandatory fun ping-pong tournament. I am not sorry.\n\n— Priya" },
    { from: "Payroll", subject: " Expense report flagged: 'emotional support keyboard'", body: "Hi,\n\nWe cannot reimburse a 'mechanical keyboard for emotional support'.\n\nHowever, 'productivity hardware' would be fine. Just saying.\n\n— Payroll" },
  ],
  reddit: {
    sub: "r/SynergyLabs",
    staticPosts: [
      { votes: "1.4k", user: "u/throwaway_4411", title: "PSA: the new dev saw the boss coming and alt-tabbed so fast the monitor flickered", body: "", comments: [["u/perf_gremlin", " muscles memory of a haunted gunslinger"], ["u/qa_menace", " that's just Tuesday"]] },
      { votes: "932", user: "u/latte_lord", title: "The coffee machine now has a queue system. It's a Jira ticket. For a coffee machine.", body: "We have peaked as a civilization.", comments: [["u/dana_hr", " It was either that or a duel."]] },
      { votes: "701", user: "u/biscuit_stan", title: "Biscuit update: he has learned to open the treat drawer", body: "We are no longer a startup, we are a logistics company for dog treats.", comments: [["u/eng_lead", " promotion when"]] },
      { votes: "566", user: "u/glasswing_dev", title: "Our AI wrote a haiku about databases. Its first one. Historic day.", body: "rows drift like soft snow\nindexes bloom in spring light\njoins bring quiet joy", comments: [["u/skeptical_sam", " okay it cooked"], ["u/dba_goblin", " starts crying in B-tree"]]},
    ],
  },
  chatSeed: {
    general: [
      ["Priya Raman", "Reminder: standup at 10:30. Keep it snappy, people 🏃"],
      ["Dana Whitfield", "Fire drill Thursday. Yes, again. The marshals need the practice."],
      ["Marco Diaz", "The 4th floor coffee machine is back. Rejoice."],
    ],
    engineering: [
      ["Priya Iyer", "GLASSWING v0.9 evals are at 94.2% 🎉"],
      ["Sam Reyes", "finally fixed the memory leak. it was, of course, one missing await"],
      ["Greg Bell", "who touched main"],
      ["Sam Reyes", "it was you, greg"],
    ],
    random: [
      ["Greg Bell", "day 41 of pretending the rubber duck on my desk is for 'debugging'"],
      ["Wren Osei", "just saw someone maximize a spreadsheet at lightning speed. we're all actors"],
      ["Marco Diaz", "printer is making The Sound again. it knows something we don't"],
      ["Dana Whitfield", "Please stop naming meeting rooms after fonts. Comic Sans is not a conference room."],
    ],
    memes: [
      ["Wren Osei", "me: I'll just fix one small bug\nthe bug: 😈"],
      ["Greg Bell", "\"quick meeting\" starters pack 🧵"],
      ["Faye Haddad", "POV: you said the standup could be an email"],
    ],
  },
};

const GOSSIP_LINES = [
  "did anyone else hear that?? 👀",
  "the coffee machine is DOWN. this is not a drill",
  "internet's out, going analog like it's 1999",
  "someone's getting caught watching youtube rn, rip",
  "cake in the kitchen. this is not a test 🎂",
  "boss is on the prowl. act natural",
  "why is the fire alarm doing that",
  "GLASSWING just wrote a better standup summary than I ever have",
  "who ate my yogurt. label said W.O.",
  "FYI the 3rd meeting room chair is cursed",
];

const BOSS_CATCH_LINES = [
  "“Everything okay over here?”",
  "“That... looks like a spreadsheet. Good.”",
  "“Deploying soon?”",
  "“Love the hustle.”",
];

/* ---------------- employee definitions ---------------- */
const PALETTES = [
  { body: "#5b8def", hair: "#2f2a33", skin: "#f2c9a4" },
  { body: "#e5647c", hair: "#6b4a2f", skin: "#eab38a" },
  { body: "#59c98f", hair: "#1f1f26", skin: "#8d5a3b" },
  { body: "#f0a45c", hair: "#c9c3b8", skin: "#f7d7b5" },
  { body: "#a67cf0", hair: "#3a2f4a", skin: "#c68863" },
  { body: "#4fc3e8", hair: "#5a3825", skin: "#f0c39a" },
  { body: "#f26d5b", hair: "#2a2a2a", skin: "#6e4326" },
  { body: "#7bd45c", hair: "#8a5a2b", skin: "#f5d0a8" },
  { body: "#e8c84f", hair: "#33302b", skin: "#b97f4e" },
  { body: "#cf6ce8", hair: "#241f2e", skin: "#f2c9a4" },
  { body: "#6cd0b3", hair: "#4a3220", skin: "#e8b88a" },
  { body: "#8899ff", hair: "#c8c0d8", skin: "#f5d5b8" },
];

const PERSONALITY_AI = {
  workaholic:    { pWork: 0.92, pCoffee: 0.03, pWindow: 0.02, pChat: 0.02, pYoutube: 0.0,  pSleep: 0.0,  pWalk: 0.01 },
  slacker:       { pWork: 0.25, pCoffee: 0.10, pWindow: 0.12, pChat: 0.10, pYoutube: 0.28, pSleep: 0.13, pWalk: 0.02 },
  memeAddict:    { pWork: 0.35, pCoffee: 0.10, pWindow: 0.06, pChat: 0.14, pYoutube: 0.30, pSleep: 0.03, pWalk: 0.02 },
  gamer:         { pWork: 0.40, pCoffee: 0.07, pWindow: 0.04, pChat: 0.09, pYoutube: 0.32, pSleep: 0.05, pWalk: 0.03 },
  researcher:    { pWork: 0.55, pCoffee: 0.07, pWindow: 0.10, pChat: 0.06, pYoutube: 0.06, pSleep: 0.02, pWalk: 0.14 },
  coffeeAddict:  { pWork: 0.50, pCoffee: 0.30, pWindow: 0.05, pChat: 0.06, pYoutube: 0.03, pSleep: 0.01, pWalk: 0.05 },
  perfectionist: { pWork: 0.80, pCoffee: 0.06, pWindow: 0.03, pChat: 0.04, pYoutube: 0.0,  pSleep: 0.0,  pWalk: 0.07 },
  social:        { pWork: 0.42, pCoffee: 0.10, pWindow: 0.08, pChat: 0.30, pYoutube: 0.04, pSleep: 0.02, pWalk: 0.04 },
};

const CODE_SNIPPETS = {
  js: `// pipeline.js — status: half-finished, do not judge
import { fetchTelemetry } from "./telemetry";

const RETRY_MAX = 3;

// TODO: remove before anyone sees this
export async function runPipeline(event) {
  const telemetry = await fetchTelemetry(event.deviceId);
  if (!telemetry) {
    // FIXME: silently swallowing errors is probably fine
    return { ok: false };
  }

  const enriched = telemetry.map(t => ({
    ...t,
    score: t.value * 1.21, // TODO: why 1.21. why.
  }));

  return enriched.sort((a, b) => b.score - a.score);
}

// NOTE(greg): I promise this will be refactored. Some day. Maybe.`,
  py: `# train_glasswing.py — WIP
import torch
from glasswing.data import load_corpus

def train(epochs=4, lr=2e-4):
    model = build_model()
    corpus = load_corpus("internal_v7")

    for epoch in range(epochs):
        for batch in corpus:
            loss = model.step(batch)
            if epoch == 2 and batch.idx == 417:
                # this batch is haunted
                continue

        print(f"epoch {epoch}: loss={loss:.4f}")

    # TODO: actually save the model. oops.
    return model

if __name__ == "__main__":
    train()`,
  css: `/* dashboard.css — last touched 2 weeks ago */
.dashboard {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
}

/* TODO: this "temporary" hack is load-bearing */
.widget .sparkline {
  transform: scale(1.02); /* fixes the wobble. don't touch */
}

.widget:nth-child(3n) {
  /* why is THIS one different. who did this */
  margin-top: 6px;
}

.dark-mode .dashboard {
  background: #0e1016; /* night shift approved */
}`,
};

const SHEETS = {
  budget: {
    name: "Q4_budget.xlsx",
    tabs: ["Summary", "Snacks", "Equipment"],
    data: {
      Summary: [["Category", "Budget", "Actual", "Δ"],
        [["Snacks", 4200, 6100], "neg"], [["Cloud spend", 18000, 17940], "ok"],
        [["Coffee pods", 600, 2140], "neg"], [["Ping-pong balls", 80, 79], "ok"]],
      Snacks: [["Item", "Qty", "Cost"],
        [["Cold brew cans", 480, 960], "ok"], [["Ramen bricks", 900, 1350], "ok"],
        [["'Healthy' options", 200, 40], "sad"]],
      Equipment: [["Item", "Price"],
        [["Standing desk (Greg #3)", 640, "third attempt"], "note"]],
    },
  },
};

function buildPersona(kind, name) {
  const base = {
    wallpaper: (Math.random() * 6) | 0,
    notes: [], mail: [], history: [], files: null, codeFile: null, sheet: null,
    ytVideo: pick(VIDEOS).id,
    downloaded: [], sticky: [], chatUnread: {},
  };
  const M = [];
  const push = m => M.push(Object.assign({ time: "09:41", unread: false }, m));
  const hr = () => pick(INTRANET.hrEmails);

  switch (kind) {
    case "workaholic":
      base.notes = [{ text: "SHIP IT\n\n- perf review doc\n- v0.9 signoff\n- email Priya\n- sleep (optional)", color: "blue" },
                    { text: "coffee countdown: pod #6 of ∞", color: "" }];
      push({ from: "Priya Raman — CEO", subject: "You're a machine 💪", body: "Please also be a person occasionally. That's an order.\n\n— Priya" });
      push({ from: "Dana Whitfield — HR", subject: "Your PTO balance is… concerning", body: "You have 23 unused vacation days.\n\nThis is not a trophy, it's a liability.\n\nWarm regards,\nDana", unread: true });
      base.history = ["intranet.wiki/ai-model", "ticket.sys/4402", "mail", "intranet.wiki/onboarding"];
      base.codeFile = { name: "pipeline.js", lang: "js" };
      base.sheet = "budget";
      break;
    case "slacker":
      base.notes = [{ text: "how to look busy:\n1. spreadsheet open\n2. serious face\n3. alt-tab speedrun\n4. sigh at monitor", color: "pink" },
                    { text: "boss patrol schedule (unofficial):\n10:12 ✗\n11:47 ✗\n14:30 ?", color: "" }];
      push(hr());
      push({ from: "Marco Diaz", subject: "dude the boss is coming", body: "ABORT. ALT TAB. GO GO GO", unread: true });
      base.history = ["redd.it", "catpipe.tv", "search:how to look busy", "catpipe.tv", "mail"];
      base.files = { Downloads: ["totally_work.xlsx", "excuse_generator.exe", "not_a_game.zip"] };
      break;
    case "memeAddict":
      base.notes = [{ text: "meme folder must hit 1GB before Q4 ends 📁😤", color: "" },
                    { text: "banana for scale 🍌", color: "blue" }];
      push({ from: "Wren Osei", subject: "FWD: FWD: FWD: (no subject)", body: "3 images and a video. The subject line gave up.\n\nOpen at your own risk." });
      base.history = ["redd.it", "redd.it", "catpipe.tv", "search:cat compilation hd", "redd.it"];
      base.files = { Pictures: ["cat_042.png", "distracted_boss.png", "this_is_fine.png", "banana_scale.png"] };
      base.codeFile = { name: "dashboard.css", lang: "css" };
      break;
    case "gamer":
      base.notes = [{ text: "after work: ranked grind 🎮\n(nobody has to know the 'standup prep' tab is actually minecraft)", color: "blue" }];
      push({ from: "Greg Bell", subject: "raid tonight??", body: "8pm. don't be late this time.\n\nbring your own snacks, HR confiscated the good ones", unread: true });
      base.history = ["catpipe.tv", "search:speedrun world record", "catpipe.tv", "mail", "catpipe.tv"];
      base.files = { Downloads: ["save_backup_final_FINAL2.zip", "keybinds.txt", "shader_packs"] };
      break;
    case "researcher":
      base.notes = [{ text: "read list:\n- attention is all you need (again)\n- scaling laws\n- that one blog post with the cool diagrams", color: "blue" }];
      push({ from: "arXiv daily", subject: "12 new papers in your feed", body: "You will read 1.5 of these.\n\nThe .5 will be the abstract only." });
      base.history = ["intranet.wiki/ai-model", "search:attention is all you need explained", "intranet.wiki/brand", "search:why is my loss nan"];
      base.codeFile = { name: "train_glasswing.py", lang: "py" };
      base.sheet = "budget";
      break;
    case "coffeeAddict":
      base.notes = [{ text: "☕ SCHEDULE ☕\n08:15 espresso\n10:00 americano\n11:30 'just one more'\n13:00 cold brew\n15:30 regret", color: "" },
                    { text: "if the machine breaks I break", color: "pink" }];
      push({ from: "Marco Diaz — Facilities", subject: "Coffee machine maintenance window", body: "The machine will be offline Tuesday 2-3pm for descaling.\n\nWe suggest counseling. We're not qualified, but we suggest it.", unread: true });
      base.history = ["intranet.wiki/onboarding", "search:is 6 coffees too many (no)", "mail", "search:coffee machine descaling"];
      base.sheet = "budget";
      break;
    case "perfectionist":
      base.notes = [{ text: "TODO (final_v3_REALLY_FINAL):\n□ rename variables\n□ rename them again\n□ review PR (mine)\n□ review PR (everyone's)", color: "blue" }];
      push({ from: "Sam Reyes", subject: "PR review? 😅", body: "it's been 3 days. there are 4 lines changed.\n\nplease. i'm begging.", unread: true });
      base.history = ["ticket.sys/4415", "intranet.wiki/ai-model", "mail", "intranet.wiki/brand"];
      base.codeFile = { name: "pipeline.js", lang: "js" };
      break;
    case "social":
      base.notes = [{ text: "bday gifts:\n- Priya: plant? no she has plants\n- Marco: mug (again)\n- Greg: grill things", color: "" }];
      push({ from: "Wren Osei", subject: " 👀 did you see", body: "check #random RIGHT NOW", unread: true });
      base.history = ["chat", "redd.it", "mail", "chat"];
      break;
  }
  // everyone gets one funny HR email & the wiki bookmark
  if (!M.some(m => m.from.startsWith("Dana"))) push(hr());
  base.mail = M;
  base.sticky = base.notes;
  return base;
}

/* crew definition: [first, last, role, personality, deskIdx] */
const CREW_DEF = [
  ["Priya", "Iyer",   "ML Engineer",      "workaholic",   0],
  ["Greg",  "Bell",   "Backend Dev",      "slacker",      1],
  ["Wren",  "Osei",   "Designer",         "memeAddict",   2],
  ["Sam",   "Reyes",  "ML Engineer",      "researcher",   3],
  ["Nico",  "Duran",  "DevOps",           "coffeeAddict", 4],
  ["Cleo",  "Mori",   "Frontend Dev",     "perfectionist",5],
  ["Jonas", "Fox",    "QA Engineer",      "gamer",        6],
  ["Faye",  "Haddad", "Product Manager",  "social",       7],
  ["Marco", "Diaz",   "Facilities",       "social",       8],
  ["Iris",  "Lindqvist","Data Analyst",   "workaholic",   9],
  ["Theo",  "Baptiste","ML Intern",       "slacker",     10],
  ["Sana",  "Kowalski","ML Engineer",    "perfectionist",11],
];
const BOSS_DEF = ["Elena", "Voss", "Engineering Director", "workaholic"];
