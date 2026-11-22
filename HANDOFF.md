# Handoff — Merelleyne site

_Last updated: 2026-11-22. Talk to the user in Russian, simply; site UI stays English. Project rules: see CLAUDE.md._

## Where things stand
- **Live:** https://merelleyneqt-sys.github.io/merelleyne/ (GitHub Pages, `gh-pages` branch, built from `dist/`).
- **Repo:** github.com/merelleyneqt-sys/merelleyne (public; user approved). `gh` is logged in as `merelleyneqt-sys` (token scopes: repo, gist, read:org — **no `workflow`**, so no GitHub Actions; deploy runs from this Mac via `scripts/deploy.sh`).
- **Admin:** local only — double-click `Admin.command` → http://localhost:8765/admin/. Publish = commit + push main + deploy.

## Not published yet (local only — user said "hold, write it to the handoff")
- **Contact window clipboard hint** (`app.js`, `style.css`, `index.html` → `?v=6`): under the Telegram/Instagram/Email buttons a muted line now always says
  "Telegram & Instagram: the message is copied automatically on click — just paste it into the chat".
  After a click it briefly turns red: "Message copied — paste it into the chat (⌘V / long-press → Paste)", then returns to the hint.
  - Committed locally, **not pushed, not deployed**. Not checked visually yet (browser pane was blocked, see below).
  - To ship: check it in the browser, then `git push && bash scripts/deploy.sh` (or press Publish in the admin).
- **Contact window: title "Get in touch" removed** (`?v=7`). Top now shows a small "Selected · N" label and a scrollable list (max ~4 rows visible) of selected tracks — serif title, key/BPM, red left marker, ✕ to deselect (updates the message). Empty state: "Pick tracks with + to list them here".
  - Committed locally, **not pushed/deployed, not visually checked** (pane blocked; headless Brave screenshot hung).
- `HANDOFF.md` itself is also only local.

## Known issues / gotchas
- The built-in Browser pane is blocked by a leftover **t.me popup** (opened when the user tested the Telegram button). Navigation/JS in the pane refuse until the user closes it. Safari (`open -a Safari <url>`) works meanwhile.
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
