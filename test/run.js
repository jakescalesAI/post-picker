// Tests for Post Picker. Run from the plugin folder: node test/run.js
// A small stand-in for the parts of Obsidian the plugin uses (a pretend DOM, vault and network), so the tests
// run in plain Node. No packages. Nothing here touches the network or the disk outside this folder.
"use strict";
const fs = require("fs");
const path = require("path");

// Words that must never ship (the owner's name, company and vault folders) live in a git-ignored file,
// test/private-words.json, so the list itself is never published. Without the file these checks pass trivially.
const PRIVATE = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "private-words.json"), "utf8")); } catch (e) { return []; } })();
const PRIVATE_RES = PRIVATE.map((w) => new RegExp(`(^|[^A-Za-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "i"));
const PRIVATE_RE = { test: (t) => PRIVATE_RES.some((r) => r.test(t)) };
const nodeCrypto = require("crypto");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

/* ---------- a pretend DOM element ---------- */
class FakeEl {
  constructor(tag, parent) { this.tag = tag; this.parent = parent || null; this.children = []; this.classes = new Set(); this.attrs = {}; this.listeners = {}; this.text = ""; this.disabled = false; }
  _make(tag, o) {
    const el = new FakeEl(tag, this);
    if (typeof o === "string") o = { cls: o };
    o = o || {};
    if (o.cls) String(o.cls).split(/\s+/).filter(Boolean).forEach((c) => el.classes.add(c));
    if (o.text != null) el.text = String(o.text);
    if (o.href) el.attrs.href = o.href;
    if (o.attr) Object.assign(el.attrs, o.attr);
    this.children.push(el);
    return el;
  }
  createDiv(o) { return this._make("div", o); }
  createSpan(o) { return this._make("span", o); }
  createEl(tag, o) { return this._make(tag, o); }
  createSvg(tag, o) { return this._make(tag, o); }
  empty() { for (const c of this.children) c.parent = null; this.children = []; this.text = ""; }
  addClass(...c) { c.forEach((x) => this.classes.add(x)); }
  removeClass(...c) { c.forEach((x) => this.classes.delete(x)); }
  hasClass(c) { return this.classes.has(c); }
  toggleClass(c, on) { if (on) this.classes.add(c); else this.classes.delete(c); }
  setText(t) { this.text = String(t); }
  setAttr(k, v) { this.attrs[k] = v; }
  getAttr(k) { return this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  click() { return Promise.all((this.listeners.click || []).map((fn) => fn({ type: "click", target: this, preventDefault() {} }))); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  get parentElement() { return this.parent; }
  get nextElementSibling() { if (!this.parent) return null; const a = this.parent.children; return a[a.indexOf(this) + 1] || null; }
  get firstElementChild() { return this.children[0] || null; }
  insertBefore(el, ref) {
    if (el.parent) el.parent.children = el.parent.children.filter((c) => c !== el);
    el.parent = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(el); else this.children.splice(i, 0, el);
    return el;
  }
  querySelectorAll(sel) { const m = /^\.([\w-]+)$/.exec(sel); if (!m) throw new Error("stub selector not supported: " + sel); return this.all((e) => e.classes.has(m[1])); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(""); }
  all(pred) { const out = []; const walk = (e) => { for (const c of e.children) { if (pred(c)) out.push(c); walk(c); } }; walk(this); return out; }
  byClass(c) { return this.all((e) => e.classes.has(c)); }
  byText(t) { return this.all((e) => e.text === t); }
  byAttr(k, v) { return this.all((e) => e.attrs[k] === v); }
}

/* ---------- the app API ---------- */
class TAbstractFile { constructor(p) { this.path = p; this.name = p.split("/").pop(); } }
class TFile extends TAbstractFile {
  constructor(p) { super(p); this.fm = undefined; this.body = ""; this._name(); }
  _name() { this.name = this.path.split("/").pop(); this.basename = this.name.replace(/\.[^.]+$/, ""); this.extension = (this.name.match(/\.([^.]+)$/) || [])[1] || ""; }
}
class TFolder extends TAbstractFile { constructor(p) { super(p); this.children = []; } }
const notices = [];
class Notice { constructor(m) { notices.push(String(m)); } }
const normalizePath = (p) => { const s = String(p).replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, ""); return s === "" ? "/" : s; };

// The network: every call is recorded, and a test sets what comes back.
const requests = [];
let respond = () => ({ status: 200, json: {} });
async function requestUrl(o) { requests.push(JSON.parse(JSON.stringify(o))); const r = await respond(o); return r; }

class Component { registerEvent() {} register() {} }
class Plugin extends Component {
  constructor(app, m) { super(); this.app = app; this.manifest = m; this._data = null; this.ribbons = []; this.commands = []; this.tabs = []; this.saved = 0; }
  async loadData() { return this._data == null ? null : JSON.parse(JSON.stringify(this._data)); }
  async saveData(d) { this._data = JSON.parse(JSON.stringify(d)); this.saved++; }
  addRibbonIcon(i, t, cb) { this.ribbons.push({ i, t, cb }); }
  addCommand(c) { this.commands.push(c); }
  addSettingTab(t) { this.tabs.push(t); }
}
const modals = [];
class Modal {
  constructor(app) { this.app = app; this.contentEl = new FakeEl("div"); this.titleEl = new FakeEl("div"); this.isOpen = false; }
  setTitle(t) { this.titleEl.setText(t); return this; }
  open() { this.isOpen = true; modals.push(this); this.onOpen(); }
  close() { if (!this.isOpen) return; this.isOpen = false; this.onClose(); }
  onOpen() {}
  onClose() {}
}
class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = new FakeEl("div"); } }
const settingsMade = [];
class Comp {
  constructor(kind) { this.kind = kind; this.inputEl = { type: "text" }; this.options = []; }
  setPlaceholder(v) { this.placeholder = v; return this; }
  setValue(v) { this.value = v; return this; }
  onChange(fn) { this.change = fn; return this; }
  setTooltip(t) { this.tooltip = t; return this; }
  setIcon(i) { this.icon = i; return this; }
  addOption(v, l) { this.options.push([v, l]); return this; }
  setButtonText(t) { this.buttonText = t; return this; }
  onClick(fn) { this.click = fn; return this; }
  setCta() { return this; }
}
class Setting {
  constructor(el) { this.el = el.createDiv("setting-item"); this.name = ""; this.desc = ""; this.heading = false; this.comps = []; settingsMade.push(this); }
  setName(n) { this.name = n; return this; }
  setDesc(d) { this.desc = d; return this; }
  setHeading() { this.heading = true; return this; }
  _add(kind, cb) { const c = new Comp(kind); this.comps.push(c); cb(c); return this; }
  addText(cb) { return this._add("text", cb); }
  addToggle(cb) { return this._add("toggle", cb); }
  addDropdown(cb) { return this._add("dropdown", cb); }
  addButton(cb) { return this._add("button", cb); }
  addExtraButton(cb) { return this._add("extra", cb); }
}
// A note view with Live Preview (.cm-sizer, properties a direct child) and Reading view
// (.markdown-preview-sizer, properties inside .mod-header), like the app draws them.
class MarkdownView extends Component {
  constructor(leaf, file, mode, source) {
    super();
    this.leaf = leaf; this.file = file; this.mode = mode || "source"; this.source = !!source;
    this.containerEl = new FakeEl("div");
    const lp = this.containerEl.createDiv("markdown-source-view").createDiv("cm-scroller").createDiv("cm-sizer");
    this.lpSizer = lp; lp.createDiv("inline-title"); this.lpMeta = lp.createDiv("metadata-container"); lp.createDiv("cm-contentContainer");
    const rv = this.containerEl.createDiv("markdown-preview-view").createDiv("markdown-preview-sizer");
    this.rvSizer = rv; rv.createDiv("markdown-preview-pusher");
    this.rvHead = rv.createDiv("mod-header"); this.rvHead.createDiv("inline-title"); this.rvMeta = this.rvHead.createDiv("metadata-container");
    rv.createDiv("markdown-preview-section");
  }
  getViewType() { return "markdown"; }
  getMode() { return this.mode; }
  getState() { return { mode: this.mode, source: this.source }; }
}

const stub = { Plugin, Modal, Notice, PluginSettingTab, Setting, TFile, TFolder, TAbstractFile, MarkdownView, Component, normalizePath, requestUrl };
const origLoad = Module._load;
Module._load = function (request, ...rest) { return request === "obsidian" ? stub : origLoad.call(this, request, ...rest); };
const momentFmt = { "YYYY-MM-DD HHmm [post]": "2026-11-13 1530 post", "YYYY-MM-DDTHH:mm": "2026-11-13T15:30", "HH:mm [post]": "15:30 post" };
global.window = { moment: () => ({ format: (f) => momentFmt[f] || "2026-11-13" }) };
global.activeWindow = { setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {} };
global.activeDocument = { activeElement: null };
const PostPicker = require(path.join(ROOT, "main.js"));
const { core } = PostPicker;

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && detail !== undefined ? "  (" + (typeof detail === "string" ? detail : JSON.stringify(detail)) + ")" : ""}`);
}
async function test(name, fn) {
  try { await fn(); } catch (e) { failed++; console.log(`FAIL ${name}  (threw: ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e})`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- a pretend app with a vault ---------- */
// Front matter in the notes is kept as an object on the file; reading a note writes it back out as simple YAML.
function yamlOut(fm) {
  return Object.entries(fm).map(([k, v]) => Array.isArray(v) ? `${k}: [${v.join(", ")}]` : `${k}: ${v}`).join("\n");
}
function yamlIn(text) {
  const m = /^---\n([\s\S]*?)\n?---/.exec(text);
  if (!m) return undefined;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = /^("?)([^":]+)\1:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[3].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
    else if (/^".*"$/.test(v)) v = JSON.parse(v);
    fm[kv[2]] = v;
  }
  return fm;
}
function makeApp(seed) {
  const byPath = new Map();
  const handlers = {};
  const on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); return { name, fn }; };
  const fire = (name, ...a) => (handlers[name] || []).forEach((fn) => fn(...a));
  const folder = (p) => { if (!p || byPath.has(p)) return; const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""; folder(parent); byPath.set(p, new TFolder(p)); };
  const put = (p, fm, body) => { folder(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""); const f = new TFile(p); f.fm = fm; f.body = body || ""; byPath.set(p, f); return f; };
  for (const [p, v] of Object.entries(seed || {})) put(p, v.fm, v.body);
  const app = {
    byPath, fire, writes: [], created: [],
    vault: {
      getAbstractFileByPath: (p) => byPath.get(p) || null,
      async createFolder(p) { if (byPath.has(p)) throw new Error("Folder already exists."); const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""; if (parent && !byPath.has(parent)) throw new Error("no parent " + parent); byPath.set(p, new TFolder(p)); },
      async create(p, text) {
        if (byPath.has(p)) throw new Error("File already exists.");
        const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        if (parent && !(byPath.get(parent) instanceof TFolder)) throw new Error("no folder " + parent);
        app.created.push({ path: p, text });
        return put(p, yamlIn(text), text.replace(/^---\n[\s\S]*?\n---\n?/, ""));
      },
      async read(f) { return (f.fm ? `---\n${yamlOut(f.fm)}\n---\n` : "") + f.body; },
      async cachedRead(f) { return this.read(f); },
      on,
    },
    metadataCache: { getFileCache: (f) => (f && f.fm !== undefined ? { frontmatter: f.fm } : null), on },
    fileManager: {
      async processFrontMatter(f, fn) { if (f.fm === undefined) f.fm = {}; fn(f.fm); app.writes.push({ path: f.path, fm: JSON.parse(JSON.stringify(f.fm)) }); fire("changed", f); },
      async renameFile(f, to) {
        if (byPath.has(to)) throw new Error("Destination file already exists!");
        const parent = to.slice(0, to.lastIndexOf("/"));
        if (parent && !byPath.has(parent)) throw new Error("no folder " + parent);
        const old = f.path; byPath.delete(old); f.path = to; f._name(); byPath.set(to, f); fire("rename", f, old);
      },
    },
    workspace: {
      leaves: [], active: null,
      getLeavesOfType(type) { return this.leaves.filter((l) => l.view && l.view.getViewType() === type); },
      getLeaf() { const ws = this; const leaf = { async openFile(f, o) { leaf.opened = f; leaf.openState = o; ws.active = f; } }; return leaf; },
      setActiveLeaf(l) { this.activeLeaf_ = l; },
      getActiveFile() { return this.active; },
      onLayoutReady(cb) { cb(); },
      on,
    },
  };
  return app;
}
function openNote(app, p, mode, source) {
  const leaf = {};
  leaf.view = new MarkdownView(leaf, app.byPath.get(p) || null, mode, source);
  app.workspace.leaves.push(leaf);
  return leaf.view;
}
async function newPlugin(seed, data) {
  const app = makeApp(seed);
  const p = new PostPicker(app, manifest);
  p._data = data === undefined ? null : JSON.parse(JSON.stringify(data));
  await p.onload();
  return { app, p };
}

