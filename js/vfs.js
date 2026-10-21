/* ===== vfs.js — persistent per-employee virtual filesystem =====
 * Tree shape: folder = {type:"folder", children:{name:node}}
 *             file   = {type:"txt"|"code"|"sheet"|"img"|"exe"|"zip"|"url"|"md", ...}
 * One tree per employee, stored in SAVE.vfs[empId] and shared by every app.
 */
"use strict";

const VFS = (() => {
  const FOLDERS = ["Desktop", "Documents", "Downloads", "Pictures"];

  function emptyTree() {
    const t = {};
    for (const f of FOLDERS) t[f] = { type: "folder", children: {} };
    return t;
  }

  /* convert a legacy Apps.fileTree array shape into the object tree */
  function convertNode(n) {
    if (Array.isArray(n)) {
      const folder = { type: "folder", children: {} };
      for (const item of n) folder.children[item.name] = convertNode(item);
      return folder;
    }
    if (n && n.type === "folder") {
      const folder = { type: "folder", children: {} };
      for (const item of (n.children || [])) folder.children[item.name] = convertNode(item);
      return folder;
    }
    return Object.assign({}, n);
  }

  function seed(emp) {
    if (SAVE.vfs[emp.id]) return SAVE.vfs[emp.id];
    const legacy = Apps.fileTree(emp);
    const tree = {};
    for (const [folderName, items] of Object.entries(legacy)) tree[folderName] = convertNode(items);
    // persona-derived persistent content
    const p = emp.persona;
    tree["Documents"].children["notes.json"] = {
      type: "txt", app: "stickies",
      content: JSON.stringify((p.sticky && p.sticky.length ? p.sticky : [{ text: "remember: breathe", color: "" }]))
    };
    if (p.codeFile) {
      tree["Documents"].children[p.codeFile.name] = { type: "code", lang: p.codeFile.lang, content: CODE_SNIPPETS[p.codeFile.lang] };
    }
    if (p.sheet) {
      tree["Documents"].children[SHEETS[p.sheet].name] = { type: "sheet", sheet: p.sheet };
    }
    /* secret documents live on specific employees' machines */
    if (emp.personality === "social") {
      tree["Documents"].children["nightjar_brief.txt"] = { type: "txt", content: "PROJECT NIGHTJAR — DO NOT CIRCULATE\n\nInvestor terms draft (V. Okonkwo):\n- Contingent Series A: $180k on GLASSWING v1.0 shipping with grade A or better\n- Board seat requested. HR not informed. Dana would object loudly.\n- If asked: this file does not exist." };
    }
    if (emp.role === "Data Analyst") {
      tree["Documents"].children["salary_compare.xlsx"] = { type: "sheet", sheet: "budget", secretTab: true, content: "Hidden tab: salaries side by side. Two people with the same title differ by $1,400/mo. The note says 'market adjustment (do not discuss)'." };
    }
    SAVE.vfs[emp.id] = tree;
    Persistence.markDirty();
    return tree;
  }

  function get(emp) { return SAVE.vfs[emp.id] || seed(emp); }

  function splitPath(pathStr) {
    return pathStr.split("/").map(s => s.trim()).filter(Boolean);
  }
  function nodeAt(tree, pathArr) {
    let node = { type: "folder", children: tree }; // virtual root wraps the top-level folders
    for (const part of pathArr) {
      if (!node || node.type !== "folder" || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  function list(emp, pathStr) {
    const tree = get(emp);
    const node = nodeAt(tree, splitPath(pathStr));
    if (!node || node.type !== "folder") return null;
    return node.children;
  }

  function writeFile(emp, pathStr, file) {
    const tree = get(emp);
    const parts = splitPath(pathStr);
    const name = parts.pop();
    const folder = nodeAt(tree, parts);
    if (!folder || folder.type !== "folder") return false;
    folder.children[name] = file;
    Persistence.markDirty();
    return true;
  }

  function readFile(emp, pathStr) {
    return nodeAt(get(emp), splitPath(pathStr));
  }

  function createFolder(emp, pathStr) {
    const parts = splitPath(pathStr);
    const name = parts.pop();
    const parent = nodeAt(get(emp), parts);
    if (!parent || parent.type !== "folder" || parent.children[name]) return false;
    parent.children[name] = { type: "folder", children: {} };
    Persistence.markDirty();
    return true;
  }

  function remove(emp, pathStr) {
    const parts = splitPath(pathStr);
    const name = parts.pop();
    const parent = nodeAt(get(emp), parts);
    if (!parent || parent.type !== "folder" || !parent.children[name]) return false;
    delete parent.children[name];
    Persistence.markDirty();
    return true;
  }

  function rename(emp, pathStr, newName) {
    const parts = splitPath(pathStr);
    const old = parts.pop();
    const parent = nodeAt(get(emp), parts);
    if (!parent || parent.type !== "folder" || !parent.children[old]) return false;
    if (parent.children[newName]) return false;
    parent.children[newName] = parent.children[old];
    delete parent.children[old];
    Persistence.markDirty();
    return true;
  }

  function move(emp, fromPath, toFolder) {
    const parts = splitPath(fromPath);
    const name = parts.pop();
    const parent = nodeAt(get(emp), parts);
    const dest = nodeAt(get(emp), splitPath(toFolder));
    if (!parent || !dest || parent.type !== "folder" || dest.type !== "folder") return false;
    if (!parent.children[name] || dest.children[name]) return false;
    dest.children[name] = parent.children[name];
    delete parent.children[name];
    Persistence.markDirty();
    return true;
  }

  function uniqueName(emp, folderPath, base, ext) {
    const children = list(emp, folderPath) || {};
    let n = 1, name = base + "." + ext;
    while (children[name]) { n++; name = base + "_" + n + "." + ext; }
    return name;
  }

  /* next paint slot */
  function nextPaintPath(emp) {
    const name = uniqueName(emp, "Pictures", "painting", "png");
    return "Pictures/" + name;
  }

  return { FOLDERS, emptyTree, seed, get, list, writeFile, readFile, createFolder, remove, rename, move, splitPath, nodeAt, uniqueName, nextPaintPath };
})();
