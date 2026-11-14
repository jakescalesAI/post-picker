/* Post Picker: start a post, and choose at the top of it which channel it is for and which platforms it
   goes to. One button makes a new post note in the channel's "new" folder. Every post note gets a bar at
   the top: the channels as one row, and the platforms that channel has as icons to tap on and off. The
   choices are kept in the note's properties (channel, platforms), so anything that posts can read them.
   Picking another channel moves the note to that channel's folder, at the same status, and drops the
   platforms that channel does not have.
   Optional publishing: with the user's own account details in settings, a post can go to Bluesky, Mastodon,
   or a Ghost or WordPress blog (as a draft). Only when the user presses the button and then confirms the
   exact text; never on its own. Where it went is written back into the note.
   No Node APIs, so it runs on phones and tablets too. */
"use strict";
const { Plugin, PluginSettingTab, Setting, Notice, Modal, TFile, MarkdownView, normalizePath, requestUrl } = require("obsidian");

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
  "mastodon": "M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z",
  "pinterest": "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z",
  "linkedin": "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  "reddit": "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"
};
const PLATFORMS = {
  site: { name: "Website blog" },
  x: { name: "X" },
  threads: { name: "Threads" },
  bluesky: { name: "Bluesky" },
  mastodon: { name: "Mastodon" },
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
    { name: "Personal", folder: "Personal", site: "", platforms: ["site", "x", "threads", "bluesky", "linkedin"] },
  ],
};
const MASTODON_VISIBILITY = ["public", "unlisted", "private"];

const str = (v, fallback) => (typeof v === "string" ? v : fallback);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const cleanFolder = (f) => {
  const p = normalizePath(String(f || "").trim());
  return p === "/" || p === "." ? "" : p.replace(/^\/+|\/+$/g, "");
};
const join = (...parts) => parts.map(cleanFolder).filter(Boolean).join("/");

