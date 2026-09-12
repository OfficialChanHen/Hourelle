# Aline — project context for Claude Code

## What this is
Aline is a modern replacement for when2meet.com. It handles the full lifecycle of event coordination: scheduling via an availability grid, collaborative location voting on a map, itinerary building for multi-stop events, real-time chat per event, and attendance tracking (multi-stop itinerary **and** single-venue). Both authenticated users and guests (via share link) can participate.

### Visual direction — the editorial system, designed past its first draft
The design is **editorial**: warm neutral / warm-charcoal surfaces, a single deep-green signature accent, Instrument Serif display headlines over a grotesk body, hairline rules, restrained shadows, and generous whitespace — shipped in two equally-finished themes (light + dark). The HTML reference files in `public/examples/` were the **early iteration** of this design, not a 1:1 target — the built app is expected to exceed them:
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

The paper is warm without being tinted: a trace of red and yellow in the grays, not the yellow wash the first draft carried. The character lives in the deep green, the serif, the hairlines and the spacing, so it survives a cooler ground.

```css
/* Light — warm neutral (default) */
:root {
  --bg:#F7F6F4; --s0:#FBFAF9; --s1:#FFFFFF; --s2:#EFEEEB; --s3:#E3E2DE;
  --border:#E3E2DE; --border2:#CFCEC9;
  --text:#1A1917; --dim:#67665F; --faint:#98978F;
  --accent:#2E4A3C; --accent-text:#2A4537; --accent-bg:#E8EEE9; --accent-border:#CBD9CF; --on-accent:#F8F7F3;
  --teal:#3F6B55; --teal-text:#31523F; --teal-bg:#E7EFE9; --teal-border:#C6DACC;     /* going / confirmed / full */
  --ochre:#8F6A33; --ochre-text:#72521F; --ochre-bg:#F3ECDF; --ochre-border:#E3D6BF; /* planning / partial / caution */
  --brick:#9C4A46; --brick-text:#823C39; --brick-bg:#F3E4E2; --brick-border:#E4CBC8; /* absent / conflict / not-going */
  --shadow:0 1px 2px rgba(30,28,24,.04), 0 10px 30px rgba(30,28,24,.06);
}
/* Dark — warm charcoal */
[data-theme="dark"] {
  --bg:#151513; --s0:#1A1A18; --s1:#1F1F1C; --s2:#262622; --s3:#302F2A;
  --border:rgba(240,238,230,.10); --border2:rgba(240,238,230,.19);
  --text:#EFEDE8; --dim:#ACA99F; --faint:#78766E;
  --accent:#4C8A66; --accent-text:#A3D6BE; --accent-bg:rgba(127,183,154,.15); --accent-border:rgba(127,183,154,.38); --on-accent:#F8F7F3;
  --teal:#5B9A7C; --teal-text:#9BD2B7; --teal-bg:rgba(111,181,151,.14); --teal-border:rgba(111,181,151,.36);
  --ochre:#BD9A5E; --ochre-text:#E1C48F; --ochre-bg:rgba(200,165,100,.15); --ochre-border:rgba(200,165,100,.38);
  --brick:#C57F78; --brick-text:#E5ACA6; --brick-bg:rgba(205,138,130,.14); --brick-border:rgba(205,138,130,.36);
  --shadow:0 1px 2px rgba(0,0,0,.5), 0 14px 36px rgba(0,0,0,.45);
}
```

**Appearances.** Four, and only four, each with a job. The house warm neutral (no `data-palette`); **Studio** (`data-palette="studio"`), cool neutral with ink as the accent and the grotesk as the display face; **Daylight** (`data-palette="daylight"`), bright white and a clear blue; **High contrast** (`data-palette="contrast"`) for glare and low vision. Each redefines the whole token set in `globals.css`, and `data-theme` still picks light or dark inside it. Never add a novelty palette; a new one has to earn a job none of these does.

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

**Color role rules — never break these:**
- `--accent` (deep green): the single signature color — every CTA, link, active/selected state, the **filled selected-tab box** (with `--on-accent` cream text), primary buttons, and urgency date pills (≤14 days). Exactly one accent; never add a second brand hue.
- `--teal`: confirmed / going / success / full-attendance; the availability heat-map ramp.
- `--ochre`: planning / partial-attendance / caution; "arrives late / leaves early".
- `--brick`: absent / conflict / danger / not-going / declined.
- Person-avatar colors: purely decorative identity — never reuse for semantic meaning.
- **Retired palette — never use again:** blue `#2563EB`, teal `#0D9488`, sienna `#B45309`, rose `#E11D48`, and the older `#16A34A` / `#D97706` / `#DC2626`. The editorial accent green + warm neutrals + ochre/brick replace them all.

### Availability heat map — green ramp (5 steps)
```
None:  var(--s2)   — no overlap
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
- **Display / headlines:** `Instrument Serif`, weight 400 (its only weight), tracking `-0.01em`. Page titles, event names, big stat values, the RSVP donut figure. Sizes 24–52px by context — be generous; this carries the editorial feel. Maps to Tailwind `font-serif`.
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
- `rounded-lg` (10px) — chips, segmented toggles, small controls
- `rounded-xl` (14px) — cards, panels, inputs
- `rounded-2xl` (18–22px) — hero cards, modals, mobile sheets
- Borders are **hairlines** (`--border`); shadows are soft and rare (`--shadow`). No glows, no decorative gradients, no left-accent-border cards.

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

**Selected-tab style — filled box, not underline:** the active tab (both the top nav AND the event-detail tabs Availability/Location/Attendance/Details) is a **filled `--accent` box with `--on-accent` cream text** and `rounded-lg`/`rounded-xl`; inactive tabs have **no background** (`--dim` text). No underline indicators anywhere.

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
<Badge variant="accent">Attending</Badge>   // interactive, selected, urgent dates (deep green)
<Badge variant="neutral">Draft</Badge>      // neutral states
```
Badges are soft: `--{role}-bg` fill, `--{role}-text` text, `1px solid --{role}-border`.

**Date urgency pills:**
- ≤ 14 days: blue accent bg (`dp-s` class) — signals "soon"
- > 14 days: neutral surface bg
- Today: sienna/warning bg with clock icon

**Avatar sizes — circular, three standard sizes:**
- `sm` (20–22px, 8–9px font) — inline in cards, host rows, piles
- `md` (26px, 9.5px font) — roster rows, avatar stacks
- `lg` (34–36px, 12px font) — guest list, profile contexts
Avatar piles overlap with a `2px solid --s1` ring and cap at 6–7 with a `+N` chip.

**Cards:** `rounded-xl border border-[--border] bg-[--s1] p-5` — hairline border, soft `--shadow`, generous padding; hero/mobile cards `rounded-2xl`.
**Section headers:** `flex items-center justify-between` with an **eyebrow** label (`text-[11px] font-semibold tracking-[.13em] uppercase text-[--faint]`) on the left; generous `mb-4` before content.
**Open stat strip (event header):** stats are **borderless** — eyebrow label → big **Instrument Serif** value → muted caption — in a row separated by whitespace (`gap-8`) with a hairline divider beneath. No per-stat boxes.

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
- **Never** introduce a second brand accent — there is exactly one (`--accent`, deep green)
- **Never** use underline-style tabs — the selected tab is a filled `--accent` box; inactive tabs have no background
- **Never** box the event-header stats — they are open (eyebrow + serif value + caption)
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
