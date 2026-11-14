/* Post Picker: start a post, and choose at the top of it which channel it is for and which platforms it
   goes to. One button makes a new post note in the channel's "new" folder. Every post note gets a bar at
   the top: the channels as one row, and the platforms that channel has as icons to tap on and off. The
   choices are kept in the note's properties (channel, platforms), so anything that posts can read them.
   Picking another channel moves the note to that channel's folder, at the same status, and drops the
   platforms that channel does not have.
   Optional sending through Zernio (zernio.com): with a Zernio API key in the device's keychain, a post goes to the
   social accounts connected there, as a draft, scheduled, or at once. Only when the user presses the button and
   confirms the exact text; never on its own. The Zernio post and its status are written back into the note.
   No Node APIs, so it runs on phones and tablets too. */
"use strict";
const { Plugin, PluginSettingTab, Setting, Notice, Modal, TFile, MarkdownView, normalizePath, requestUrl, SecretComponent } = require("obsidian");

const HEADER_CLS = "pp-post-header";

/* ---------- platforms ---------- */
// Brand marks from Simple Icons (CC0), 24x24, filled with the text colour.
const ICONS = {
  "facebook": "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  "instagram": "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  "tiktok": "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  "youtube": "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  "x": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  "threads": "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z",
  "bluesky": "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z",
  "pinterest": "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z",
  "linkedin": "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  "reddit": "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"
};
const PLATFORMS = {
  site: { name: "Website blog" },
  x: { name: "X" },
  threads: { name: "Threads" },
  bluesky: { name: "Bluesky" },
  linkedin: { name: "LinkedIn" },
  facebook: { name: "Facebook" },
  instagram: { name: "Instagram" },
  tiktok: { name: "TikTok" },
  youtube: { name: "YouTube" },
  pinterest: { name: "Pinterest" },
  reddit: { name: "Reddit" },
};
const PLATFORM_KEYS = Object.keys(PLATFORMS);
// Own keys only, so a note saying "constructor" or "toString" is not taken for a platform.
const isPlatform = (k) => Object.prototype.hasOwnProperty.call(PLATFORMS, k);
// A globe for the channel's own website, drawn in the same 24x24 frame.
const SITE_ICON = "M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm7.9 7h-3.3a18.6 18.6 0 0 0-1.6-4.6A9.6 9.6 0 0 1 19.9 7zM12 2.4c.9 1.3 1.7 2.8 2.1 4.6H9.9c.4-1.8 1.2-3.3 2.1-4.6zM2.6 14a9.8 9.8 0 0 1 0-4h3.6a20 20 0 0 0 0 4H2.6zm1.5 3h3.3c.4 1.6.9 3.2 1.6 4.6A9.6 9.6 0 0 1 4.1 17zm3.3-10H4.1A9.6 9.6 0 0 1 9 2.4C8.3 3.8 7.8 5.4 7.4 7zM12 21.6c-.9-1.3-1.7-2.8-2.1-4.6h4.2c-.4 1.8-1.2 3.3-2.1 4.6zm2.5-7.6h-5a17.6 17.6 0 0 1 0-4h5a17.6 17.6 0 0 1 0 4zm.5 7.6c.7-1.4 1.2-3 1.6-4.6h3.3a9.6 9.6 0 0 1-4.9 4.6zm2.8-7.6a20 20 0 0 0 0-4h3.6a9.8 9.8 0 0 1 0 4h-3.6z";
const iconPath = (key) => (key === "site" ? SITE_ICON : ICONS[key] || "");

/* ---------- settings ---------- */
const DEFAULT_SETTINGS = {
  root: "Posts",
  newFolder: "0 New",
  nameFormat: "YYYY-MM-DD HHmm [post]",
  channelProp: "channel",
  platformsProp: "platforms",
  showHeader: true,
  lastChannel: "",
  channels: [
    { name: "Personal", folder: "Personal", site: "", platforms: ["site", "x", "threads", "bluesky", "linkedin"], zernioProfile: "" },
  ],
  // keyName: the name of the keychain entry holding the Zernio API key (never the key). profiles: [{ id, name }].
  zernio: { keyName: "", profiles: [] },
};

const str = (v, fallback) => (typeof v === "string" ? v : fallback);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const cleanFolder = (f) => {
  const p = normalizePath(String(f || "").trim());
  return p === "/" || p === "." ? "" : p.replace(/^\/+|\/+$/g, "");
};
const join = (...parts) => parts.map(cleanFolder).filter(Boolean).join("/");

function cleanChannel(c) {
  c = c || {};
  const platforms = (Array.isArray(c.platforms) ? c.platforms : []).map((p) => String(p).toLowerCase().trim()).filter(isPlatform);
  return {
    name: str(c.name, "").trim(),
    folder: str(c.folder, "").trim(),
    site: str(c.site, "").trim(),
    platforms: PLATFORM_KEYS.filter((k) => platforms.includes(k)), // always in the one order
    zernioProfile: str(c.zernioProfile, "").trim(),
  };
}
function cleanZernio(z) {
  z = obj(z);
  const profiles = (Array.isArray(z.profiles) ? z.profiles : [])
    .map((p) => ({ id: str(obj(p).id, "").trim(), name: str(obj(p).name, "").trim() }))
    .filter((p) => p.id);
  return { keyName: str(z.keyName, "").trim(), profiles };
}
function mergeSettings(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const pick = (k) => (typeof s[k] === "string" && s[k].trim() ? s[k].trim() : DEFAULT_SETTINGS[k]);
  return {
    root: typeof s.root === "string" ? s.root.trim() : DEFAULT_SETTINGS.root,
    newFolder: typeof s.newFolder === "string" ? s.newFolder.trim() : DEFAULT_SETTINGS.newFolder,
    nameFormat: pick("nameFormat"),
    channelProp: pick("channelProp"),
    platformsProp: pick("platformsProp"),
    showHeader: typeof s.showHeader === "boolean" ? s.showHeader : DEFAULT_SETTINGS.showHeader,
    lastChannel: str(s.lastChannel, ""),
    channels: (Array.isArray(s.channels) ? s.channels : DEFAULT_SETTINGS.channels).map(cleanChannel).filter((c) => c.name),
    zernio: cleanZernio(s.zernio),
  };
}

