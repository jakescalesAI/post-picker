# Post Picker

Start a blog or social post with one button, pick at the top of the note which channel it is for and which platforms it goes to, and send it to [Zernio](https://zernio.com) to post when you choose.

## Features

- **New post**: one button (ribbon or command) makes a dated note in the channel's "new posts" folder and opens it.
- **A bar at the top of every post note**, above its properties:
  - **Channel**: one row of chips, one per channel. Tapping another channel writes it into the note, drops the platforms that channel does not have, and moves the note into that channel's folder at the same status (for example from `Garden/2 Ready/` to `Studio/2 Ready/`).
  - **Goes to**: the platforms that channel posts to, as brand icons. Tap one to add or leave it out. **All** and **None** set them all at once. A platform in the note that the channel does not have shows with a dashed red ring, so nothing is hidden; tap it to remove it.
  - A short summary, such as "Everywhere Garden posts (4)" or "example.com, Bluesky".
  - **Zernio** (optional): a **Send to Zernio** button once Zernio is set up for the channel. See below.
- **Channels** each have a name, a folder, a website and their own list of platforms: website blog, X, Threads, Bluesky, LinkedIn, Facebook, Instagram, TikTok, YouTube, Pinterest and Reddit.
- **Sending through Zernio, only when you ask.** Zernio posts to the social accounts you connected there. Each channel is linked to one Zernio profile, and a post goes to that profile's account on every platform picked in the note. In the confirm box you choose:
  - **Save as a draft** (the default): the post waits in Zernio. Nothing goes out until you schedule or publish it there.
  - **Schedule**: Zernio posts it at the date and time you pick, in your device's time zone.
  - **Publish now**: Zernio posts it straight away.

  Every send starts with a button press and then a confirm box that shows the exact text for each platform and where it goes. Nothing is sent until you press **Send draft**, **Schedule** or **Publish now** in that box. It never sends on its own, on a timer or when a note changes. Afterwards the Zernio post id and its status are written into the note.

The website toggle is for planning: it records that the post is meant for the channel's site, and nothing is sent for it.

## How to use

1. Copy `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/post-picker/` in your vault and turn it on.
2. In settings, set the **Posts folder** (default `Posts`) and your channels. Each channel's folder sits inside the posts folder.
3. Press **New post** in the ribbon, or run the command **New post**. A note is made in `<posts folder>/<channel folder>/<new posts folder>/` and opened. The channel used last is picked.
4. Write. Use the bar at the top to change the channel and pick the platforms.
5. To send it (optional): set up Zernio once (see Settings), then press **Send to Zernio** on the bar, or run the command **Send the open post to Zernio**. Check the text, choose draft, schedule or publish now, and press the button.

The bar shows in Live Preview and Reading view, not in plain source mode, which shows the properties as text.

**Which text is sent.** The note's text without its properties, made plain: `[words](https://link)` becomes `words (https://link)`, `[[Note|alias]]` becomes `alias`, and heading marks, `**bold**`, `==highlight==`, comments (`%%...%%`) and embedded files are taken out. If the note has a heading named after a platform, only the text under it goes to that platform: `## X`, `## LinkedIn`, `## Bluesky` and so on. Text under any platform's heading is left out of the others, so a long LinkedIn version never goes to X. Platforms that get the same text are sent as one Zernio post.

A post that is empty, or too long for a platform (X 280, Bluesky 300, Threads 500, LinkedIn 3000 characters, and so on), shows the reason in the confirm box, with no send button.

## Importing

Nothing to import. Post Picker works on the notes you make with it, or on any note you put in a channel's folder.

## Settings

- **Posts folder**: each channel has its own folder in here. Default `Posts`. A note in it gets the bar only when it is marked as a post: it has the channel or platforms property (every post made with **New post** has both), or it sits in a channel's new posts folder, where drafts start. Other notes kept in these folders, such as a finished piece of writing with no properties, stay plain notes. If you leave the posts folder empty, a note counts as a post when it is marked like this inside a channel's folder, or when its channel property names a channel.
- **New posts go in**: a folder inside the channel's folder for new posts. Default `0 New`. Empty: the channel's folder itself.
- **New post name**: a date pattern ([moment.js format](https://momentjs.com/docs/#/displaying/format/)). Text in square brackets stays as written. Default `YYYY-MM-DD HHmm [post]`. Characters a file name cannot hold, such as `:` or `/`, become `-`. A name already used gets ` 2`, ` 3` and so on.
- **Channel property** and **Platforms property**: the property names written into the note. Defaults `channel` and `platforms`. Read without regard to case.
- **Show the bar on post notes**: on by default.
- **Sending with Zernio** (optional):
  - **Zernio API key**: make one in Zernio under API keys (it starts with `sk_`). Pick or add it here with the keychain picker. The key is kept in your device's keychain (Settings, Keychain), never in the plugin's files.
  - **Check key and load profiles**: fetches your Zernio profiles, so each channel can pick one.
- **Channels**: for each, a name, a folder (inside the posts folder), a website (shown on the website toggle, such as `example.com`), the platforms it posts to (tap the chips), and its **Zernio profile**. Channel folders can nest; the deepest one that holds a note wins.

## Note format

A new post:

```yaml
---
channel: Garden
platforms: []
---
```

After picking platforms and sending to Zernio as a draft:

```yaml
---
channel: Garden
platforms: [x, threads, bluesky]
zernio_id: 65f1c0a9e2b5af0012ab34cd
zernio_status: draft
zernio_date: 2026-11-13T15:30
---
```

- `channel`: the channel's name. Read before the folder: if the note names a channel, that is its channel, wherever it sits.
- `platforms`: a list of `site`, `x`, `threads`, `bluesky`, `linkedin`, `facebook`, `instagram`, `tiktok`, `youtube`, `pinterest`, `reddit`. A comma-separated text (`x, bluesky`) is read too. Unknown words are ignored and dropped on the next change.
- `zernio_id`: the Zernio post id, or several separated by commas when platforms got different text. `zernio_status`: `draft`, `scheduled` or `published` as Zernio answered. `zernio_date`: when it was sent. `zernio_scheduled`: the time a scheduled post goes out.
- `<platform>_url`, such as `bluesky_url`: the post's address, written when Zernio published at once and sent it back.

The bar then shows "In Zernio" with the status, and the button reads "Send to Zernio again". Pressing it again warns that it makes a second post there. Nothing else in the note is changed.

## Network use

**Nothing is sent until you press Check key and load profiles in settings, or the send button in a confirm box.** Making posts, the bar, picking channels and platforms, and opening settings never go online. There is no tracking, no analytics and no update check. All requests use the app's own `requestUrl`.

It contacts only Zernio's API, `https://zernio.com/api/v1`, with your API key in the `Authorization` header:

- `GET /profiles`: when you press **Check key and load profiles**. Answers with your profiles' names and ids.
- `GET /accounts?profileId=...`: when you send, to find the channel's profile's account on each platform.
- `POST /posts`: when you send, one request per distinct text, with the text, the platform and account ids, and either nothing (a draft), a `scheduledFor` time and your time zone, or `publishNow`. Each carries an `Idempotency-Key` made from the note's path, the choice and the text, so pressing twice or a retry after a lost answer does not make two posts.

Zernio's own terms and privacy policy apply to what you send, and each platform's apply to what Zernio posts there.

## Privacy

- **Your Zernio API key is never in the plugin's files.** It lives in your device's keychain (Settings, Keychain), which Obsidian encrypts with your operating system's secure storage. The plugin's `data.json` keeps only the keychain entry's name, your Zernio profiles' names and ids, and which profile each channel uses. If you sync your vault, the key does not travel with it: add it to the keychain on each device that should send.
- Settings from older versions that held account passwords or tokens are not read any more, and they are removed from `data.json` the next time the settings are saved.
- Revoke the key in Zernio if a device is lost.
- Only the notes you send are read for sending, and only the text shown in the confirm box is sent.

## Mobile support

Works on desktop, phones and tablets. It uses no Node or Electron APIs. Sending uses `requestUrl`. The keychain needs Obsidian 1.11.4 or newer. Character counting uses `Intl.Segmenter` where the device has it, and counts characters otherwise.

## Tests

From this folder:

```
node test/run.js
```

No dependencies. The tests use a stand-in for the app, its vault, its keychain and the network; no request leaves the computer. They cover the settings, making a post, moving a note between channels, the platform lists, where the bar appears, the text that is sent, and every Zernio request: the key from the keychain, drafts, schedules, publishing now, and refusals.

The brand icons are from [Simple Icons](https://simpleicons.org) (CC0). The brands themselves are trademarks of their owners.

## Licence

MIT. See `LICENSE`.
