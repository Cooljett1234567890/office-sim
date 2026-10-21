/* ===== main.js — boot, input, game loop ===== */
"use strict";

(function () {
  loadSave();
  Employees.create();
  for (const e of [...SIM.employees, SIM.boss]) e.persona = buildPersona(e.personality, e.name);
  Office.init();
  Desktop.init();
  Apps.init();
  bindInput();
  bindButtons();

  let last = performance.now();
  function loop(now) {
    const dt = clamp(now - last, 0, 60); last = now;
    const dts = dt / 1000; // seconds — all sim timers are seconds
    const t = now;
    Events.update(dts);
    Employees.update(dts);
    tickSave(dts);
    // follow camera
    if (SIM.followId) {
      const e = SIM.employees.find(x => x.id === SIM.followId);
      if (e) { Office.cam.x = lerp(Office.cam.x, e.x, 0.08); Office.cam.y = lerp(Office.cam.y, e.y - 20, 0.08); Office.clampCam(); }
      else { SIM.followId = null; $("#follow-badge").classList.add("hidden"); }
    }
    if (!Desktop.isOpen) Office.render(dts, t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------------- input ---------------- */
  function bindInput() {
    const canvas = Office.canvas;
    let down = null, dragging = false;

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
    // hover cursor
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
    if (!hit) { SIM.selectedEmployee = null; return; }
    Audio2.click();
    if (hit.type === "pc") {
      Desktop.open(hit.emp);
    } else {
      const emp = hit.emp;
      if (SIM.followId === emp.id) {
        SIM.followId = null; $("#follow-badge").classList.add("hidden");
      } else {
        SIM.followId = emp.id;
        const badge = $("#follow-badge");
        badge.querySelector("b").textContent = emp.name;
        badge.classList.remove("hidden");
        badge.querySelector(".unfollow").onclick = () => { SIM.followId = null; badge.classList.add("hidden"); };
        officeToast(`${emp.name} — ${emp.role}. ${moodLine(emp)}`);
      }
    }
  }

  function moodLine(emp) {
    if (emp.away) return "Not in yet.";
    switch (emp.state) {
      case "youtube": return "Definitely working. That is definitely a spreadsheet.";
      case "asleep": return "Deep in a standup-related dream. Shhh.";
      case "coffee": case "sip": return "Performing critical caffeine operations.";
      case "chat": return "Syncing (verbally).";
      case "gaze": return "Strategically observing load-bearing windows.";
      case "pretend": return "ALTERNATE TAB ENGAGED.";
      case "meeting": return "In standup. Pretending to take notes.";
      case "lunch": return "Refueling. Do not perceive.";
      case "walk": case "fire": return "In transit.";
      case "wait": return "Waiting for the all-clear.";
      default: return `Currently: ${pick(["deep work", "a bug with opinions", "the zone", "a spreadsheet", "thinking about coffee"])}.`;
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
      officeToast(`🏢 <b>Synergy Labs — Living Office</b><br>Drag: pan · Scroll: zoom · Click person: follow · Click monitor: use their PC<br>Esc: exit PC / unfollow · ${SAVE.achievements.length}/${ACHIEVEMENTS.length} achievements found`);
    });
    // initial welcome
    setTimeout(() => {
      officeToast(`🏢 Welcome to Synergy Labs. Day ${SIM.day}, ${fmtTime(SIM.minutes)}. The coffee is fresh and the boss is watching. Probably.`);
    }, 800);
  }
})();
