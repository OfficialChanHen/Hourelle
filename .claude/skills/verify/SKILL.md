---
name: verify
description: How to drive and screenshot this app end-to-end (Next.js client-side, localStorage data, headless Chromium on WSL2 without sudo)
---

# Verifying Hourelle changes in a real browser

The app is fully client-side (localStorage, no backend). `curl` only proves the page compiles; real verification needs a browser.

## One-time setup that already exists on this machine

- Chromium headless shell: `~/.cache/ms-playwright/chromium_headless_shell-*` (installed via `npx playwright install chromium --only-shell`)
- Missing system libs (no sudo on this WSL2 box): already extracted to `~/.cache/aline-verify-libs/` (libnspr4, libnss3, libasound2, from `apt-get download` + `dpkg -x` — no root needed)

## Recipe

1. Dev server runs on `http://localhost:3000` (`npm run dev`). Keep it running; restart it if you kill it for a check.
2. In a scratch dir: `npm init -y && npm i playwright` (playwright npm package is not in the project and should stay out of it).
3. Run drive scripts with the local libs:
   ```bash
   LD_LIBRARY_PATH=~/.cache/aline-verify-libs node drive.js
   ```
4. Seed test data through `context.addInitScript` — write an `AppEvent[]` JSON array to localStorage key `hourelle.events.v1` (shape in `src/lib/events.ts`). The init script re-runs on every navigation, so state resets per page load. Useful fields for edge states: `rsvp: 'pending'`, `status: 'confirmed'` + `confirmed: { dayKey, startMin, endMin, placeIds }` (clock minutes), `availIv` (grid minutes from `times[0]`).
   Also set `hourelle.hint.location = '1'` to suppress the one-time hint.
5. The built-in demo event is at `/events/q3-offsite`; tabs via `?tab=availability|location|attendance|details`.
6. Clipboard checks: `newContext({ permissions: ['clipboard-read', 'clipboard-write'] })` works in the headless shell.
7. Dark theme: `addInitScript(() => localStorage.setItem('theme', 'dark'))` (next-themes). Mobile: 390px viewport.
8. Active tab assert: `button[data-active="true"]` in the event-detail tab bar.

## Gotchas

- `page.on('pageerror')` + console-error logging catches client crashes that still return HTTP 200.
- Demo events are never persisted by `patchEvent`; panels keep edits in local state, so in-memory changes vanish on tab switch. Seed a non-demo event to test persistence.
