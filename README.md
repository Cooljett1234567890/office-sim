# Synergy Labs — Living AI Office Simulator

A living, breathing (fake) AI startup office in your browser. Every employee has a
personality, a schedule, and a fully usable Windows-inspired desktop — and yes,
some of them are definitely watching real YouTube videos instead of working.

## Run it

No build step, no server, no dependencies:

> Double-click **`index.html`**

That's it. Works from `file://`. (For the absolute best experience any modern
Chromium/Firefox/Safari browser works — Chrome, Edge, Firefox, etc.)

## Controls

| Input | Action |
|---|---|
| Drag | Pan the office |
| Scroll | Zoom |
| Click a person | Follow them (Esc or ✕ to stop) |
| Click a monitor | Use that employee's PC |
| Esc | Close window → exit PC → unfollow |

## What's inside

### The office
- 12 employees + a boss, each with a personality: workaholic, slacker, meme addict,
  gamer, research nerd, coffee addict, perfectionist, social butterfly
- Daily routine: staggered arrivals, 10:30 standup, lunch waves, 17:00+ departures
- Behaviors: typing, meetings, coffee runs, window gazing, chatting, napping,
  watching YouTube, and **alt-tabbing to a spreadsheet when the boss walks by**
- Day/night cycle with sky, stars, lamps and monitor glow
- Random events: fire drills, internet outages, coffee machine breakdowns, boss
  catching a slacker, office birthdays
- Biscuit, the office dog. Do not feed.

### The computers (click any monitor)
An original Windows-inspired desktop with taskbar, start menu, notification
center, and working apps:
- **File Explorer** — every employee has different files
- **Browser** — tabs, back/forward, bookmarks, address bar, fake search
  - Fake internal sites: intranet + wiki, HR portal, ticket system, "Redddit",
    and CatPipe (the only IT-approved video platform)
  - **Real YouTube embeds** (via youtube-nocookie): Minecraft redstone, Minecraft
    survival, Fireship CS concepts, Two Minute Papers… and one rickroll
- **Wavelength** — Slack-like chat with live office gossip that reacts to events
- **Mail** — including passive-aggressive HR emails
- Sticky Notes, Calculator, Paint (draw on the canvas), Terminal (try `matrix`,
  `sudo`, `neofetch`, `coffee`), CodeForge with half-finished code, GridSheet,
  and a fully playable **Minesweeper**
- Per-person wallpaper, files, browser history, and secrets
- Look for `how_to_look_busy.txt` on the slacker's machine

### Extras
- 15 achievements for exploring (check Settings → Achievements)
- Fully synthesized audio: typing, footsteps, chatter, coffee machine, printer,
  and a soft ambient pad — no audio files anywhere
- Office state (day, time, achievements, settings) saves to localStorage

## Project layout

```
index.html          entry point
css/style.css       all styling (office HUD + desktop OS + apps)
js/state.js         save/load, achievements, helpers
js/audio.js         WebAudio synthesized SFX + ambient music
js/data.js          world layout, employees, content, verified video IDs
js/office.js        canvas renderer, camera, day/night lighting
js/employees.js     behavior AI, pathing, schedules
js/events.js        day cycle, meetings, random office events
js/desktop.js       Windows-inspired shell + window manager
js/apps.js          built-in apps
js/browser.js       tabbed browser, fake sites, YouTube embeds
js/main.js          boot, input, game loop
```