/* ---------- reading a post ---------- */
const lower = (v) => String(v == null ? "" : v).trim().toLowerCase();
// A property's key in the note, whatever case it was written in.
function propKey(fm, name) {
  const want = lower(name);
  return Object.keys(fm || {}).find((k) => lower(k) === want) || name;
}
function asList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",");
  return [];
}
const rootOf = (s) => cleanFolder(s.root);
// The channel whose folder the note sits in, if any. The deepest folder wins, so channels can nest.
function channelByFolder(s, path) {
  const r = rootOf(s);
  let best = null, depth = -1;
  for (const c of s.channels) {
    const base = join(r, c.folder);
    if (base && path.startsWith(base + "/") && base.length > depth) { best = c; depth = base.length; }
  }
  return best;
}
function channelByName(s, name) {
  const want = lower(name);
  return want ? s.channels.find((c) => lower(c.name) === want) || null : null;
}
// A post is a note under the posts folder. With no posts folder set, every note in the vault would get the bar,
// so then only notes in a channel's folder, or naming a channel, count.
function isPost(s, path, fm) {
  if (!path || !/\.md$/i.test(path)) return false;
  const r = rootOf(s);
  if (r) return path.startsWith(r + "/");
  return !!(channelByFolder(s, path) || channelByName(s, (fm || {})[propKey(fm, s.channelProp)]));
}

/* ---------- publishing through Zernio ----------
   Zernio (zernio.com) holds the user's connected social accounts. The plugin keeps one Zernio API key; each
   channel names its Zernio profile, and a post goes to that profile's account on each platform picked in the
   note. Nothing is sent until the user presses the button and confirms the exact text. */
const ZERNIO = "https://zernio.com/api/v1";
// The plugin's platform keys as Zernio names them. The website toggle has no social account behind it.
const ZERNIO_PLATFORM = { x: "twitter", threads: "threads", bluesky: "bluesky", linkedin: "linkedin", facebook: "facebook", instagram: "instagram", tiktok: "tiktok", youtube: "youtube", pinterest: "pinterest", reddit: "reddit" };
// The longest text each platform takes. Longer text is refused here, before anything is sent.
const LIMITS = { x: 280, bluesky: 300, threads: 500, linkedin: 3000, pinterest: 500, instagram: 2200, tiktok: 2200, facebook: 63206, youtube: 5000, reddit: 40000 };
const SEND_MODES = ["draft", "schedule", "now"];
// The platforms picked in a note that can go out through Zernio for this channel.
// The key itself is never in the settings: only the name of the keychain entry that holds it.
function zernioReady(s, c) { return !!(c && s.zernio.keyName && c.zernioProfile); }
function sendable(s, c, picked) { return zernioReady(s, c) ? PLATFORM_KEYS.filter((k) => picked.includes(k) && ZERNIO_PLATFORM[k]) : []; }

// What the bar shows for a note, or null when the note is not a post. Never holds a credential: it is
// written into the page as the bar's signature.
function headerData(s, file, fm) {
  fm = fm || {};
  if (!file || !isPost(s, file.path, fm)) return null;
  const named = channelByName(s, fm[propKey(fm, s.channelProp)]);
  const channel = named || channelByFolder(s, file.path);
  const picked = asList(fm[propKey(fm, s.platformsProp)]).map(lower).filter(isPlatform);
  const available = channel ? channel.platforms : [];
  const send = sendable(s, channel, picked);
  const publish = send.length ? {
    platforms: send,
    id: str(fm[propKey(fm, "zernio_id")], ""),
    status: str(fm[propKey(fm, "zernio_status")], ""),
    date: String(fm[propKey(fm, "zernio_date")] || ""),
  } : null;
  return {
    path: file.path, // so a bar drawn for one note is never reused for another that looks the same
    channels: s.channels.map((c) => c.name),
    channel: channel ? channel.name : null,
    site: channel ? channel.site : "",
    available,
    picked: PLATFORM_KEYS.filter((k) => picked.includes(k)),
    // A platform set in the note that this channel does not have: shown, so nothing is hidden.
    extra: PLATFORM_KEYS.filter((k) => picked.includes(k) && !available.includes(k)),
    publish,
  };
}
function platformLabel(key, site) {
  return key === "site" && site ? site : isPlatform(key) ? PLATFORMS[key].name : key;
}
function summary(d) {
  if (!d.channel) return "Pick a channel first";
  const n = d.picked.length;
  if (!n) return "No platforms picked yet";
  if (d.available.length && d.available.every((k) => d.picked.includes(k))) return `Everywhere ${d.channel} posts (${n})`;
  return d.picked.map((k) => platformLabel(k, d.site)).join(", ");
}

/* ---------- writing a post ---------- */
function nextList(current, key, on) {
  const set = new Set(asList(current).map(lower).filter(isPlatform));
  if (on) set.add(key); else set.delete(key);
  return PLATFORM_KEYS.filter((k) => set.has(k));
}

async function ensureFolder(app, folder) {
  folder = cleanFolder(folder);
  if (!folder) return;
  let path = "";
  for (const part of folder.split("/")) {
    path = path ? path + "/" + part : part;
    if (!app.vault.getAbstractFileByPath(path)) {
      try { await app.vault.createFolder(path); } catch (e) { if (!app.vault.getAbstractFileByPath(path)) throw e; }
    }
  }
}

// A date pattern such as "HH:mm" would make a name no file system takes; those characters become "-".
const safeName = (n) => String(n || "").replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim() || "post";
// A value written as-is when YAML reads it back the same, quoted otherwise ("a: b", "#tag", "yes", "12").
function yamlValue(v) {
  v = String(v);
  return /^[A-Za-z_][\w .-]*$/.test(v) && !/^(true|false|yes|no|on|off|null|~)$/i.test(v) && v === v.trim() ? v : JSON.stringify(v);
}

