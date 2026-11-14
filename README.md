# Post Picker

Start a blog or social post with one button, and pick at the top of the note which channel it is for and which platforms it goes to.

## Features

- **New post**: one button (ribbon or command) makes a dated note in the channel's "new posts" folder and opens it.
- **A bar at the top of every post note**, above its properties:
  - **Channel**: one row of chips, one per channel. Tapping another channel writes it into the note, drops the platforms that channel does not have, and moves the note into that channel's folder at the same status (for example from `Garden/2 Ready/` to `Studio/2 Ready/`).
  - **Goes to**: the platforms that channel posts to, as brand icons. Tap one to add or leave it out. **All** and **None** set them all at once. A platform in the note that the channel does not have shows with a dashed red ring, so nothing is hidden; tap it to remove it.
  - A short summary, such as "Everywhere Garden posts (4)" or "example.com, Bluesky".
  - **Publish** (optional): a button for each place you have added account details for and picked in this note. See below.
- **Channels** each have a name, a folder, a website and their own list of platforms: website blog, X, Threads, Bluesky, Mastodon, LinkedIn, Facebook, Instagram, TikTok, YouTube, Pinterest and Reddit.
- **Publishing, only when you ask**, to the platforms that have a free API you can use with your own account:
  - **Bluesky**: posts at once, publicly. Up to 300 characters (graphemes). Links and hashtags are made clickable.
  - **Mastodon**: posts at once, with the visibility you chose. Up to 500 characters by default (a link counts as 23, as Mastodon counts it).
  - **Ghost** and **WordPress**: sends the post to your blog **as a draft**. Nothing is public until you publish it there.

  Every publish starts with a button press and then a confirm box that shows the exact text (or the exact HTML for a blog) and where it goes. Nothing is sent until you press **Post** or **Send draft** in that box. It never publishes on its own, on a timer or when a note changes. After it works, the post's address and the date are written into the note.

The other platforms (X, Threads, LinkedIn and the rest) are for planning only: the bar records that the post is meant for them, and nothing is sent.

## How to use

1. Copy `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/post-picker/` in your vault and turn it on.
2. In settings, set the **Posts folder** (default `Posts`) and your channels. Each channel's folder sits inside the posts folder.
3. Press **New post** in the ribbon, or run the command **New post**. A note is made in `<posts folder>/<channel folder>/<new posts folder>/` and opened. The channel used last is picked.
4. Write. Use the bar at the top to change the channel and pick the platforms.
5. To publish, add the account details for that channel in settings (see Settings), pick the platform in the bar, then press **Post to Bluesky**, **Post to Mastodon**, or **Send to Ghost / WordPress as a draft** on the bar. Or run the command **Publish the open post**. Check the text in the confirm box, then press **Post**.

The bar shows in Live Preview and Reading view, not in plain source mode, which shows the properties as text.

**Which text is sent.** The note's text without its properties. If the note has a heading named after the place, only the text under it is sent there: `## Bluesky`, `## Mastodon`, and `## Website`, `## Blog`, `## Ghost` or `## WordPress` for a blog. Text under a heading named after any other platform (`## X`, `## LinkedIn`...) is left out of the rest, so a long Mastodon version never goes to Bluesky.

- For Bluesky and Mastodon the text is made plain: `[words](https://link)` becomes `words (https://link)`, `[[Note|alias]]` becomes `alias`, heading marks, `**bold**`, `==highlight==`, comments (`%%...%%`) and embedded files are taken out.
- For a blog the text becomes simple HTML: headings, paragraphs, lists, quotes, code, links, web images, bold, italic and struck text. Links that are not `http`, `https` or `mailto` become plain text. The title is the note's `title` property, else its first `#` heading (taken out of the body), else the file name.

A post that is empty or too long shows the reason in the confirm box, with no Post button.

## Importing

Nothing to import. Post Picker works on the notes you make with it, or on any note you put in a channel's folder.

## Settings

