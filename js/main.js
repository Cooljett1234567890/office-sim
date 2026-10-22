/* ===== main.js — boot, input, game loop ===== */
"use strict";

(function () {
  loadSave();
  // restore purchased annex desks before reviving the crew
  for (let i = 0; i < (SAVE.expandedDesks || 0); i++) {
    if (!DESKS.some(d => d === ANNEX_DESKS[i])) DESKS.push(ANNEX_DESKS[i]);
  }
  Employees.create();
  for (const e of SIM.employees) { Apps.Persona.ensure(e); VFS.seed(e); }
  Office.init();
  Desktop.init();
  Apps.init();
  Interact.init();
  Company.seedFresh();
  Player.init();
  bindInput();
  bindButtons();

  let last = performance.now();
  function loop(now) {
    const dt = clamp(now - last, 0, 60); last = now;
    const dts = dt / 1000; // seconds — all sim timers are seconds
    const t = now;
    if (!SIM.paused) {
      Events.update(dts);
      Employees.update(dts);
      Player.update(dts);
      Persistence.tick(dts);
    }
    // camera: player follow > npc follow > free
    const p = SIM.player;
    if (p && Player.follow && !Desktop.isOpen) {
      Office.cam.x = lerp(Office.cam.x, p.x, 0.1);
      Office.cam.y = lerp(Office.cam.y, p.y - 30, 0.1);
      Office.clampCam();
      SIM.followId = null;
      $("#follow-badge").classList.add("hidden");
    } else if (SIM.followId) {
      const e = empById(SIM.followId);
      if (e) { Office.cam.x = lerp(Office.cam.x, e.x, 0.08); Office.cam.y = lerp(Office.cam.y, e.y - 20, 0.08); Office.clampCam(); }
      else { SIM.followId = null; $("#follow-badge").classList.add("hidden"); }
    }
    updateTouchLayer();
    if (!Desktop.isOpen) {
      Office.render(dts, t);
      updateHint();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------------- touch / mobile support ---------------- */
  const TOUCH = (function () {
    try {
      return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
    } catch (e) { return false; }
  })();
  window.SYNERGY_TOUCH = TOUCH;

  let updateTouchLayer = function () {};
  (function setupTouch() {
    const stage = $("#office-stage");
    const tl = el("div", "touch-layer hidden");
    tl.innerHTML = `
      <div class="joy-base"><div class="joy-knob"></div></div>
      <div class="touch-btns">
        <button class="tbtn" id="tbtnE" aria-label="Interact">E</button>
        <button class="tbtn small" id="tbtnCam" aria-label="Recenter camera">⌖</button>
      </div>`;
    stage.appendChild(tl);
    const joyBase = tl.querySelector(".joy-base"), joyKnob = tl.querySelector(".joy-knob");
    const JOY_R = 46;
    let joyId = null, joyCX = 0, joyCY = 0;

    function setDir(dx, dy) {
      const k = Player.keys;
      k["w"] = k["a"] = k["s"] = k["d"] = false;
      if (Math.hypot(dx, dy) < JOY_R * 0.28) return;
      const sector = String(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)));
      const map = { "4": ["a"], "3": ["a", "s"], "2": ["s"], "1": ["d", "s"], "0": ["d"], "-1": ["d", "w"], "-2": ["w"], "-3": ["a", "w"], "-4": ["a"] };
      (map[sector] || []).forEach(x => { k[x] = true; });
    }
    function moveJoy(t) {
      let dx = t.clientX - joyCX, dy = t.clientY - joyCY;
      const d = Math.hypot(dx, dy);
      if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      setDir(t.clientX - joyCX, t.clientY - joyCY);
    }
    function endJoy() {
      joyId = null;
      joyKnob.style.transform = "translate(0, 0)";
      const k = Player.keys;
      k["w"] = k["a"] = k["s"] = k["d"] = false;
    }
    joyBase.addEventListener("touchstart", ev => {
      ev.preventDefault();
      Audio2.resume();
      const t = ev.changedTouches[0];
      joyId = t.identifier;
      const r = joyBase.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      moveJoy(t);
    }, { passive: false });
    joyBase.addEventListener("touchmove", ev => {
      ev.preventDefault();
      for (const t of ev.changedTouches) if (t.identifier === joyId) moveJoy(t);
    }, { passive: false });
    joyBase.addEventListener("touchend", ev => {
      ev.preventDefault();
      for (const t of ev.changedTouches) if (t.identifier === joyId) endJoy();
    }, { passive: false });
    joyBase.addEventListener("touchcancel", endJoy, { passive: false });

    tl.querySelector("#tbtnE").addEventListener("click", () => Player.interact());
    tl.querySelector("#tbtnCam").addEventListener("click", () => {
      Player.follow = true; SIM.followId = null;
      $("#follow-badge").classList.add("hidden");
      const p = SIM.player;
      if (p) Office.centerOn(p.x, p.y);
    });

    updateTouchLayer = function () {
      const want = (TOUCH || window.__forceTouch === true) && !!SIM.player
        && !Desktop.isOpen && $("#charcreator").classList.contains("hidden");
      tl.classList.toggle("hidden", !want);
    };
    window.__updateTouch = updateTouchLayer;
  })();

  /* touch gestures on the office canvas: tap = click, drag = pan, pinch = zoom */
  (function setupCanvasTouch() {
    const canvas = Office.canvas;
    let tpan = null, tpinch = null;
    canvas.addEventListener("touchstart", ev => {
      ev.preventDefault();
      Audio2.resume();
      if (ev.touches.length === 1) {
        const t = ev.touches[0];
        tpan = { x: t.clientX, y: t.clientY, cx: Office.cam.x, cy: Office.cam.y, t0: performance.now(), moved: false };
        tpinch = null;
      } else if (ev.touches.length >= 2) {
        const a = ev.touches[0], b = ev.touches[1];
        tpinch = { prevD: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2 };
        tpan = null;
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", ev => {
      ev.preventDefault();
      if (tpinch && ev.touches.length >= 2) {
        const a = ev.touches[0], b = ev.touches[1];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ncx = (a.clientX + b.clientX) / 2, ncy = (a.clientY + b.clientY) / 2;
        Office.zoomAt(tpinch.cx, tpinch.cy, d / Math.max(1, tpinch.prevD));
        tpinch.prevD = d;
        Office.cam.x -= (ncx - tpinch.cx) / Office.cam.scale;
        Office.cam.y -= (ncy - tpinch.cy) / Office.cam.scale;
        Office.clampCam();
        tpinch.cx = ncx; tpinch.cy = ncy;
        SIM.followId = null; Player.follow = false;
        $("#follow-badge").classList.add("hidden");
      } else if (tpan && ev.touches.length === 1) {
        const t = ev.touches[0];
        const dx = t.clientX - tpan.x, dy = t.clientY - tpan.y;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) tpan.moved = true;
        if (tpan.moved) {
          SIM.followId = null; Player.follow = false;
          $("#follow-badge").classList.add("hidden");
          Office.cam.x = tpan.cx - dx / Office.cam.scale;
          Office.cam.y = tpan.cy - dy / Office.cam.scale;
          Office.clampCam();
        }
      }
    }, { passive: false });
    canvas.addEventListener("touchend", ev => {
      ev.preventDefault();
      if (tpan && !tpan.moved && performance.now() - tpan.t0 < 400) {
        const t = ev.changedTouches[0];
        handleClick({ clientX: t.clientX, clientY: t.clientY, target: canvas });
      }
      if (ev.touches.length === 0) { tpan = null; tpinch = null; }
    }, { passive: false });
    canvas.addEventListener("touchcancel", () => { tpan = null; tpinch = null; }, { passive: false });
  })();

  /* ---------------- input ---------------- */
  function gameInputAllowed() {
    if (Desktop.isOpen) return false;
    if (!$("#charcreator").classList.contains("hidden")) return false;
    const ae = document.activeElement;
    if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return false;
    return true;
  }

  function bindInput() {
    const canvas = Office.canvas;
    let down = null, dragging = false;

    window.addEventListener("keydown", e => {
      const k = e.key.toLowerCase();
      if (gameInputAllowed()) {
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
          Player.keys[k] = true;
          if (k !== " ") e.preventDefault();
        }
        if (k === "e") Player.interact();
        if (k === "q") { Player.standUp(); }
      }
      if (e.key === "Escape") {
        if (Interact.open) { Interact.close(); return; }
        if (!$("#desktop").classList.contains("hidden")) {
          const focused = document.querySelector(".dwin.focused");
          if (focused && focused.closest) { /* Desktop handles its own Esc below */ }
        } else if (SIM.followId) {
          SIM.followId = null; $("#follow-badge").classList.add("hidden");
        } else if (SIM.player) {
          Player.follow = true;
        }
      }
    });
    window.addEventListener("keyup", e => {
      const k = e.key.toLowerCase();
      if (k === " ") Player.keys[" "] = false;
      else Player.keys[k] = false;
    });

    canvas.addEventListener("mousedown", e => {
      Audio2.resume();
      down = { x: e.clientX, y: e.clientY, cx: Office.cam.x, cy: Office.cam.y };
      dragging = false;
      canvas.classList.add("grabbing");
    });
    window.addEventListener("mousemove", e => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragging = true;
      if (dragging) {
        SIM.followId = null; $("#follow-badge").classList.add("hidden");
        Player.follow = false;
        Office.cam.x = down.cx - dx / Office.cam.scale;
        Office.cam.y = down.cy - dy / Office.cam.scale;
        Office.clampCam();
      }
    });
    window.addEventListener("mouseup", e => {
      canvas.classList.remove("grabbing");
      if (!down) return;
      if (!dragging && e.target === canvas) handleClick(e);
      down = null;
    });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      Audio2.resume();
      Office.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    canvas.addEventListener("mousemove", e => {
      if (down) return;
      const w = Office.screenToWorld(e.clientX, e.clientY);
      const hit = Office.hitTest(w.x, w.y);
      canvas.style.cursor = hit ? "pointer" : "grab";
    });
  }

  function handleClick(e) {
    const w = Office.screenToWorld(e.clientX, e.clientY);
    const hit = Office.hitTest(w.x, w.y);
    if (!hit) { SIM.selectedEmployee = null; Interact.close(); return; }
    Audio2.click();
    if (hit.type === "pc") {
      Desktop.open(hit.emp);
    } else if (hit.emp && hit.emp.isPlayer) {
      Player.follow = true;
    } else {
      Interact.showEmployee(hit.emp);
    }
  }

  /* contextual hint for the nearest interaction */
  function updateHint() {
    const h = Player.hint();
    const elh = $("#hud-hint");
    const mv = window.SYNERGY_TOUCH ? "joystick to move" : "WASD to walk";
    if (h) {
      elh.innerHTML = `<b style="color:#9cc3ff">[E]</b> ${h} · ${mv} · tap people/monitors`;
      elh.style.background = "rgba(30,40,70,.75)";
    } else {
      elh.textContent = `${mv} · [E] interact · drag to pan · pinch to zoom · tap a monitor to use their PC`;
      elh.style.background = "rgba(10,12,20,.5)";
    }
  }

  /* ---------------- buttons ---------------- */
  function bindButtons() {
    $("#btn-mute").addEventListener("click", () => {
      SAVE.settings.sound = !SAVE.settings.sound;
      Audio2.setMuted(!SAVE.settings.sound);
      $("#btn-mute").textContent = SAVE.settings.sound ? "🔊" : "🔇";
      $("#dt-vol").textContent = SAVE.settings.sound ? "🔊" : "🔇";
      if (SAVE.settings.sound) Audio2.resume();
    });
    $("#btn-mute").textContent = SAVE.settings.sound ? "🔊" : "🔇";
    $("#dt-vol").textContent = SAVE.settings.sound ? "🔊" : "🔇";
    $("#btn-help").addEventListener("click", () => {
      officeToast(`🏢 <b>Synergy Labs</b> — Day ${SIM.day} · Cash $${Math.round(SAVE.company.cash).toLocaleString()}<br>WASD: walk · E: interact · Q: stand up · Drag: pan · Scroll: zoom<br>Click employees: inspect/manage · Click monitors: their PC · Your desk: SynergyHQ`);
    });
    setTimeout(() => {
      if (SAVE.player) officeToast(`☀️ Back at the office, ${SAVE.player.first}. Day ${SIM.day}, ${fmtTime(SIM.minutes)}. Cash: $${Math.round(SAVE.company.cash).toLocaleString()}.`);
    }, 900);
  }
  window.__booted = true;
})();