// A name not used yet in the folder: "name", then "name 2", "name 3"...
function freeName(app, folder, base) {
  for (let i = 1; i < 1000; i++) {
    const name = i === 1 ? base : `${base} ${i}`;
    if (!app.vault.getAbstractFileByPath(normalizePath(join(folder, name + ".md")))) return name;
  }
  return `${base} ${Date.now()}`;
}

// Where the note goes for another channel: its folder at the same status. A loose post right in the posts
// folder goes into the channel's new-posts folder. null when it stays where it is.
function movedPath(s, path, to) {
  if (!to) return null;
  const from = channelByFolder(s, path);
  if (from === to) return null;
  let target;
  if (from) target = join(rootOf(s), to.folder, path.slice(join(rootOf(s), from.folder).length + 1));
  else if (rootOf(s) && path.startsWith(rootOf(s) + "/")) target = join(rootOf(s), to.folder, s.newFolder, path.split("/").pop());
  else return null;
  target = normalizePath(target);
  return target === path ? null : target;
}

/* ---------- the text that is sent ---------- */
const stripFrontmatter = (t) => String(t || "").replace(/^﻿?---\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/, "");
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
// Headings that hold one place's own version of the post ("## LinkedIn", "## X", "## Website").
const sectionsFor = (k) => [lower(PLATFORMS[k].name), k, ZERNIO_PLATFORM[k] || ""].concat(k === "site" ? ["website", "blog"] : []).filter(Boolean);
const SECTION_NAMES = new Set(PLATFORM_KEYS.flatMap(sectionsFor));

/* The part of the note a destination gets. A heading named after it ("## Bluesky", "## Website") holds its own
   version. Otherwise it gets the note without any such sections, so a LinkedIn version never reaches X. */
function sectionText(body, sections) {
  const lines = stripFrontmatter(body).replace(/\r\n?/g, "\n").split("\n");
  const own = [], rest = [];
  let into = null; // { level, mine } while inside a platform section
  let fence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = !fence && HEADING.exec(line);
    if (h) {
      const level = h[1].length, name = lower(h[2]);
      if (into && level <= into.level) into = null;
      if (!into && SECTION_NAMES.has(name)) { into = { level, mine: sections.includes(name) }; continue; }
    }
    if (into) { if (into.mine) own.push(line); } else rest.push(line);
  }
  return (own.join("\n").trim() ? own : rest).join("\n").trim();
}

