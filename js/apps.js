/* ===== apps.js — built-in desktop applications ===== */
"use strict";

const Apps = (() => {
  const registry = {};
  const CHATS = {};   // channel -> [{who, when, text}]
  let chatUnread = {};

  function reg(id, def) { registry[id] = def; }

  /* ================= helpers ================= */
  function seededRandom(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function fileTree(emp) {
    const p = emp.persona;
    const tree = {
      "Desktop": [
        { name: "todo.txt", type: "txt", content: p.notes.map(n => n.text).join("\n\n———\n\n") || "TODO:\n- survive" },
        { name: "shortcuts", type: "folder", children: [
          { name: "intranet.url", type: "url", url: "intranet.home" },
          { name: "chat.url", type: "url", url: "chat" },
        ] },
      ],
      "Documents": [],
      "Downloads": [],
      "Pictures": [],
    };
    if (p.codeFile) tree["Documents"].push({ name: p.codeFile.name, type: "code", lang: p.codeFile.lang, content: CODE_SNIPPETS[p.codeFile.lang] });
    if (p.sheet) tree["Documents"].push({ name: SHEETS[p.sheet].name, type: "sheet", sheet: p.sheet });
    tree["Documents"].push({ name: "meeting_notes.md", type: "txt", content: `# Standup notes\n\n- GLASSWING v0.9: 94.2%\n- memory leak: FIXED (allegedly)\n- someone broke the build again (greg)\n- action items: TBD (always)\n` });
    if (emp.personality === "slacker") {
      tree["Documents"].push({ name: "how_to_look_busy.txt", type: "txt", secret: "busy", content: `HOW TO LOOK BUSY — field guide (do not print)\n\n1. Keep a spreadsheet open. Content optional. Gridlines mandatory.\n2. Type loudly during meetings. Nod at intervals of 4-7 seconds.\n3. Walk briskly while carrying a laptop. Destination irrelevant.\n4. Sigh at your monitor. Deeply. Once per hour.\n5. If the boss approaches: alt-tab, frown, mutter "edge case".\n6. Coffee cup must never be empty. It signals momentum.\n7. Respond "looking into it" to everything. It is always true.\n\nReminder: work expands to fill the time you're pretending to spend on it.` });
    }
    if (emp.personality === "slacker" || emp.personality === "gamer") {
      tree["Downloads"].push({ name: "totally_work.xlsx", type: "sheet", sheet: "budget" });
      tree["Downloads"].push({ name: "excuse_generator.exe", type: "exe", content: "Error: this application requires 1 (one) workflow.\nWorkflow not found. Reinstalling enthusiasm…" });
      tree["Downloads"].push({ name: "not_a_game.zip", type: "zip", children: [{ name: "definitely_spreadsheet.exe", type: "exe", content: "It is a game." }, { name: "readme.txt", type: "txt", content: "This is a productivity suite. Wink." }] });
    }
    if (p.files) for (const [folder, files] of Object.entries(p.files)) {
      for (const f of files) {
        if (f.endsWith(".png")) tree[folder === "Pictures" ? "Pictures" : "Downloads"].push({ name: f, type: "img", seed: hash(f) });
        else tree["Downloads"].push({ name: f, type: "txt", content: "(binary file — viewer not available in trial version)" });
      }
    }
    // generic filler
    tree["Downloads"].push({ name: "Q4_budget.xlsx", type: "sheet", sheet: "budget" });
    if (!tree["Pictures"].length) tree["Pictures"].push({ name: "office_dog.png", type: "img", seed: 7 });
    return tree;
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  /* ================= EXPLORER ================= */
  reg("explorer", {
    title: "File Explorer", icon: "📁", w: 700, h: 460,
    render(body, w, emp) {
      const tree = fileTree(emp);
      body.innerHTML = `<div class="explorer">
        <div class="ex-sidebar"></div>
        <div class="ex-main"><div class="ex-crumbs">This PC</div><div class="ex-grid"></div></div>
      </div>`;
      const side = body.querySelector(".ex-sidebar"), grid = body.querySelector(".ex-grid"), crumbs = body.querySelector(".ex-crumbs");
      const ICONS = { folder: "📂", txt: "📄", code: "📜", sheet: "📊", img: "🖼️", exe: "⚙️", zip: "🗜️", url: "🔗", md: "📝" };
      let cwd = ["Desktop"];
      function render() {
        crumbs.textContent = "This PC  ›  " + cwd.join("  ›  ");
        grid.innerHTML = "";
        // up
        if (cwd.length > 1) {
          const up = exItem("⬆️", "..", () => { cwd.pop(); render(); });
          grid.appendChild(up);
        }
        let node = tree;
        for (const c of cwd) node = node[c] ? (Array.isArray(node[c]) ? null : null) : null;
        // navigate: cwd[0] is root folder name
        let items = tree[cwd[0]] || [];
        for (let i = 1; i < cwd.length; i++) {
          const found = items.find(f => f.name === cwd[i] && f.type === "folder");
          items = found ? found.children : [];
        }
        if (!items.length) { grid.appendChild(el("div", "ex-empty", "This folder is empty. Like the coffee pot at 5pm.")); return; }
        for (const f of items) {
          const it = exItem(ICONS[f.type] || "📄", f.name, () => openItem(f, f.name === ".." ? null : f));
          grid.appendChild(it);
        }
      }
      function exItem(icon, name, fn) {
        const d = el("div", "ex-item", `<span class="ic">${icon}</span>${name}`);
        d.addEventListener("dblclick", () => { Audio2.click(); fn(); });
        return d;
      }
      function openItem(f) {
        if (!f) { cwd.pop(); render(); return; }
        if (f.type === "folder") { cwd.push(f.name); render(); return; }
        if (f.type === "url") { Desktop.openApp("browser", { url: f.url }); return; }
        Desktop.openApp("viewer", { file: f });
        if (f.secret === "busy") unlockAchievement("busy");
      }
      // sidebar
      const sideItems = ["Desktop", "Documents", "Downloads", "Pictures"];
      for (const s of sideItems) {
        const d = el("div", "ex-side-item" + (s === "Desktop" ? " active" : ""), `${s === "Desktop" ? "🖥️" : s === "Documents" ? "📄" : s === "Downloads" ? "⬇️" : "🖼️"} ${s}`);
        d.addEventListener("click", () => { cwd = [s]; side.querySelectorAll(".ex-side-item").forEach(x => x.classList.remove("active")); d.classList.add("active"); render(); });
        side.appendChild(d);
      }
      render();
    },
  });

  /* ================= VIEWER ================= */
  reg("viewer", {
    title: "Viewer", icon: "📄", w: 620, h: 460,
    render(body, w, emp) {
      body.innerHTML = `<div class="viewer"><div class="viewer-body"></div></div>`;
      const vb = body.querySelector(".viewer-body");
      const f = w.args.file;
      if (!f) { vb.textContent = "No file selected."; return; }
      body.closest(".dwin").querySelector(".t-label").textContent = f.name;
      if (f.type === "code") {
        vb.className = "viewer-body code";
        vb.innerHTML = highlightCode(f.content, f.lang);
      } else if (f.type === "img") {
        vb.innerHTML = "";
        const c = document.createElement("canvas");
        c.width = 480; c.height = 320; c.style.maxWidth = "100%";
        drawMeme(c, f.seed);
        vb.appendChild(c);
      } else if (f.type === "sheet") {
        Desktop.openApp("sheet", { sheet: f.sheet });
        Desktop.close && setTimeout(() => { /* close viewer */ const win = w; w.node && w.node.querySelector(".close").click(); }, 30);
      } else if (f.type === "exe") {
        vb.innerHTML = `<div style="text-align:center;padding:40px 20px"><div style="font-size:44px">⚠️</div><p><b>${f.name}</b></p><p style="color:var(--win-muted)">${f.content}</p></div>`;
        Audio2.error();
      } else if (f.type === "zip") {
        vb.innerHTML = `<div class="ex-grid">${f.children.map(c => `<div class="ex-item"><span class="ic">📄</span>${c.name}</div>`).join("")}</div>`;
      } else {
        vb.textContent = f.content || "(empty file)";
      }
    },
  });

  function highlightCode(src, lang) {
    let h = src.replace(/&/g, "&").replace(/</g, "<");
    h = h.replace(/(\/\/[^\n]*|#[^\n]*)/g, '<span class="cm">$1</span>');
    h = h.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="str">$1</span>');
    const kws = lang === "py" ? "import from def return for in if else print range await async class" : "import export const let var function return if else await async new class extends";
    h = h.replace(new RegExp(`\\b(${kws.split(" ").join("|")})\\b`, "g"), '<span class="kw">$1</span>');
    h = h.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>');
    return h;
  }

  function drawMeme(canvas, seed) {
    const r = seededRandom(seed + 1);
    const ctx = canvas.getContext("2d");
    const hues = [[52, 90, 60], [200, 80, 55], [340, 70, 60], [140, 60, 50]];
    const h = hues[seed % hues.length];
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, `hsl(${h[0]},${h[1]}%,${h[2]}%)`);
    g.addColorStop(1, `hsl(${(h[0] + 60) % 360},${h[1]}%,${h[2] - 20}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const emojis = ["🐈", "🐕", "🔥", "😂", "🗿", "🦆", "🍕", "💾", "🐸"];
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 0.25 + r() * 0.3;
      ctx.font = `${30 + r() * 50}px Segoe UI Emoji`;
      ctx.fillText(emojis[(seed + i) % emojis.length], r() * (canvas.width - 60), 50 + r() * (canvas.height - 40));
    }
    ctx.globalAlpha = 1;
    ctx.font = "700 34px Segoe UI"; ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 8;
    const caps = ["me pretending to work", "it works on my machine", "tasks: done ✅", "sent from my desk", "peak productivity", "do not perceive me"];
    ctx.fillText(caps[seed % caps.length], canvas.width / 2, canvas.height - 28);
    ctx.shadowBlur = 0; ctx.textAlign = "left";
  }

  /* ================= SPREADSHEET ================= */
  reg("sheet", {
    title: "GridSheet", icon: "📊", w: 640, h: 420,
    render(body, w, emp) {
      const data = SHEETS[w.args.sheet || "budget"];
      body.innerHTML = `<div class="sheet">
        <div class="sheet-bar">${data.name} — autosaved (you're welcome)</div>
        <div class="sheet-grid"></div>
        <div class="sheet-tabs">${data.tabs.map((t, i) => `<span class="${i === 0 ? "active" : ""}">${t}</span>`).join("")}</div>
      </div>`;
      const grid = body.querySelector(".sheet-grid");
      function renderTab(idx) {
        const rows = data.data[data.tabs[idx]];
        let html = "<table>";
        rows.forEach((row, ri) => {
          html += "<tr>";
          if (ri === 0) row.forEach(c => html += `<th>${c}</th>`);
          else {
            html += `<td>${row[0]}</td>`;
            for (let i = 1; i < row.length; i++) {
              const v = row[i];
              const neg = typeof v === "number" && data.data[data.tabs[idx]][0] && rows[0][i] === "Δ" && false;
              html += `<td class="${typeof v === "number" ? "num" : ""}">${typeof v === "number" ? v.toLocaleString() : v}</td>`;
            }
          }
          html += "</tr>";
        });
        html += "</table>";
        grid.innerHTML = html;
      }
      body.querySelectorAll(".sheet-tabs span").forEach((s, i) => s.addEventListener("click", () => {
        body.querySelectorAll(".sheet-tabs span").forEach(x => x.classList.remove("active"));
        s.classList.add("active"); renderTab(i); Audio2.click();
      }));
      renderTab(0);
    },
  });

  /* ================= STICKY NOTES ================= */
  reg("stickies", {
    title: "Sticky Notes", icon: "🗒️", w: 460, h: 420,
    render(body, w, emp) {
      body.innerHTML = `<div class="stickies"></div>`;
      const wrap = body.querySelector(".stickies");
      const tb = el("div", "app-toolbar");
      const add = el("button", "", "＋ New note");
      tb.appendChild(add);
      body.prepend(tb);
      const colors = ["", "pink", "blue"];
      function addNote(text, color) {
        const n = el("div", "sticky-note " + (color || ""), text);
        wrap.appendChild(n);
      }
      (emp.persona.sticky.length ? emp.persona.sticky : [{ text: "remember: breathe", color: "" }]).forEach(n => addNote(n.text, n.color));
      add.addEventListener("click", () => { addNote(pick(["buy coffee beans", "standup in 5", "email greg", "why is the printer humming", "water the plant (the sad one)"]), pick(colors)); Audio2.pop(); });
    },
  });

  /* ================= CALCULATOR ================= */
  reg("calculator", {
    title: "Calculator", icon: "🧮", w: 300, h: 430,
    render(body) {
      body.innerHTML = `<div class="calc">
        <div class="calc-disp"><div class="calc-expr"></div><div class="calc-val">0</div></div>
        <div class="calc-grid"></div>
      </div>`;
      const val = body.querySelector(".calc-val"), expr = body.querySelector(".calc-expr");
      const grid = body.querySelector(".calc-grid");
      let cur = "0", acc = null, op = null, fresh = true;
      const keys = [["C", "c"], ["±", "neg"], ["%", "pct"], ["÷", "op"],
        ["7"], ["8"], ["9"], ["×", "op"],
        ["4"], ["5"], ["6"], ["−", "op"],
        ["1"], ["2"], ["3"], ["+", "op"],
        ["√"], ["0"], [".", "dot"], ["=", "eq"]];
      for (const [label, kind] of keys) {
        const b = el("button", kind === "op" ? "op" : kind === "eq" ? "eq" : "", label);
        b.addEventListener("click", () => press(label, kind || "num"));
        grid.appendChild(b);
      }
      function press(k, kind) {
        Audio2.click();
        if (kind === "num") { cur = fresh || cur === "0" ? k : cur + k; fresh = false; }
        else if (k === "C") { cur = "0"; acc = null; op = null; expr.textContent = ""; }
        else if (k === "±") cur = String(-parseFloat(cur));
        else if (k === "%") cur = String(parseFloat(cur) / 100);
        else if (k === "√") cur = String(Math.sqrt(parseFloat(cur)));
        else if (k === "dot" && !cur.includes(".")) cur += ".";
        else if (kind === "op") { if (op && !fresh) calc(); acc = parseFloat(cur); op = k; expr.textContent = `${acc} ${k}`; fresh = true; }
        else if (k === "=") { if (op) { calc(); op = null; expr.textContent = ""; } }
        val.textContent = cur.length > 12 ? Number(cur).toPrecision(9) : cur;
        function calc() {
          const b = parseFloat(cur), a = acc;
          let r = a + b; if (op === "−") r = a - b; if (op === "×") r = a * b; if (op === "÷") r = b === 0 ? NaN : a / b;
          cur = String(Math.round(r * 1e10) / 1e10); acc = r; fresh = true;
        }
      }
    },
  });

  /* ================= PAINT ================= */
  reg("paint", {
    title: "Paint", icon: "🎨", w: 660, h: 500,
    render(body, w, emp) {
      body.innerHTML = `<div class="paint-wrap">
        <div class="app-toolbar">
          <span style="font-size:11px;color:var(--win-muted)">Brush</span>
          <input type="range" min="2" max="30" value="6" style="width:90px" class="p-size">
          <span class="sep"></span><span class="p-colors" style="display:flex;gap:4px"></span>
          <span class="sep"></span>
          <button class="p-clear">🗑 Clear</button>
          <button class="p-fill">🪣 Fill</button>
        </div>
        <div class="paint-canvas-wrap"><canvas id="paintCanvas" width="560" height="360"></canvas></div>
      </div>`;
      const canvas = body.querySelector("#paintCanvas");
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      let color = "#22252e", size = 6, drawing = false, last = null;
      const COLORS = ["#22252e", "#d13438", "#f59e0b", "#22a559", "#4f8cff", "#a855f7", "#e879a0", "#8b5a2b"];
      const cw = body.querySelector(".p-colors");
      COLORS.forEach(c => {
        const d = el("div", "accent-dot", "");
        d.style.background = c; if (c === color) d.classList.add("sel");
        d.addEventListener("click", () => { color = c; cw.querySelectorAll(".accent-dot").forEach(x => x.classList.remove("sel")); d.classList.add("sel"); Audio2.click(); });
        cw.appendChild(d);
      });
      body.querySelector(".p-size").addEventListener("input", e => size = +e.target.value);
      body.querySelector(".p-clear").addEventListener("click", () => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); Audio2.pop(); });
      body.querySelector(".p-fill").addEventListener("click", () => { ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height); unlockAchievement("paint"); });
      const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; };
      canvas.addEventListener("mousedown", e => { drawing = true; last = pos(e); });
      document.addEventListener("mousemove", e => {
        if (!drawing || !canvas.isConnected) return;
        const p = pos(e);
        ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        last = p;
      });
      document.addEventListener("mouseup", () => { if (drawing) unlockAchievement("paint"); drawing = false; });
      // preloaded doodles for creatives
      if (emp.personality === "memeAddict") {
        ctx.font = "90px Segoe UI Emoji"; ctx.textAlign = "center";
        ctx.fillText("🐈", canvas.width / 2, 180);
        ctx.font = "600 22px Segoe UI"; ctx.fillStyle = "#d13438";
        ctx.fillText("when the build passes", canvas.width / 2, 240);
        ctx.textAlign = "left";
      }
      if (emp.personality === "perfectionist") {
        ctx.font = "600 15px Segoe UI"; ctx.fillStyle = "#4f8cff";
        ctx.fillText("wireframe_v27_FINAL_final2.png", 16, 26);
        ctx.strokeStyle = "#4f8cff"; ctx.strokeRect(16, 40, 240, 140); ctx.strokeRect(270, 40, 270, 60);
        ctx.strokeRect(270, 112, 270, 68);
      }
    },
  });

  /* ================= TERMINAL ================= */
  reg("terminal", {
    title: "Terminal", icon: "⌨️", w: 620, h: 400,
    render(body, w, emp) {
      body.innerHTML = `<div class="terminal"><div class="t-out"></div><div class="t-line"><span class="t-prompt">C:\\Users\\${emp.first.toLowerCase()}></span><input class="term-input" autofocus spellcheck="false"></div></div>`;
      const out = body.querySelector(".t-out"), input = body.querySelector(".term-input");
      const term = body.querySelector(".terminal");
      function print(html, cls) { const d = el("div", "t-line" + (cls ? " " + cls : ""), html); out.appendChild(d); term.scrollTop = term.scrollHeight; }
      print(`SynergyShell v3.1 — type 'help'\n`);
      const cmds = {
        help: () => print(`Available commands:\n  help, ls, cd, cat <file>, whoami, date, coffee, sudo, neofetch, matrix, exit`),
        ls: () => print("Documents/  Downloads/  Pictures/  todo.txt  .definitely_not_procrastinating"),
        cd: (a) => print(a ? (a === ".." ? "moved up. like your goals." : `directory '${a}' does not exist (or does it?)`) : "C:\\" + emp.first.toLowerCase()),
        cat: (a) => {
          if (!a) return print("usage: cat <file>");
          if (a.includes("todo")) return print(emp.persona.notes.map(n => n.text).join("\n---\n") || "it's empty. like your motivation on mondays.");
          if (a.includes("secret")) return print(" Access granted. The cake is a spreadsheet. 🎂");
          print(`cat: ${a}: no such file (have you tried 'ls'?)`, "t-err");
        },
        whoami: () => print(`${emp.name} — ${emp.role} — ${emp.personality.replace(/([A-Z])/g, " $1").toLowerCase()} — mood: ${emp.mood}`),
        date: () => print(`${DAYS[(SIM.day - 1) % 5]}, Day ${SIM.day} — ${fmtTime(SIM.minutes)} (office time)`),
        coffee: () => { print("brewing… ☕"); Audio2.coffeeOn(); setTimeout(() => { Audio2.coffeeOff(); print("coffee ready. productivity +2"); }, 1800); },
        sudo: (a) => print(a ? `${emp.first} is not in the sudoers file. This incident will be reported to ${SIM.boss.first}.` : "usage: sudo <regret>"),
        neofetch: () => print(`        ______        ${emp.first}@SYNERGY-PC
       /      \\       ─────────────────
      |  o  o  |      OS: AcornOS 3.1 (Inspired Edition)
      |   /\   |      Shell: SynergyShell 3.1
       \\  --  /       CPU: Optimistic Core i9
        ------        Coffee: ${emp.personality === "coffeeAddict" ? "CRITICAL ☠️" : "nominal"}`),
        matrix: () => {
          print("wake up, " + emp.first + "…", "t-warn");
          unlockAchievement("matrix");
          const c = el("canvas", "matrix-canvas");
          c.width = innerWidth; c.height = innerHeight;
          document.body.appendChild(c);
          const mx = c.getContext("2d");
          const cols = Math.floor(c.width / 14);
          const drops = Array(cols).fill(0);
          let frames = 0;
          const iv = setInterval(() => {
            mx.fillStyle = "rgba(0,0,0,0.08)"; mx.fillRect(0, 0, c.width, c.height);
            mx.fillStyle = "#0f0"; mx.font = "14px monospace";
            for (let i = 0; i < cols; i++) {
              mx.fillText(String.fromCharCode(0x30A0 + Math.random() * 90), i * 14, drops[i] * 16);
              if (drops[i] * 16 > c.height && Math.random() > 0.975) drops[i] = 0;
              drops[i]++;
            }
            if (++frames > 240 || Math.random() < 0.002) { clearInterval(iv); c.remove(); }
          }, 40);
          c.addEventListener("click", () => { clearInterval(iv); c.remove(); });
        },
        exit: () => { print("bye 👋"); setTimeout(() => w.node.querySelector(".close").click(), 400); },
      };
      input.addEventListener("keydown", e => {
        if (e.key !== "Enter") { if (e.key.length === 1) Audio2.key(); return; }
        const raw = input.value.trim(); input.value = "";
        print(`<span class="t-prompt">C:\\Users\\${emp.first.toLowerCase()}></span> ${raw.replace(/</g, "<")}`);
        if (!raw) return;
        const [cmd, ...rest] = raw.split(/\s+/);
        (cmds[cmd] || (() => print(`'${cmd}' is not recognized. Blame the intern.`, "t-err")))(rest.join(" "));
      });
      body.closest(".dwin").addEventListener("mousedown", () => setTimeout(() => input.focus(), 0));
    },
  });

  /* ================= SETTINGS ================= */
  reg("settings", {
    title: "Settings", icon: "⚙️", w: 640, h: 460,
    render(body, w, emp) {
      body.innerHTML = `<div class="settings">
        <div class="set-nav"></div>
        <div class="set-body"></div>
      </div>`;
      const nav = body.querySelector(".set-nav"), page = body.querySelector(".set-body");
      const tabs = [["personalization", "🎨 Personalization"], ["sound", "🔊 Sound"], ["about", "ℹ️ About"], ["achievements", "🏆 Achievements"]];
      let cur = w.args.tab || "personalization";
      function renderNav() {
        nav.innerHTML = "";
        for (const [id, label] of tabs) {
          const d = el("div", id === cur ? "active" : "", label);
          d.addEventListener("click", () => { cur = id; renderNav(); renderPage(); Audio2.click(); });
          nav.appendChild(d);
        }
      }
      function renderPage() {
        page.innerHTML = "";
        if (cur === "personalization") {
          page.appendChild(el("h2", "", "Personalization"));
          const row1 = el("div", "set-row", "<label>Wallpaper</label>");
          const wg = el("div", "wp-grid");
          Desktop.WALLPAPERS.forEach((wp, i) => {
            const t = el("div", "wp-thumb" + (i === emp.persona.wallpaper ? " sel" : ""));
            t.style.background = wp;
            t.addEventListener("click", () => { emp.persona.wallpaper = i; Desktop.open(emp); Audio2.pop(); renderPage(); });
            wg.appendChild(t);
          });
          row1.appendChild(wg); page.appendChild(row1);
          const row2 = el("div", "set-row", "<label>Accent color</label>");
          const ag = el("div", "accent-dots");
          Desktop.ACCENTS.forEach((a, i) => {
            const d = el("div", "accent-dot" + (i === SAVE.settings.accent ? " sel" : ""));
            d.style.background = a;
            d.addEventListener("click", () => { SAVE.settings.accent = i; document.documentElement.style.setProperty("--accent", a); renderPage(); writeSave(); Audio2.click(); });
            ag.appendChild(d);
          });
          row2.appendChild(ag); page.appendChild(row2);
        } else if (cur === "sound") {
          page.appendChild(el("h2", "", "Sound"));
          const row = el("div", "set-row", "<label>System sounds</label>");
          const sw = el("div", "switch" + (SAVE.settings.sound ? " on" : ""));
          sw.addEventListener("click", () => { SAVE.settings.sound = !SAVE.settings.sound; Audio2.setMuted(!SAVE.settings.sound); $("#btn-mute").textContent = SAVE.settings.sound ? "🔊" : "🔇"; $("#dt-vol").textContent = SAVE.settings.sound ? "🔊" : "🔇"; sw.classList.toggle("on"); writeSave(); });
          row.appendChild(sw); page.appendChild(row);
          page.appendChild(el("p", "", `<span style="font-size:12px;color:var(--win-muted)">All sounds are synthesized live. No audio files were harmed.</span>`));
        } else if (cur === "about") {
          page.appendChild(el("h2", "", "About this PC"));
          page.appendChild(el("div", "", `
            <p style="line-height:1.8;font-size:13px">
            <b>Device name:</b> SYNERGY-${emp.first.toUpperCase()}-01<br>
            <b>Processor:</b> Optimistic Core i9 @ 4.2 GHz<br>
            <b>RAM:</b> 32 GB (16 GB usable, 16 GB "reserved for the AI")<br>
            <b>OS:</b> AcornOS 3.1 — Inspired Edition (definitely not a specific real OS)<br>
            <b>Owner:</b> ${emp.name}, ${emp.role}<br>
            <b>Uptime:</b> since the last coffee<br>
            <b>IT tickets open:</b> ${3 + (hash(emp.name) % 9)}</p>`));
        } else if (cur === "achievements") {
          page.appendChild(el("h2", "", `Achievements — ${SAVE.achievements.length}/${ACHIEVEMENTS.length}`));
          for (const a of ACHIEVEMENTS) {
            const got = SAVE.achievements.includes(a.id);
            page.appendChild(el("div", "ach-item" + (got ? "" : " locked"),
              `<span class="ic">${a.icon}</span><div><div class="nm">${a.name}</div><div class="ds">${got ? a.desc : "???"}</div></div>`));
          }
        }
      }
      renderNav(); renderPage();
    },
  });

  /* ================= CHAT ================= */
  const CHANNELS = ["general", "engineering", "random", "memes"];
  function seedChats() {
    for (const ch of CHANNELS) {
      CHATS[ch] = (INTRANET.chatSeed[ch] || []).map(([who, text]) => ({ who, text }));
      chatUnread[ch] = 0;
    }
  }
  reg("chat", {
    title: "Wavelength", icon: "💬", w: 720, h: 480,
    render(body, w, emp) {
      body.innerHTML = `<div class="chat">
        <div class="ch-sidebar"></div>
        <div class="ch-main">
          <div class="ch-head"></div>
          <div class="ch-msgs"></div>
          <div class="ch-typing"></div>
          <div class="ch-input"><input class="inp" placeholder="Message the channel…"><button class="btn">Send</button></div>
        </div>
      </div>`;
      const side = body.querySelector(".ch-sidebar"), msgs = body.querySelector(".ch-msgs"),
            head = body.querySelector(".ch-head"), typing = body.querySelector(".ch-typing");
      let cur = w.args.channel || "general";
      function renderSide() {
        side.innerHTML = '<div style="font-size:11px;color:var(--win-muted);padding:4px 10px">CHANNELS</div>';
        for (const ch of CHANNELS) {
          const d = el("div", "ch-ch" + (ch === cur ? " active" : ""), `<span>#${ch}</span>${chatUnread[ch] ? `<span class="unread">${chatUnread[ch]}</span>` : ""}`);
          d.addEventListener("click", () => { cur = ch; chatUnread[ch] = 0; renderSide(); renderMsgs(); Audio2.click(); });
          side.appendChild(d);
        }
      }
      function renderMsgs() {
        head.innerHTML = `<span>#${cur}</span><small>Company-wide chatter · be normal (impossible)</small>`;
        msgs.innerHTML = "";
        for (const m of CHATS[cur] || []) {
          const avColor = `hsl(${hash(m.who) % 360},55%,45%)`;
          const d = el("div", "ch-msg", `<div class="ch-av" style="background:${avColor}">${m.who[0]}</div>
            <div><div><span class="ch-who">${m.who}</span><span class="ch-when">${m.when || fmtTime(SIM.minutes)}</span></div>
            <div class="ch-txt">${m.text}</div>${Math.random() < 0.3 ? '<span class="react">👀 3</span><span class="react">😂 5</span>' : ""}</div>`);
          msgs.appendChild(d);
        }
        msgs.scrollTop = msgs.scrollHeight;
        if (cur === "random") unlockAchievement("gossip");
      }
      const inp = body.querySelector(".ch-input input");
      body.querySelector(".ch-input .btn").addEventListener("click", send);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") send(); if (e.key.length === 1) Audio2.key(); });
      function send() {
        const text = inp.value.trim(); if (!text) return;
        CHATS[cur].push({ who: emp.name, text });
        inp.value = "";
        // someone replies
        setTimeout(() => {
          const colleague = pick(SIM.employees);
          CHATS[cur].push({ who: colleague.name, text: pick(["lmk when you're free", "big if true", "adding it to the backlog", "this is the way", "the printer says hi", "did you see the boss? act normal"]) });
          if (Desktop.isOpen && Desktop.emp === emp) renderMsgs();
        }, rnd(1500, 4000));
        renderMsgs(); Audio2.pop();
      }
      renderSide(); renderMsgs();
      // live updates while open
      const iv = setInterval(() => {
        if (!Desktop.isOpen || Desktop.emp !== emp || !msgs.isConnected) { clearInterval(iv); return; }
        if (Math.random() < 0.25) {
          const colleague = pick(SIM.employees);
          CHATS[cur].push({ who: colleague.name, text: pick(GOSSIP_LINES) });
          renderMsgs();
        }
        typing.textContent = Math.random() < 0.5 ? `${pick(SIM.employees).first} is typing…` : "";
      }, 6000);
    },
  });
  function pushChat(channel, who, text) {
    if (!CHATS.general) seedChats();
    (CHATS[channel] || CHATS.general).push({ who, text });
    chatUnread[channel] = (chatUnread[channel] || 0) + 1;
  }

  /* ================= MAIL ================= */
  reg("mail", {
    title: "Mail", icon: "✉️", w: 720, h: 470,
    render(body, w, emp) {
      body.innerHTML = `<div class="mail">
        <div class="ml-list"></div>
        <div class="ml-view"><div class="nc-empty">Select an email. Or don't. Dana will find you anyway.</div></div>
      </div>`;
      const list = body.querySelector(".ml-list"), view = body.querySelector(".ml-view");
      const mails = emp.persona.mail;
      function renderList() {
        list.innerHTML = "";
        mails.forEach((m, i) => {
          const d = el("div", "ml-item" + (m.unread ? " unread" : ""), `
            <div class="fr"><span>${m.from}</span><span class="dt">${m.time}</span></div>
            <div class="sj">${m.subject}</div>
            <div class="pv">${m.body.slice(0, 60)}…</div>`);
          d.addEventListener("click", () => {
            m.unread = false;
            list.querySelectorAll(".ml-item").forEach(x => x.classList.remove("active"));
            d.classList.add("active");
            view.innerHTML = `<h2>${m.subject}</h2><div class="meta">From: <b>${m.from}</b> · ${m.time} · To: ${emp.name}</div><div class="body">${m.body}</div>`;
            Audio2.click();
          });
          list.appendChild(d);
        });
        // compose button
        const comp = el("button", "btn", "✏️ Compose");
        comp.style.margin = "10px";
        comp.addEventListener("click", () => {
          view.innerHTML = `<h2>New message</h2>
            <input class="inp" style="width:100%;margin-bottom:8px" placeholder="To: everyone@synergy.labs" value="everyone@synergy.labs">
            <input class="inp" id="ml-subj" style="width:100%;margin-bottom:8px" placeholder="Subject">
            <textarea class="inp" style="width:100%;height:120px" placeholder="Say something nice. Or passive aggressive. Your call."></textarea>
            <button class="btn" style="margin-top:8px">Send 🚀</button>`;
          view.querySelector(".btn").addEventListener("click", () => {
            const s = view.querySelector("#ml-subj").value || "(no subject)";
            mails.unshift({ from: emp.name, subject: s, body: "Sent from my desk. Sent from my desk.", time: fmtTime(SIM.minutes) });
            renderList();
            Desktop.notify("📨", "Mail delivered", `Your email "${s}" reached 43 inboxes. 3 people opened it. 0 replied.`);
            Audio2.chime();
          });
        });
        list.appendChild(comp);
      }
      renderList();
    },
  });

  /* ================= CODE EDITOR ================= */
  reg("code", {
    title: "CodeForge", icon: "📜", w: 700, h: 470,
    render(body, w, emp) {
      const file = emp.persona.codeFile || { name: "pipeline.js", lang: "js" };
      const src = CODE_SNIPPETS[file.lang];
      body.innerHTML = `<div class="codeed">
        <div class="codeed-tabs"><span class="codeed-tab active">${file.name}</span><span class="codeed-tab">+ new tab</span></div>
        <div class="codeed-editor">${highlightCode(src, file.lang)}</div>
        <div class="codeed-status"><span>⎇ main</span><span> Ln ${src.split("\n").length}, Col 1</span><span>UTF-8</span><span>${file.lang.toUpperCase()}</span><span style="color:#e5c07b">⚠ 3 TODOs, 1 haunted line</span></div>
      </div>`;
      body.querySelector(".codeed-editor").addEventListener("keydown", () => Audio2.key());
    },
  });

  /* ================= MINESWEEPER ================= */
  reg("mines", {
    title: "Minesweeper", icon: "💣", w: 380, h: 460,
    render(body, w, emp) {
      body.innerHTML = `<div class="mines">
        <div class="mines-head"><span>💣 <b class="mines-left">10</b></span><button class="btn mines-new">🙂 New game</button><span class="flag">🚩 <b class="mines-flags">0</b></span></div>
        <div class="mines-grid"></div>
        <div style="font-size:11px;color:var(--win-muted)">left click: reveal · right click: flag</div>
      </div>`;
      const N = 9, MINES = 10;
      const gridEl = body.querySelector(".mines-grid");
      gridEl.style.gridTemplateColumns = `repeat(${N}, 26px)`;
      let board, over, flags;
      function newGame() {
        over = false; flags = 0;
        body.querySelector(".mines-left").textContent = MINES;
        body.querySelector(".mines-flags").textContent = "0";
        body.querySelector(".mines-new").textContent = "🙂 New game";
        board = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => ({ mine: false, rev: false, flag: false, n: 0, r, c })));
        let placed = 0;
        while (placed < MINES) { const r = (Math.random() * N) | 0, c = (Math.random() * N) | 0; if (!board[r][c].mine) { board[r][c].mine = true; placed++; } }
        for (const row of board) for (const cell of row) {
          cell.n = neighbors(cell).filter(x => x.mine).length;
        }
        render();
      }
      function neighbors(cell) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const r = cell.r + dr, c = cell.c + dc;
          if (r >= 0 && r < N && c >= 0 && c < N) out.push(board[r][c]);
        }
        return out;
      }
      function render() {
        gridEl.innerHTML = "";
        for (const row of board) for (const cell of row) {
          const b = el("button", "mcell" + (cell.rev ? " rev" : "") + (cell.boom ? " boom" : "") + (cell.n ? " c" + cell.n : ""),
            cell.rev ? (cell.mine ? "💥" : cell.n || "") : (cell.flag ? "🚩" : ""));
          b.addEventListener("click", () => reveal(cell));
          b.addEventListener("contextmenu", e => { e.preventDefault(); if (over || cell.rev) return; cell.flag = !cell.flag; flags += cell.flag ? 1 : -1; body.querySelector(".mines-flags").textContent = flags; Audio2.click(); render(); });
          gridEl.appendChild(b);
        }
      }
      function reveal(cell) {
        if (over || cell.rev || cell.flag) return;
        Audio2.click();
        cell.rev = true;
        if (cell.mine) { cell.boom = true; over = true; Audio2.error(); body.querySelector(".mines-new").textContent = "😵 New game"; render(); return; }
        if (cell.n === 0) for (const ncell of neighbors(cell)) if (!ncell.rev && !ncell.mine) reveal(ncell);
        render();
        if (board.flat().filter(c => !c.rev && !c.mine).length === 0) {
          over = true; Audio2.chime(); unlockAchievement("mine");
          body.querySelector(".mines-new").textContent = "😎 You win!";
          Desktop.notify("💣", "Minesweeper", "Board cleared. Productivity momentarily increased, then immediately decreased.");
        }
      }
      body.querySelector(".mines-new").addEventListener("click", newGame);
      newGame();
    },
  });

  /* ================= BUSY SIM (easter egg app) ================= */
  reg("busysim", {
    title: "ProductivityPro", icon: "📈", w: 520, h: 420,
    render(body, w, emp) {
      body.innerHTML = `<div class="article">
        <h1>ProductivityPro™ 90-day trial</h1>
        <p><b>Status:</b> evaluating your focus…</p>
        <p>Focus score: <b style="color:#e57373">7%</b> (keyboard activity mostly "asdf")</p>
        <h3>Recommendations</h3>
        <ul>
          <li>Open a spreadsheet. Any spreadsheet. The gridlines build trust.</li>
          <li>Sigh audibly once per hour. Management interprets sighs as depth.</li>
          <li>Walk fast while holding a laptop. You are now "heading to a meeting".</li>
          <li>If asked what you're working on, say "edge cases". Works 94.2% of the time.</li>
        </ul>
        <p style="color:var(--win-muted);font-size:11px;margin-top:14px">Trial expires in -40 days. Your manager has been notified of your diligence.</p>
      </div>`;
    },
  });

  /* ================= icon lists ================= */
  function desktopIcons(emp) {
    const p = emp.personality;
    const icons = [
      { app: "explorer", icon: "📁", label: "Files" },
      { app: "browser", icon: "🌐", label: "Browser", args: { home: true } },
      { app: "mail", icon: "✉️", label: "Mail" },
      { app: "chat", icon: "💬", label: "Wavelength" },
      { app: "stickies", icon: "🗒️", label: "Stickies" },
    ];
    if (p === "gamer") icons.push({ app: "mines", icon: "💣", label: "Mines" });
    if (p === "memeAddict") icons.push({ app: "paint", icon: "🎨", label: "Paint" });
    if (p === "workaholic" || p === "researcher") icons.push({ app: "code", icon: "📜", label: "CodeForge" });
    if (p === "slacker") icons.push({ app: "busysim", icon: "📈", label: "ProductivityPro" });
    if (p === "coffeeAddict") icons.push({ app: "calculator", icon: "🧮", label: "Calc", args: {} });
    icons.push({ app: "terminal", icon: "⌨️", label: "Terminal" });
    icons.push({ app: "settings", icon: "⚙️", label: "Settings" });
    return icons;
  }
  function startMenuApps(emp) {
    return [
      { app: "browser", icon: "🌐", label: "Browser" },
      { app: "mail", icon: "✉️", label: "Mail" },
      { app: "chat", icon: "💬", label: "Wavelength" },
      { app: "explorer", icon: "📁", label: "Files" },
      { app: "stickies", icon: "🗒️", label: "Sticky Notes" },
      { app: "calculator", icon: "🧮", label: "Calculator" },
      { app: "paint", icon: "🎨", label: "Paint" },
      { app: "terminal", icon: "⌨️", label: "Terminal" },
      { app: "mines", icon: "💣", label: "Minesweeper" },
      { app: "code", icon: "📜", label: "CodeForge" },
      { app: "busysim", icon: "📈", label: "ProductivityPro" },
      { app: "settings", icon: "⚙️", label: "Settings" },
    ];
  }

  function officeNote(kind, text) { officeToast(text); }

  function init() { seedChats(); }

  return { registry, init, pushChat, officeNote, desktopIcons, startMenuApps, CHATS, fileTree };
})();
