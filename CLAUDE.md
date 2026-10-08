# Hourelle — project context for Claude Code

## What this is
Hourelle is a modern replacement for when2meet.com. It handles the full lifecycle of event coordination: scheduling via an availability grid, collaborative location voting on a map, itinerary building for multi-stop events, real-time chat per event, and attendance tracking (multi-stop itinerary **and** single-venue). Both authenticated users and guests (via share link) can participate.

**What it is for:** a better when2meet. The point is finding when busy people can meet, online or in person; places, attendance and budget are secondary. Keep every screen quick and simple, and lead with the time question (your times, the best time so far, who is still missing, the locked time) before anything else.

### Visual direction — the editorial system, designed past its first draft
The design is **warmer editorial**: warm paper / warm-charcoal surfaces, a single lively green signature accent, a serif display with a few italic accent words over a grotesk body, hairline rules, soft rounded shapes (pill buttons and chips), restrained shadows, generous whitespace, and one coral role colour for moments — shipped in two equally-finished themes (light + dark). The audience is busy people planning with a group (friends, clubs, strangers at an open event), so it should read friendly and a little fun, never like an office meeting tool. The fun comes from the faces, the italic accents, the rounder shapes and small moments, not from poster layouts: no big titles over full-bleed art (we are not Partiful). The references for this pass are `docs/design/Combined.dc.html` and `docs/design/Faces.dc.html` (look, not markup). The HTML reference files in `public/examples/` were the **early iteration** of this design, not a 1:1 target — the built app is expected to exceed them:
- `Gatherly Editorial.dc.html` — early full desktop app, light + dark
- `Gatherly Mobile.dc.html` — early mobile version (bottom tab bar, status bar)
- `Premium Directions.dc.html` — the side-by-side exploration the editorial direction (option 1a) came from

Treat the editorial system below (tokens, type, spacing, color roles) as the source of truth. Use the artifacts for their voice and vocabulary, then make premium judgment calls beyond them — when a mock detail and a better common web practice conflict, prefer the better practice and keep the editorial voice. Intentional departures already shipped include color-coded section kickers, the unified popover kit, the avatar account menu, liquid-glass mobile chrome, and the event header's open stat strip.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 App Router | Server components for data, client for interactive UI |
| Language | TypeScript | Strict mode on |
| Styling | Tailwind CSS | Use design tokens below, not arbitrary values |
| Database | Supabase (Postgres) | Row-level security on all tables |
| Realtime | Supabase Realtime | Chat messages, availability updates live |
| Auth | NextAuth.js | Google + email providers; guest sessions via JWT |
| Map | Leaflet.js + leaflet-geosearch | OpenStreetMap tiles, no API key needed |
| 3D | @react-three/fiber + @react-three/drei | React Three Fiber for any 3D elements (globe viz, premium onboarding, decorative 3D); use sparingly and only where 3D genuinely adds value |
| Animations | GSAP + @gsap/react | All non-trivial animations — drawer slides, grid drag feedback, lifecycle fills, route transitions, pin animations. Do NOT use CSS transitions for anything complex. |
| Email | Resend | Event reminders at T-7d, T-1d, T-morning |
| Cron | Vercel Cron Jobs | Triggers reminder sends |
| Calendar sync | Google Calendar API + Microsoft Graph API | Read-only free/busy queries |
| Deployment | Vercel | Edge functions for API routes |
| Tests | Vitest | `npm test`; unit tests for the pure logic in `src/lib` live in `src/lib/__tests__` (fixtures in `test/`). Add or update one with every change to counting, availability, polls, import or calendar-file logic |

### GSAP usage rules
- Import via `import { gsap } from 'gsap'` and `import { useGSAP } from '@gsap/react'`
- Always use `useGSAP()` hook inside React components — never call `gsap.to()` directly outside a hook or effect
- Register plugins at module level: `gsap.registerPlugin(ScrollTrigger, Flip)`
- Clean up via the `context` returned from `useGSAP` — GSAP cleans up automatically when the hook's scope unmounts
- Key animated elements: chat drawer slide-in/out, availability cell selection rubber-band, event lifecycle progress bar fill, map pin click pulse, card hover lift, modal enter/exit, route transitions, notification toasts

### Three.js / React Three Fiber usage rules
- Only reach for R3F when 3D genuinely improves the experience — not as decoration
- Wrap all R3F canvases in a `<Suspense>` with a flat 2D fallback
- Use `@react-three/drei` helpers: `OrbitControls`, `Html`, `useGLTF`, `Environment`
- Keep canvas pixel ratio capped at 2: `<Canvas dpr={[1, 2]}>`
- Potential use cases: interactive 3D globe for the location map, animated event card flip on confirmation, premium onboarding sequence

---

## Design system

### Themes — CSS variables (drive everything from these)

Two themes, switched via `data-theme` on the root element. Map Tailwind semantic tokens to these CSS custom properties; never hardcode hex in components. Light (warm neutral) is the default; dark (warm charcoal) is equally finished.

The paper is warm: a cream page and near-white cards with a trace of yellow, calm enough to sit beside a calendar. The green is livelier than the first editorial pass (which read as a bank), and coral carries the moments. `src/app/globals.css` is the source of truth; the house values are:

```css
/* Light — warm paper (default) */
:root {
  --bg:#FAF6EF; --s0:#FCF9F4; --s1:#FFFDF9; --s2:#F3EDE3; --s3:#EAE2D5;
  --border:#EAE2D5; --border2:#D6CCBC;
  --text:#1F1B16; --dim:#655D52; --faint:#6B6358;
  --accent:#2E6B4E; --accent-text:#23543D; --accent-bg:#E4F0E7; --accent-border:#C3DCCB; --on-accent:#FFFDF9;
  --teal:#3F6B55; --teal-text:#31523F; --teal-bg:#E7EFE9; --teal-border:#C6DACC;     /* going / confirmed / full */
  --ochre:#8F6A33; --ochre-text:#72521F; --ochre-bg:#F5ECDC; --ochre-border:#E6D6BA; /* planning / partial / caution */
  --brick:#9C4A46; --brick-text:#823C39; --brick-bg:#F5E3E0; --brick-border:#E8CAC5; /* absent / conflict / not-going */
  --moment:#C4603F; --moment-text:#A0452A; --moment-bg:#FBE8DF; --moment-border:#F1C9B8; /* your turn / up next / it's on */
  --shadow:0 1px 2px rgba(60,40,20,.05), 0 12px 32px rgba(60,40,20,.07);
}
/* Dark — warm charcoal */
[data-theme="dark"] {
  --bg:#171512; --s0:#1C1A16; --s1:#211E1A; --s2:#292520; --s3:#332F28;
  --border:rgba(245,236,220,.10); --border2:rgba(245,236,220,.19);
  --text:#F1ECE4; --dim:#B0A99D; --faint:#938C80;
  --accent:#2F7A56; --accent-text:#9FDCBC; --accent-bg:rgba(111,196,152,.15); --accent-border:rgba(111,196,152,.38); --on-accent:#FFFDF9;
  --teal:#5B9A7C; --teal-text:#9BD2B7; --teal-bg:rgba(111,181,151,.14); --teal-border:rgba(111,181,151,.36);
  --ochre:#BD9A5E; --ochre-text:#E1C48F; --ochre-bg:rgba(200,165,100,.15); --ochre-border:rgba(200,165,100,.38);
  --brick:#C57F78; --brick-text:#E5ACA6; --brick-bg:rgba(205,138,130,.14); --brick-border:rgba(205,138,130,.36);
  --moment:#E08868; --moment-text:#F4B8A0; --moment-bg:rgba(224,136,104,.15); --moment-border:rgba(224,136,104,.40);
  --shadow:0 1px 2px rgba(0,0,0,.5), 0 14px 36px rgba(0,0,0,.45);
}
```

Every text/background pair clears WCAG AA (4.5:1), the accent clears 3:1 against the page, and `--on-accent` clears 4.5:1 on the accent, in every palette and theme. Check with `python3 docs/verify/contrast.py` from the repo root (it reads `src/app/globals.css`); keep FAILURES at 0 before changing a token.

**Appearances.** Five, and only five, each with a job. The house warm neutral (no `data-palette`); **Studio** (`data-palette="studio"`), cool neutral with ink as the accent and the grotesk as the display face; **Daylight** (`data-palette="daylight"`), bright white and a clear blue; **Breeze** (`data-palette="breeze"`), sunny warm white, a sea-teal accent, coral moments and sandy shapes, a brighter, sunnier look for people who find the house paper too muted (its heat ramp stays green); **High contrast** (`data-palette="contrast"`) for glare and low vision. A new one is added to `globals.css`, the picker (`AppearancePicker.tsx`), the pre-paint list in `app/layout.tsx` and `docs/verify/contrast.py`. Each redefines the whole token set in `globals.css` (the `--moment` role included), and `data-theme` still picks light or dark inside it. Never add a novelty palette; a new one has to earn a job none of these does.

```ts
// src/lib/colors.ts — person avatar colors: warm & muted, decorative identity ONLY.
// Light bg + dark text so the chip reads on both themes. Never reuse for semantic meaning.
export const personColors: Record<string, { bg: string; text: string }> = {
  sage:  { bg: '#D6E4D6', text: '#2E4A3C' }, clay:  { bg: '#ECD9CE', text: '#6B3F2A' },
  wheat: { bg: '#EFE4C9', text: '#6E5523' }, stone: { bg: '#E2DED3', text: '#4A463C' },
  rose:  { bg: '#EAD6D3', text: '#6E3B38' }, sky:   { bg: '#D6E1EA', text: '#2C4A5C' },
  plum:  { bg: '#E1D8E4', text: '#4A2F52' }, fern:  { bg: '#DCE6D2', text: '#3A5223' },
}
```

Person colours now live as CSS variables (`--person-<key>-bg` / `-fg`, per theme and palette) in `globals.css`; components read them through `personVar()` from `src/lib/colors.ts` and never hardcode person hex.

**Color role rules — never break these:**
- `--accent` (green): the single signature color — every CTA, link, active/selected state, focus ring, the **pencil underline under the selected tab**, primary buttons, and urgency date pills (≤14 days). Exactly one accent; never add a second brand hue.
- `--moment` (coral): a role colour, not a brand accent. For moments that ask for you now: "Your turn" chips and strips (your reply or your times are missing), the Home **Up next** eyebrow, and the share-first card (border + "Your turn" kicker). Never for good news: it sits close enough to brick that a celebration in coral reads as an error. Use `text-moment-text` on `bg-moment-bg` with `border-moment-border`; the solid `bg-moment` is for small icons and dots only. Never a button, link, selected state or focus ring (those stay `--accent`), and keep it rare: one coral thing per screen is the norm.
- `--teal`: confirmed / going / success / full-attendance, including the **It's on** celebration when a plan locks in (`JustLocked.tsx`); the availability heat-map ramp.
- `--ochre`: planning / partial-attendance / caution; "arrives late / leaves early".
- `--brick`: absent / conflict / danger / not-going / declined.
- Person-avatar colors: purely decorative identity — never reuse for semantic meaning.
- **Retired palette — never use again:** blue `#2563EB`, teal `#0D9488`, sienna `#B45309`, rose `#E11D48`, the older `#16A34A` / `#D97706` / `#DC2626`, and the first editorial deep green accent `#2E4A3C` / `#437B5B` (it lives on only as the full step of the heat ramp). The lively accent green + warm paper + ochre/brick/coral replace them all.

### Availability heat map — green ramp (5 steps)
```
None:  var(--s1)   — no overlap (the card colour, so it never looks like your clay marks)
Low:   #EBF0EC     — 1–2 people free
Mid:   #D0DFD4     — 3–4 people
High:  #9FBBA6     — 5–6 people
Full:  #2E4A3C     — everyone free (cream count text)
```
Your own cells overlay in **warm clay** (never purple):
```
You only:    #F1EBDF     You + some: #E6DCC6     You + many: #D8CBAE   (count text #6A5527)
```
The ramp stays green in every appearance, Studio included: "free" has to read as free whatever the chrome is doing.