// Markdown to the plain text a social post shows: links keep their address, marks go.
function plainText(md) {
  let t = String(md || "").replace(/%%[\s\S]*?%%/g, "");
  t = t.replace(/!\[\[[^\]]*\]\]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, (m, target) => target.split("#")[0].split("/").pop());
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => (text === url ? url : `${text} (${url})`));
  t = t.split("\n").map((l) => l.replace(/^#{1,6}[ \t]+/, "").replace(/[ \t]+$/, "")).join("\n");
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1").replace(/==([^=\n]+)==/g, "$1").replace(/~~([^~\n]+)~~/g, "$1");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
// Characters as a person counts them: an emoji made of several code points is one.
function graphemes(t) { return segmenter ? Array.from(segmenter.segment(t)).length : Array.from(t).length; }

/* ---------- Zernio: the requests ----------
   Every request goes through the app's requestUrl. `req` is passed in so tests can stand in for the network. */
const utf8 = (s) => new TextEncoder().encode(s);
async function zernio(req, key, o, what) {
  if (!key) throw new Error("Choose your Zernio API key in settings first.");
  let res;
  try {
    res = await req(Object.assign({ throw: false, method: "GET", headers: {} }, o, {
      url: ZERNIO + o.path,
      headers: Object.assign({ Authorization: `Bearer ${key}` }, o.body ? { "Content-Type": "application/json" } : {}, o.headers || {}),
    }));
  } catch (e) { throw new Error(`Zernio could not be reached: ${e.message}`); }
  let json = null;
  try { json = res.json; } catch (e) { json = null; } // an error page that is not JSON
  if (!res || res.status < 200 || res.status >= 300) {
    const j = obj(json);
    const why = j.error || j.message || "";
    const status = res ? res.status : "no answer";
    if (status === 401 || status === 403) throw new Error(`Zernio refused the API key (${status}). Check it in settings.`);
    throw new Error(`Zernio said no to ${what} (${status})${why ? ": " + why : ""}`);
  }
  return obj(json);
}
const idOf = (x) => String((x && (x._id || x.id)) || "");
// The profiles under the key: [{ id, name }]. Used to fill the channel's profile list in settings.
async function zernioProfiles(req, key) {
  const j = await zernio(req, key, { path: "/profiles?limit=1000" }, "listing profiles");
  const list = Array.isArray(j.profiles) ? j.profiles : Array.isArray(j.data) ? j.data : [];
  return list.map((p) => ({ id: idOf(p), name: str(p.name, "").trim() || idOf(p) })).filter((p) => p.id);
}
// The accounts of one profile: [{ id, platform, name }].
async function zernioAccounts(req, key, profileId) {
  const j = await zernio(req, key, { path: `/accounts?profileId=${encodeURIComponent(profileId)}&limit=500` }, "listing accounts");
  const list = Array.isArray(j.accounts) ? j.accounts : Array.isArray(j.data) ? j.data : [];
  return list
    .filter((a) => a && a.isActive !== false && (!a.profileId || idOf(a.profileId) === profileId || a.profileId === profileId))
    .map((a) => ({ id: idOf(a), platform: lower(a.platform), name: str(a.username, "") || str(a.displayName, "") }))
    .filter((a) => a.id && a.platform);
}

// A steady key for the same note, text and choice, in the form of a UUID: Zernio treats a repeat within a day as
// the same post, so pressing twice, or a retry after a lost answer, never makes two.
function stableId(s) {
  const h = (seed) => { let x = seed; for (const ch of utf8(s)) { x ^= ch; x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16).padStart(8, "0"); };
  const hex = h(0x811c9dc5) + h(0x01000193) + h(0x9e3779b9) + h(0x7f4a7c15);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/* Everything the confirm box shows and the request sends, worked out from the note before anything is sent.
   Each platform gets the note's text, or its own section ("## LinkedIn"). Platforms with the same text go as one
   Zernio post. */
function preparePost(s, file, fm, raw) {
  fm = fm || {};
  const channel = channelByName(s, fm[propKey(fm, s.channelProp)]) || channelByFolder(s, file.path);
  if (!channel) throw new Error("Pick a channel for this post first.");
  if (!s.zernio.keyName) throw new Error("Choose your Zernio API key from the keychain in the Post Picker settings first.");
  if (!channel.zernioProfile) throw new Error(`Choose the Zernio profile for ${channel.name} in settings first.`);
  const picked = asList(fm[propKey(fm, s.platformsProp)]).map(lower).filter(isPlatform);
  const platforms = sendable(s, channel, picked);
  if (!platforms.length) throw new Error("Pick at least one social platform in the bar first. The website toggle is not sent.");
  const groups = [];
  for (const k of platforms) {
    const text = plainText(sectionText(raw, sectionsFor(k)));
    const g = groups.find((x) => x.text === text);
    if (g) g.platforms.push(k); else groups.push({ text, platforms: [k] });
  }
  const problems = [];
  for (const g of groups) {
    g.length = graphemes(g.text);
    g.limit = Math.min(...g.platforms.map((k) => LIMITS[k] || Infinity));
    if (!g.text) problems.push("The post is empty.");
    else if (g.length > g.limit) {
      const tight = g.platforms.filter((k) => (LIMITS[k] || Infinity) < g.length).map((k) => PLATFORMS[k].name);
      problems.push(`Too long for ${tight.join(", ")}: ${g.length} of ${g.limit} characters. Shorten it, or give it its own section such as “## ${tight[0]}”.`);
    }
  }
  const profile = (s.zernio.profiles.find((p) => p.id === channel.zernioProfile) || {}).name || channel.zernioProfile;
  return {
    path: file.path, channel: channel.name, profileId: channel.zernioProfile, profile, groups,
    sent: { id: str(fm[propKey(fm, "zernio_id")], ""), status: str(fm[propKey(fm, "zernio_status")], "") },
    problem: problems.join(" "),
  };
}

// "YYYY-MM-DDTHH:mm" from a date-and-time box, as Zernio's local time. Empty when it is not a real future time.
function scheduleTime(value, nowMs) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || "").trim());
  if (!m) return "";
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  return Number.isFinite(t) && t > nowMs ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00` : "";
}

/* Sends what the confirm box showed. mode: "draft" (saved in Zernio, nothing goes out), "schedule" (at `when`,
   this device's time zone) or "now". Returns [{ id, status, urls: { platformKey: url } }], one per Zernio post. */
async function sendToZernio(req, key, prep, mode, when, timeZone) {
  if (!key) throw new Error("The Zernio API key is not in this device's keychain. Add it in settings, under Keychain.");
  if (!SEND_MODES.includes(mode)) throw new Error("Choose draft, schedule or publish now.");
  if (mode === "schedule" && !when) throw new Error("Choose a date and time in the future.");
  const accounts = await zernioAccounts(req, key, prep.profileId);
  const missing = [];
  const accountFor = (k) => {
    const a = accounts.find((x) => x.platform === ZERNIO_PLATFORM[k]);
    if (!a) missing.push(PLATFORMS[k].name);
    return a;
  };
  const plans = prep.groups.map((g) => ({ g, targets: g.platforms.map((k) => ({ k, a: accountFor(k) })) }));
  if (missing.length) throw new Error(`The Zernio profile ${prep.profile} has no ${missing.join(", ")} account. Connect it in Zernio or turn it off in the bar.`);
  const out = [];
  for (const { g, targets } of plans) {
    const body = { content: g.text, platforms: targets.map((t) => ({ platform: ZERNIO_PLATFORM[t.k], accountId: t.a.id })) };
    if (mode === "now") body.publishNow = true;
    if (mode === "schedule") { body.scheduledFor = when; body.timezone = timeZone || "UTC"; }
    // No time and not now: Zernio saves it as a draft.
    const idem = stableId(`${prep.path}\n${mode}\n${when || ""}\n${body.platforms.map((p) => p.accountId).join(",")}\n${g.text}`);
    const j = await zernio(req, key, { path: "/posts", method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": idem } }, "the post");
    const post = obj(j.post);
    const urls = {};
    for (const p of Array.isArray(post.platforms) ? post.platforms : []) {
      const k = Object.keys(ZERNIO_PLATFORM).find((x) => ZERNIO_PLATFORM[x] === lower(p.platform));
      if (k && p.platformPostUrl) urls[k] = String(p.platformPostUrl);
    }
    out.push({ id: idOf(post), status: str(post.status, mode === "now" ? "published" : mode === "schedule" ? "scheduled" : "draft"), urls });
  }
  return out;
}


/* ---------- the bar ---------- */
function svgIcon(parent, key, size) {
  const svg = parent.createSvg("svg", { attr: { viewBox: "0 0 24 24", width: size, height: size, fill: "currentColor", "aria-hidden": "true", focusable: "false" } });
  svg.createSvg("path", { attr: { d: iconPath(key) } });
  return svg;
}

// Draws the bar into h. on.channel(name), on.toggle(key, on), on.all(on) do the writing; on.publish(key) opens
// the confirm box. Each click handler returns its promise, so it can be awaited.
function drawHeader(h, d, on) {
  const row1 = h.createDiv("pp-row");
  row1.createSpan({ cls: "pp-label", text: "Channel" });
  const seg = row1.createDiv({ cls: "pp-seg", attr: { role: "radiogroup", "aria-label": "Channel" } });
  for (const name of d.channels) {
    const b = seg.createEl("button", {
      cls: name === d.channel ? "pp-chip is-on" : "pp-chip",
      text: name,
      attr: { type: "button", role: "radio", "aria-checked": String(name === d.channel), "data-channel": name },
    });
    b.addEventListener("click", () => (name !== d.channel ? on.channel(name) : null));
  }

  const row2 = h.createDiv("pp-row");
  row2.createSpan({ cls: "pp-label", text: "Goes to" });
  const icons = row2.createDiv({ cls: "pp-icons", attr: { role: "group", "aria-label": "Platforms" } });
  const keys = PLATFORM_KEYS.filter((k) => d.available.includes(k) || d.extra.includes(k));
  for (const key of keys) {
    const picked = d.picked.includes(key);
    const label = platformLabel(key, d.site);
    const missing = d.extra.includes(key);
    const why = d.channel ? `not connected for ${d.channel}` : "no channel picked";
    const b = icons.createEl("button", {
      cls: `pp-icon${picked ? " is-on" : ""}${missing ? " is-missing" : ""}`,
      attr: {
        type: "button", "data-platform": key, "aria-pressed": String(picked),
        "aria-label": missing ? `${label}: ${why}. Tap to remove` : picked ? `${label}: on. Tap to leave it out` : `${label}: off. Tap to add`,
        title: missing ? `${label} (${why})` : label,
      },
    });
    svgIcon(b, key, 16);
    b.addEventListener("click", () => on.toggle(key, !picked));
  }
  if (d.channel && d.available.length) {
    const allOn = d.available.every((k) => d.picked.includes(k));
    const all = icons.createEl("button", { cls: "pp-all", text: allOn ? "None" : "All", attr: { type: "button", "data-all": allOn ? "none" : "all" } });
    all.addEventListener("click", () => on.all(!allOn));
  }
  if (!d.channel) icons.createSpan({ cls: "pp-hint", text: "Pick a channel to see its platforms." });
  h.createDiv({ cls: "pp-summary", text: summary(d) });

  // Sending: one button, for the social platforms picked in this note, once Zernio is set up for the channel.
  if (d.publish && on.publish) {
    const row3 = h.createDiv("pp-row");
    row3.createSpan({ cls: "pp-label", text: "Zernio" });
    const box = row3.createDiv("pp-publish");
    const b = box.createEl("button", { cls: "pp-pub", text: d.publish.id ? "Send to Zernio again" : "Send to Zernio", attr: { type: "button", "data-publish": "zernio" } });
    b.addEventListener("click", () => on.publish());
    if (d.publish.id) {
      const day = d.publish.date ? ` · ${d.publish.date.slice(0, 16).replace("T", " ")}` : "";
      box.createSpan({ cls: "pp-posted", text: `In Zernio: ${d.publish.status || "sent"}${day}`, attr: { "data-posted": "zernio" } });
    }
  }
}


/* ---------- placing the bar in a note ----------
   Right above the properties block; without one, under the inline title, or at the top. In Live Preview
   and Reading view. Plain source mode shows the properties as text, so it is left alone. */
function childWith(el, cls) {
  return el ? Array.from(el.children).find((c) => c.hasClass(cls)) || null : null;
}
function nextNotOurs(el) {
  let n = el ? el.nextElementSibling : null;
  while (n && n.hasClass(HEADER_CLS)) n = n.nextElementSibling;
  return n;
}
function placeFor(sizer) {
  const meta = childWith(sizer, "metadata-container")
    || childWith(childWith(sizer, "mod-header"), "metadata-container")
    || sizer.querySelector(".metadata-container");
  if (meta) return { parent: meta.parentElement, before: meta };
  const head = childWith(sizer, "mod-header") || sizer;
  const title = childWith(head, "inline-title");
  if (title) return { parent: head, before: nextNotOurs(title) };
  let first = sizer.firstElementChild;
  if (first && first.hasClass("markdown-preview-pusher")) first = first.nextElementSibling;
  while (first && first.hasClass(HEADER_CLS)) first = first.nextElementSibling;
  return { parent: sizer, before: first };
}

class PostBars {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.observers = new WeakMap();
    this.timer = null;
    this.timerWin = null;
    this.dead = false;
  }
  start() {
    const ws = this.app.workspace;
    const all = () => this.update();
    this.plugin.registerEvent(ws.on("file-open", all));
    this.plugin.registerEvent(ws.on("layout-change", all));
    this.plugin.registerEvent(ws.on("active-leaf-change", all));
    this.plugin.registerEvent(this.app.metadataCache.on("changed", (f) => this.update(f)));
    this.plugin.registerEvent(this.app.vault.on("rename", () => this.update()));
    ws.onLayoutReady(all);
  }
  views() {
    return this.app.workspace.getLeavesOfType("markdown").map((l) => l.view).filter((v) => v instanceof MarkdownView);
  }
  update(file) {
    if (this.dead) return;
    for (const v of this.views()) if (!file || (v.file && v.file.path === file.path)) this.render(v);
    this.later();
  }
  // Once more a moment later, when the app has finished drawing the note itself. The timer lives on the window
  // it was set in (a pop-out window has its own).
  later() {
    if (this.dead) return;
    if (this.timer && this.timerWin) this.timerWin.clearTimeout(this.timer);
    this.timerWin = typeof activeWindow !== "undefined" ? activeWindow : window;
    this.timer = this.timerWin.setTimeout(() => { this.timer = null; if (!this.dead) for (const v of this.views()) this.render(v); }, 150);
  }
  sizerOf(view) {
    const state = typeof view.getState === "function" ? view.getState() || {} : {};
    const mode = typeof view.getMode === "function" ? view.getMode() : state.mode;
    if (mode === "preview") {
      const el = view.containerEl.querySelector(".markdown-preview-sizer");
      return el ? { mode, el } : null;
    }
    if (state.source) return null;
    const el = view.containerEl.querySelector(".cm-sizer");
    return el ? { mode: "source", el } : null;
  }
  barsIn(view) { return Array.from(view.containerEl.querySelectorAll(`.${HEADER_CLS}`)); }
  clear(view) { for (const h of this.barsIn(view)) h.remove(); }

  render(view) {
    const s = this.plugin.settings;
    const file = view.file;
    const box = s.showHeader && file ? this.sizerOf(view) : null;
    const cache = file ? this.app.metadataCache.getFileCache(file) : null;
    const d = box ? headerData(s, file, cache && cache.frontmatter) : null;
    if (!d) { this.clear(view); this.watch(view, null); return; }
    const sig = JSON.stringify(d);
    const where = placeFor(box.el);
    const found = this.barsIn(view);
    const h0 = found[0];
    if (!(found.length === 1 && h0.getAttr("data-sig") === sig && h0.parentElement === where.parent && nextNotOurs(h0) === where.before)) {
      for (const h of found) h.remove();
      const h = where.parent.createDiv({ cls: HEADER_CLS, attr: { "data-sig": sig } });
      where.parent.insertBefore(h, where.before);
      drawHeader(h, d, {
        channel: (name) => this.plugin.setChannel(file, name),
        toggle: (key, on) => this.plugin.setPlatform(file, key, on),
        all: (on) => this.plugin.setAll(file, on),
        publish: () => this.plugin.confirmPublish(file),
      });
    }
    this.watch(view, box.el, box.mode);
  }
  // The app redraws parts of a note on its own. If the bar goes missing, draw it again.
  watch(view, el, mode) {
    const was = this.observers.get(view);
    if (was && was.el === el) return;
    if (was) was.observer.disconnect();
    this.observers.delete(view);
    const win = el && (el.win || (typeof activeWindow !== "undefined" ? activeWindow : null));
    const MO = win && win.MutationObserver;
    if (!el || !MO) return;
    const observer = new MO(() => { if (this.barsIn(view).length !== 1) this.later(); });
    observer.observe(el, { childList: true, subtree: mode === "preview" });
    this.observers.set(view, { el, observer });
  }
  destroy() {
    this.dead = true;
    if (this.timer && this.timerWin) this.timerWin.clearTimeout(this.timer);
    this.timer = null;
    for (const v of this.views()) {
      this.clear(v);
      const o = this.observers.get(v);
      if (o) o.observer.disconnect();
    }
  }
}


/* ---------- the confirm box ---------- */
function setModalTitle(modal, title) {
  if (typeof modal.setTitle === "function") modal.setTitle(title); // 1.5.0 has setTitle; older builds only titleEl
  else if (modal.titleEl) modal.titleEl.setText(title);
}
const pad2 = (n) => String(n).padStart(2, "0");
// "YYYY-MM-DDTHH:mm" for a date-and-time box, an hour from now, on the hour.
function nextHour(nowMs) {
  const d = new Date(nowMs + 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:00`;
}

