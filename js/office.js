/* ===== office.js — world rendering, camera, hit-testing ===== */
"use strict";

const Office = (() => {
  const cam = { x: WORLD.w / 2, y: WORLD.h / 2, scale: 0.78, min: 0.45, max: 2.6 };
  let canvas, ctx, W, H, dpr;
  const steam = [];
  let hoverTarget = null;

  function init() {
    canvas = $("#office-canvas");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 14; i++) steam.push({ x: 150 + rnd(-6, 6), y: 0, life: 0, max: rnd(2, 4), active: false });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
  }

  function screenToWorld(sx, sy) { return { x: (sx - W / 2) / cam.scale + cam.x, y: (sy - H / 2) / cam.scale + cam.y }; }
  function worldToScreen(wx, wy) { return { x: (wx - cam.x) * cam.scale + W / 2, y: (wy - cam.y) * cam.scale + H / 2 }; }

  function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    cam.scale = clamp(cam.scale * factor, cam.min, cam.max);
    const after = screenToWorld(sx, sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
    clampCam();
  }
  function clampCam() {
    const mx = WORLD.w / 2 / cam.scale, my = WORLD.h / 2 / cam.scale;
    cam.x = clamp(cam.x, Math.min(mx, WORLD.w / 2), Math.max(mx, WORLD.w / 2));
    cam.y = clamp(cam.y, Math.min(my, WORLD.h / 2), Math.max(my, WORLD.h / 2));
  }
  function centerOn(x, y) { cam.x = x; cam.y = y; clampCam(); }

  /* ---------- time-of-day colors ---------- */
  function skyColors(minutes) {
    const t = minutes / 60;
    const stops = [
      [0,  ["#0a1030", "#141c40"], 1], [5, ["#1a2450", "#2a3460"], 1],
      [7,  ["#f0a47a", "#7a92c8"], 1], [9, ["#7fb2e8", "#a8cdec"], 0],
      [16, ["#7fb2e8", "#a8cdec"], 0], [18, ["#f0975c", "#e8c27a"], 1],
      [20, ["#1a2450", "#2a3460"], 1], [24, ["#0a1030", "#141c40"], 1],
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    return { top: mixHex(a[1][0], b[1][0], f), bot: mixHex(a[1][1], b[1][1], f), stars: a[2] * (1 - f) + b[2] * f, hour: t };
  }
  function mixHex(h1, h2, f) {
    const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const c1 = p(h1), c2 = p(h2);
    return `rgb(${(lerp(c1[0], c2[0], f)) | 0},${(lerp(c1[1], c2[1], f)) | 0},${(lerp(c1[2], c2[2], f)) | 0})`;
  }

  /* ---------- main draw ---------- */
  function draw(dt, t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(cam.scale, cam.scale); ctx.translate(-cam.x, -cam.y);

    const sky = skyColors(SIM.minutes);
    drawFloor(); drawWalls(sky, t); drawMeetingRoom(); drawKitchen(sky, t);
    drawFurniture();

    // y-sorted actors
    const list = [];
    const walkingStates = ["walk", "fire", "patrol", "leave"];
    const everyone = [...SIM.employees, SIM.boss];
    const occ = {};
    for (const e of everyone) {
      if (e.away || walkingStates.includes(e.state)) continue;
      if (e.desk >= 0) occ[e.desk] = e;
      else if (Math.hypot(e.x - BOSS_DESK.x, e.y - (BOSS_DESK.y + 48)) < 40) occ[-1] = e;
    }
    DESKS.forEach((d, i) => list.push({ y: d.y, draw: () => drawDeskPair(d, occ[i] || null, t) }));
    list.push({ y: BOSS_DESK.y, draw: () => drawDeskPair(BOSS_DESK, occ[-1] || null, t) });
    for (const e of everyone) {
      if (e.away || !walkingStates.includes(e.state)) continue;
      list.push({ y: e.y + 2, draw: () => Office.drawWalker(e, t) });
    }
    list.sort((a, b) => a.y - b.y).forEach(i => i.draw());

    drawDoor();
    drawLighting(sky);
    drawSteam(dt);

    ctx.restore();
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function drawFloor() {
    ctx.fillStyle = "#8a8378"; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // carpet tiles
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    for (let x = 0; x < WORLD.w; x += 80) for (let y = 0; y < WORLD.h; y += 80) if (((x / 80 + y / 80) | 0) % 2) ctx.fillRect(x, y, 80, 80);
    // kitchen tile
    ctx.fillStyle = "#cfc8ba"; ctx.fillRect(40, 90, 440, 400);
    ctx.strokeStyle = "rgba(0,0,0,.06)"; ctx.lineWidth = 1;
    for (let x = 40; x <= 480; x += 55) { ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x, 490); ctx.stroke(); }
    for (let y = 90; y <= 490; y += 55) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(480, y); ctx.stroke(); }
    // meeting rug
    ctx.fillStyle = "#5a6f9e"; rr(1500, 130, 400, 330, 18); ctx.fill();
    // lounge rug
    ctx.fillStyle = "#7a9e6f"; rr(60, 560, 280, 260, 18); ctx.fill();
    // soft vignette rug under desks
    ctx.fillStyle = "rgba(255,255,255,0.04)"; rr(280, 440, 1300, 560, 24); ctx.fill();
  }

  function drawWalls(sky, t) {
    // top wall
    ctx.fillStyle = "#6e675e"; ctx.fillRect(0, 0, WORLD.w, 90);
    // windows
    const winY = 14, winH = 62;
    for (let i = 0; i < 9; i++) {
      const x = 180 + i * 185;
      const g = ctx.createLinearGradient(0, winY, 0, winY + winH);
      g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
      ctx.fillStyle = g; rr(x, winY, 150, winH, 8); ctx.fill();
      if (sky.stars > 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${sky.stars * 0.8})`;
        for (let s = 0; s < 6; s++) ctx.fillRect(x + 12 + ((s * 37) % 130), winY + 8 + ((s * 23) % 40), 2, 2);
        if (sky.hour > 20 || sky.hour < 6) { ctx.fillStyle = "#e8e4d4"; ctx.beginPath(); ctx.arc(x + 110, winY + 18, 9, 0, 7); ctx.fill(); }
      } else {
        // sun & skyline
        const sunX = x + 30 + ((sky.hour - 8) / 10) * 90;
        ctx.fillStyle = "rgba(255,236,180,0.9)"; ctx.beginPath(); ctx.arc(clamp(sunX, x + 20, x + 130), winY + 26, 8, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(70,80,110,0.55)";
        ctx.fillRect(x + 10, winY + winH - 22, 18, 22); ctx.fillRect(x + 34, winY + winH - 32, 14, 32);
        ctx.fillRect(x + 54, winY + winH - 16, 22, 16); ctx.fillRect(x + 84, winY + winH - 28, 16, 28);
        ctx.fillRect(x + 106, winY + winH - 18, 20, 18);
      }
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 3; rr(x, winY, 150, winH, 8); ctx.stroke();
    }
    // wall shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, 90, WORLD.w, 14);
    // right wall hint
    ctx.fillStyle = "#655e55"; ctx.fillRect(WORLD.w - 26, 0, 26, WORLD.h);
  }

  function drawMeetingRoom() {
    // glass wall
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 5;
    ctx.strokeRect(1500, 110, 400, 360);
    // table
    ctx.fillStyle = "#8a6f4d"; rr(1560, 240, 280, 150, 40); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)"; rr(1572, 250, 256, 130, 34); ctx.fill();
    // presentation screen
    ctx.fillStyle = "#20222c"; rr(1610, 140, 280, 70, 8); ctx.fill();
    const presenting = SIM.event && SIM.event.type === "meeting";
    ctx.fillStyle = presenting ? "#4f8cff" : "#2e3240";
    rr(1620, 148, 260, 54, 6); ctx.fill();
    if (presenting) {
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "600 15px Segoe UI";
      ctx.fillText("DAILY STANDUP", 1665, 170);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "11px Segoe UI";
      ctx.fillText("GLASSWING v0.9 — 94.2% eval", 1660, 190);
    }
    // chairs
    for (const s of MEETING_SEATS) { ctx.fillStyle = "#3d4252"; rr(s.x - 16, s.y - 12, 32, 26, 8); ctx.fill(); }
    ctx.fillStyle = "#3d4252"; rr(1656, 250, 88, 20, 8); ctx.fill();
  }

  function drawKitchen(sky, t) {
    // counter
    ctx.fillStyle = "#9a917f"; rr(60, 100, 360, 46, 8); ctx.fill();
    // coffee machine
    ctx.fillStyle = "#2e323c"; rr(120, 96, 62, 58, 8); ctx.fill();
    ctx.fillStyle = "#d13438"; rr(132, 118, 38, 10, 3); ctx.fill();
    ctx.fillStyle = "#181b22"; rr(138, 136, 26, 12, 3); ctx.fill();
    if (steam.some(s => s.active)) { ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150, 92); ctx.quadraticCurveTo(158, 80, 150, 68); ctx.stroke(); }
    // mugs
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ["#e8c84f", "#5b8def", "#59c98f", "#e5647c"][i]; rr(200 + i * 26, 112, 16, 14, 3); ctx.fill(); }
    // fridge
    ctx.fillStyle = "#b8b2a4"; rr(290, 80, 60, 110, 8); ctx.fill();
    ctx.fillStyle = "#8f897b"; ctx.fillRect(290, 120, 60, 4);
    ctx.fillStyle = "#6e6a5e"; ctx.fillRect(340, 100, 4, 16); ctx.fillRect(340, 130, 4, 30);
    // stickers
    ctx.font = "12px Segoe UI"; ctx.fillText("🍪", 300, 145); ctx.fillText("🤖", 315, 175);
    // lunch table
    ctx.fillStyle = "#8a6f4d"; rr(210, 400, 190, 60, 14); ctx.fill();
    ctx.fillStyle = "#e5647c"; ctx.beginPath(); ctx.arc(250, 415, 8, 0, 7); ctx.fill(); // bowl
    ctx.fillStyle = "#4fc3e8"; rr(300, 410, 30, 12, 4); ctx.fill();
    // printer
    ctx.fillStyle = "#565b68"; rr(315, 96, 70, 48, 6); ctx.fill();
    ctx.fillStyle = "#f4f2ec"; rr(325, 110, 50, 8, 2); ctx.fill();
    ctx.fillStyle = "#3a3f4c"; ctx.fillRect(340, 128, 20, 10);
  }

  function drawFurniture() {
    // plants
    for (const [x, y] of [[520, 130], [1250, 130], [60, 540], [70, 940], [1850, 520], [300, 1010], [1640, 940]]) {
      ctx.fillStyle = "#7a4a2b"; rr(x - 10, y, 20, 26, 5); ctx.fill();
      ctx.fillStyle = "#4e8f4a";
      ctx.beginPath(); ctx.arc(x - 8, y - 8, 14, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 9, y - 12, 12, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 22, 13, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.beginPath(); ctx.arc(x - 4, y - 14, 4, 0, 7); ctx.fill();
    }
    // sofa
    ctx.fillStyle = "#4a7d6b"; rr(80, 660, 180, 70, 16); ctx.fill();
    ctx.fillStyle = "#3c6a5a"; rr(80, 660, 180, 26, 12); ctx.fill();
    // water cooler
    ctx.fillStyle = "#cfd6e0"; rr(1524, 940, 34, 70, 6); ctx.fill();
    ctx.fillStyle = "#4fc3e8"; rr(1528, 920, 26, 26, 10); ctx.fill();
    // whiteboard
    ctx.fillStyle = "#f4f2ec"; rr(1852, 480, 30, 220, 6); ctx.fill();
    ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1858, 500); ctx.lineTo(1878, 500); ctx.stroke();
    ctx.strokeStyle = "#2e86c1"; ctx.beginPath(); ctx.moveTo(1858, 514); ctx.lineTo(1874, 514); ctx.stroke();
    ctx.strokeStyle = "#7d3c98"; ctx.beginPath(); ctx.moveTo(1858, 528); ctx.lineTo(1868, 528); ctx.stroke();
    // Biscuit the office dog
    const bx = 1000 + Math.sin(Date.now() / 4000) * 180, by = 970;
    ctx.fillStyle = "#d9a44a"; ctx.beginPath(); ctx.ellipse(bx, by, 16, 10, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 16, by - 5, 7, 0, 7); ctx.fill();
    ctx.fillStyle = "#3a2c14"; ctx.fillRect(bx + 18, by - 9, 3, 4);
  }

  /* desks (always drawn) + seated employee */
  function drawDeskPair(d, e, t) {
    // chair
    ctx.fillStyle = "#3a3f4c"; rr(d.x - 17, d.y + 42, 34, 30, 9); ctx.fill();
    const seated = e && e.state !== "walk" && e.state !== "fire" && e.state !== "patrol" && e.state !== "leave";
    if (seated) drawPerson(e, d.x, d.y + 48, t, true);
    // desk
    ctx.fillStyle = "#b8977a"; rr(d.x - 55, d.y - 26, 110, 58, 8); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.08)"; rr(d.x - 55, d.y + 8, 110, 24, 6); ctx.fill();
    // monitor
    ctx.fillStyle = "#22252e"; rr(d.x - 34, d.y - 52, 68, 44, 6); ctx.fill();
    if (seated) drawScreen(e, d.x - 30, d.y - 48, 60, 36, t);
    else { ctx.fillStyle = "#101218"; rr(d.x - 30, d.y - 48, 60, 36, 3); ctx.fill(); }
    ctx.fillStyle = "#2e323c"; ctx.fillRect(d.x - 4, d.y - 10, 8, 8);
    // keyboard + mouse
    ctx.fillStyle = "#494f5e"; rr(d.x - 26, d.y - 6, 44, 12, 3); ctx.fill();
    ctx.fillStyle = "#494f5e"; rr(d.x + 26, d.y - 6, 10, 12, 3); ctx.fill();
    // coffee mug on desk
    ctx.fillStyle = seated && e.personality === "coffeeAddict" ? "#d13438" : "#e8e4d8";
    rr(d.x - 48, d.y - 4, 11, 12, 3); ctx.fill();
    if (seated && e.mugHot) { ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d.x - 43, d.y - 6); ctx.quadraticCurveTo(d.x - 39, d.y - 14, d.x - 43, d.y - 20); ctx.stroke(); }
  }

  const SCREEN_MODES = {
    work:    c => { c.fillStyle = "#0f1420"; c.fillRect(0, 0, 60, 36); c.fillStyle = "#4a5c7a"; for (let i = 0; i < 6; i++) c.fillRect(6, 6 + i * 5, 20 + ((i * 13) % 30), 2.5); },
    sheet:   c => { c.fillStyle = "#0e2a1c"; c.fillRect(0, 0, 60, 36); c.strokeStyle = "#2e5c3f"; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(4, i * 7); c.lineTo(56, i * 7); c.stroke(); } for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(6 + i * 14, 2); c.lineTo(6 + i * 14, 34); c.stroke(); } },
    video:   c => { c.fillStyle = "#20141f"; c.fillRect(0, 0, 60, 36); c.fillStyle = "#d13438"; c.beginPath(); c.arc(30, 18, 9, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(27, 13); c.lineTo(27, 23); c.lineTo(35, 18); c.fill(); },
    chat:    c => { c.fillStyle = "#141c2e"; c.fillRect(0, 0, 60, 36); c.fillStyle = "#4f8cff"; c.fillRect(5, 6, 26, 6); c.fillRect(18, 16, 30, 6); c.fillStyle = "#59c98f"; c.fillRect(5, 26, 22, 6); },
    present: c => { c.fillStyle = "#1a2a4a"; c.fillRect(0, 0, 60, 36); c.fillStyle = "#4f8cff"; c.fillRect(8, 8, 44, 20); c.fillStyle = "rgba(255,255,255,.8)"; c.fillRect(12, 12, 18, 3); c.fillRect(12, 19, 30, 3); },
    off:     c => { c.fillStyle = "#101218"; c.fillRect(0, 0, 60, 36); c.fillStyle = "rgba(255,255,255,0.06)"; c.font = "8px Segoe UI"; c.fillText("standby", 16, 21); },
  };
  function drawScreen(e, x, y, w, h, t) {
    const c = (fn) => { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); fn(ctx); ctx.restore(); };
    if (e.state === "fire") return c(SCREEN_MODES.off);
    if (e.state === "asleep") return c(SCREEN_MODES.off);
    if (e.state === "meeting") return c(SCREEN_MODES.present);
    switch (e.screen) {
      case "code": return c(SCREEN_MODES.work);
      case "sheet": return c(SCREEN_MODES.sheet);
      case "video": return c(SCREEN_MODES.video);
      case "chat": return c(SCREEN_MODES.chat);
      default: return c(SCREEN_MODES.work);
    }
  }

  /* people */
  function drawPerson(e, x, y, t, seated) {
    const p = e.palette;
    const bob = seated ? 0 : Math.sin(t * 0.012 + e.seed * 7) * 2 * (e.moving ? 1 : 0.2);
    const breathe = Math.sin(t * 0.002 + e.seed * 9) * 0.8;
    ctx.save();
    ctx.translate(x, y + bob);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(0, seated ? 6 : 14, 14, 5, 0, 0, 7); ctx.fill();

    const sleeping = e.state === "asleep";
    const headDrop = sleeping ? 7 : 0;

    // legs (walking only)
    if (!seated && e.moving) {
      const step = Math.sin(t * 0.02 + e.seed) * 5;
      ctx.strokeStyle = "#2e323c"; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-4 + step, 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(4 - step, 22); ctx.stroke();
    }

    // body
    ctx.fillStyle = p.body;
    rr(-13, -14 + breathe * 0.3, 26, seated ? 26 : 24, 11); ctx.fill();
    // badge
    ctx.fillStyle = "rgba(255,255,255,0.85)"; rr(-2, -6, 6, 8, 2); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-1, -4, 4, 1.6);

    // arms
    const typing = (seated && (e.screenModeTyping || e.screen === "code" || e.state === "pretend")) && !sleeping;
    ctx.strokeStyle = p.skin; ctx.lineWidth = 4.5; ctx.lineCap = "round";
    if (typing) {
      const ty = Math.sin(t * 0.02 + e.seed * 3) * 1.5;
      ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-14, 4 + ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(14, 4 - ty); ctx.stroke();
    } else if (!seated && e.moving) {
      const sw = Math.sin(t * 0.02 + e.seed) * 4;
      ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-13, 2 + sw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(13, 2 - sw); ctx.stroke();
    }

    // head
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(0, -26 + headDrop, 11, 0, 7); ctx.fill();
    // hair
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(0, -28 + headDrop, 11, Math.PI, 0); ctx.fill();
    if (e.hairStyle === "bun") { ctx.beginPath(); ctx.arc(0, -38 + headDrop, 5, 0, 7); ctx.fill(); }
    if (e.hairStyle === "long") { rr(-11, -28 + headDrop, 6, 14, 3); ctx.fill(); rr(5, -28 + headDrop, 6, 14, 3); ctx.fill(); }
    if (e.hairStyle === "flat") { rr(-11, -33 + headDrop, 22, 6, 3); ctx.fill(); }

    // face
    if (sleeping) {
      ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-6, -26 + headDrop); ctx.lineTo(-2, -26 + headDrop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -26 + headDrop); ctx.lineTo(6, -26 + headDrop); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -22 + headDrop, 2, 0, Math.PI); ctx.stroke();
      // Zzz
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "600 10px Segoe UI";
      ctx.fillText("z", 12, -34 + Math.sin(t * 0.003) * 3);
      ctx.font = "600 7px Segoe UI";
      ctx.fillText("z", 18, -40 + Math.sin(t * 0.003 + 1) * 3);
    } else {
      const blink = (Math.sin(t * 0.0013 + e.seed * 11) > 0.97) || e.blink;
      ctx.fillStyle = "#22252e";
      if (blink) { ctx.fillRect(-5, -27 + headDrop, 3.4, 1.4); ctx.fillRect(2, -27 + headDrop, 3.4, 1.4); }
      else { ctx.beginPath(); ctx.arc(-3.5, -26 + headDrop, 1.8, 0, 7); ctx.arc(3.5, -26 + headDrop, 1.8, 0, 7); ctx.fill(); }
      // mouth by mood
      ctx.strokeStyle = "#22252e"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (e.mood === "happy") ctx.arc(0, -21.5 + headDrop, 3, 0.2, Math.PI - 0.2);
      else if (e.mood === "panicked") ctx.ellipse(0, -20.5 + headDrop, 2.2, 3, 0, 0, 7);
      else if (e.mood === "annoyed") { ctx.moveTo(-3, -20 + headDrop); ctx.lineTo(3, -21 + headDrop); }
      else ctx.arc(0, -19 + headDrop, 2.6, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      // sweat drop when boss near
      if (e.sweat) { ctx.fillStyle = "#7fd4ff"; ctx.beginPath(); ctx.arc(9, -31 + Math.sin(t * 0.008) * 2, 2.2, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawWalker(e, t) {
    drawPerson(e, e.x, e.y, t, false);
    if (e === SIM.selectedEmployee || SIM.followId === e.id) {
      ctx.strokeStyle = "rgba(79,140,255,0.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 16, 16, 6, 0, 0, 7); ctx.stroke();
    }
  }

  function drawDoor() {
    ctx.fillStyle = "#3a3f4c"; rr(920, 1036, 80, 44, 4); ctx.fill();
    ctx.fillStyle = "#59c98f"; rr(934, 1022, 52, 14, 4); ctx.fill();
    ctx.fillStyle = "#0f1a12"; ctx.font = "600 10px Segoe UI"; ctx.textAlign = "center";
    ctx.fillText("EXIT", 960, 1032); ctx.textAlign = "left";
  }

  function drawLighting(sky) {
    const hour = sky.hour;
    const nightness = clamp((hour < 7 ? (7 - hour) : hour > 18 ? (hour - 18) : 0) / 2, 0, 1);
    if (nightness > 0.02) {
      ctx.fillStyle = `rgba(10,14,34,${nightness * 0.45})`;
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
      // warm lamp pools
      for (const [lx, ly, r] of [[420, 560, 130], [740, 560, 130], [1060, 560, 130], [1380, 560, 130],
        [420, 740, 130], [740, 740, 130], [1060, 740, 130], [1380, 740, 130],
        [420, 920, 130], [740, 920, 130], [1060, 920, 130], [1380, 920, 130],
        [300, 380, 160], [1690, 300, 180]]) {
        const g = ctx.createRadialGradient(lx, ly, 10, lx, ly, r);
        g.addColorStop(0, `rgba(255,214,150,${nightness * 0.28})`); g.addColorStop(1, "rgba(255,214,150,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, r, 0, 7); ctx.fill();
      }
      // screen glow
      for (const e of SIM.employees) {
        if (e.away || e.state === "walk" || e.state === "fire") continue;
        const d = DESKS[e.desk]; if (!d) continue;
        const g = ctx.createRadialGradient(d.x, d.y - 30, 4, d.x, d.y - 30, 80);
        const col = e.screen === "video" ? "255,120,140" : e.screen === "chat" ? "110,170,255" : "170,220,255";
        g.addColorStop(0, `rgba(${col},${nightness * 0.30})`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y - 30, 80, 0, 7); ctx.fill();
      }
    }
    // soft daylight wash
    if (nightness < 0.9) {
      ctx.fillStyle = `rgba(255,244,214,${(0.9 - nightness) * 0.10})`;
      ctx.fillRect(0, 0, WORLD.w, 300);
    }
  }

  function drawSteam(dt) {
    const someoneBrewing = SIM.employees.some(e => e.state === "coffee" || e.state === "brewing");
    for (const s of steam) {
      if (!s.active && someoneBrewing && Math.random() < 0.02) { s.active = true; s.life = 0; s.x = 150 + rnd(-6, 6); }
      if (!s.active) continue;
      s.life += dt;
      const f = s.life / s.max;
      if (f >= 1) { s.active = false; continue; }
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - f)})`;
      ctx.beginPath(); ctx.arc(s.x + Math.sin(f * 5) * 5, 88 - f * 46, 3 + f * 5, 0, 7); ctx.fill();
    }
  }

  /* ---------- hit testing ---------- */
  function hitTest(wx, wy) {
    const all = [...SIM.employees, SIM.boss];
    for (const e of all) {
      if (e.away) continue;
      const seated = e.state !== "walk" && e.state !== "fire" && e.state !== "patrol";
      if (seated) {
        const d = e.desk >= 0 ? DESKS[e.desk] : BOSS_DESK;
        // monitor area
        if (wx > d.x - 38 && wx < d.x + 38 && wy > d.y - 58 && wy < d.y + 34) return { type: "pc", emp: e };
        if (Math.hypot(wx - d.x, wy - (d.y + 40)) < 30) return { type: "person", emp: e };
      } else {
        if (Math.hypot(wx - e.x, wy - (e.y - 14)) < 26) return { type: "person", emp: e };
      }
    }
    return null;
  }

  function render(dt, t) { draw(dt, t); }

  return { init, render, screenToWorld, worldToScreen, zoomAt, centerOn, cam, hitTest, drawWalker, clampCam, drawPerson, get canvas() { return canvas; } };
})();