// The accounts a channel publishes with. Each one is empty until the user pastes their own details in settings.
function cleanAccounts(a) {
  a = obj(a);
  const b = obj(a.bluesky), m = obj(a.mastodon), w = obj(a.site);
  const t = (v) => str(v, "").trim();
  const limit = Math.floor(Number(m.limit));
  return {
    bluesky: { handle: t(b.handle).replace(/^@/, ""), password: t(b.password), service: t(b.service) || "https://bsky.social" },
    mastodon: { instance: t(m.instance), token: t(m.token), visibility: MASTODON_VISIBILITY.includes(m.visibility) ? m.visibility : "public", limit: limit > 0 ? limit : 500 },
    site: { kind: ["ghost", "wordpress"].includes(w.kind) ? w.kind : "", url: t(w.url), key: t(w.key), user: t(w.user), password: t(w.password) },
  };
}
function cleanChannel(c) {
  c = c || {};
  const platforms = (Array.isArray(c.platforms) ? c.platforms : []).map((p) => String(p).toLowerCase().trim()).filter(isPlatform);
  return {
    name: str(c.name, "").trim(),
    folder: str(c.folder, "").trim(),
    site: str(c.site, "").trim(),
    platforms: PLATFORM_KEYS.filter((k) => platforms.includes(k)), // always in the one order
    accounts: cleanAccounts(c.accounts),
  };
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

/* ---------- publishing: where a post can go ----------
   Only these have a free API that takes the user's own credentials. Bluesky and Mastodon post at once and
   publicly; the website ones land as drafts. Each is sent only when the user presses Post in the confirm box. */
const DESTINATIONS = {
  bluesky: { platform: "bluesky", name: "Bluesky", action: "Post to Bluesky", limit: 300, sections: ["bluesky"] },
  mastodon: { platform: "mastodon", name: "Mastodon", action: "Post to Mastodon", sections: ["mastodon"] },
  ghost: { platform: "site", name: "Ghost", action: "Send to Ghost as a draft", sections: ["ghost", "website", "website blog", "blog"] },
  wordpress: { platform: "site", name: "WordPress", action: "Send to WordPress as a draft", sections: ["wordpress", "website", "website blog", "blog"] },
};
// The destinations a channel has the details for.
function readyDestinations(c) {
  if (!c) return [];
  const a = c.accounts || cleanAccounts(null);
  const out = [];
  if (c.platforms.includes("bluesky") && a.bluesky.handle && a.bluesky.password) out.push("bluesky");
  if (c.platforms.includes("mastodon") && a.mastodon.instance && a.mastodon.token) out.push("mastodon");
  if (c.platforms.includes("site") && a.site.url) {
    if (a.site.kind === "ghost" && a.site.key) out.push("ghost");
    if (a.site.kind === "wordpress" && a.site.user && a.site.password) out.push("wordpress");
  }
  return out;
}

// What the bar shows for a note, or null when the note is not a post. Never holds a credential: it is
// written into the page as the bar's signature.
function headerData(s, file, fm) {
  fm = fm || {};
  if (!file || !isPost(s, file.path, fm)) return null;
  const named = channelByName(s, fm[propKey(fm, s.channelProp)]);
  const channel = named || channelByFolder(s, file.path);
  const picked = asList(fm[propKey(fm, s.platformsProp)]).map(lower).filter(isPlatform);
  const available = channel ? channel.platforms : [];
  const publish = readyDestinations(channel)
    .filter((k) => picked.includes(DESTINATIONS[k].platform))
    .map((k) => ({ key: k, action: DESTINATIONS[k].action, url: str(fm[propKey(fm, k + "_url")], ""), date: String(fm[propKey(fm, k + "_date")] || "") }));
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
const SECTION_NAMES = new Set(Object.values(DESTINATIONS).flatMap((d) => d.sections).concat(PLATFORM_KEYS.map((k) => lower(PLATFORMS[k].name))));

/* The part of the note a destination gets. A heading named after it ("## Bluesky", "## Website") holds its own
   version. Otherwise it gets the note without any such sections, so a Mastodon version never reaches Bluesky. */
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
// Bluesky counts graphemes: an emoji made of several code points is one.
function graphemes(t) { return segmenter ? Array.from(segmenter.segment(t)).length : Array.from(t).length; }
const URL_RE = /https?:\/\/[^\s<>"'`]+/g;
// A web address as written in running text, without the full stop or bracket after it.
function trimUrl(u) {
  u = u.replace(/[.,;:!?'"]+$/, "");
  while (u.endsWith(")") && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1);
  return u;
}
// Mastodon counts every link as 23 characters, whatever its length.
function mastodonLength(t) { return Array.from(t.replace(URL_RE, (u) => "x".repeat(23) + u.slice(trimUrl(u).length))).length; }

// Bluesky shows a link or hashtag only where a "facet" marks it, by UTF-8 byte offsets.
function blueskyFacets(text) {
  const enc = new TextEncoder();
  const bytes = (s) => enc.encode(s).length;
  const facets = [];
  for (const m of text.matchAll(URL_RE)) {
    const uri = trimUrl(m[0]);
    const start = bytes(text.slice(0, m.index));
    facets.push({ index: { byteStart: start, byteEnd: start + bytes(uri) }, features: [{ $type: "app.bsky.richtext.facet#link", uri }] });
  }
  for (const m of text.matchAll(/(^|\s)#([^\s#]+)/g)) {
    const tag = m[2].replace(/[.,;:!?'")\]]+$/, "");
    if (!tag || /^\d+$/.test(tag) || tag.length > 64) continue;
    const start = bytes(text.slice(0, m.index + m[1].length));
    facets.push({ index: { byteStart: start, byteEnd: start + bytes("#" + tag) }, features: [{ $type: "app.bsky.richtext.facet#tag", tag }] });
  }
  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

/* Markdown to simple HTML for a blog. Headings, paragraphs, lists, quotes, code, links, images (web addresses
   only) and bold, italic and struck text. Everything else is sent as escaped text. */
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const webUrl = (u) => /^(https?:\/\/|mailto:)/i.test(u);
function inlineHtml(text) {
  const keep = [];
  const hold = (html) => `\u0001${keep.push(html) - 1}\u0002`;
  let t = String(text);
  t = t.replace(/`([^`\n]+)`/g, (m, code) => hold(`<code>${esc(code)}</code>`));
  t = t.replace(/!\[\[[^\]]*\]\]/g, "");
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => (webUrl(url) ? hold(`<img src="${esc(url)}" alt="${esc(alt)}">`) : ""));
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, (m, target) => target.split("#")[0].split("/").pop());
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => (webUrl(url) ? hold(`<a href="${esc(url)}">${marks(esc(label))}</a>`) : label));
  t = t.replace(URL_RE, (u) => { const clean = trimUrl(u); return hold(`<a href="${esc(clean)}">${esc(clean)}</a>`) + u.slice(clean.length); });
  t = marks(esc(t));
  return t.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[Number(i)]);
}
function marks(t) {
  return t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>").replace(/~~([^~\n]+)~~/g, "<del>$1</del>").replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
}
function markdownToHtml(md) {
  const lines = String(md || "").replace(/%%[\s\S]*?%%/g, "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [], list = null, quote = [];
  const flushPara = () => { if (para.length) out.push(`<p>${para.map(inlineHtml).join("<br>")}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</${list.tag}>`); list = null; };
  const flushQuote = () => { if (quote.length) out.push(`<blockquote><p>${quote.map(inlineHtml).join("<br>")}</p></blockquote>`); quote = []; };
  const flush = () => { flushPara(); flushList(); flushQuote(); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      flush();
      const code = [];
      while (++i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const h = HEADING.exec(line);
    if (h) { flush(); out.push(`<h${h[1].length}>${inlineHtml(h[2])}</h${h[1].length}>`); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push("<hr>"); continue; }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
    const li = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushPara(); flushQuote();
      const tag = li[1] ? "ul" : "ol";
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(li[3].replace(/^\[[ xX]\]\s+/, ""));
      continue;
    }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flush();
  return out.join("\n");
}

// The blog title: the note's title property, else its first top heading (taken out of the body), else its name.
function blogParts(fm, body, basename) {
  let text = body;
  let title = str(fm && fm[propKey(fm, "title")], "").trim();
  if (!title) {
    const m = /^[ \t]*#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(text);
    if (m && !text.slice(0, m.index).trim()) { title = m[1]; text = text.slice(m.index + m[0].length); }
  }
  return { title: title || basename, html: markdownToHtml(text.trim()) };
}

/* ---------- publishing: the requests ----------
   Every request goes through the app's requestUrl. `req` is passed in so tests can stand in for the network. */
// A server address as https://host[/path], without a trailing slash. Plain http only for this computer.
function serverUrl(u, what) {
  let s = String(u || "").trim().replace(/\/+$/, "");
  if (!s) throw new Error(`Add the ${what} address in settings first.`);
  if (!/^[a-z]+:\/\//i.test(s)) s = "https://" + s;
  if (!/^https:\/\//i.test(s) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(s)) throw new Error(`The ${what} address must start with https://, so your password is not sent in the clear.`);
  return s;
}
async function call(req, what, o) {
  let res;
  try { res = await req(Object.assign({ throw: false }, o)); } catch (e) { throw new Error(`${what} could not be reached: ${e.message}`); }
  let json = null;
  try { json = res.json; } catch (e) { json = null; } // an error page that is not JSON
  if (!res || res.status < 200 || res.status >= 300) {
    const j = obj(json);
    const why = j.message || j.error_description || j.error || (Array.isArray(j.errors) && j.errors[0] && (j.errors[0].context || j.errors[0].message)) || "";
    throw new Error(`${what} said no (${res ? res.status : "no answer"})${why ? ": " + why : ""}`);
  }
  return obj(json);
}
const jsonPost = (url, body, headers) => ({ url, method: "POST", contentType: "application/json", headers: headers || {}, body: JSON.stringify(body) });

// Bluesky (AT Protocol): a session from the handle and app password, then a post record. The session is not kept.
async function postBluesky(req, acc, text, nowIso) {
  const base = serverUrl(acc.service || "https://bsky.social", "Bluesky server");
  const session = await call(req, "Bluesky", jsonPost(`${base}/xrpc/com.atproto.server.createSession`, { identifier: acc.handle, password: acc.password }));
  if (!session.accessJwt || !session.did) throw new Error("Bluesky did not open a session.");
  const record = { $type: "app.bsky.feed.post", text, createdAt: nowIso };
  const facets = blueskyFacets(text);
  if (facets.length) record.facets = facets;
  const made = await call(req, "Bluesky", jsonPost(`${base}/xrpc/com.atproto.repo.createRecord`, { repo: session.did, collection: "app.bsky.feed.post", record }, { Authorization: `Bearer ${session.accessJwt}` }));
  const rkey = String(made.uri || "").split("/").pop();
  if (!rkey) throw new Error("Bluesky did not say where the post is.");
  return { url: `https://bsky.app/profile/${session.handle || acc.handle}/post/${rkey}` };
}

// Mastodon: one status, with a key so a retry after a lost answer does not post twice.
async function postMastodon(req, acc, text, idemKey) {
  const base = serverUrl(acc.instance, "Mastodon server");
  const made = await call(req, "Mastodon", jsonPost(`${base}/api/v1/statuses`, { status: text, visibility: acc.visibility || "public" }, { Authorization: `Bearer ${acc.token}`, "Idempotency-Key": idemKey }));
  if (!made.url) throw new Error("Mastodon did not say where the post is.");
  return { url: made.url };
}

// Ghost Admin API: a short-lived token (a JWT signed with the key's secret, HS256), then a draft post from HTML.
const b64 = (bytes) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const utf8 = (s) => new TextEncoder().encode(s);
function webCrypto() {
  const c = (typeof window !== "undefined" && window.crypto) || globalThis.crypto;
  if (!c || !c.subtle) throw new Error("This device cannot sign the Ghost key.");
  return c.subtle;
}
async function ghostToken(adminKey, nowMs) {
  const parts = String(adminKey || "").trim().split(":");
  const [id, secret] = parts;
  if (parts.length !== 2 || !id || !/^[0-9a-f]+$/i.test(secret || "") || secret.length % 2) throw new Error("The Ghost Admin API key should look like id:secret (copy it from Ghost's Integrations page).");
  const iat = Math.floor(nowMs / 1000);
  const head = b64url(utf8(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })));
  const body = b64url(utf8(JSON.stringify({ iat, exp: iat + 5 * 60, aud: "/admin/" })));
  const keyBytes = new Uint8Array(secret.match(/../g).map((h) => parseInt(h, 16)));
  const subtle = webCrypto();
  const key = await subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await subtle.sign("HMAC", key, utf8(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}
async function postGhost(req, acc, parts, nowMs) {
  const base = serverUrl(acc.url, "Ghost site");
  const token = await ghostToken(acc.key, nowMs);
  const made = await call(req, "Ghost", jsonPost(`${base}/ghost/api/admin/posts/?source=html`, { posts: [{ title: parts.title, html: parts.html, status: "draft" }] }, { Authorization: `Ghost ${token}`, "Accept-Version": "v5.0" }));
  const post = Array.isArray(made.posts) ? made.posts[0] : null;
  if (!post) throw new Error("Ghost did not send the post back.");
  return { url: post.url || `${base}/ghost/#/editor/post/${post.id}`, id: post.id };
}

// WordPress REST API with an application password: a draft post.
async function postWordPress(req, acc, parts) {
  const base = serverUrl(acc.url, "WordPress site");
  // WordPress shows application passwords in groups with spaces; it accepts them with or without.
  const auth = b64(utf8(`${acc.user}:${acc.password.replace(/\s+/g, "")}`));
  const made = await call(req, "WordPress", jsonPost(`${base}/wp-json/wp/v2/posts`, { title: parts.title, content: parts.html, status: "draft" }, { Authorization: `Basic ${auth}` }));
  if (!made.id) throw new Error("WordPress did not send the post back.");
  return { url: made.link || `${base}/?p=${made.id}`, id: made.id };
}

// A short, steady key for the same note and text: the same post pressed twice is one post on Mastodon.
function hashKey(s) {
  let h = 0x811c9dc5;
  for (const ch of utf8(s)) { h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; }
  return "pp-" + h.toString(16);
}

/* Everything the confirm box shows and the request sends, worked out from the note before anything is sent. */
function preparePost(s, file, fm, raw, key) {
  const dest = DESTINATIONS[key];
  if (!dest) throw new Error("Unknown place to publish.");
  fm = fm || {};
  const channel = channelByName(s, fm[propKey(fm, s.channelProp)]) || channelByFolder(s, file.path);
  if (!channel || !readyDestinations(channel).includes(key)) throw new Error(`Add the ${dest.name} details to this post's channel in settings first.`);
  const acc = channel.accounts;
  const body = sectionText(raw, dest.sections);
  const p = { key, channel: channel.name, action: dest.action, name: dest.name, posted: str(fm[propKey(fm, key + "_url")], "") };
  if (key === "bluesky" || key === "mastodon") {
    p.text = plainText(body);
    p.limit = key === "bluesky" ? dest.limit : acc.mastodon.limit;
    p.length = key === "bluesky" ? graphemes(p.text) : mastodonLength(p.text);
    p.where = key === "bluesky"
      ? `As @${acc.bluesky.handle} on ${serverUrl(acc.bluesky.service, "Bluesky server").replace(/^https?:\/\//, "")}. It is public as soon as it is posted.`
      : `To ${serverUrl(acc.mastodon.instance, "Mastodon server").replace(/^https?:\/\//, "")}, visible: ${acc.mastodon.visibility}.${acc.mastodon.visibility === "public" ? " It is public as soon as it is posted." : ""}`;
    p.problem = !p.text ? "The post is empty." : p.length > p.limit ? `Too long: ${p.length} of ${p.limit} characters.` : "";
  } else {
    const parts = blogParts(fm, body, file.basename);
    p.title = parts.title;
    p.html = parts.html;
    p.text = parts.html;
    p.where = `To ${serverUrl(acc.site.url, `${dest.name} site`)} as a draft. Nothing is public until you publish it there.`;
    p.problem = parts.html ? "" : "The post is empty.";
  }
  return p;
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

  // Publishing: only for platforms picked in this note whose account details are in settings.
  if (d.publish && d.publish.length && on.publish) {
    const row3 = h.createDiv("pp-row");
    row3.createSpan({ cls: "pp-label", text: "Publish" });
    const box = row3.createDiv("pp-publish");
    for (const p of d.publish) {
      const b = box.createEl("button", { cls: "pp-pub", text: p.url ? `${p.action} again` : p.action, attr: { type: "button", "data-publish": p.key } });
      b.addEventListener("click", () => on.publish(p.key));
      if (p.url) {
        const day = p.date ? ` ${p.date.slice(0, 10)}` : "";
        box.createEl("a", { cls: "pp-posted", text: `Posted${day}`, href: p.url, attr: { target: "_blank", rel: "noopener", "data-posted": p.key } });
      }
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
        publish: (key) => this.plugin.confirmPublish(file, key),
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

/* ---------- confirm boxes ---------- */
function setModalTitle(modal, title) {
  if (typeof modal.setTitle === "function") modal.setTitle(title); // 1.5.0 has setTitle; older builds only titleEl
  else if (modal.titleEl) modal.titleEl.setText(title);
}

// Shows the exact text and where it goes. Nothing is sent unless the user presses the button.
class ConfirmPublishModal extends Modal {
  constructor(app, p, onYes) { super(app); this.p = p; this.onYes = onYes; }
  onOpen() {
    const p = this.p;
    const el = this.contentEl;
    el.empty();
    el.addClass("pp-confirm");
    setModalTitle(this, `${p.action}?`);
    el.createEl("p", { cls: "pp-confirm-where", text: p.where });
    if (p.posted) el.createEl("p", { cls: "pp-confirm-warn", text: `This post is already on ${p.name}: ${p.posted}. Posting again makes a second copy.` });
    if (p.title !== undefined) el.createDiv({ cls: "pp-confirm-title", text: `Title: ${p.title}` });
    if (p.html !== undefined) el.createDiv({ cls: "pp-confirm-label", text: "The HTML that is sent:" });
    el.createEl("pre", { cls: "pp-confirm-text", text: p.text });
    if (p.limit) el.createDiv({ cls: `pp-confirm-count${p.length > p.limit ? " is-over" : ""}`, text: `${p.length} of ${p.limit} characters` });
    if (p.problem) el.createEl("p", { cls: "pp-confirm-warn", text: p.problem });
    const row = el.createDiv("modal-button-container");
    const no = row.createEl("button", { text: "Cancel", attr: { type: "button", "data-confirm": "no" } });
    no.addEventListener("click", () => this.close());
    if (!p.problem) {
      const yes = row.createEl("button", { cls: "mod-cta", text: p.key === "ghost" || p.key === "wordpress" ? "Send draft" : "Post", attr: { type: "button", "data-confirm": "yes" } });
      yes.addEventListener("click", () => { this.close(); return this.onYes(); });
    }
  }
  onClose() { this.contentEl.empty(); }
}

// For the command: which of the note's ready places to publish to.
class ChoosePublishModal extends Modal {
  constructor(app, choices, onPick) { super(app); this.choices = choices; this.onPick = onPick; }
  onOpen() {
    setModalTitle(this, "Publish this post");
    const el = this.contentEl;
    el.empty();
    el.addClass("pp-confirm");
    const row = el.createDiv("pp-publish");
    for (const c of this.choices) {
      const b = row.createEl("button", { cls: "pp-pub", text: c.url ? `${c.action} again` : c.action, attr: { type: "button", "data-publish": c.key } });
      b.addEventListener("click", () => { this.close(); return this.onPick(c.key); });
    }
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
      id: "publish",
      name: "Publish the open post",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const d = file ? headerData(this.settings, file, this.frontmatter(file)) : null;
        if (!d || !d.publish.length) return false;
        if (!checking) new ChoosePublishModal(this.app, d.publish, (key) => this.confirmPublish(file, key)).open();
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

  // Reads the note as it is now and opens the confirm box. Returns the box, or null with a notice.
  async confirmPublish(file, key) {
    try {
      const raw = await this.app.vault.read(file);
      const p = preparePost(this.settings, file, this.frontmatter(file), raw, key);
      const modal = new ConfirmPublishModal(this.app, p, () => this.publish(file, p));
      modal.open();
      return modal;
    } catch (e) { new Notice(e.message); return null; }
  }

  // Sends what the confirm box showed, then writes where it went into the note. One send per note and place at a time.
  async publish(file, p) {
    const lock = `${file.path}|${p.key}`;
    if (this.sending.has(lock)) return null;
    this.sending.add(lock);
    const acc = (this.channelFor(p.channel) || {}).accounts;
    try {
      if (!acc) throw new Error(`The channel ${p.channel} is gone from settings.`);
      const now = Date.now();
      let res;
      if (p.key === "bluesky") res = await postBluesky(this.request, acc.bluesky, p.text, new Date(now).toISOString());
      else if (p.key === "mastodon") res = await postMastodon(this.request, acc.mastodon, p.text, hashKey(`${file.path}\n${p.text}`));
      else if (p.key === "ghost") res = await postGhost(this.request, acc.site, p, now);
      else if (p.key === "wordpress") res = await postWordPress(this.request, acc.site, p);
      else throw new Error("Unknown place to publish.");
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm[propKey(fm, `${p.key}_url`)] = res.url;
        fm[propKey(fm, `${p.key}_date`)] = window.moment(now).format("YYYY-MM-DDTHH:mm");
      });
      new Notice(p.key === "ghost" || p.key === "wordpress" ? `Sent to ${p.name} as a draft.` : `Posted to ${p.name}.`);
      return res;
    } catch (e) {
      new Notice(`Not published: ${e.message}`);
      return null;
    } finally { this.sending.delete(lock); }
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

    new Setting(el).setName("Channels").setHeading();
    el.createDiv({ cls: "setting-item-description", text: "Publishing is optional. Account details you add here are saved in this plugin's data.json file inside your vault, in plain text. If you sync your vault or plugin settings, they sync too. Use app passwords, never your main password." });
    s.channels.forEach((c, i) => {
      const box = el.createDiv("pp-settings-channel");
      new Setting(box).setName(c.name || `Channel ${i + 1}`).setHeading()
        .addExtraButton((b) => b.setIcon("trash").setTooltip("Remove").onClick(async () => { s.channels.splice(i, 1); await save(); this.display(); }));
      new Setting(box).setName("Name").addText((t) => t.setValue(c.name).onChange(async (v) => { c.name = v.trim(); await save(); }));
      new Setting(box).setName("Folder").setDesc("Inside the posts folder.").addText((t) => t.setValue(c.folder).onChange(async (v) => { c.folder = v.trim(); await save(); }));
      new Setting(box).setName("Website").setDesc("Shown on the website toggle, such as example.com.").addText((t) => t.setValue(c.site).onChange(async (v) => { c.site = v.trim(); await save(); }));
      const plat = new Setting(box).setName("Platforms it posts to");
      for (const key of PLATFORM_KEYS) {
        plat.addToggle((t) => t.setTooltip(PLATFORMS[key].name).setValue(c.platforms.includes(key)).onChange(async (v) => {
          c.platforms = nextList(c.platforms, key, v);
          await save();
          this.display(); // the publishing fields below follow the platforms
        }));
      }
      plat.setDesc(PLATFORM_KEYS.map((k) => PLATFORMS[k].name).join(", "));
      this.accounts(box, c, save);
    });
    new Setting(el).addButton((b) => b.setButtonText("Add a channel").onClick(async () => {
      s.channels.push(cleanChannel({ name: `Channel ${s.channels.length + 1}`, folder: `Channel ${s.channels.length + 1}` }));
      await save();
      this.display();
    }));
  }

  // Publishing details for one channel, shown only for the platforms it has that can publish.
  accounts(box, c, save) {
    const a = c.accounts = cleanAccounts(c.accounts);
    const field = (name, desc, o, k, placeholder, secret) => new Setting(box).setName(name).setDesc(desc).addText((t) => {
      if (secret && t.inputEl) t.inputEl.type = "password";
      t.setPlaceholder(placeholder).setValue(o[k]).onChange(async (v) => { o[k] = v.trim(); await save(); });
    });
    if (c.platforms.includes("bluesky")) {
      field("Bluesky handle", "Optional, to publish. Such as name.bsky.social.", a.bluesky, "handle", "name.bsky.social");
      field("Bluesky app password", "Make one in Bluesky under Settings, Privacy and security, App passwords.", a.bluesky, "password", "xxxx-xxxx-xxxx-xxxx", true);
      field("Bluesky server", "Leave as is unless your account is on another server.", a.bluesky, "service", "https://bsky.social");
    }
    if (c.platforms.includes("mastodon")) {
      field("Mastodon server", "Optional, to publish. Such as mastodon.social.", a.mastodon, "instance", "mastodon.social");
      field("Mastodon access token", "In Mastodon: Preferences, Development, New application, with only the write:statuses scope. Copy its access token.", a.mastodon, "token", "", true);
      new Setting(box).setName("Mastodon visibility").addDropdown((d) => {
        for (const v of MASTODON_VISIBILITY) d.addOption(v, { public: "Public", unlisted: "Quiet public (unlisted)", private: "Followers only" }[v]);
        d.setValue(a.mastodon.visibility).onChange(async (v) => { a.mastodon.visibility = v; await save(); });
      });
      new Setting(box).setName("Mastodon character limit").setDesc("500 on most servers.").addText((t) => t.setValue(String(a.mastodon.limit)).onChange(async (v) => {
        const n = Math.floor(Number(v));
        a.mastodon.limit = n > 0 ? n : 500;
        await save();
      }));
    }
    if (c.platforms.includes("site")) {
      new Setting(box).setName("Website publishing").setDesc("Optional. Sends the post to your blog as a draft.").addDropdown((d) => {
        d.addOption("", "Off").addOption("ghost", "Ghost").addOption("wordpress", "WordPress");
        d.setValue(a.site.kind).onChange(async (v) => { a.site.kind = v; await save(); this.display(); });
      });
      if (a.site.kind) field("Site address", "Such as https://example.com.", a.site, "url", "https://example.com");
      if (a.site.kind === "ghost") field("Ghost Admin API key", "In Ghost: Settings, Integrations, Add custom integration. Copy the Admin API key (id:secret).", a.site, "key", "", true);
      if (a.site.kind === "wordpress") {
        field("WordPress username", "", a.site, "user", "");
        field("WordPress application password", "In WordPress: Users, Profile, Application passwords.", a.site, "password", "", true);
      }
    }
  }
}

module.exports = PostPicker;
module.exports.core = {
  DEFAULT_SETTINGS, PLATFORMS, PLATFORM_KEYS, HEADER_CLS, DESTINATIONS, mergeSettings, cleanChannel, cleanAccounts, headerData, summary, platformLabel,
  nextList, movedPath, channelByFolder, channelByName, isPost, freeName, safeName, yamlValue, drawHeader, placeFor, iconPath, propKey, asList,
  readyDestinations, sectionText, plainText, graphemes, mastodonLength, blueskyFacets, markdownToHtml, blogParts, serverUrl,
  ghostToken, postBluesky, postMastodon, postGhost, postWordPress, preparePost, hashKey, stripFrontmatter,
};