### Typography — serif display + grotesk body
- **Display / headlines:** the display serif (Lora: 400 at display sizes, 500 under 28px), tracking `-0.01em`. Page titles, event names, big stat values, the RSVP donut figure. Sizes 24–52px by context — be generous; this carries the editorial feel. Maps to Tailwind `font-serif`.
- **Italic accent words:** a word or two in a serif headline set in italic and the accent ink, through `<Em>` (and `<Wordmark>`) from `src/components/ui/Em.tsx`, which use the `.em-accent` class and the `--em` token (Studio sets it to plain ink). Shipped uses: the wordmark ("Hour" + italic "elle"), the one word in the Home headline ("is *happening*"), the landing headline ("everyone"), and "Your event is *live*". Restraint: never a whole line, never body text, never two in one heading, never on a coloured fill; a new one has to be a real headline moment. No ad-hoc `italic text-accent` styles.
- **Body / UI:** `Instrument Sans` (300–700), base 13–14px; card titles & buttons 13–15px / 600. Maps to `font-sans`. (Geist / Inter / Roboto are retired.)
- **Eyebrow labels:** `text-[10px]`–`text-[11px] font-semibold tracking-[.13em] uppercase text-[--faint]` — above stat values and section starts.
- **Mono:** only raw data (hex, IDs), sparingly.
- Load `Instrument Serif:ital@0;1` + `Instrument Sans:wght@300;400;500;600;700` from Google Fonts; wire into `tailwind.config.ts` as `font-serif` / `font-sans`. **Min rendered text 11px** (12px mobile).

### Spacing — generous (breathing room is a feature)
The redesign deliberately loosened the old dense layout.
- Card padding `p-5`–`p-6` (20–24px); compact list rows `py-3`.
- Page gutters `px-6`–`px-8`; max content width ~1240px.
- Between sections `mt-7`–`mt-9` (28–36px); open stat columns `gap-8` (32px).
- Inner element gaps `gap-2.5`–`gap-3`.

### Border radius & elevation
Rounder than the first editorial pass. The Tailwind radius scale itself is moved in `globals.css` (`@theme`), so the named steps below are the real values:
- `rounded-full` — **every button** (primary, secondary, danger, text buttons with a hover fill), chips, badges, tabs (top nav and event tabs), segmented controls (track and thumb; a track that can wrap uses `rounded-[22px]`), toolbar toggles, and round icon buttons
- `rounded-lg` (10px) — small square controls
- `rounded-xl` (16px) — inner panels, callouts, strips, popovers, toasts
- `rounded-2xl` (20px) — cards, panels, modals, sheets, empty states
- `rounded-3xl` (24px) — hero cards (the Home Up next card, the locked-in card)
- Inputs, selects and textareas stay slightly rounded rectangles (their 9–12px values); a field is not a pill.
- The mobile create FAB is a rounded square (`rounded-[16px]`) tilted `-4deg`, the one playful tilt in the app.
- Borders are **hairlines** (`--border`); shadows are soft and rare (`--shadow`). No glows, no decorative gradients, no left-accent-border cards.