// A neutral set-up, like a real one: a posts folder with two channels.
const SETUP = {
  root: "Writing/Posts",
  newFolder: "0 New",
  channels: [
    { name: "Garden", folder: "0 Garden", site: "garden.example", platforms: ["site", "bluesky", "x", "threads"] },
    { name: "Studio", folder: "1 Studio", site: "studio.example", platforms: ["site", "bluesky", "linkedin", "nonsense"] },
  ],
};
const R = "Writing/Posts";

(async () => {
  await test("settings", async () => {
    const d = core.mergeSettings(null);
    check("defaults", d.root === "Posts" && d.newFolder === "0 New" && d.channelProp === "channel" && d.platformsProp === "platforms" && d.showHeader === true && d.channels.length === 1 && d.channels[0].name === "Personal");
    const s = core.mergeSettings(SETUP);
    check("saved values are kept, missing ones get defaults", s.root === R && s.nameFormat === "YYYY-MM-DD HHmm [post]" && s.channels.length === 2);
    check("unknown platforms are dropped and the rest kept in one order", eq(s.channels[1].platforms, ["site", "bluesky", "linkedin"]), s.channels[1].platforms);
    check("an empty property name falls back", core.mergeSettings({ channelProp: "  ", platformsProp: "" }).channelProp === "channel");
    check("a channel with no name is dropped", core.mergeSettings({ channels: [{ name: "" }, { name: "A" }] }).channels.length === 1);
    check("a wrong type falls back", core.mergeSettings({ showHeader: "yes", channels: "x" }).showHeader === true && core.mergeSettings({ channels: "x" }).channels[0].name === "Personal");
    check("names of object methods are not platforms", eq(core.cleanChannel({ name: "A", platforms: ["constructor", "toString", "x"] }).platforms, ["x"]));
  });

  await test("reading a post", async () => {
    const s = core.mergeSettings(SETUP);
    const f = (p) => ({ path: p });
    const d = core.headerData(s, f(`${R}/0 Garden/0 New/a.md`), { channel: "Garden", platforms: ["x", "bluesky"] });
    check("channel and picked platforms, in order", d.channel === "Garden" && eq(d.picked, ["x", "bluesky"].sort((a, b) => core.PLATFORM_KEYS.indexOf(a) - core.PLATFORM_KEYS.indexOf(b))) && eq(d.extra, []), d);
    check("the channel from the folder when the note does not name one", core.headerData(s, f(`${R}/1 Studio/Drafts/b.md`), {}).channel === "Studio");
    check("the channel property wins over the folder", core.headerData(s, f(`${R}/1 Studio/b.md`), { Channel: "garden" }).channel === "Garden");
    check("platforms as a comma list", eq(core.headerData(s, f(`${R}/0 Garden/c.md`), { platforms: "X, threads" }).picked, ["x", "threads"]));
    check("a platform the channel lacks shows as extra", eq(core.headerData(s, f(`${R}/0 Garden/c.md`), { platforms: ["linkedin"] }).extra, ["linkedin"]));
    check("not a post outside the posts folder", core.headerData(s, f("Elsewhere/a.md"), { channel: "Garden" }) === null);
    check("not a post: a folder that only starts with the same name", core.headerData(s, f("Writing/Posts old/a.md"), {}) === null);
    check("not a post: a canvas", core.headerData(s, f(`${R}/0 Garden/a.canvas`), {}) === null);
    check("summary", core.summary({ channel: null, picked: [] }) === "Pick a channel first" && core.summary({ channel: "Garden", picked: [], available: ["x"] }) === "No platforms picked yet"
      && core.summary({ channel: "Garden", picked: ["x"], available: ["x"] }) === "Everywhere Garden posts (1)" && core.summary({ channel: "Garden", picked: ["site"], available: ["site", "x"], site: "garden.example" }) === "garden.example");
    const whole = core.mergeSettings({ ...SETUP, root: "" });
    check("with no posts folder, only notes in a channel folder or naming a channel are posts", core.headerData(whole, f("Diary/today.md"), { title: "x" }) === null
      && core.headerData(whole, f("0 Garden/a.md"), {}).channel === "Garden" && core.headerData(whole, f("Diary/a.md"), { channel: "Studio" }).channel === "Studio");
    const nested = core.mergeSettings({ root: "P", channels: [{ name: "Outer", folder: "Blog" }, { name: "Inner", folder: "Blog/Inner" }] });
    check("the deepest channel folder wins", core.channelByFolder(nested, "P/Blog/Inner/a.md").name === "Inner");
  });

  await test("writing lists", async () => {
    check("toggle on keeps the order", eq(core.nextList(["threads"], "x", true), ["x", "threads"]));
    check("toggle off", eq(core.nextList("x, threads", "x", false), ["threads"]));
    check("rubbish in the list is dropped", eq(core.nextList(["x", "nope", 3], "bluesky", true), ["x", "bluesky"]));
    const s = core.mergeSettings(SETUP);
    const [g, st] = s.channels;
    check("moved path keeps the status folder", core.movedPath(s, `${R}/0 Garden/2 Ready/a.md`, st) === `${R}/1 Studio/2 Ready/a.md`);
    check("no move to the same channel", core.movedPath(s, `${R}/0 Garden/a.md`, g) === null);
  });

  await test("new post", async () => {
    const { app, p } = await newPlugin({}, SETUP);
    check("a ribbon button and a new post command", p.ribbons.length === 1 && p.commands.some((c) => c.id === "new-post"));
    const file = await p.newPost();
    check("made in the first channel's new folder", file && file.path === `${R}/0 Garden/0 New/2026-11-13 1530 post.md`, file && file.path);
    const text = app.created[0] && app.created[0].text;
    check("with the channel and an empty platform list", text === "---\nchannel: Garden\nplatforms: []\n---\n\n", text);
    check("and opened", app.workspace.active === file);
    const again = await p.newPost();
    check("a second post the same minute gets a number", again.path === `${R}/0 Garden/0 New/2026-11-13 1530 post 2.md`, again.path);
    const two = await Promise.all([p.newPost(), p.newPost()]);
    check("two taps at once make one post", two[0] === two[1] && app.created.length === 3);
    p.settings.lastChannel = "Studio";
    check("the last channel used is the default", (await p.newPost()).path.startsWith(`${R}/1 Studio/0 New/`));
    const odd = await newPlugin({}, { ...SETUP, nameFormat: "HH:mm [post]", channels: [{ name: "Notes: daily", folder: "N" }] });
    const of = await odd.p.newPost();
    check("a name the file system cannot hold is cleaned", of && of.path === `${R}/N/0 New/15-30 post.md`, of && of.path);
    check("a channel name YAML would misread is quoted", odd.app.created[0] && /channel: "Notes: daily"/.test(odd.app.created[0].text) && of.fm.channel === "Notes: daily", odd.app.created[0] && odd.app.created[0].text);
    const none = await newPlugin({}, { ...SETUP, channels: [] });
    check("no channels: a notice, no note", (await none.p.newPost()) === null && none.app.created.length === 0 && /Add a channel/.test(notices[notices.length - 1]));
  });

  await test("set the channel", async () => {
    const { app, p } = await newPlugin({
      [`${R}/0 Garden/1 Drafts/Seeds.md`]: { fm: { channel: "Garden", platforms: ["site", "x", "bluesky"] }, body: "Hello" },
      [`${R}/1 Studio/1 Drafts/Taken.md`]: { fm: { channel: "Studio" } },
      [`${R}/0 Garden/1 Drafts/Taken.md`]: { fm: { channel: "Garden" } },
      [`${R}/Loose.md`]: { fm: {} },
    }, SETUP);
    const f = app.byPath.get(`${R}/0 Garden/1 Drafts/Seeds.md`);
    await p.setChannel(f, "Studio");
    check("moved to the other channel at the same status", f.path === `${R}/1 Studio/1 Drafts/Seeds.md` && app.byPath.get(f.path) === f, f.path);
    check("channel written, platforms it lacks dropped", f.fm.channel === "Studio" && eq(f.fm.platforms, ["site", "bluesky"]), f.fm);
    check("remembered as the last channel", p.settings.lastChannel === "Studio" && p._data.lastChannel === "Studio");
    const t = app.byPath.get(`${R}/0 Garden/1 Drafts/Taken.md`);
    await p.setChannel(t, "Studio");
    check("a name already there: it stays, with a notice", t.path === `${R}/0 Garden/1 Drafts/Taken.md` && /already in Studio/.test(notices[notices.length - 1]));
    const l = app.byPath.get(`${R}/Loose.md`);
    await p.setChannel(l, "Garden");
    check("a loose post in the posts folder moves into the channel's new folder", l.path === `${R}/0 Garden/0 New/Loose.md` && l.fm.channel === "Garden", l.path);
    await p.setChannel(l, "Nobody");
    check("an unknown channel changes nothing", l.fm.channel === "Garden");
  });

  await test("set platforms", async () => {
    const { app, p } = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { Channel: "Garden", Platforms: "x" } } }, SETUP);
    const f = app.byPath.get(`${R}/0 Garden/a.md`);
    await p.setPlatform(f, "bluesky", true);
    check("toggle on, into the property as the note spells it", eq(f.fm.Platforms, ["x", "bluesky"]) && !("platforms" in f.fm), f.fm);
    await p.setPlatform(f, "x", false);
    check("toggle off", eq(f.fm.Platforms, ["bluesky"]));
    await p.setAll(f, true);
    check("all: every platform the channel has", eq(f.fm.Platforms, ["site", "x", "threads", "bluesky"].filter(() => true).sort((a, b) => core.PLATFORM_KEYS.indexOf(a) - core.PLATFORM_KEYS.indexOf(b))), f.fm.Platforms);
    await p.setAll(f, false);
    check("none", eq(f.fm.Platforms, []));
  });

  await test("the bar in a note", async () => {
    const { app, p } = await newPlugin({
      [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["x"] } },
      [`${R}/0 Garden/b.md`]: { fm: { channel: "Garden", platforms: ["x"] } },
      ["Diary/today.md"]: { fm: { channel: "Garden" } },
    }, SETUP);
    const bars = (v) => v.containerEl.byClass(core.HEADER_CLS);
    const v = openNote(app, `${R}/0 Garden/a.md`, "source");
    app.fire("file-open", v.file);
    let h = bars(v)[0];
    check("one bar, right above the properties in Live Preview", bars(v).length === 1 && h.parentElement === v.lpSizer && h.nextElementSibling === v.lpMeta);
    check("a chip per channel, the note's one on", h.byClass("pp-chip").length === 2 && h.byAttr("data-channel", "Garden")[0].hasClass("is-on"));
    check("an icon per platform of the channel, x on", h.byClass("pp-icon").length === 4 && h.byAttr("data-platform", "x")[0].hasClass("is-on") && !h.byAttr("data-platform", "bluesky")[0].hasClass("is-on"));
    await h.byAttr("data-platform", "bluesky")[0].click();
    check("tapping an icon writes the list", eq(v.file.fm.platforms, ["x", "bluesky"]));
    h = bars(v)[0];
    check("and the bar is drawn again", bars(v).length === 1 && h.byAttr("data-platform", "bluesky")[0].hasClass("is-on"));
    await h.byAttr("data-all", "all")[0].click();
    check("All", v.file.fm.platforms.length === 4);
    await bars(v)[0].byAttr("data-channel", "Studio")[0].click();
    check("tapping a channel moves the note", v.file.path === `${R}/1 Studio/a.md` && v.file.fm.channel === "Studio");
    // The same view now shows another note whose bar would look the same: taps must go to the new note.
    const a = v.file;
    a.fm = { channel: "Garden", platforms: ["x"] };
    app.fire("changed", a);
    v.file = app.byPath.get(`${R}/0 Garden/b.md`);
    app.fire("file-open", v.file);
    await bars(v)[0].byAttr("data-platform", "threads")[0].click();
    check("after switching notes, a tap goes to the note shown", eq(v.file.fm.platforms, ["x", "threads"]) && eq(a.fm.platforms, ["x"]), [v.file.fm, a.fm]);
    v.mode = "preview"; app.fire("layout-change");
    h = bars(v)[0];
    check("Reading view: above the properties inside the header", bars(v).length === 1 && h.parentElement === v.rvHead && h.nextElementSibling === v.rvMeta);
    v.mode = "source"; v.source = true; app.fire("layout-change");
    check("plain source mode: no bar", bars(v).length === 0);
    v.source = false;
    const d = openNote(app, "Diary/today.md", "source");
    app.fire("file-open", d.file);
    check("no bar on a note outside the posts folder", bars(d).length === 0);
    p.settings.showHeader = false; await p.saveSettings();
    check("turned off: no bar", bars(v).length === 0);
    p.settings.showHeader = true; await p.saveSettings();
    check("turned on again", bars(v).length === 1);
    const n = openNote(app, `${R}/0 Garden/a.md`, "source");
    n.file = Object.assign(new TFile(`${R}/Loose.md`), { fm: { platforms: ["x"] } });
    app.byPath.set(n.file.path, n.file);
    app.fire("file-open", n.file);
    const lab = bars(n)[0].byAttr("data-platform", "x")[0].getAttr("aria-label");
    check("with no channel, a leftover platform says so plainly", !/null/.test(lab), lab);
    p.onunload();
    check("unload removes the bars", bars(v).length === 0);
  });

  /* ---------- publishing ---------- */
  // Made-up account details, only for these tests. None of them is real.
  const ACCOUNTS = {
    bluesky: { handle: "@garden.example", password: "test-app-pass", service: "https://pds.example" },
    mastodon: { instance: "social.example/", token: "test-token", visibility: "unlisted", limit: 60 },
    site: { kind: "ghost", url: "https://blog.example/", key: "0123456789abcdef01234567:" + "ab".repeat(32) },
  };
  const PUB = {
    ...SETUP,
    channels: [
      { ...SETUP.channels[0], platforms: ["site", "bluesky", "mastodon", "x"], accounts: ACCOUNTS },
      { ...SETUP.channels[1], platforms: ["site", "bluesky"], accounts: { site: { kind: "wordpress", url: "wp.example", user: "editor", password: "abcd EFGH 1234 ijkl" } } },
    ],
  };
  const lastModal = () => modals[modals.length - 1];
  const buttonIn = (m, which) => m.contentEl.byAttr("data-confirm", which)[0];

  await test("the text that is sent", async () => {
    const note = "---\nchannel: Garden\n---\nShared opening.\n\n## Bluesky\nShort one for **Bluesky**.\n\n## Mastodon\nLonger one.\n\n## Website\nThe blog.\n";
    check("a platform's own section", core.sectionText(note, ["bluesky"]) === "Short one for **Bluesky**.");
    check("without one: the note minus every platform section", core.sectionText(note, ["threads-nothing"]) === "Shared opening.");
    check("front matter is never sent", !/channel/.test(core.sectionText(note, ["x"])));
    check("plain text: links keep their address, marks and wikilinks go", core.plainText("# Hi\nSee [my site](https://a.example/x) and [[Notes/Idea|this idea]] or [[Plan#Step]]. **Bold** ==hi== %%secret%%![[pic.png]]")
      === "Hi\nSee my site (https://a.example/x) and this idea or Plan. Bold hi", core.plainText("# Hi\nSee [my site](https://a.example/x) and [[Notes/Idea|this idea]] or [[Plan#Step]]. **Bold** ==hi== %%secret%%![[pic.png]]"));
    check("a family emoji is one grapheme", core.graphemes("hi 👨‍👩‍👧") === 4);
    check("Mastodon counts a link as 23", core.mastodonLength("go https://example.com/a/very/long/path/that/goes/on.") === 3 + 23 + 1);
    const text = "Café: https://ex.example/a_(b). #tag2 and #123 not";
    const f = core.blueskyFacets(text);
    const enc = new TextEncoder();
    const cut = (x) => Buffer.from(enc.encode(text).slice(x.index.byteStart, x.index.byteEnd)).toString("utf8");
    check("Bluesky link facet by UTF-8 bytes, without the full stop", f[0].features[0].uri === "https://ex.example/a_(b)" && cut(f[0]) === "https://ex.example/a_(b)" && f[0].index.byteStart === 7, f[0]);
    check("Bluesky tag facet, not for a number", f.length === 2 && f[1].features[0].tag === "tag2" && cut(f[1]) === "#tag2", f);
    const html = core.markdownToHtml("## Hello <you>\n\nA [link](https://a.example/?q=1&r=2) and [bad](javascript:alert) and *it*.\nNext line `<b>`\n\n- one\n- **two**\n\n1. first\n\n> quote\n\n```\n<script>x</script>\n```\n\n![p](https://img.example/p.png)\n---");
    check("HTML: headings, links, escaping", /<h2>Hello &lt;you&gt;<\/h2>/.test(html) && /<a href="https:\/\/a.example\/\?q=1&amp;r=2">link<\/a>/.test(html) && /and bad and <em>it<\/em>\.<br>Next line <code>&lt;b&gt;<\/code>/.test(html), html);
    check("HTML: lists, quotes, code, images, rules", /<ul><li>one<\/li><li><strong>two<\/strong><\/li><\/ul>/.test(html) && /<ol><li>first<\/li><\/ol>/.test(html) && /<blockquote><p>quote<\/p><\/blockquote>/.test(html)
      && /<pre><code>&lt;script&gt;x&lt;\/script&gt;<\/code><\/pre>/.test(html) && /<img src="https:\/\/img.example\/p.png" alt="p">/.test(html) && /<hr>$/.test(html), html);
    check("no script or javascript: gets through", !/<script|javascript:/i.test(html));
    check("blog title from the first heading, taken out of the body", eq(core.blogParts({}, "# Big title\nThe blog.", "file"), { title: "Big title", html: "<p>The blog.</p>" }));
    check("blog title from the title property, else the file name", core.blogParts({ Title: "Prop" }, "# H\nx", "f").title === "Prop" && core.blogParts({}, "Just text", "File name").title === "File name");
    check("server addresses: https added, http refused", core.serverUrl("social.example/", "x") === "https://social.example" && core.serverUrl("http://localhost:2368", "x") === "http://localhost:2368" && (() => { try { core.serverUrl("http://blog.example", "x"); return false; } catch (e) { return /https/.test(e.message); } })());
    check("the same note and text give the same Mastodon key", core.hashKey("a\nb") === core.hashKey("a\nb") && core.hashKey("a") !== core.hashKey("b"));
  });

  await test("publish buttons on the bar", async () => {
    const s = core.mergeSettings(PUB);
    check("account details are kept and cleaned", s.channels[0].accounts.bluesky.handle === "garden.example" && s.channels[0].accounts.mastodon.limit === 60 && s.channels[1].accounts.site.kind === "wordpress" && s.channels[1].accounts.bluesky.service === "https://bsky.social");
    check("no details: nothing to publish to", eq(core.readyDestinations(core.mergeSettings(SETUP).channels[0]), []));
    check("ready places for a channel", eq(core.readyDestinations(s.channels[0]), ["bluesky", "mastodon", "ghost"]) && eq(core.readyDestinations(s.channels[1]), ["wordpress"]));
    const d = core.headerData(s, { path: `${R}/0 Garden/a.md` }, { channel: "Garden", platforms: ["bluesky", "x"], bluesky_url: "https://bsky.app/profile/x/post/1", bluesky_date: "2026-11-01T10:00" });
    check("only the picked ones show, with what was posted", eq(d.publish.map((p) => p.key), ["bluesky"]) && d.publish[0].url === "https://bsky.app/profile/x/post/1");
    check("no secret in the bar's data", !/test-app-pass|test-token|abab/.test(JSON.stringify(d)));
    const { app } = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["bluesky", "mastodon", "site"] }, body: "Hi" } }, PUB);
    const v = openNote(app, `${R}/0 Garden/a.md`, "source");
    app.fire("file-open", v.file);
    const h = v.containerEl.byClass(core.HEADER_CLS)[0];
    check("three publish buttons", h.byClass("pp-pub").map((b) => b.text).join(" | ") === "Post to Bluesky | Post to Mastodon | Send to Ghost as a draft");
    check("no secret anywhere in the page", !/test-app-pass|test-token|abab/.test(JSON.stringify(h.attrs) + h.textContent));
    check("nothing sent just by showing the bar", requests.length === 0);
  });

  await test("publish to Bluesky", async () => {
    requests.length = 0;
    respond = (o) => {
      if (o.url.endsWith("createSession")) return { status: 200, json: { accessJwt: "session-jwt", did: "did:plc:test123", handle: "garden.example" } };
      if (o.url.endsWith("createRecord")) return { status: 200, json: { uri: "at://did:plc:test123/app.bsky.feed.post/3kpost", cid: "c" } };
      return { status: 404, json: {} };
    };
    const body = "Café time. Read https://garden.example/p #slow\n\n## Mastodon\nNot for Bluesky.";
    const { app, p } = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["bluesky"] }, body } }, PUB);
    const v = openNote(app, `${R}/0 Garden/a.md`, "source");
    app.fire("file-open", v.file);
    await v.containerEl.byClass(core.HEADER_CLS)[0].byAttr("data-publish", "bluesky")[0].click();
    let m = lastModal();
    const shown = m.contentEl.byClass("pp-confirm-text")[0].text;
    check("the confirm box shows the exact text", shown === "Café time. Read https://garden.example/p #slow", shown);
    check("and where it goes", m.titleEl.text === "Post to Bluesky?" && /@garden\.example on pds\.example/.test(m.contentEl.byClass("pp-confirm-where")[0].text) && m.contentEl.byClass("pp-confirm-count")[0].text === "46 of 300 characters");
    check("nothing is sent before Post is pressed", requests.length === 0);
    await buttonIn(m, "no").click();
    check("Cancel sends nothing", requests.length === 0 && !m.isOpen);
    await p.confirmPublish(v.file, "bluesky");
    m = lastModal();
    await buttonIn(m, "yes").click();
    check("two requests: a session, then the post", requests.length === 2 && requests[0].url === "https://pds.example/xrpc/com.atproto.server.createSession" && requests[1].url === "https://pds.example/xrpc/com.atproto.repo.createRecord", requests.map((r) => r.url));
    check("the session sends the handle and app password", requests[0].method === "POST" && eq(JSON.parse(requests[0].body), { identifier: "garden.example", password: "test-app-pass" }) && requests[0].contentType === "application/json");
    const rec = JSON.parse(requests[1].body);
    check("the post: the session's token, the account, the collection", requests[1].headers.Authorization === "Bearer session-jwt" && rec.repo === "did:plc:test123" && rec.collection === "app.bsky.feed.post");
    check("the record: text, type, time and facets", rec.record.$type === "app.bsky.feed.post" && rec.record.text === shown && /^\d{4}-\d\d-\d\dT/.test(rec.record.createdAt)
      && rec.record.facets.length === 2 && rec.record.facets[0].features[0].uri === "https://garden.example/p" && rec.record.facets[0].index.byteStart === 17 && rec.record.facets[1].features[0].tag === "slow", rec.record);
    check("the post's address and date written into the note", v.file.fm.bluesky_url === "https://bsky.app/profile/garden.example/post/3kpost" && v.file.fm.bluesky_date === "2026-11-13T15:30", v.file.fm);
    const h = v.containerEl.byClass(core.HEADER_CLS)[0];
    check("the bar then shows it was posted", h.byAttr("data-posted", "bluesky")[0].attrs.href === v.file.fm.bluesky_url && h.byAttr("data-publish", "bluesky")[0].text === "Post to Bluesky again");
    await p.confirmPublish(v.file, "bluesky");
    check("pressing again warns it is already there", /already on Bluesky/.test(lastModal().contentEl.textContent));
    lastModal().close();

    v.file.body = "x".repeat(301);
    await p.confirmPublish(v.file, "bluesky");
    m = lastModal();
    check("too long: said plainly, and no Post button", /Too long: 301 of 300/.test(m.contentEl.textContent) && !buttonIn(m, "yes") && m.contentEl.byClass("pp-confirm-count")[0].hasClass("is-over"));
    m.close();
  });

  await test("publish to Mastodon", async () => {
    requests.length = 0;
    respond = () => ({ status: 200, json: { id: "1", url: "https://social.example/@garden/1", created_at: "2026-11-13T15:30:00Z" } });
    const { app, p } = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["mastodon"] }, body: "Main text.\n\n## Mastodon\nToot with https://garden.example/a-really-long-address-here" } }, PUB);
    const f = app.byPath.get(`${R}/0 Garden/a.md`);
    const m = await p.confirmPublish(f, "mastodon");
    check("its own section, counted the Mastodon way", m.p.text === "Toot with https://garden.example/a-really-long-address-here" && m.p.length === 10 + 23 && /social\.example, visible: unlisted/.test(m.p.where));
    await Promise.all([buttonIn(m, "yes").click(), p.publish(f, m.p)]);
    check("pressed twice at once: sent once", requests.length === 1);
    const r = requests[0];
    check("the request", r.url === "https://social.example/api/v1/statuses" && r.method === "POST" && r.headers.Authorization === "Bearer test-token" && /^pp-[0-9a-f]+$/.test(r.headers["Idempotency-Key"])
      && eq(JSON.parse(r.body), { status: m.p.text, visibility: "unlisted" }), r);
    check("the address written into the note", f.fm.mastodon_url === "https://social.example/@garden/1" && f.fm.mastodon_date === "2026-11-13T15:30");

    requests.length = 0;
    respond = () => ({ status: 401, json: { error: "The access token is invalid" } });
    const before = JSON.stringify(f.fm);
    await p.publish(f, m.p);
    check("a refusal is shown and the note is left alone", /Not published: Mastodon said no \(401\): The access token is invalid/.test(notices[notices.length - 1]) && JSON.stringify(f.fm) === before, notices[notices.length - 1]);
    respond = () => { throw new Error("offline"); };
    await p.publish(f, m.p);
    check("no connection is shown too", /could not be reached: offline/.test(notices[notices.length - 1]));
  });

  await test("send to Ghost", async () => {
    requests.length = 0;
    respond = () => ({ status: 201, json: { posts: [{ id: "abc", url: "https://blog.example/p/1234/", status: "draft" }] } });
    const { app, p } = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["site"] }, body: "# Slow gardens\nThey **grow**.\n\n## Bluesky\nskip me" } }, PUB);
    const f = app.byPath.get(`${R}/0 Garden/a.md`);
    const m = await p.confirmPublish(f, "ghost");
    check("the box shows the title, the HTML and that it is a draft", /Title: Slow gardens/.test(m.contentEl.textContent) && m.contentEl.byClass("pp-confirm-text")[0].text === "<p>They <strong>grow</strong>.</p>" && /blog\.example as a draft/.test(m.p.where) && buttonIn(m, "yes").text === "Send draft");
    const t0 = Date.now();
    await buttonIn(m, "yes").click();
    const r = requests[0];
    check("the request", requests.length === 1 && r.url === "https://blog.example/ghost/api/admin/posts/?source=html" && r.headers["Accept-Version"] === "v5.0" && /^Ghost [\w-]+\.[\w-]+\.[\w-]+$/.test(r.headers.Authorization), r);
    check("the body: a draft from HTML", eq(JSON.parse(r.body), { posts: [{ title: "Slow gardens", html: "<p>They <strong>grow</strong>.</p>", status: "draft" }] }));
    const [h64, p64, sig] = r.headers.Authorization.slice(6).split(".");
    const head = JSON.parse(Buffer.from(h64, "base64url").toString());
    const claims = JSON.parse(Buffer.from(p64, "base64url").toString());
    check("JWT header: HS256 with the key id", eq(head, { alg: "HS256", typ: "JWT", kid: "0123456789abcdef01234567" }), head);
    check("JWT claims: admin audience, five minutes", claims.aud === "/admin/" && claims.exp - claims.iat === 300 && Math.abs(claims.iat - Math.floor(t0 / 1000)) < 5, claims);
    const want = nodeCrypto.createHmac("sha256", Buffer.from("ab".repeat(32), "hex")).update(`${h64}.${p64}`).digest("base64url");
    check("JWT signed with the secret's bytes", sig === want);
    check("the draft's address written into the note", f.fm.ghost_url === "https://blog.example/p/1234/" && f.fm.ghost_date === "2026-11-13T15:30");
    let err = "";
    try { await core.ghostToken("not-a-key", Date.now()); } catch (e) { err = e.message; }
    check("a key that is not id:secret is refused before sending", /id:secret/.test(err));
  });

  await test("send to WordPress", async () => {
    requests.length = 0;
    respond = () => ({ status: 201, json: { id: 42, link: "https://wp.example/?p=42", status: "draft" } });
    const { app, p } = await newPlugin({ [`${R}/1 Studio/a.md`]: { fm: { channel: "Studio", platforms: ["site"], title: "Studio notes" }, body: "Hello <there>" } }, PUB);
    const f = app.byPath.get(`${R}/1 Studio/a.md`);
    const m = await p.confirmPublish(f, "wordpress");
    await buttonIn(m, "yes").click();
    const r = requests[0];
    check("the request, with the application password (spaces taken out)", r && r.url === "https://wp.example/wp-json/wp/v2/posts" && Buffer.from(r.headers.Authorization.replace(/^Basic /, ""), "base64").toString() === "editor:abcdEFGH1234ijkl", r);
    check("the body: a draft", eq(JSON.parse(r.body), { title: "Studio notes", content: "<p>Hello &lt;there&gt;</p>", status: "draft" }));
    check("the address written into the note", f.fm.wordpress_url === "https://wp.example/?p=42");
  });

  await test("publish: refused before sending", async () => {
    requests.length = 0;
    const plainHttp = { ...PUB, channels: [{ ...PUB.channels[0], accounts: { ...ACCOUNTS, mastodon: { instance: "http://social.example", token: "t" } } }] };
    const { app, p } = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["mastodon"] }, body: "Hi" }, [`${R}/0 Garden/b.md`]: { fm: { channel: "Garden" }, body: "" } }, plainHttp);
    const f = app.byPath.get(`${R}/0 Garden/a.md`);
    check("plain http: no box, a notice, nothing sent", (await p.confirmPublish(f, "mastodon")) === null && /https/.test(notices[notices.length - 1]) && requests.length === 0);
    const none = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["bluesky"] }, body: "Hi" } }, SETUP);
    check("no account details: a notice", (await none.p.confirmPublish(none.app.byPath.get(`${R}/0 Garden/a.md`), "bluesky")) === null && /details/.test(notices[notices.length - 1]));
    const empty = await newPlugin({ [`${R}/0 Garden/a.md`]: { fm: { channel: "Garden", platforms: ["bluesky"] }, body: "  " } }, PUB);
    const m = await empty.p.confirmPublish(empty.app.byPath.get(`${R}/0 Garden/a.md`), "bluesky");
    check("an empty post has no Post button", m && !buttonIn(m, "yes") && /empty/.test(m.contentEl.textContent));
    m.close();
    const cmd = empty.p.commands.find((c) => c.id === "publish");
    empty.app.workspace.active = empty.app.byPath.get(`${R}/0 Garden/a.md`);
    check("the publish command shows on a post with somewhere to go", cmd.checkCallback(true) === true);
    cmd.checkCallback(false);
    check("and opens a chooser, not a send", lastModal().contentEl.byAttr("data-publish", "bluesky").length === 1 && requests.length === 0);
    empty.app.workspace.active = null;
    check("not on other notes", cmd.checkCallback(true) === false);
  });

  await test("settings tab", async () => {
    const { p } = await newPlugin({}, PUB);
    const tab = p.tabs[0];
    settingsMade.length = 0;
    tab.display();
    const first = tab.containerEl.children[0];
    check("no heading at the very top", first && !settingsMade.some((x) => x.el === first && x.heading));
    const secret = settingsMade.filter((x) => /password|token|API key/i.test(x.name));
    check("passwords, tokens and keys are hidden as you type", secret.length >= 3 && secret.every((x) => x.comps[0].inputEl.type === "password"), secret.map((x) => x.name));
    check("it says where the details are kept", /data\.json/.test(tab.containerEl.textContent) && /app passwords/i.test(tab.containerEl.textContent));
    const names = settingsMade.map((x) => x.name);
    check("the right fields per channel", names.includes("Bluesky handle") && names.includes("Mastodon access token") && names.includes("Ghost Admin API key") && names.includes("WordPress application password"));
    const handle = settingsMade.find((x) => x.name === "Bluesky handle");
    await handle.comps[0].change(" new.example ");
    check("a change is saved", p._data.channels[0].accounts.bluesky.handle === "new.example");
  });

  await test("release files", async () => {
    check("manifest", manifest.id === "post-picker" && manifest.isDesktopOnly === false);
    const code = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
    const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
    check("no Node modules, so it runs on phones", !/require\(["'](fs|path|child_process|os|electron|crypto)["']\)/.test(code));
    check("nothing personal in the code or styles", !PRIVATE_RE.test(code + css));
    check("no innerHTML, fetch, console.log, lookbehind or activeLeaf", !/innerHTML|outerHTML|insertAdjacentHTML|\bfetch\(|console\.log|\(\?<[=!]|workspace\.activeLeaf/.test(code));
    check("timers through a window", !/[^.\w]setTimeout\(|[^.\w]clearTimeout\(/.test(code));
    check("the network only through requestUrl", !/XMLHttpRequest|navigator\.sendBeacon|new WebSocket/.test(code));
    check("description starts with a verb, ends with a full stop, 10-250 characters, no app or plugin words",
      /^(Start|Pick|Write|Plan)\b/.test(manifest.description) && manifest.description.endsWith(".") && manifest.description.length >= 10 && manifest.description.length <= 250 && !/obsidian|plugin/i.test(manifest.description), manifest.description);
    const versions = JSON.parse(fs.readFileSync(path.join(ROOT, "versions.json"), "utf8"));
    check("version 1.0.0 in the manifest and versions.json", manifest.version === "1.0.0" && eq(versions, { "1.0.0": manifest.minAppVersion }));
    const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    check(".gitignore keeps settings and secrets out", ["data.json", "jake-settings.json", "node_modules/", "*.log"].every((x) => ignore.split(/\r?\n/).includes(x)));
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    const order = ["## Features", "## How to use", "## Importing", "## Settings", "## Note format", "## Network use", "## Privacy", "## Mobile support", "## Tests", "## Licence"];
    check("README has its sections in order", order.every((h, i) => readme.indexOf(h) > (i ? readme.indexOf(order[i - 1]) : 0)), order.filter((h) => readme.indexOf(h) < 0));
    check("README names every host it contacts", ["bsky.social", "/xrpc/com.atproto.server.createSession", "/api/v1/statuses", "/ghost/api/admin/posts/", "/wp-json/wp/v2/posts"].every((h) => readme.includes(h)));
    check("README says plainly where credentials live", /data\.json/.test(readme) && /app password/i.test(readme));
    check("nothing personal in the README", !PRIVATE_RE.test(readme));
  });

  // The owner's own settings, when this copy has them (never in a public clone).
  const own = path.join(ROOT, "jake-settings.json");
  if (fs.existsSync(own)) {
    await test("owner's settings still load", async () => {
      const s = core.mergeSettings(JSON.parse(fs.readFileSync(own, "utf8")));
      check("owner's settings: folder, channels and their platforms", !!s.root && s.channels.length >= 1 && s.channels.every((c) => c.name && c.folder && c.platforms.length > 0 && c.accounts));
      check("owner's settings: a post in a channel folder gets the bar", !!core.headerData(s, { path: `${s.root}/${s.channels[0].folder}/0 New/x.md` }, {}));
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
