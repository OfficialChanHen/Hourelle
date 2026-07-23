# The four planning shapes — and the demo for each

Every Aline event answers two independent questions: **when** and **where**. Each question
arrives either open (find a time together / vote on a place) or already answered (the date
is set / the place is chosen). That gives four shapes, and the built-in demos cover one each.

An event is `status: 'confirmed'` only once **both** questions are closed. Until then it is
`'planning'` — even when one answer is already a fact. The derived phase and open-question
logic live in `src/lib/events.ts` (`phaseOf`, `openQuestions`).

| # | When | Where | Demo event | URL |
|---|------|-------|-----------|-----|
| 1 | open | open | **Design Team Dinner** | `/events/design-team-dinner` |
| 2 | open | answered | **Brunch at Mama's** | `/events/brunch-at-mamas` |
| 3 | answered | open | **Priya's Send-off** | `/events/priyas-send-off` |
| 4 | answered | answered | **Trivia Night at The Anchor** | `/events/trivia-night-anchor` |

## 1 · Both open — Design Team Dinner

The classic when2meet case. Born `planning` with a multi-day window and a live venue ballot.
The availability grid finds the time, votes find the place, and the host's "Lock it in"
modal closes both at once. The stage summary reports both fronts: replies so far, best
window so far, ballot leader.

## 2 · Place answered, time open — Brunch at Mama's

The venue was chosen at creation ("Already chosen" in the wizard), which stores
`location.mode: 'set'`. No voting UI anywhere; the place reads as fact ("Mama's is the
place") while the grid hunts for the right morning. Lock-in only asks for the day and time.

## 3 · Time answered, place open — Priya's Send-off

The mirror of shape 2, and the newest one. Created with "The date is set" plus a live
ballot: the event stores its `confirmed` slot from birth but stays `status: 'planning'`
until the venue is chosen. The time reads as fact everywhere (cards, countdown, calendar
export, stage summary: "Fri, Aug 7 · 7:00 PM – 10:00 PM is the time · 5 of 7 voted"),
the ballot stays fully live, and the confirm modal flips to "Lock in the place" with the
day and time shown as an already-set row. The availability grid stays open as a
"can you make it" reply, windowed to the fixed slot.

## 4 · Both answered — Trivia Night at The Anchor

Date fixed and venue set at creation, so the event is born `confirmed` and goes straight
to the RSVP round. No planning surfaces at all: the confirmed hero leads the page, the
lifecycle strip starts at "Lock in", and the only question left is who is coming.

## How the `where` answer is stored

`location.mode` is the single vocabulary:

- `'vote'` — live ballot; the place question is **open**
- `'set'` — the host picked the venue as fact; no voting UI (answered)
- `'remote'` — online event; there is no place question (answered)
- `'later'` — deliberately deferred; no ballot to run (answered)

Older stored events used `mode: 'vote'` plus a `settled: true` flag for the chosen-venue
case; `readAll()` in `src/lib/events.ts` folds those into `mode: 'set'` on read.

## Other built-in demos

Not part of the four-shape set, but useful context:

- **Q3 Team Offsite Planning** (`/events/q3-offsite`) — shape 1, the original populated demo
- **Fall Harvest Fair** (`/events/harvest-fair`) — shape 1 at scale: 24 people, 12 venues
- **Housewarming at Sarah's** (`/events/sarahs-housewarming`) — shape 4, hosted by someone else (invited view)
- **Shoreline Trail Cleanup** (`/events/shoreline-cleanup`) — shape 4, invited view, same-day clash demo