// Shows the exact text for each platform and where it goes, and asks how: draft, schedule or now.
// Nothing is sent unless the user presses the button.
class ZernioModal extends Modal {
  constructor(app, p, onSend) { super(app); this.p = p; this.onSend = onSend; this.mode = "draft"; this.when = nextHour(Date.now()); }
  onOpen() {
    const p = this.p;
    const el = this.contentEl;
    el.empty();
    el.addClass("pp-confirm");
    setModalTitle(this, "Send to Zernio");
    el.createEl("p", { cls: "pp-confirm-where", text: `To the Zernio profile “${p.profile}”, for ${p.channel}.` });
    if (p.sent.id) el.createEl("p", { cls: "pp-confirm-warn", text: `This post was sent to Zernio before (${p.sent.status || "sent"}). Sending again makes a second post there.` });
    for (const g of p.groups) {
      el.createDiv({ cls: "pp-confirm-label", text: g.platforms.map((k) => PLATFORMS[k].name).join(", ") });
      el.createEl("pre", { cls: "pp-confirm-text", text: g.text });
      el.createDiv({ cls: `pp-confirm-count${g.length > g.limit ? " is-over" : ""}`, text: Number.isFinite(g.limit) ? `${g.length} of ${g.limit} characters` : `${g.length} characters` });
    }
    if (p.problem) el.createEl("p", { cls: "pp-confirm-warn", text: p.problem });

    const how = el.createDiv({ cls: "pp-seg pp-mode", attr: { role: "radiogroup", "aria-label": "How to send" } });
    const whenRow = el.createDiv("pp-when");
    const input = whenRow.createEl("input", { attr: { type: "datetime-local", "aria-label": "When to post", value: this.when } });
    input.addEventListener("input", () => { this.when = input.value; });
    const note = el.createEl("p", { cls: "pp-confirm-where" });
    const row = el.createDiv("modal-button-container");
    const no = row.createEl("button", { text: "Cancel", attr: { type: "button", "data-confirm": "no" } });
    no.addEventListener("click", () => this.close());
    const yes = p.problem ? null : row.createEl("button", { cls: "mod-cta", attr: { type: "button", "data-confirm": "yes" } });
    const labels = { draft: "Save as a draft", schedule: "Schedule", now: "Publish now" };
    const paint = () => {
      for (const b of Array.from(how.children)) { const on = b.getAttr("data-mode") === this.mode; b.toggleClass("is-on", on); b.setAttr("aria-checked", String(on)); }
      whenRow.toggleClass("pp-hidden", this.mode !== "schedule");
      note.setText(this.mode === "draft" ? "Saved in Zernio as a draft. Nothing is posted until you schedule or publish it there."
        : this.mode === "schedule" ? "Zernio posts it at this time, in this device's time zone."
          : "Posted on every platform above as soon as you press the button.");
      if (yes) yes.setText(this.mode === "draft" ? "Send draft" : this.mode === "schedule" ? "Schedule" : "Publish now");
    };
    for (const m of SEND_MODES) {
      const b = how.createEl("button", { cls: "pp-chip", text: labels[m], attr: { type: "button", role: "radio", "data-mode": m } });
      b.addEventListener("click", () => { this.mode = m; paint(); });
    }
    if (yes) yes.addEventListener("click", () => { this.close(); return this.onSend(this.mode, this.when); });
    paint();
  }
  onClose() { this.contentEl.empty(); }
}