- **Posts folder**: each channel has its own folder in here. Default `Posts`. If you leave it empty, a note counts as a post only when it is in a channel's folder or its channel property names a channel, so the bar does not appear on every note in the vault.
- **New posts go in**: a folder inside the channel's folder for new posts. Default `0 New`. Empty: the channel's folder itself.
- **New post name**: a date pattern ([moment.js format](https://momentjs.com/docs/#/displaying/format/)). Text in square brackets stays as written. Default `YYYY-MM-DD HHmm [post]`. Characters a file name cannot hold, such as `:` or `/`, become `-`. A name already used gets ` 2`, ` 3` and so on.
- **Channel property** and **Platforms property**: the property names written into the note. Defaults `channel` and `platforms`. Read without regard to case.
- **Show the bar on post notes**: on by default.
- **Channels**: for each, a name, a folder (inside the posts folder), a website (shown on the website toggle, such as `example.com`) and the platforms it posts to. Channel folders can nest; the deepest one that holds a note wins.
- **Publishing, per channel** (all optional, shown only for the platforms the channel has):
  - **Bluesky handle**, **Bluesky app password** and **Bluesky server** (default `https://bsky.social`; change it only if your account is on another server). Make an app password in Bluesky under Settings, Privacy and security, App passwords.
  - **Mastodon server** (such as `mastodon.social`), **Mastodon access token**, **Mastodon visibility** (public, quiet public or followers only) and **Mastodon character limit** (default 500). Make a token in Mastodon under Preferences, Development, New application, with only the `write:statuses` scope.
  - **Website publishing**: Off, Ghost or WordPress, and the **Site address**. For Ghost, the **Ghost Admin API key** (`id:secret`, from Ghost's Settings, Integrations, Add custom integration). For WordPress, your **WordPress username** and an **application password** (Users, Profile, Application passwords).

Addresses must start with `https://` (added for you when you leave it out). Plain `http://` is refused, so a password is never sent in the clear, except to `localhost` for a blog running on your own computer.

## Note format

A new post:

```yaml
---
channel: Garden
platforms: []
---
```

After picking platforms and publishing to Bluesky and Ghost:

```yaml
---
channel: Garden
platforms: [site, bluesky, mastodon]
bluesky_url: https://bsky.app/profile/name.bsky.social/post/3kxyz
bluesky_date: 2026-11-13T15:30
ghost_url: https://example.com/p/1b2c3d/
ghost_date: 2026-11-13T15:32
---
```

- `channel`: the channel's name. Read before the folder: if the note names a channel, that is its channel, wherever it sits.
- `platforms`: a list of `site`, `x`, `threads`, `bluesky`, `mastodon`, `linkedin`, `facebook`, `instagram`, `tiktok`, `youtube`, `pinterest`, `reddit`. A comma-separated text (`x, bluesky`) is read too. Unknown words are ignored and dropped on the next change.
- `<place>_url` and `<place>_date`, where place is `bluesky`, `mastodon`, `ghost` or `wordpress`: written after a publish works. For Ghost and WordPress it is the draft's address. The bar then shows "Posted" with the date and a link, and the button reads "... again". Pressing it again warns that it makes a second copy.

Nothing else in the note is changed.

## Network use

**Nothing is sent until you press Post or Send draft in a confirm box.** Making posts, the bar, picking channels and platforms, and opening settings never go online. There is no tracking, no analytics and no update check. All requests use the app's own `requestUrl`.

When you do publish, it contacts only the server you set for that channel, and sends only what the confirm box showed:

### Bluesky

- Host: your Bluesky server, `https://bsky.social` unless you changed it.
- `POST /xrpc/com.atproto.server.createSession` with your handle and app password. The session token it returns is used once and not saved.
- `POST /xrpc/com.atproto.repo.createRecord` with the token, your account id, the collection `app.bsky.feed.post`, and the record: the text, the time, and link and hashtag positions.
- The post is public at once. Its address (`https://bsky.app/profile/<handle>/post/<id>`) is built from the answer; `bsky.app` is not contacted.

### Mastodon

- Host: the Mastodon server you set, such as `https://mastodon.social`.
- `POST /api/v1/statuses` with your access token, the text, the visibility, and an `Idempotency-Key` made from the note's path and text, so a retry after a lost answer does not post twice.

### Ghost

- Host: your Ghost site's address.
- `POST /ghost/api/admin/posts/?source=html` with the title, the HTML and `status: draft`. It signs in with a token made on your device from your Admin API key: a JSON Web Token signed with HS256 (the key's secret never leaves your device), valid for five minutes.

### WordPress

- Host: your WordPress site's address.
- `POST /wp-json/wp/v2/posts` with your username and application password (HTTP Basic), the title, the HTML as content and `status: draft`.

Each service's own terms and privacy policy apply to what you post there.

## Privacy

- **Your account details live in this plugin's `data.json`, inside your vault, at `.obsidian/plugins/post-picker/data.json`, in plain text.** Anyone who can read your vault folder can read them. If you sync your vault or your plugin settings (Obsidian Sync, iCloud, Dropbox, git or anything else), they are copied wherever the vault goes. Don't put that file in a public repository.
- **Use app passwords, never your main password.** Bluesky app passwords, a Mastodon token with only `write:statuses`, a Ghost custom integration key and a WordPress application password can each be revoked on their own without changing your main password. Revoke one if a device or backup is lost.
- Nothing is stored anywhere else, and nothing is sent anywhere except the servers above, when you press Post.
- Your notes stay where they are. Only the notes you publish are read for sending, and only the part shown in the confirm box is sent.

## Mobile support

Works on desktop, phones and tablets. It uses no Node or Electron APIs. Publishing uses `requestUrl`, and the Ghost token is signed with the Web Crypto API (`crypto.subtle`), which the mobile apps have. Grapheme counting for Bluesky uses `Intl.Segmenter` where the device has it, and counts characters otherwise.

## Tests

From this folder:

```
node test/run.js
```

No dependencies. The tests use a stand-in for the app, its vault and the network; no request leaves the computer. They cover the settings, making a post, moving a note between channels, the platform lists, where the bar appears, the text and HTML that are sent, and each publish request (including the Ghost token's header, claims and signature).

The brand icons are from [Simple Icons](https://simpleicons.org) (CC0). The brands themselves are trademarks of their owners.

## Licence

MIT. See `LICENSE`.