### Scrapbook + soft flow — moments vs decision surfaces (the core rule)
Two layers on top of the editorial system. **Scrapbook touches** (taped, slightly tilted photo frames, sticker faces, sticky notes, small italic serif notes) go **only on moments**: covers, the Home Up next card, the It's on / locked-in moment, empty states. **Decision surfaces stay flat, straight and uncovered**: the availability grid (nothing overlaps or tilts onto it), place voting and the map, who's coming, the create form, chat, and anything you tap to answer. Those may take **soft flow** warmth only: soft organic colour shapes behind a page region, rounded containers, status said as a sentence ("4 of 5 have answered. Fri, Oct 2, 7:00 PM to 9:00 PM CDT works for the most people so far."). Tilts stay at 3deg or less (sticky notes 2deg), and a tilted thing never holds a control that answers in place (a button that only takes you to the task, like a card's "Mark my times", is fine). Scrapbook layers never trap a fixed overlay: a modal opened from inside a `relative isolate` region is portalled to the body.
- Components (`src/components/ui/`): `SoftShapes` (flat blobs behind a region, full width, aria-hidden, parent needs `relative isolate`; hidden in High contrast), `Tape`, `PhotoFrame` (frame + tape + tilt, capped at 3deg, optional GSAP `settle`), `StickyNote` ("Your turn"; held by its glue strip, never a pin), `FaceSticker` (your own face, big, at about -7deg beside the pad, flipping to your initials like every face: the one tilt past 3deg, allowed because the only control it holds is itself; no words), `WavyRule` (masked wave in `--border2`), `FaceRibbon` (sticker faces in a wave, capped at 6 then +N), `Avatar tilt` (sticker contexts only), `StageStepper` (the five stages as words, the current one circled in pencil, finished ones a little dimmer, no dots or ticks; an ordered list with `aria-current="step"`), Home's notes board (`NotesBoard` in home/page.tsx: one sticky note per plan waiting on you, in rows of two, each a little turned, at most five then a "+N more" note; your `FaceSticker` in the spot after the last note, or centred on a row of its own). A note leaves only when its task is done: the board remembers what it held (`hourelle.home.notes`), and a note done elsewhere since the last visit is drawn once more in its spot, ticked Done, then peels up from the bottom and falls off the page (`animations/peel.ts` peelable with `fall`), and the notes after it slide into the gap. On phones Up next is the closest plan as the photo card, lying straight (the tilt is for the side-by-side photos on a large screen), with the next two as compact framed rows (`CompactPlan`) whose faces are tucked behind the row's right edge, leaning out with their eyes showing (one button beside the row that turns all three over to their initials); nothing on Home swipes or pages, `PeekCard tilt` (the face row turns with a tilted frame so faces tuck evenly), `Keepsake` (each Up next card's hand-laid details, worked out from the plan id so a card keeps its look: tape across a corner or an edge, two short strips, a paper clip (its short leg drawn under the card, so it really holds the edge), two pins or album photo corners (dark paper pockets, `--mount`), plus the frame's tilt and border width; neighbours never share a kind; never over the name, stepper, details or buttons, and no pointer). Card controls (arrows, counter, Copy link, Duplicate, Delete or Leave) sit above every card layer.
- Tokens, defined in every theme and palette block: `--shape-a/b/c` (the house hues: sage, soft coral, warm sand; Studio cool greys, Daylight its blues, Breeze sea mist, coral and sand; pale enough that dim and faint text clear 4.5:1 on them), `--tape` and `--tape-2`, `--pin`, `--clip`, `--frame` + `--frame-shadow`, `--sticky` + `--sticky-text` / `--sticky-dim` / `--sticky-kicker` + `--sticky-shadow`. Utilities: `bg-frame`, `bg-tape`, `bg-sticky`, `text-sticky-*`, `shadow-frame`, `shadow-sticky`.
- Where it lives today: Home (greeting line, a headline sentence with one `<Em>` word that follows the plan in front, then only the **three closest plans**: on lg+ the closest as a big taped photo with the next two smaller and loosely placed beside it, on phones the closest as the photo and the next two as compact framed rows; each card leads with the time question (your times, best time so far, who is missing, the locked time) before place and extras, with the plan's name, a `StageStepper`, one button for the next step and, beside it, Copy link (host only), Duplicate and Delete (yours) or Leave (someone else's), named for the plan and going to the plan's delete zone to confirm; every plan waiting on you as a sticky note on the board, spelling out the task; Start a plan as a flat framed form), the plan header (the cover as a large framed photo wearing the plan's card detail, right of the title on a large screen and leading the header on a phone, face ribbon, "Hosted by" note, status sentence, `StageStepper`, Lock it in for hosts above the tabs, soft shapes behind the header only), `JustLocked`, `EmptyState`, and the shelves: Plans (a face ribbon of everyone you are planning with and a sentence, pencil-tab filters, every plan a `StoredEventCard` photo lying straight, with its Keepsake and faces half up over the edge; past plans a little pale), Templates (each one a straight photo with no faces, since nobody is invited to a template; Start blank an empty frame holding your face) and Demos (the same photos, the what-to-look-for line as a caption under each). Shelves lie straight and take their details in turn (`shelfLooks`), so a row shows pins, tape, a clip and photo corners; a host's own pick (`event.keepsake`, set under Style in the wizard and on Details: Auto, Pins, Tape, Two strips, Paper clip, Photo corners or None, one preview for cover and detail) wins everywhere (`withDetail`). The three shelf pages share `ShelfHeader`, whose band is a fixed size. Faces are the focal point wherever there are people. On touch screens `PeekCard` faces rest half up, rise while the card is near the middle of the screen and sink back once it is scrolled well away (two shared IntersectionObservers, a 40% band to rise and a 70% band to sink); every peek face is a button named for the person that flips to their initials and never opens the card.