/* ---------- the plugin ---------- */
class PostPicker extends Plugin {
  async onload() {
    this.settings = mergeSettings(await this.loadData());
    this.busy = null;
    this.sending = new Set();
    this.request = requestUrl; // tests put a stand-in network here
    this.addRibbonIcon("square-pen", "New post", () => this.newPost());
    this.addCommand({ id: "new-post", name: "New post", callback: () => this.newPost() });
    this.addCommand({
      id: "send-to-zernio",
      name: "Send the open post to Zernio",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const d = file ? headerData(this.settings, file, this.frontmatter(file)) : null;
        if (!d || !d.publish) return false;
        if (!checking) this.confirmPublish(file);
        return true;
      },
    });
    this.addSettingTab(new PostPickerSettingTab(this.app, this));
    this.bars = new PostBars(this);
    this.bars.start();
  }
  onunload() { if (this.bars) this.bars.destroy(); }
  async saveSettings() { await this.saveData(this.settings); if (this.bars) this.bars.update(); }

  channelFor(name) { return channelByName(this.settings, name); }
  defaultChannel() { return this.channelFor(this.settings.lastChannel) || this.settings.channels[0] || null; }
  frontmatter(file) { const c = this.app.metadataCache.getFileCache(file); return (c && c.frontmatter) || {}; }

  // One new post at a time: a second tap while the first is still being made does nothing more.
  newPost() {
    if (!this.busy) this.busy = this.makePost().finally(() => { this.busy = null; });
    return this.busy;
  }
  async makePost() {
    const s = this.settings;
    const c = this.defaultChannel();
    if (!c) { new Notice("Add a channel in the Post Picker settings first."); return null; }
    const folder = cleanFolder(join(rootOf(s), c.folder, s.newFolder));
    try {
      await ensureFolder(this.app, folder);
      const name = freeName(this.app, folder, safeName(window.moment().format(s.nameFormat)));
      const body = `---\n${yamlValue(s.channelProp)}: ${yamlValue(c.name)}\n${yamlValue(s.platformsProp)}: []\n---\n\n`;
      const file = await this.app.vault.create(normalizePath(join(folder, name + ".md")), body);
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file, { active: true, state: { mode: "source" } });
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
      return file;
    } catch (e) {
      console.error("[post-picker]", e);
      new Notice(`The post could not be made: ${e.message}`);
      return null;
    }
  }

  // Sets the channel, drops the platforms it does not have, and moves the note to its folder at the same status.
  async setChannel(file, name) {
    const s = this.settings;
    const to = this.channelFor(name);
    if (!to || !(file instanceof TFile)) return;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm[propKey(fm, s.channelProp)] = to.name;
        const pk = propKey(fm, s.platformsProp);
        fm[pk] = asList(fm[pk]).map(lower).filter((p) => to.platforms.includes(p));
      });
      const target = movedPath(s, file.path, to);
      if (target) {
        if (this.app.vault.getAbstractFileByPath(target)) {
          new Notice(`A note named "${file.basename}" is already in ${to.name}'s folder, so this one stays where it is.`);
        } else {
          await ensureFolder(this.app, target.slice(0, target.lastIndexOf("/")));
          await this.app.fileManager.renameFile(file, target);
        }
      }
      s.lastChannel = to.name;
      await this.saveData(s);
    } catch (e) { new Notice(`Could not change the channel: ${e.message}`); }
  }

  // Reads the note's own list at the moment of writing, so a stale bar cannot undo a newer change.
  async setPlatform(file, key, on) {
    const s = this.settings;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        const pk = propKey(fm, s.platformsProp);
        fm[pk] = nextList(fm[pk], key, on);
      });
    } catch (e) { new Notice(`Could not save the platforms: ${e.message}`); }
  }

  async setAll(file, on) {
    const s = this.settings;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        const c = channelByName(s, fm[propKey(fm, s.channelProp)]) || channelByFolder(s, file.path);
        fm[propKey(fm, s.platformsProp)] = on && c ? c.platforms.slice() : [];
      });
    } catch (e) { new Notice(`Could not save the platforms: ${e.message}`); }
  }


  // The Zernio API key, read from this device's keychain (Settings, Keychain) under the name chosen in settings.
  zernioKey() {
    const name = this.settings.zernio.keyName;
    const store = this.app.secretStorage;
    if (!name || !store || typeof store.getSecret !== "function") return "";
    try { return store.getSecret(name) || ""; } catch (e) { return ""; }
  }

  // Reads the note as it is now and opens the confirm box. Returns the box, or null with a notice.
  async confirmPublish(file) {
    try {
      const raw = await this.app.vault.read(file);
      const p = preparePost(this.settings, file, this.frontmatter(file), raw);
      const modal = new ZernioModal(this.app, p, (mode, when) => this.publish(file, p, mode, when));
      modal.open();
      return modal;
    } catch (e) { new Notice(e.message); return null; }
  }

  // Sends what the confirm box showed, then writes where it went into the note. One send per note at a time.
  async publish(file, p, mode, whenValue) {
    if (this.sending.has(file.path)) return null;
    this.sending.add(file.path);
    try {
      const now = Date.now();
      const when = mode === "schedule" ? scheduleTime(whenValue, now) : "";
      if (mode === "schedule" && !when) throw new Error("Choose a date and time in the future.");
      const tz = (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
      const res = await sendToZernio(this.request, this.zernioKey(), p, mode, when, tz);
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm[propKey(fm, "zernio_id")] = res.map((r) => r.id).filter(Boolean).join(", ");
        fm[propKey(fm, "zernio_status")] = Array.from(new Set(res.map((r) => r.status))).join(", ");
        fm[propKey(fm, "zernio_date")] = window.moment(now).format("YYYY-MM-DDTHH:mm");
        if (when) fm[propKey(fm, "zernio_scheduled")] = when.slice(0, 16);
        for (const r of res) for (const [k, url] of Object.entries(r.urls)) fm[propKey(fm, `${k}_url`)] = url;
      });
      new Notice(mode === "draft" ? "Saved in Zernio as a draft." : mode === "schedule" ? `Scheduled in Zernio for ${when.slice(0, 16).replace("T", " ")}.` : "Sent to Zernio to publish now.");
      return res;
    } catch (e) {
      new Notice(`Not sent: ${e.message}`);
      return null;
    } finally { this.sending.delete(file.path); }
  }
}

