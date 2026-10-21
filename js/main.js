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
    if (!Desktop.isOpen) {
      Office.render(dts, t);
      updateHint();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

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
    if (h) {
      elh.innerHTML = `<b style="color:#9cc3ff">[E]</b> ${h} · WASD to move · click people/monitors · Esc re-centers camera`;
      elh.style.background = "rgba(30,40,70,.75)";
    } else {
      elh.textContent = "WASD to walk · [E] interact · Drag to pan · Scroll to zoom · Click a monitor to use their PC · Esc re-centers";
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