### Pencil and ink — planning on paper
`src/components/ui/Pencil.tsx` is a small kit of hand-drawn SVG marks: `PencilUnderline`, `PencilCircle`, `PencilStar`, `PencilTick`, `PencilStrike`, `PencilBracket`, `Highlight` (the highlighter swipe) and `PencilArrow`. Inks are tokens: the accent pencil, the coral pencil (`--moment`) for asks, graphite (`--dim`). Every stroke shares one grain filter (`PencilDefs`, mounted once in the root layout); High contrast drops the grain for plain solid lines. Each mark draws itself once with GSAP (`pathLength` 1, dash offset) and is static under `reducedMotion()`. Marks are always `aria-hidden` and never the only way something is said.
- Sized from what they mark, never fixed shapes: an underline spans its word, a circle its box, `Highlight` is a soft, slightly uneven marker shape per line the phrase wraps to, measured from its words, covering each whole word from just above the capitals to just under the baseline and a little past each end (`--highlight`, multiplied on light paper; only ever behind `--text`); every mark is fitted to its measured box in pixels, never a stretched viewBox (a stretched one draws only part of a long stroke), and `PencilArrow` is measured from its note to its target element (layout offsets, so a tilted card does not skew it) and measured again on resize.
- Handwriting (`HandNote.tsx`) is Caveat, loaded only where that file is used, at 17px or more, and only for a short margin note with an arrow: at something you owe ("your times are missing"), or the landing page's one note at its demo button.
- The visitor header and the landing page follow the same rules: pencil tabs, soft shapes behind the hero and the demos, one highlighter in the headline ("the hour"), demo cards as hand-laid photos with Keepsake details and faces; the hero's demo grid stays flat and uncovered.
- Where they go: the selected tab's underline, the current stage's circle, one highlighter per screen (the hero card's time on Home, the best time above the grid on a plan), the margin note on the hero card when you owe something, a star on Your turn notes, a graphite underline under "Start a plan". A handful per screen at most.

### Theme wiring (provider + Tailwind)

**1. `app/globals.css`** — the only place hex lives. Paste both token sets from the Themes block above:
```css
:root { /* …all --bg / --text / --accent / --teal / --ochre / --brick … light values… */ }
[data-theme="dark"] { /* …dark values… */ }
```

**2. `tailwind.config.ts`** — map semantic utilities to the variables so `bg-s1`, `text-dim`, `border-border`, `bg-accent`, `text-on-accent`, `font-serif` resolve per theme automatically:
```ts
import type { Config } from 'tailwindcss'
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: { extend: {
    colors: {
      bg:'var(--bg)', s0:'var(--s0)', s1:'var(--s1)', s2:'var(--s2)', s3:'var(--s3)',
      border:'var(--border)', text:'var(--text)', dim:'var(--dim)', faint:'var(--faint)',
      accent:'var(--accent)', 'on-accent':'var(--on-accent)',
      teal:'var(--teal)', ochre:'var(--ochre)', brick:'var(--brick)',
      // per-role bg/text/border also exposed, e.g. 'teal-bg':'var(--teal-bg)' …
    },
    fontFamily: {
      serif: ['Instrument Serif','serif'],   // display / headlines
      sans:  ['Instrument Sans','system-ui','sans-serif'], // body / UI (default)
    },
  } },
} satisfies Config
```

**3. Provider** — `next-themes`, writing **`data-theme`** (not the default `class`); default **light** (warm neutral):
```tsx
// app/providers.tsx
'use client'
import { ThemeProvider } from 'next-themes'
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} themes={['light','dark']}>
      {children}
    </ThemeProvider>
  )
}
```
```tsx
// app/layout.tsx
<html lang="en" suppressHydrationWarning>
  <body className="bg-bg text-text font-sans antialiased">
    <Providers>{children}</Providers>
  </body>
</html>
```

**4. Toggle** — `const { setTheme, resolvedTheme } = useTheme()` → `setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')`. Both themes are first-class; never read theme during SSR without `suppressHydrationWarning`. Components stay theme-agnostic by only using token utilities (`bg-s1`, `text-dim`, `bg-accent text-on-accent`) — never raw hex.

---

## Routes and pages

```
/                          → Home: Current event hero + lifecycle strip, Your events, Upcoming events
/create                    → Event creation wizard (3 steps: basics → invite → share)
/events                    → My events (full list, filterable)
/events/[id]               → Event detail — tabs: Availability, Location, Attendance, Details
/events/[id]/join          → Guest join flow (stripped down, no auth required)
/auth/signin               → Sign in (Google OAuth + email magic link)
```

### Event detail tab routes
`/events/[id]?tab=availability` (default)
`/events/[id]?tab=location`
`/events/[id]?tab=attendance`
`/events/[id]?tab=details`

**Time first.** Availability is the default tab and the plan's prime spot. **Attendance** is on every plan; while a plan is being decided it reads against the best time (or day) so far and says so in a note at the top, since that can change until the time is locked. **Location** stays, but with no place decided and none suggested it leads with one quiet "Add a place if you need one"; Home and the header then say nothing about place. Home cards carry only time-related extras (new messages, reply-by, deciding-by); budget, spots and the host live on the plan page. A guest goes from the invite to the grid in Edit mine with the grid in view; the tour offer is a small note above the tabs, never a modal.

---

## Data model (Supabase)

```sql
events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  host_id     uuid references auth.users,
  host_name   text not null,
  description text,
  budget_cents integer,
  start_date  date,
  end_date    date,
  status      text default 'planning', -- planning | availability | location | confirmed | complete | cancelled
  timezone    text default 'UTC',
  slug        text unique,
  created_at  timestamptz default now()
)

event_participants (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references events on delete cascade,
  user_id         uuid references auth.users,
  guest_name      text,
  guest_email     text,
  rsvp            text default 'pending',  -- attending | maybe | not_going | pending
  avatar_color    text default 'gray',
  initials        text,
  calendar_connected boolean default false,
  created_at      timestamptz default now()
)

availability_slots (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references events on delete cascade,
  participant_id  uuid references event_participants on delete cascade,
  slot_start      timestamptz not null,
  slot_end        timestamptz not null,
  source          text default 'manual'  -- manual | google_calendar | outlook
)

event_locations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references events on delete cascade,
  name        text not null,
  address     text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  suggested_by uuid references event_participants,
  created_at  timestamptz default now()
)

location_votes (
  id             uuid primary key default gen_random_uuid(),
  location_id    uuid references event_locations on delete cascade,
  participant_id uuid references event_participants on delete cascade,
  unique (location_id, participant_id)
)

itinerary_stops (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references events on delete cascade,
  location_id uuid references event_locations,
  position    integer not null,
  start_time  timestamptz,
  end_time    timestamptz,
  note        text,
  source      text default 'manual',  -- manual | imported_from_votes
  created_at  timestamptz default now()
)

messages (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references events on delete cascade,
  participant_id  uuid references event_participants on delete cascade,
  body            text not null,
  created_at      timestamptz default now()
)

reminder_jobs (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade,
  send_at  timestamptz not null,
  type     text not null,   -- 7d | 1d | morning
  sent     boolean default false
)
```

---

## Component architecture

```
src/
├── app/
│   ├── (auth)/signin/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx                   # Nav shell — [Home|Events|Templates] tabs + [+New event] button + user avatar
│   │   ├── page.tsx                     # Home page
│   │   ├── create/page.tsx
│   │   └── events/
│   │       ├── page.tsx
│   │       └── [id]/
│   │           ├── page.tsx
│   │           ├── join/page.tsx
│   │           └── _components/
│   │               ├── EventHeader.tsx
│   │               ├── InfoStrip.tsx
│   │               ├── TabNav.tsx
│   │               ├── LifecycleProgress.tsx
│   │               ├── availability/
│   │               │   ├── AvailabilityGrid.tsx     # Full 7-day grid, scrollable
│   │               │   ├── GridCell.tsx             # Single cell — heat map + JM dot
│   │               │   ├── TimeHandle.tsx           # Drag handles for sub-slot precision
│   │               │   └── CalendarSync.tsx
│   │               ├── location/
│   │               │   ├── LocationMap.tsx
│   │               │   ├── VotingPanel.tsx
│   │               │   ├── ItineraryPanel.tsx
│   │               │   └── MapPin.tsx
│   │               ├── attendance/
│   │               │   ├── AttendanceModelToggle.tsx   # [Multi-stop itinerary | Single venue]
│   │               │   ├── HeadcountStrip.tsx          # stacked bar per stop / through-the-day
│   │               │   ├── StopCards.tsx                # O(1) per-venue card: bar + capped pile + flag
│   │               │   ├── ExceptionsList.tsx          # itinerary: only people with gaps get a row
│   │               │   └── SingleVenueAttendance.tsx    # RSVP breakdown + grouped roster + Roster/Timeline
│   │               └── chat/
│   │                   └── ChatDrawer.tsx           # GSAP slide-in from right
├── components/
│   ├── ui/
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── AvatarRow.tsx
│   │   ├── StatChip.tsx
│   │   ├── TimezonePill.tsx             # Small PDT/EDT pill — required on every time display
│   │   └── LifecycleProgress.tsx        # 5-dot progress strip
│   └── three/
│       ├── EventGlobe.tsx               # R3F globe for location map (optional premium)
│       └── SceneWrapper.tsx             # Canvas + Suspense wrapper
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   ├── colors.ts
│   ├── types.ts
│   └── availability.ts                  # Overlap calculation, best-slot finder
├── hooks/
│   ├── useAvailability.ts
│   ├── useChat.ts
│   ├── useLocationVotes.ts
│   └── useGridDrag.ts                   # Mouse + touch drag state for availability grid
└── animations/
    ├── drawer.ts                         # GSAP drawer slide timeline
    ├── cell-select.ts                    # GSAP rubber-band cell selection feedback
    └── lifecycle.ts                      # GSAP progress fill timeline
```

---

## Key features — implementation notes

### Availability grid — full spec

**Layout:** Full 7-day grid (Mon–Sun). Weekend columns (Sat, Sun) get muted header treatment. Time column is sticky-left, day headers are sticky-top on scroll. Grid body scrolls vertically covering 6 AM – 11 PM.

**Slot granularity:** 30-min default (handles :00 and :30 boundaries). 15-min option adds :15/:45 — use when event window starts/ends at a non-standard time. Toggle in the grid toolbar: `[15 min | 30 min | 1 hr]`. Time labels: hours bold, :30 medium, :15/:45 light (same 11px size, different color weight).

**Cell states (Edit mine mode):**
```
Empty (no one):       var(--surface-2)
Others free (low):    #EFF9F6
Others free (mid):    #C8EDE6
Others free (high):   #82CFC4
Others free (full):   #0D9488
You only:             #EEEDFE  + JM dot centered
You + some others:    #D8D5F9  + JM dot
You + many others:    #C5C0F2  + JM dot
Weekend (no data):    var(--surface-0) — slightly muted
```

**Interaction hierarchy (fastest to slowest):**
1. Calendar import — auto-populates from Google/Outlook free/busy, zero effort post-setup
2. Click/tap-drag — hold and drag across cells; works in any direction; GSAP rubber-band preview during drag
3. Day header shortcut — tap the checkmark on a day header to select/deselect all slots in that day
4. Preset buttons — Morning / Afternoon / Evening fills standard blocks across current day
5. Individual tap — toggle single cell; fallback only

**Time handles (sub-slot precision):**
After a drag selection, handles appear at the top and bottom edges of the selected block. Dragging a handle moves the selection boundary to any minute, not just slot boundaries. The final cell of a selection can be partially filled — show a solid colored div covering N% of the cell height with a dashed border at the cut point. On mobile, tapping a handle opens a time picker as fallback. GSAP handles the handle snap animation.

**Mobile critical:** Call `event.preventDefault()` inside `touchmove` handler when in Edit mode — otherwise browser scroll intercepts the drag. Never mark cells in View mode scroll.

**Edit vs View modes:** Mode toggle in toolbar `[View | Edit mine]`. In View mode: scroll works normally, cells show full heat map with everyone's avatars. In Edit mode: your cells are foreground (purple), others' availability is subtle context (dots + heat map tint). Prevents accidental marking while browsing.

**Query pattern for overlap:**
```sql
SELECT slot_start, array_agg(participant_id) as free_participants
FROM availability_slots
WHERE event_id = $1
GROUP BY slot_start
ORDER BY slot_start
```

### Location voting + itinerary
- Leaflet map with custom circular pins showing vote count; selected pin shows popup
- Itinerary mode: numbered pins (1→2→3) connected by dashed route line; city vs water-crossing use different dash patterns
- `leaflet-geosearch` for location search (Nominatim, no API key)
- Route optimization on itinerary import: Mapbox Directions API preferred, nearest-neighbor fallback
- Import from votes: seeds the itinerary from top-voted locations sorted by route efficiency, not vote rank
- Re-import warning: if votes change after itinerary is manually edited, surface a "Votes updated" banner — never auto-overwrite

### Attendance — two models behind one tab toggle
The Attendance tab opens on a model toggle: **[Multi-stop itinerary | Single venue]**.

**Multi-stop itinerary** (must scale to many venues × many guests):
- Per-person states full / partial / absent, computed from `availability_slots` JOIN `itinerary_stops`; auto-recomputes when times shift.
- **Headcount strip** — one stacked bar (full/partial) per stop; peak/dip flagged.
- **Per-venue cards are O(1)** — proportion bar + "X of 16 here" + a capped avatar pile (`+N`) + a flag chip ("2 partial" / "1 conflict" / "3 out"); the grid wraps for any number of stops.
- **Exceptions list, not a matrix** — a summary line ("10 of 16 attend all 6 stops") then a row ONLY for people with gaps, chips marking the stops they miss. List length tracks exceptions, not guest count — never render an O(people × stops) grid.
- Conflict alert: flag stops with 2+ absences + suggest a time shift.

**Single venue** (one room, all day — "who is in the room, and when"):
- Always-on **headcount-through-the-day** strip + a **Roster / Timeline** sub-toggle.
- Roster: RSVP breakdown (going / maybe / not-going / no-reply, big serif figure) + roster grouped by *Here the whole time / Arriving late · leaving early / Can't make it / Awaiting reply*.
- Timeline: collapses full-day attendees into one bar, gives an individual row only to people whose timing differs — stays compact as the guest list grows.

Entry points unchanged: stop-card attendance row, conflict badge, summary-bar link, dedicated tab.

### Event lifecycle — 5 stages
Tracked on `events.status`. Shown as a 5-dot progress strip (GSAP fill animation on stage change):
1. `planning` → Invitations sent
2. `availability` → Collecting availability
3. `location` → Voting in progress
4. `confirmed` → Time + location locked (animated fill on confirmation)
5. `complete` → Event happened

### Chat drawer
- Supabase Realtime on `messages` filtered by `event_id`
- GSAP slide-in from right (264px wide), dims calendar with rgba(0,0,0,0.16) backdrop
- Backdrop and drawer animate together as a timeline: `tl.to(backdrop, {opacity:1}).to(drawer, {x:0}, '<')`
- Toggled by chat button with unread count badge
- Guests can chat using `guest_name`

### Calendar sync
- Google: OAuth2 → store refresh token → `/calendars/primary/freebusy`
- Outlook: OAuth2 → Microsoft Graph → `/me/calendar/getSchedule`
- Both read-only. Write results as `availability_slots` with `source = 'google_calendar'`

### Email reminders
- On event confirmation, create 3 rows in `reminder_jobs` per participant (7d, 1d, morning)
- Vercel Cron `0 * * * *` — query unsent jobs where `send_at <= now()`, send via Resend, mark sent
- Template includes: event name, date + time + timezone, location (if confirmed), countdown, event link

### Guest experience
- Share link: `/events/[id]/join?token=[slug]`
- Guest enters name → `event_participants` row with `user_id = null`
- Guest can: mark availability, vote on locations, chat, see the budget (read-only)
- Guest cannot: edit event details (including the budget), manage other participants
- Guest session in localStorage + httpOnly cookie

---

## UI patterns — always follow these

**Navigation structure (desktop):**
```
[Logo (serif wordmark)] [Home | Events | Templates] (tabs) ... [+ New event] (CTA button) [User avatar]
```
"Create event" is NEVER a nav tab — always a separate button.

**Copy word:** product copy calls the thing a "plan" (code, routes and data keep "event"). Never "plan a plan": use start, make or set up. Billing tiers live under "Pricing"; lifecycle stages read Deciding / RSVP / Soon / Today / Done, one word each, and the planning-phase badge says Deciding.

**Selected-tab style — pencil underline:** the active tab (the top nav, the mobile tab bar, and the plan tabs Availability/Location/Attendance/Details) gets a **hand-drawn pencil underline in the accent** (`PencilUnderline`) and darker, heavier text (`text-text`, 600–700); inactive tabs are plain `--dim` text with no background. A mouse hover or keyboard focus on an inactive tab sketches a thinner graphite pencil line (`PencilHover`, `--pencil-hover`) left to right, rubbed out right to left on leave; none on touch, instant under reduced motion. Focus rings, `aria-current`/`aria-selected` and 44px phone targets stay. Buttons are still filled pills.

**Mobile:** a fixed **bottom tab bar** — Home · Events · center **+** (create, green circular FAB) · Alerts · Profile — plus a faux status bar and a sticky top app bar (back chevron on detail screens). Phone width ~412px. See `Gatherly Mobile.dc.html`.

**Timezone — required on every time display:**
```tsx
<span>{formatTime(event.start_time)}</span>
<TimezonePill tz={event.timezone} /> // renders e.g. "PDT" or "EDT"
```
Never show a time without timezone context. For events with participants in multiple timezones, show the event timezone with a "Convert to my time" toggle.

**Event lifecycle strip — on hero/current event card:**
```tsx
<LifecycleProgress
  stages={['Invitations', 'Availability', 'Location', 'Confirmed', 'Complete']}
  currentStage={event.status}
  // GSAP fills the line and dots up to currentStage
/>
```

**Status badges — strict role mapping (editorial variants):**
```tsx
<Badge variant="teal">Confirmed</Badge>     // confirmed, going, full availability
<Badge variant="ochre">Planning</Badge>     // planning, partial, caution
<Badge variant="brick">Absent</Badge>       // absent, conflict, not going
<Badge variant="accent">Attending</Badge>   // interactive, selected, urgent dates (green)
<Badge variant="moment">Your turn</Badge>    // asks for you now, or celebrates (coral)
<Badge variant="neutral">Draft</Badge>      // neutral states
```
Badges are soft pills: `--{role}-bg` fill, `--{role}-text` text, `1px solid --{role}-border`, `rounded-full`.

**Date urgency pills:**
- ≤ 14 days: accent (green) — signals "soon"
- > 14 days: neutral surface bg
- Today: ochre/warning bg with clock icon

**Avatar sizes — circular, three standard sizes:**
- `sm` (20–22px, 8–9px font) — inline in cards, host rows, piles
- `md` (26px, 9.5px font) — roster rows, avatar stacks
- `lg` (34–36px, 12px font) — guest list, profile contexts
Every face is a sticker: a die-cut edge (`--face-edge`) that follows its own shape plus a small lift (`--face-lift`), so piles overlap sticker-on-sticker with no circular notch, and cap at 6–7 with a `+N` chip in the same edge.

**Cards:** `rounded-2xl border border-border bg-s1 p-5` — hairline border, soft `--shadow`, generous padding; hero cards `rounded-3xl`.
**Buttons:** primary `rounded-full bg-accent text-on-accent font-semibold`, secondary `rounded-full border border-border2 bg-s1 hover:bg-s2`; heights 44px on phones (`h-11`), 32–40px from `sm`.
**Moments of life:** the fun is small and earned: the faces, an italic accent word, a coral "Your turn", the It's on burst when a plan locks in (GSAP, skipped under `reducedMotion()`), and empty states that speak like a person ("Your next plan goes here", "Waiting on the group"). No emoji, no confetti rain, no poster layouts.
**Section headers:** `flex items-center justify-between` with an **eyebrow** label (`text-[11px] font-semibold tracking-[.13em] uppercase text-[--faint]`) on the left; generous `mb-4` before content. The Home **Up next** eyebrow is coral (`--moment-text`).
**Answer counts are always a number out of a whole, in one wording** (`src/lib/answers.ts`, with who counts decided once in `src/lib/events.ts`: `answeredIds`, `rsvpPool`). While deciding it is answered out of everyone invited, "3 of 9 have answered", where an answer is a mark on one of the plan's current days or "none of these days work" by someone still on the plan. Once locked it is going out of the people available for the locked time (their marks cover it, plus anyone who has said going or maybe since), "4 of 5 who can make it are going", and where there is room the rest after a colon ("4 of 5 who can make it are going: 1 maybe"); a plan whose date was set at creation never asked for times, so it counts out of everyone ("4 of 6 are going"). At lock-in, marks that cover the slot start as going, marks that miss it entirely (or "none work") start as can't go, and partial marks or none start at no reply, each automatic one marked so the person can change it. Screens differ only in whether they add the detail; never "Everyone has answered", "responded" or "replied so far", and never count in a component. **Plan header status:** where planning stands is one **sentence** (`StageSummary`), not a stat strip: replies, the best time so far (a link to it on the grid, with its timezone pill) and the place, each a clause. No per-stat boxes.

### Scalability — design for dozens to hundreds
Assume the busy case, not the demo case: an event can have dozens to hundreds of participants and many places/stops. Every feature must stay correct and responsive at that scale.
- **Bounded render work:** never make per-frame cost scale with `cells × people`. Compute per-entity aggregates once per render (hoist/`useMemo`), not once per cell. The availability grid builds each day's combined intervals once, then reads them per cell.
- **Bounded DOM:** cap what a single container draws — avatar piles collapse to `+N` (≤6–7 shown), long lists paginate/virtualize, wide grids page (the week pager) rather than rendering 21 days × 96 rows at once.
- **No O(people × stops) matrices** — use the exceptions-list / single-venue roster (see Attendance) and O(1) per-venue cards.
- **Summarize, don't enumerate:** headcounts, heat bands, "+N", and roster groupings scale; a row-per-person does not. List length should track exceptions or groups, not raw headcount.
- **Data shape scales too:** prefer interval/aggregate math over per-slot-per-person scans; query overlaps in the DB (`GROUP BY`), not by loading every row into the client.
- Sanity-check interactions (drag, vote, filter) with ~100 participants and ~20 places in mind — if a handler is O(n²) per event, fix the shape before shipping.

### Responsive design — required on every screen
The app must be fully usable from a ~360px phone to a large desktop. This is a hard requirement on every new component, not a later polish pass.
- Build mobile-first with Tailwind breakpoints (`sm` 640 / `md` 768 / `lg` 1024); no fixed pixel widths on layout containers — use `flex-wrap`, `minmax()`, `max-w-*`, and `min-w-0` on flex children
- Side-by-side panels (availability grid + chat, map + voting panel) stack vertically below `lg`; the side panel becomes a full-width block with its own bounded height
- Wide content (grids, tables) scrolls horizontally inside its own `overflow-x-auto` container — the page body never scrolls sideways
- Toolbars and filter rows `flex-wrap` instead of overflowing; sticky headers stay compact on mobile
- Mobile end state is the bottom tab bar from `Gatherly Mobile.dc.html`; until it exists, primary nav must still be reachable on small screens
- Hit targets ≥ 44px and min font 12px on mobile; sanity-check layouts at 360, 412, 768, 1024, and 1280px

---

## What to avoid

- **Never** use the retired palette: `#2563EB`, `#0D9488`, `#B45309`, `#E11D48`, `#16A34A`, `#D97706`, `#DC2626` — use the editorial accent green + ochre/brick + warm neutrals
- **Never** introduce a second brand accent — there is exactly one (`--accent`, green). Coral (`--moment`) is a role colour like ochre and brick: never a button, link or selected state
- **Never** use poster layouts (big titles over full-bleed art); the warmth comes from faces, italic accents, rounder shapes and small moments
- **Never** make a button or chip square-cornered — buttons and chips are pills (`rounded-full`); fields stay slightly rounded rectangles
- **Never** use a filled pill or a plain CSS underline for a selected tab — it is the accent pencil underline with heavier text; inactive tabs have no background
- **Never** draw pencil marks over the availability grid's cells or any form field; on decision surfaces the only marks are the tab underline and the best-time highlighter above the grid
- **Never** box the plan-header status — it is a sentence
- **Never** tilt, tape or overlap anything onto a decision surface (the grid, voting, the map, who's coming, the create form, chat, answer buttons); scrapbook touches are for moments only, and tilts stay at 3deg or less
- **Never** set headlines in the body grotesk — display type is **Instrument Serif**; never use Geist/Inter
- **Never** hardcode hex in components — read the theme CSS variables so light + dark both work
- **Never** render an O(people × stops) attendance matrix — use the exceptions list / single-venue roster
- **Never** let per-render work scale with `cells × people` or draw an unbounded avatar pile / list — hoist aggregates, cap with `+N`, page or virtualize (see Scalability)
- **Never** use decorative gradients, glows, emoji, or left-accent-border cards — keep it restrained and editorial
- **Never** put "Create event" as a nav tab — it is a button (desktop) / center FAB (mobile)
- **Never** use CSS `transition` for complex animations — use GSAP
- **Never** show a time without a timezone pill
- **Never** let anyone but the event host edit the budget — guests and participants see it read-only, labeled as set by the host
- **Never** hardcode timezone — always use `event.timezone`
- **Never** use `position: fixed` in components
- **Never** show the full availability grid to guests before they enter their name
- **Never** auto-overwrite a manually-edited itinerary when new votes come in — diff and notify
- **Never** mark cells in View mode — requires explicit switch to Edit mode
- **Never** call `gsap.to()` outside a `useGSAP()` hook or `useEffect`
- **Never** initialize a Three.js canvas without a `<Suspense>` fallback
- Minimum font size: **11px** desktop / **12px** mobile; mobile hit targets ≥ 44px

---

## Environment variables needed

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXTAUTH_SECRET=
NEXTAUTH_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

RESEND_API_KEY=

MAPBOX_TOKEN=          # for route optimization in itinerary
```