/* ---------- settings tab ---------- */
class PostPickerSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const el = this.containerEl;
    const p = this.plugin;
    const s = p.settings;
    const save = async () => { await p.saveSettings(); };
    el.empty();
    el.createDiv({ cls: "setting-item-description", text: "New post makes a note in a channel's folder. Every note under the posts folder gets a bar at the top to pick its channel and the platforms it goes to." });
    const text = (name, desc, key, placeholder) => new Setting(el).setName(name).setDesc(desc)
      .addText((t) => t.setPlaceholder(placeholder).setValue(s[key]).onChange(async (v) => { s[key] = v.trim() || (key === "root" || key === "newFolder" ? "" : DEFAULT_SETTINGS[key]); await save(); }));
    text("Posts folder", "Each channel has its own folder in here.", "root", "Posts");
    text("New posts go in", "A sub-folder of the channel's folder. Empty: the channel's folder itself.", "newFolder", "0 New");
    text("New post name", "A date pattern; text in square brackets stays as written.", "nameFormat", "YYYY-MM-DD HHmm [post]");
    text("Channel property", "", "channelProp", "channel");
    text("Platforms property", "", "platformsProp", "platforms");
    new Setting(el).setName("Show the bar on post notes")
      .addToggle((t) => t.setValue(s.showHeader).onChange(async (v) => { s.showHeader = v; await save(); }));

    // Zernio: optional. The key lives in the device's keychain; the settings keep only its name.
    new Setting(el).setName("Sending with Zernio").setHeading();
    el.createDiv({ cls: "setting-item-description", text: "Optional. Zernio (zernio.com) posts to the social accounts you connected there. Make an API key in Zernio under API keys. It is kept in this device's keychain (Settings, Keychain), encrypted by your system, never in the plugin's files. Then pick each channel's Zernio profile below." });
    const keyRow = new Setting(el).setName("Zernio API key").setDesc("Choose or add the keychain entry that holds it.");
    if (typeof SecretComponent === "function") {
      keyRow.addComponent((box) => new SecretComponent(this.app, box).setValue(s.zernio.keyName).onChange(async (v) => { s.zernio.keyName = String(v || "").trim(); await save(); }));
    } else {
      keyRow.setDesc("This version of the app has no keychain. Update the app to send with Zernio.");
    }
    const check = new Setting(el).setName("Profiles").setDesc(s.zernio.profiles.length ? `${s.zernio.profiles.length} loaded: ${s.zernio.profiles.map((x) => x.name).join(", ")}.` : "Not loaded yet.");
    check.addButton((b) => b.setButtonText("Check key and load profiles").onClick(async () => {
      check.setDesc("Checking…");
      try {
        s.zernio.profiles = await zernioProfiles(p.request, p.zernioKey());
        await save();
        this.display();
      } catch (e) { check.setDesc(e.message); }
    }));

    new Setting(el).setName("Channels").setHeading();
    s.channels.forEach((c, i) => {
      const box = el.createDiv("pp-settings-channel");
      new Setting(box).setName(c.name || `Channel ${i + 1}`).setHeading()
        .addExtraButton((b) => b.setIcon("trash").setTooltip("Remove").onClick(async () => { s.channels.splice(i, 1); await save(); this.display(); }));
      new Setting(box).setName("Name").addText((t) => t.setValue(c.name).onChange(async (v) => { c.name = v.trim(); await save(); }));
      new Setting(box).setName("Folder").setDesc("Inside the posts folder.").addText((t) => t.setValue(c.folder).onChange(async (v) => { c.folder = v.trim(); await save(); }));
      new Setting(box).setName("Website").setDesc("Shown on the website toggle, such as example.com.").addText((t) => t.setValue(c.site).onChange(async (v) => { c.site = v.trim(); await save(); }));
      new Setting(box).setName("Platforms it posts to").setDesc("Tap to turn each on or off.");
      // A grid of labelled chips: twelve unlabelled toggles in one row ran off the edge of the settings pane.
      const grid = box.createDiv({ cls: "pp-settings-platforms", attr: { role: "group", "aria-label": `Platforms for ${c.name}` } });
      for (const key of PLATFORM_KEYS) {
        const on = c.platforms.includes(key);
        const chip = grid.createEl("button", { cls: `pp-settings-platform${on ? " is-on" : ""}`, attr: { type: "button", "aria-pressed": String(on), "data-platform": key } });
        svgIcon(chip, key, 14);
        chip.createSpan({ text: platformLabel(key, c.site) });
        chip.addEventListener("click", async () => {
          const next = !c.platforms.includes(key);
          c.platforms = nextList(c.platforms, key, next);
          chip.toggleClass("is-on", next);
          chip.setAttr("aria-pressed", String(next));
          await save();
        });
      }
      const prof = new Setting(box).setName("Zernio profile").setDesc("Where this channel's posts go in Zernio.");
      if (s.zernio.profiles.length) {
        prof.addDropdown((d) => {
          d.addOption("", "None");
          for (const x of s.zernio.profiles) d.addOption(x.id, x.name);
          if (c.zernioProfile && !s.zernio.profiles.some((x) => x.id === c.zernioProfile)) d.addOption(c.zernioProfile, `Profile ${c.zernioProfile}`);
          d.setValue(c.zernioProfile).onChange(async (v) => { c.zernioProfile = v; await save(); });
        });
      } else {
        prof.setDesc("Load the profiles above first, or paste the profile's id.").addText((t) => t.setPlaceholder("Profile id").setValue(c.zernioProfile).onChange(async (v) => { c.zernioProfile = v.trim(); await save(); }));
      }
    });
    new Setting(el).addButton((b) => b.setButtonText("Add a channel").onClick(async () => {
      s.channels.push(cleanChannel({ name: `Channel ${s.channels.length + 1}`, folder: `Channel ${s.channels.length + 1}` }));
      await save();
      this.display();
    }));
  }
}

module.exports = PostPicker;
module.exports.core = {
  DEFAULT_SETTINGS, PLATFORMS, PLATFORM_KEYS, HEADER_CLS, ZERNIO, ZERNIO_PLATFORM, LIMITS, SEND_MODES, mergeSettings, cleanChannel, headerData, summary,
  platformLabel, nextList, movedPath, channelByFolder, channelByName, isPost, freeName, safeName, yamlValue, drawHeader, placeFor, iconPath, propKey,
  asList, sectionText, sectionsFor, plainText, graphemes, stripFrontmatter, zernioReady, sendable, zernioProfiles, zernioAccounts, stableId, preparePost,
  scheduleTime, sendToZernio, nextHour, ZernioModal, PostPickerSettingTab,
};
