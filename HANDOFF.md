# Handoff — Merelleyne site

_Last updated: 2026-11-23. Talk to the user in Russian, simply; site UI stays English. Project rules: see CLAUDE.md._

## Where things stand
- **Live:** https://merelleyneqt-sys.github.io/merelleyne/ (GitHub Pages, `gh-pages` branch, built from `dist/`).
- **Repo:** github.com/merelleyneqt-sys/merelleyne (public; user approved). `gh` is logged in as `merelleyneqt-sys` (token scopes: repo, gist, read:org — **no `workflow`**, so no GitHub Actions; deploy runs from this Mac via `scripts/deploy.sh`).
- **Admin:** local only — double-click `Admin.command` → http://localhost:8765/admin/. Publish = commit + push main + deploy.

## Earlier items (now published)
- **Contact window clipboard hint** (`app.js`, `style.css`, `index.html` → `?v=6`): under the Telegram/Instagram/Email buttons a muted line now always says
  "Telegram & Instagram: the message is copied automatically on click — just paste it into the chat".
  After a click it briefly turns red: "Message copied — paste it into the chat (⌘V / long-press → Paste)", then returns to the hint.
  - Committed locally, **not pushed, not deployed**. Not checked visually yet (browser pane was blocked, see below).
  - To ship: check it in the browser, then `git push && bash scripts/deploy.sh` (or press Publish in the admin).
- **Contact window: title "Get in touch" removed** (`?v=7`). Top now shows a small "Selected · N" label and a scrollable list (max ~4 rows visible) of selected tracks — serif title, key/BPM, red left marker, ✕ to deselect (updates the message). Empty state: "Pick tracks with + to list them here".
  - Committed locally, **not pushed/deployed, not visually checked** (pane blocked; headless Brave screenshot hung).
- **+20 random test tracks** (now 30). Picked from the drive's `*other files*.zip` archives, one file per project (prefer TAG → `Merelleyne - Title (Key_BPM).mp3` → master WAV), converted to 160k MP3. Key/BPM filled where the file/folder name had it; 12 tracks have no key/BPM (fill in admin).
  - ⚠ **Only ATLAS is tagged — the other 19 are full untagged versions.** Ask the user before publishing them online (anyone could download them). Audio folder is now ~125 MB.
- Fixed admin bug: saving a track with empty BPM crashed (`int(None)` in `serve.py write_tracks`).
- `HANDOFF.md` itself is also only local.

## Published 2026-11-22 (user: "publish as is", incl. the 19 untagged tracks)
- **EN/RU switch** top-right (`EN / RU`, red dot on active). All texts in `i18n.js` (`en`/`ru`), Contact message/subject per language in `settings.js` (`{en, ru}` objects). First visit: RU if browser is Russian, else EN; choice saved. Oranienbaum and IBM Plex Mono both have Cyrillic (checked).
- **Name → Links window**: click MERELLEYNE → Instagram, Telegram, YouTube (@merelleynehq), Email. SoundCloud/Spotify/TikTok slots in `settings.js` are empty (hidden) — ask the user for links if they have them.
- **Rows: title only** (duration removed too). **Player: "Title (Key · BPM)"** in brackets on the right.
- **Row play button removed** (user changed mind about a download button there): only + remains; row click plays; download stays in the right-click menu.
- **Search** above the list (fixed width), left: underline input with magnifier, "N found", "Nothing found", ✕ to clear, `/` focuses it, Esc clears. Prev/next/shuffle follow the filtered list. `ё` = `е`.
- **Rows show only duration** (key/BPM removed from the list; still in player, contact list and message).
- **Right-click menu** on a track (long-press on phones): Play/Pause, Add/Remove selection, **Download tagged MP3 — Free** (downloads `audio/<file>` as `Merelleyne - Title (tagged).mp3`), Copy link (`site/#<file-slug>` → page scrolls to the track and loads it in the player, no autoplay). Toast "Link copied".
  - ⚠ The free download gives whatever is in `audio/` — for the 19 untagged test tracks that is the **full untagged version**.

## 2026-11-23: volumes + sections + BPM/Key/Genre switches + New label (`?v=21`) — published 2026-11-23
- Vol. switch and Arrangements / Software / Sample packs menu, see CLAUDE.md. Software and sample packs are empty: waiting for the user's items (name, link).
- Not tested: real long-press on a phone.

- Auto BPM/key detection in the admin: done, see CLAUDE.md. Guessed BPM accepted at the user's request; 19 or so guessed keys still await confirmation. Auto genre (user: unsure → "Alternative") waits for the user's OK to download larger_clap_music (776 MB) + PyTorch.
- Possibly wrong labels to check with the user: Velvet Skies says 116, analysis hears 106; Radiant Abyss 125 vs 123; Arcane Bm vs B.

## Future feature — "Sold" tracks (user request, NOT started; do after hosting is settled)
- From the admin page (or, later, a "playlist edit mode" on his own profile page) the user can **mark a track as sold**.
- On the public site a sold track's **+ (add to selection / "cart") button turns grey and inactive**. Clicking it shows a message that **this track is already sold** (EN + RU texts in `i18n.js`, e.g. "This track is already sold" / "Этот трек уже продан").
- The track stays in the list and can still be played (assumption — confirm with the user). A sold track can't be in the selection: drop it from saved selections on load.
- Implementation idea with today's setup: `"sold": true` in `tracks.json` → admin row gets a "Sold" toggle → Publish. A real online "edit mode" on a profile page would need login + a backend (today the admin is local-only by the user's choice) — discuss when we get there.
- Also hide/disable "Download tagged MP3" for sold tracks? Ask the user.

## Known issues / gotchas
- If the user tests Telegram/Instagram buttons in the built-in Browser pane, the opened popup blocks the pane until the user closes it.
- A stale terminal tab "GitHub login" (c1) is still open; the user typed in it, so only the user can close it.
- External drive `/Volumes/HARD-DRIVE_1TB` (source beats) was **disconnected** at last check.
- Safari caches hard → always bump `?v=` in `index.html` when css/js change.
- Telegram `t.me/<user>?text=` prefill is not guaranteed; that's why the message is copied to the clipboard first. Instagram (`ig.me/m/<user>`) can't prefill at all. Email uses mailto with body (works).

## Open ideas / decisions for the user (not started)
- **Payments:** currently none — buyers select tracks and contact via TG/IG/Email. Discussed: no buyer registration; possible checkout services (Gumroad / Lemon Squeezy / Payhip, or Russian services if payouts must go to a Russian bank). Depends on where the user receives money — unanswered.
- **License tiers** (MP3 / WAV / WAV + stems at different prices) — suggested, not decided.
- **Custom domain** (e.g. merelleyne.com) instead of github.io — mentioned, not decided.
- Vinyl filter slightly mutes the cover's red — offered to make it brighter, no answer.
- Vinyl spin speed is 40s/turn (user asked "same as now"); offered real 33 rpm, no answer.

## Done so far (short)
Playlist page (vinyl cover with user's skull art, rows with play + select, hover feedback), bottom player (now playing, shuffle/prev/play/next/repeat, seek, volume), contact window with prepared message, no prices/numbers/footer, local admin with upload/convert/edit/reorder/delete/publish, GitHub Pages hosting.
