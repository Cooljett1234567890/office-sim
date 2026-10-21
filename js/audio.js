/* ===== audio.js — fully synthesized sound (no assets) ===== */
"use strict";

const Audio2 = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = null, musicStep = 0, started = false;
  let coffeeNode = null, printerTimer = null;

  function init() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain();
    master.gain.value = SAVE.settings.sound ? 0.9 : 0;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  }

  function resume() { init(); if (ctx && ctx.state === "suspended") ctx.resume(); if (!started) startMusic(); started = true; }

  function setMuted(m) { if (master) master.gain.value = m ? 0 : 0.9; }

  function env(node, t, a, d, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g); return g;
  }

  /* ---- SFX ---- */
  function tone(freq, dur, type = "sine", vol = 0.2, when = 0, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = env(o, t, 0.005, dur, vol);
    g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.2, filterFreq = 2000, when = 0, type = "bandpass") {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, (dur * ctx.sampleRate) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    src.connect(f);
    const g = env(f, t, 0.003, dur, vol);
    g.connect(sfxGain);
    src.start(t);
  }

  const click  = () => { tone(1900, 0.02, "square", 0.05); noise(0.015, 0.04, 4000); };
  const key    = () => { noise(0.02, rnd(0.02, 0.05), rnd(2500, 5000)); };
  const pop    = () => tone(520, 0.07, "sine", 0.12);
  const swoosh = () => noise(0.12, 0.05, 900);
  const chime  = () => { tone(880, 0.12, "sine", 0.12); tone(1320, 0.18, "sine", 0.1, 0.09); };
  const error  = () => { tone(220, 0.14, "square", 0.1); tone(180, 0.2, "square", 0.1, 0.12); };
  const alarm  = () => { for (let i = 0; i < 4; i++) { tone(940, 0.16, "square", 0.1, i * 0.34); tone(700, 0.16, "square", 0.1, i * 0.34 + 0.17); } };

  function step(vol) { noise(0.045, clamp(vol, 0.005, 0.06), rnd(180, 320), 0, "lowpass"); }
  function chatter(vol) { noise(rnd(0.25, 0.5), clamp(vol, 0.004, 0.05), rnd(400, 900), 0, "bandpass"); }
  function type() { noise(0.012, rnd(0.012, 0.03), rnd(3000, 6000)); }

  /* coffee machine loop */
  function coffeeOn() {
    if (!ctx || coffeeNode) return;
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 55;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 140;
    const g = ctx.createGain(); g.gain.value = 0.05;
    o.connect(f); f.connect(g); g.connect(sfxGain); o.start();
    coffeeNode = { o, g };
    const drip = setInterval(() => { if (!coffeeNode) return clearInterval(drip); noise(0.05, 0.05, 2500); tone(1400, 0.05, "sine", 0.03); }, 700);
    coffeeNode.drip = drip;
  }
  function coffeeOff() {
    if (!coffeeNode) return;
    try { coffeeNode.o.stop(); } catch (e) {}
    clearInterval(coffeeNode.drip);
    coffeeNode = null;
  }

  /* printer */
  function printerBurst() {
    if (!ctx) return;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => { noise(0.08, 0.06, 1200, 0, "bandpass"); tone(90 + Math.random() * 40, 0.06, "sawtooth", 0.03); }, i * 160);
    }
  }

  /* ambient music: soft chord pad */
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
  function startMusic() {
    if (!ctx || musicTimer) return;
    const playChord = () => {
      if (SAVE.settings.sound === false) return;
      const chord = CHORDS[musicStep % CHORDS.length];
      musicStep++;
      chord.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = i === 0 ? "triangle" : "sine"; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.05 / (i + 1), ctx.currentTime + 1.4);
        g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 7.4);
        const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 900;
        o.connect(fl); fl.connect(g); g.connect(musicGain);
        o.start(); o.stop(ctx.currentTime + 7.6);
      });
    };
    playChord();
    musicTimer = setInterval(playChord, 6400);
  }

  return { resume, setMuted, click, key, pop, swoosh, chime, error, alarm, step, chatter, type, coffeeOn, coffeeOff, printerBurst, get ctx() { return ctx; } };
})();
