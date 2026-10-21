# Synergy Labs — Living Company Simulator

You are the boss. Create a character, physically walk around a living AI-startup
office, manage real employees with memories, run projects and finances, keep
demanding investors happy, and snoop through interconnected employee computers —
complete with real YouTube embeds and a fully synthesized soundscape.

Pure vanilla HTML/CSS/JS. No frameworks, no build step, no assets.

> Double-click **`index.html`** — or play at https://cooljett1234567890.github.io/office-sim/

## Controls

| Input | Action |
|---|---|
| **WASD / arrows** | Walk around as the boss |
| **E** | Interact with the nearest person / object (talk, manage, coffee, printer, meeting, whiteboard) |
| **Q** | Stand up from your desk |
| **Esc** | Close window → leave a PC → re-center camera |
| Drag / scroll | Pan / zoom the office |
| Click employee | Inspect & manage them (talk, tasks, reviews, warnings, bonuses, promotions, firing) |
| Click a monitor | Use that employee's computer |
| Click **your** monitor (right side, below the meeting room) | SynergyHQ, Investor Relations, Hiring Board |

Typing in any text field never moves your character.

## The company layer

- **Finances** — starting cash $52,000 (seed round) minus a $4,000 flagship project.
  Daily revenue = `monthlyRevenue / 22 × qualityFactor(0.6–1.4)`; daily expenses =
  `Σ salaries / 22 + $650 operating`. Salaries $5.4k–7.2k/mo by personality.
  Hiring costs $1,200 (desk kit + one welcome plant). Bonuses $500–2,000.
- **Projects** — blueprints with upfront costs, budgets, deadlines and work
  requirements. Assigned employees contribute daily based on `skill fit ×
  personality × morale × stress × attendance` — a workaholic consistently
  delivers, a slacker "contributes", a perfectionist boosts quality but ships
  slower. Payout = `budget × grade (S 1.25 / A 1.1 / B 1.0 / C 0.8)`; late
  projects can fail and damage reputation. Projects complete the moment the work
  is done — early delivery is allowed.
- **Investors** — four personalities (growth-hungry Marcus Vane, quality-obsessed
  Dr. Kolstad, cautious Beatrice Hallow, deadline-fiend RicoTanaka). Confidence
  evolves with revenue, cash reserves, shipped grades, overspending, hiring/firing
  and broken promises. Below 25% they warn you; at 5% they withdraw (revenue
  drop) until you rebuild trust. Ask for funding, present reports, make
  promises — breaking them is remembered.
- **Expansion** — buy annex desks ($1,800, real pathfinding-integrated desks),
  facilities (espresso machine, arcade corner, plant overhaul), and push toward
  higher-value projects.

## The people layer

- 12 named employees with personalities, skills, salaries, morale, stress,
  attendance and productivity histories — plus anyone you hire.
- **Structured event history** (240-event ring buffer): getting caught watching
  YouTube, promotions, firings, projects, arguments, birthdays, promises.
- **Employee memories** — each person keeps up to 36 weighted memories with
  recency decay. Dialogue references what actually happened to them. Coworkers
  overhear social events with lighter weight. No duplicates per event.
- **Relationships** — affinity drifts by personality kinship and desk proximity;
  arguments hurt, shared successes bind. Tense coworkers argue more.
- **Running jokes** — repeated events escalate through 3 stages: first teasing
  in chat, then someone makes a meme in Paint (a real file in their Pictures),
  finally the target embraces the legend. Survives reloads.

## The computers

Every desk runs **AcornOS** — taskbar, start menu, notification center, and 15+
apps over a **shared persistent virtual filesystem** (per-employee `Desktop /
Documents / Downloads / Pictures`):

- File Explorer creates/renames/deletes real files; Sticky Notes live in
  `Documents/notes.json`; Paint saves drawings to `Pictures/*.png` (viewable in
  Explorer, editable across sessions); CodeForge edits code files in place;
  Mail, chat (Wavelength), browser history and bookmarks all persist.
- The browser has tabs/history/bookmarks, a fake intranet that shows **live
  project progress**, Redddit fed by real office chat, and CatPipe with real
  embedded YouTube videos (verified IDs — Mumbo Jumbo, Pixlriffs, Fireship,
  Two Minute Papers, and one rickroll).
- **Secrets** — five hidden threads (an investor's side-deal, a salary
  comparison sheet, Greg's "totally a spreadsheet" archive, a haunted terminal
  file after 18:00, and a certain field guide). No markers; discoveries are
  persisted and quietly acknowledged.

## Persistence

- Versioned save (`version: 2`) in `localStorage`, autosaved every 20s, on
  important actions, and on unload. **v1 saves migrate automatically** — day,
  time, achievements, stats and settings survive; the game then asks you to
  create your boss character (the founder retired to a llama farm).
- Employees are stored as whitelisted persistent slices; IDs are stable, so
  files, mail, relationships and memories survive reloads.
- Save management lives in SynergyHQ → Save: save now, export/import JSON,
  start a new game. Corrupted saves are backed up to
  `synergy.office.v1.backup` rather than silently wiped.

## Project layout

```
index.html          entry point
css/style.css       all styling (office, OS shell, management UIs)
js/persist.js       versioned save layer + migration + export/import
js/state.js         global sim state, achievements, lookups
js/audio.js         synthesized SFX + ambient music
js/data.js          world layout, crew, content, economy data, verified video IDs
js/vfs.js           shared per-employee virtual filesystem
js/office.js        canvas renderer, camera, day/night, character art
js/employees.js     behavior AI, pathing, schedules
js/memory.js        events, memories, relationships, running jokes, discoveries
js/company.js       finances, projects, productivity, hiring/firing, expansion
js/player.js        character creation, the boss as a physical character, interactions
js/events.js        day cycle, meetings, random office events, day rollover
js/desktop.js       AcornOS shell + window manager
js/apps.js          built-in apps (Explorer, chat, mail, paint, terminal…)
js/mgmt.js          SynergyHQ dashboard, Investor Relations, Hiring Board
js/browser.js       tabbed browser, fake sites, YouTube embeds
js/main.js          boot, input, game loop
```

## Financial formulas (as implemented)

```
qualityFactor   = 0.6 + (avg active project quality / 100) × 0.8   (1.0 if none)
dailyRevenue    = monthlyRevenue / 22 × qualityFactor
dailyExpenses   = Σ(active salaries) / 22 + 650
projectProgress = Σ per assignee: (14 + skillFit/6) × personalityMult
                  × (0.6 + morale/100 × 0.55) × (1.1 − stress/100 × 0.45)
                  × random(0.85–1.15)         [0 if out sick]
projectQuality  = moving average of skillFit × 0.4 + perfectionistBonus + morale/4
payout          = budget × gradeMultiplier          reputation ± project.rep
fundingChance   = 0.15 + confidence/130 + reputation/260 + min(revenue,90k)/400k
```
