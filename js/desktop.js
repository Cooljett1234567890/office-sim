/* ===== desktop.js — Windows-inspired shell, window manager ===== */
"use strict";

const Desktop = (() => {
  let root, wall, icons, wins, startBtn, startMenu, tasks, notifCenter, notifDot;
  let emp = null;
  let zIndex = 100;
  const openWins = [];

  const WALLPAPERS = [
    "linear-gradient(135deg,#1e3a8a 0%,#3b82f6 45%,#93c5fd 100%)",
    "linear-gradient(135deg,#0f172a 0%,#334155 60%,#64748b 100%)",
    "radial-gradient(120% 120% at 20% 10%,#7c3aed 0%,#312e81 55%,#0f0a2e 100%)",
    "linear-gradient(160deg,#064e3b 0%,#059669 55%,#a7f3d0 100%)",
    "radial-gradient(130% 130% at 80% 90%,#f59e0b 0%,#b45309 45%,#7c2d12 100%)",
    "linear-gradient(135deg,#831843 0%,#be185d 55%,#fbcfe8 100%)",
    "linear-gradient(135deg,#111827 0%,#1f2937 50%,#374151 100%)",
    "radial-gradient(140% 120% at 30% 80%,#0ea5e9 0%,#1e3a8a 50%,#172554 100%)",
  ];
  const ACCENTS = ["#4f8cff", "#e05c8a", "#42b883", "#f59e0b"];

  function init() {
    root = $("#desktop"); wall = $("#dt-wallpaper"); icons = $("#dt-icons");
    wins = $("#dt-windows"); startBtn = $("#dt-start"); startMenu = $("#dt-startmenu");
    tasks = $("#dt-tasks"); notifCenter = $("#dt-notifcenter"); notifDot = $("#dt-notif-dot");

    startBtn.addEventListener("click", () => toggleStart());
    document.querySelector(".sm-power").addEventListener("click", close);
    document.querySelector(".sm-achievements").addEventListener("click", () => { toggleStart(false); openApp("settings", { tab: "achievements" }); });
    $("#dt-search").addEventListener("click", () => openApp("browser", { url: "search:synergy labs" }));
    $("#dt-vol").addEventListener("click", toggleSound);
    $("#dt-net").addEventListener("click", () => notify("📶", "Network", "Connected — SynergyNet-5G. Signal: mostly vibes."));
    notifDot.addEventListener("click", () => { notifCenter.classList.toggle("hidden"); renderNotifCenter(); });
    root.addEventListener("mousedown", e => {
      if (!startMenu.classList.contains("hidden") && !startMenu.contains(e.target) && e.target !== startBtn) toggleStart(false);
      if (!notifCenter.classList.contains("hidden") && !notifCenter.contains(e.target) && e.target !== notifDot) notifCenter.classList.add("hidden");
    });
  }

  function toggleSound() {
    SAVE.settings.sound = !SAVE.settings.sound;
    Audio2.setMuted(!SAVE.settings.sound);
    $("#dt-vol").textContent = SAVE.settings.sound ? "🔊" : "🔇";
    $("#btn-mute").textContent = SAVE.settings.sound ? "🔊" : "🔇";
  }

  function open(target) {
    emp = target;
    SIM.desktopOpenFor = emp.id;
    wall.style.background = WALLPAPERS[emp.persona.wallpaper % WALLPAPERS.length];
    document.documentElement.style.setProperty("--accent", ACCENTS[SAVE.settings.accent % ACCENTS.length]);
    renderIcons();
    wins.innerHTML = ""; openWins.length = 0;
    renderTasks();
    root.classList.remove("hidden");
    Audio2.pop();
    // achievements
    SAVE.stats.pcsOpened++;
    if (!SAVE.stats.uniquePcs.includes(emp.id)) SAVE.stats.uniquePcs.push(emp.id);
    unlockAchievement("firstPC");
    if (SAVE.stats.uniquePcs.length >= 5) unlockAchievement("fivePCs");
    if (SIM.minutes >= 18 * 60) unlockAchievement("night");
    if (emp.personality === "coffeeAddict" && (SAVE.stats.coffeePc = (SAVE.stats.coffeePc || 0) + 1) >= 1) { /* flavor */ }
    writeSave();
    notify("👋", `Signed in as ${emp.name}`, emp.role + " · " + pick(["Welcome back!", "You have mail.", "It's a great day to pretend to work.", "Remember: hydrate."]));
  }

  function close() {
    emp = null; SIM.desktopOpenFor = null;
    root.classList.add("hidden");
    startMenu.classList.add("hidden");
    notifCenter.classList.add("hidden");
    Audio2.swoosh();
  }

  function renderIcons() {
    icons.innerHTML = "";
    for (const ic of Apps.desktopIcons(emp)) {
      const d = el("div", "dt-icon", `<span class="ic">${ic.icon}</span>${ic.label}`);
      d.addEventListener("dblclick", () => { Audio2.click(); openApp(ic.app, ic.args); });
      d.addEventListener("click", () => { document.querySelectorAll(".dt-icon.sel").forEach(x => x.classList.remove("sel")); d.classList.add("sel"); });
      icons.appendChild(d);
    }
  }

  /* ---------- window manager ---------- */
  function openApp(appId, args) {
    const app = Apps.registry[appId];
    if (!app) return;
    const key = appId + ":" + JSON.stringify(args || {});
    const existing = openWins.find(w => w.key === key);
    if (existing) { focusWin(existing); if (app.onArgs) app.onArgs(existing, args); return existing; }
    const w = {
      key, appId, args: args || {},
      x: 90 + (openWins.length % 6) * 36, y: 40 + (openWins.length % 6) * 30,
      w: app.w || 640, h: app.h || 440, min: false, max: false,
    };
    const node = el("div", "dwin");
    node.innerHTML = `
      <div class="dwin-title">
        <span class="t-ic">${app.icon}</span><span class="t-label">${app.title}</span>
        <span class="dwin-ctrl">
          <button class="mini">─</button><button class="maxi">▢</button><button class="close">✕</button>
        </span>
      </div>
      <div class="dwin-body"></div>
      <div class="dwin-resize"></div>`;
    w.node = node;
    w.body = node.querySelector(".dwin-body");
    wins.appendChild(node);
    positionWin(w);
    // drag
    const title = node.querySelector(".dwin-title");
    title.addEventListener("mousedown", ev => {
      if (ev.target.closest(".dwin-ctrl")) return;
      focusWin(w);
      const sx = ev.clientX - w.x, sy = ev.clientY - w.y;
      const mv = e2 => { w.x = clamp(e2.clientX - sx, -w.w + 80, innerWidth - 60); w.y = clamp(e2.clientY - sy, 0, innerHeight - 90); positionWin(w); };
      const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
    });
    node.addEventListener("mousedown", () => focusWin(w));
    node.querySelector(".close").addEventListener("click", () => closeWin(w));
    node.querySelector(".mini").addEventListener("click", () => { w.min = true; node.style.display = "none"; renderTasks(); Audio2.pop(); });
    node.querySelector(".maxi").addEventListener("click", () => { w.max = !w.max; node.classList.toggle("maximized", w.max); positionWin(w); Audio2.click(); });
    // resize
    const rz = node.querySelector(".dwin-resize");
    rz.addEventListener("mousedown", ev => {
      ev.preventDefault();
      const sw = w.w, sh = w.h, sx = ev.clientX, sy = ev.clientY;
      const mv = e2 => { w.w = clamp(sw + e2.clientX - sx, 320, innerWidth); w.h = clamp(sh + e2.clientY - sy, 200, innerHeight); positionWin(w); if (app.onResize) app.onResize(w); };
      const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
    });

    app.render(w.body, w, emp);
    if (app.onArgs && w.args) app.onArgs(w, w.args);
    openWins.push(w);
    focusWin(w);
    renderTasks();
    Audio2.swoosh();
    return w;
  }

  function positionWin(w) {
    if (w.max) { Object.assign(w.node.style, { left: "0", top: "0", width: "100vw", height: "calc(100vh - 48px)" }); }
    else Object.assign(w.node.style, { left: w.x + "px", top: w.y + "px", width: w.w + "px", height: w.h + "px", display: w.min ? "none" : "flex" });
  }
  function focusWin(w) {
    openWins.forEach(o => o.node.classList.remove("focused"));
    w.node.classList.add("focused");
    w.node.style.zIndex = ++zIndex;
    if (w.min) { w.min = false; w.node.style.display = "flex"; }
    renderTasks();
  }
  function closeWin(w) {
    if (w.app.onClose) w.app.onClose(w);
    w.node.remove();
    const i = openWins.indexOf(w); if (i >= 0) openWins.splice(i, 1);
    renderTasks(); Audio2.click();
    if (w.appId === "browser") unlockCheckBrowser();
  }
  function unlockCheckBrowser() { /* handled by browser app itself */ }

  function renderTasks() {
    tasks.innerHTML = "";
    for (const w of openWins) {
      const app = Apps.registry[w.appId];
      const b = el("button", "task-btn" + (w.node.classList.contains("focused") && !w.min ? " active" : ""), `<span>${app.icon}</span><span>${app.title}</span>`);
      b.addEventListener("click", () => {
        if (w.min || !w.node.classList.contains("focused")) { w.min = false; focusWin(w); }
        else { w.min = true; w.node.style.display = "none"; renderTasks(); }
        Audio2.click();
      });
      tasks.appendChild(b);
    }
  }

  /* ---------- start menu ---------- */
  function toggleStart(force) {
    const show = force != null ? force : startMenu.classList.contains("hidden");
    startMenu.classList.toggle("hidden", !show);
    startBtn.classList.toggle("active", show);
    if (show) renderStart();
  }
  function renderStart() {
    const grid = startMenu.querySelector(".sm-apps");
    grid.innerHTML = "";
    for (const app of Apps.startMenuApps(emp)) {
      const b = el("button", "sm-app", `<span class="ic">${app.icon}</span><span>${app.label}</span>`);
      b.addEventListener("click", () => { toggleStart(false); Audio2.click(); openApp(app.app, app.args); });
      grid.appendChild(b);
    }
    startMenu.querySelector(".sm-name").textContent = emp.name;
    startMenu.querySelector(".sm-avatar").textContent = emp.first[0];
    startMenu.querySelector(".ach-count").textContent = `${SAVE.achievements.length}/${ACHIEVEMENTS.length}`;
  }

  /* ---------- notifications ---------- */
  function notify(icon, title, body) {
    const t = el("div", "dt-toast", `<div class="t-head"><span class="ic">${icon}</span>${title}</div><div class="t-body">${body}</div>`);
    $("#dt-toasts").appendChild(t);
    notifDot.classList.remove("hidden");
    Audio2.pop();
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .5s"; }, 6500);
    setTimeout(() => t.remove(), 7100);
    SAVE.notifLog.push({ t: fmtTime(SIM.minutes), text: title + " — " + body });
    if (SAVE.notifLog.length > 60) SAVE.notifLog.shift();
  }

  function renderNotifCenter() {
    notifCenter.innerHTML = '<div class="nc-title">Notifications <span id="nc-clear">clear all</span></div>';
    notifCenter.querySelector("#nc-clear").addEventListener("click", () => { SAVE.notifLog.length = 0; renderNotifCenter(); });
    if (!SAVE.notifLog.length) { notifCenter.appendChild(el("div", "nc-empty", "No new notifications")); return; }
    [...SAVE.notifLog].reverse().slice(0, 20).forEach(n => {
      notifCenter.appendChild(el("div", "nc-item", `<b>${n.t}</b>${n.text}`));
    });
  }

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!root.classList.contains("hidden")) {
        // close focused window first; if none, exit desktop
        const focused = openWins.find(w => w.node.classList.contains("focused"));
        if (focused) closeWin(focused); else close();
      } else if (SIM.followId) { SIM.followId = null; $("#follow-badge").classList.add("hidden"); }
    }
  });

  return { init, open, close, openApp, notify, toggleStart, get isOpen() { return emp !== null; }, get emp() { return emp; }, WALLPAPERS, ACCENTS };
})();
