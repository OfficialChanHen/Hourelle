# If need be: grid UI and preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the if-need-be feature on `feature/if-need-be` (brush toggle, half-width marks, "3 +1" counts, grouped cell detail, best-time clause, Attendance note, flag) and push the branch so Vercel builds a preview.

**Architecture:** The data layer (`availIv` free, `needIv` if need be, `applyBrush`, `availIvOf`, `bestWindow`/`bestBlock` with `needIds`, `needClause`) and the sync layer are committed. This plan makes the sync layer safe on a database without migration 0019, then adds small pure helpers in `grid-lib.ts` and `availability.ts` and wires them into `AvailabilityPanel.tsx`, `DayCalendar.tsx`, `parts.tsx`, `StageSummary.tsx` and `AttendancePanel.tsx`. Everything new is behind `NEXT_PUBLIC_IF_NEED_BE_ON=1`.

**Tech Stack:** Next.js 14, TypeScript, Tailwind with CSS variables, Vitest, Supabase.

**Spec:** `docs/superpowers/specs/2026-10-28-if-need-be-design.md`

## Global Constraints

- Flag: `process.env.NEXT_PUBLIC_IF_NEED_BE_ON === '1'`. With it off, the brush is hidden and nothing new is written (no `if_need_be` in any select or upsert).
- Copy: "Free", "If need be". No explanation under the toggle. Best-time clause comes only from `needClause(n)` in `src/lib/answers.ts`.
- Heat shade counts only fully free people. If-need-be marks never darken a cell.
- A minute is never both kinds for one person.
- No hex in components. New token `--you-need-edge` in every palette and theme block of `globals.css` that sets `--you-*`, and checked in `docs/verify/contrast.py`: 3:1 against `--s1`, the four heat steps and the three `--you-*` fills. "+N" text reuses `--heat-count` / `--you-text`, which already pass 4.5:1.
- Hit targets ≥44px on phones. The brush toggle wraps, never overflows, at 360px.
- The brush exists only in Edit mine, never in View, never when locked.
- Calendar import and Fill my times only ever add Free, and only to minutes not marked either way.
- Every `src/lib` change gets a Vitest test in `src/lib/__tests__`.
- Commits: plain-sentence subjects naming what that commit's diff does. Stage files by name. Commits go through the `git-committer` agent.

## Review Focus

1. **Database without migration 0019.** Answers still load and save, and nobody's times vanish, whether the flag is on or off. (Task 1 tests `missingNeedColumn` and `answerSelect`.)
2. **Free and if-need-be overlapping in stored data** (production writes free rows without touching `if_need_be`, so a person can end up with both on the same minute). Reads treat free as winning, and the next write cleans it up. (Task 2 tests `withoutOverlap`.)
3. **Resizing or nudging a free block over if-need-be minutes.** The free block wins those minutes on save. (Task 2: `commitBoth` runs `withoutOverlap`; Task 2 test.)
4. **Undo after Clear or calendar import** brings back both kinds. (Task 4 verification step.)
5. **A live update to someone else's marks arriving mid-drag** doesn't undo the drag in progress. (Task 4 verification step; `useFollow` for `need` skips while `drag` is set, the same as `mine`.)

---

### Task 0: Clean the branch

The working tree mixes three things: a first try at the grid UI that goes against the spec (Shift picks the brush, dashed edge, new `--need-*` colours), unrelated design edits (dots and chips removed in `AttendancePanel.tsx`, `EventDetail.tsx`, `LocationPanel.tsx`, and the "none of these days work" line in `AvailabilityPanel.tsx`), and a `.gitignore` line. Commit `6b6ca05` also added 15 `.claude/worktrees/agent-*` gitlinks by mistake.

**Files:**
- Modify: `.gitignore`, `src/app/(main)/events/[id]/_components/AvailabilityPanel.tsx`, `src/app/globals.css`, `src/app/(main)/events/[id]/_components/availability/grid-lib.ts`
- Remove from index: `.claude/worktrees/agent-*`

- [ ] **Step 1: Save the whole working diff** to `/tmp/hourelle-before-if-need-be-ui.patch` (`git diff > …`). Check that it isn't empty.
- [ ] **Step 2: Put the three if-need-be files back to HEAD:** `git checkout HEAD -- src/app/globals.css "src/app/(main)/events/[id]/_components/availability/grid-lib.ts" "src/app/(main)/events/[id]/_components/AvailabilityPanel.tsx"`. Then re-apply only the "none of these days work" hunk from the patch to `AvailabilityPanel.tsx` (the `unavail.has(meId) ?` span), so the unrelated design edit survives. Leave the Attendance, EventDetail and Location edits in the working tree, unstaged. They don't belong to this feature, and the user decides about them.
- [ ] **Step 3: Untrack the gitlinks:** `git rm --cached -r .claude/worktrees`. `git status` shows 15 deletions and the folders still on disk.
- [ ] **Step 4: Run** `npm test`. Expected: all pass (99).
- [ ] **Step 5: Commit** `.gitignore`, the 15 removals and this plan file. Subject: `Stop tracking agent worktrees and add the if-need-be UI plan`.

---

### Task 1: The flag, and sync that survives a missing column

**Files:**
- Modify: `src/lib/availability.ts`, `src/lib/remote.ts:182-345`
- Test: `src/lib/__tests__/if-need-be.test.ts`

**Interfaces:**
- Produces: `ifNeedBeOn(): boolean` (availability.ts), `missingNeedColumn(message?: string): boolean` and `answerSelect(withNeed: boolean): string` (remote.ts, exported for tests).

- [ ] **Step 1: Write the failing tests**

```ts
describe('the switch and a database without the column', () => {
  it('reads the flag', () => {
    vi.stubEnv('NEXT_PUBLIC_IF_NEED_BE_ON', '1'); expect(ifNeedBeOn()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_IF_NEED_BE_ON', ''); expect(ifNeedBeOn()).toBe(false)
    vi.unstubAllEnvs()
  })
  it('tells a missing if_need_be column from a missing table', () => {
    expect(missingNeedColumn('column availability.if_need_be does not exist')).toBe(true)
    expect(missingNeedColumn("Could not find the 'if_need_be' column of 'availability' in the schema cache")).toBe(true)
    expect(missingNeedColumn('relation "public.availability" does not exist')).toBe(false)
    expect(missingNeedColumn(undefined)).toBe(false)
  })
  it('asks for the column only when it should', () => {
    expect(answerSelect(true)).toContain('if_need_be')
    expect(answerSelect(false)).not.toContain('if_need_be')
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/if-need-be.test.ts`. Expected: FAIL, the three names aren't exported.
- [ ] **Step 3: Implement.** `ifNeedBeOn` follows the `feedSoon`/`billing` pattern. In `remote.ts`, add a module flag `needColumnMissing`. `loadAnswers` selects `answerSelect(ifNeedBeOn() && !needColumnMissing)`. On an error where `missingNeedColumn` is true, set `needColumnMissing` and retry once without the column. Only a non-column "does not exist" sets `rowsMissing`. `noteMissing` checks `missingNeedColumn` first and returns without setting `rowsMissing`. `pushAnswers` leaves `if_need_be` out of the row (and out of the change check) when the flag is off or the column is missing. When an upsert fails on the missing column, it sets the flag and retries the same row without `if_need_be`, so the answer is kept. `withAnswers` reads `r.if_need_be` only when it's present on the row (it already does).
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** the two lib files and the test. Subject: `Answers still load and save on a database without the if-need-be column`.

---

### Task 2: Pure helpers the grid needs

**Files:**
- Modify: `src/lib/availability.ts`, `src/lib/calendar-import.ts:193-221`, `src/lib/events.ts`, `src/app/(main)/events/[id]/_components/availability/grid-lib.ts`
- Test: `src/lib/__tests__/if-need-be.test.ts`, `src/lib/__tests__/calendar-import.test.ts`

**Interfaces:**
- Produces (availability.ts): `withoutOverlap(free: Iv[], need: Iv[]): Iv[]` returns `need` with every free minute cut out. `paintRanges(free: Record<string, Iv[]>, need: Record<string, Iv[]>, ranges: { day: string; s: number; e: number }[], brush: Brush): { free: Record<string, Iv[]>; need: Record<string, Iv[]> }` applies `applyBrush` per range.
- Produces (grid-lib.ts): `cellPeople(freeByPid: Record<string, Iv[]>, needByPid: Record<string, Iv[]>, w0: number, w1: number): { free: string[]; need: string[] }`. `free` is the peak of `cellBands(freeByPid)`. `need` is everyone whose need marks touch [w0,w1) and who isn't in `free`. Also `countLabel(free: number, need: number): { main: string; extra: string }` and `needSegments(need: Iv[], w0: number, w1: number): { s: number; e: number; first: boolean; last: boolean }[]`, the need intervals clipped to the cell, where `first`/`last` say whether the run starts or ends inside this cell.
- Produces (events.ts): `needOnlyIds(ev: AppEvent, dayKey: string, s: number, e: number): Set<string>` for people who can make [s,e) only with an if-need-be mark (`slotFits` on `availIvOf` but not on `freeIvOf`).
- Produces (calendar-import.ts): `planImport(ev, meId, mine, busyUtc, need?: Record<string, Iv[]>)`.

- [ ] **Step 1: Write the failing tests**

```ts
it('free wins a minute marked both ways', () => {
  expect(withoutOverlap([{ s: 30, e: 60 }], [{ s: 0, e: 90 }])).toEqual([{ s: 0, e: 30 }, { s: 60, e: 90 }])
  expect(withoutOverlap([], [{ s: 0, e: 30 }])).toEqual([{ s: 0, e: 30 }])
})
it('paints several ranges with one brush', () => {
  const out = paintRanges({ d1: [{ s: 0, e: 60 }] }, {}, [{ day: 'd1', s: 30, e: 90 }, { day: 'd2', s: 0, e: 30 }], 'need')
  expect(out.free).toEqual({ d1: [{ s: 0, e: 30 }] })
  expect(out.need).toEqual({ d1: [{ s: 30, e: 90 }], d2: [{ s: 0, e: 30 }] })
})
it('counts a cell as free people plus extra if-need-be people', () => {
  const p = cellPeople({ A: [{ s: 0, e: 30 }], B: [{ s: 0, e: 30 }] }, { C: [{ s: 0, e: 30 }], A: [{ s: 30, e: 60 }] }, 0, 30)
  expect(p).toEqual({ free: ['A', 'B'], need: ['C'] })
  expect(countLabel(3, 1)).toEqual({ main: '3', extra: '+1' })
  expect(countLabel(0, 2)).toEqual({ main: '', extra: '+2' })
  expect(countLabel(3, 0)).toEqual({ main: '3', extra: '' })
})
it('clips a run of if-need-be marks to a cell and knows its ends', () => {
  expect(needSegments([{ s: 15, e: 90 }], 0, 30)).toEqual([{ s: 15, e: 30, first: true, last: false }])
  expect(needSegments([{ s: 15, e: 90 }], 30, 60)).toEqual([{ s: 30, e: 60, first: false, last: false }])
  expect(needSegments([{ s: 15, e: 90 }], 60, 90)).toEqual([{ s: 60, e: 90, first: false, last: true }])
})
it('names who makes a slot only if need be', () => {
  // A free across the slot, B covered half free half if need be, C not covered
  // build with the plan()/person() fixtures as the lock-in tests do
  expect([...needOnlyIds(e, 'd1', 0, 60)]).toEqual(['B'])
})
```

In `calendar-import.test.ts`: `planImport` with `need = { [day]: [{ s: 0, e: 60 }] }` and a calendar free all day returns `times[day]` with no minute in 0–60. On a day poll, a day with need marks isn't filled.

- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the signatures above. `cellPeople` reuses `cellBands`/`peakOf`. `planImport` subtracts both `mine[day]` and `need?.[day]` from `di.free` before adding, and adds only that remainder (today it adds all of `di.free`).
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** the four lib files and two tests. Subject: `Helpers for if-need-be counts, overlap and painting, and calendar import leaves if-need-be marks alone`.

---

### Task 3: Token and contrast

**Files:**
- Modify: `src/app/globals.css` (every block that sets `--you-only`), `docs/verify/contrast.py`

- [ ] **Step 1: Add a UI 3:1 check** to `contrast.py`: for every theme, `you-need-edge` against `s1`, `heat-low`, `heat-mid`, `heat-high`, `heat-full`, `you-only`, `you-some`, `you-many`. Print failures and add them to `bad`.
- [ ] **Step 2: Run** `python3 docs/verify/contrast.py`. Expected: fails with a KeyError or failures, since the token doesn't exist yet.
- [ ] **Step 3: Add `--you-need-edge`** beside `--you-text` in each block. Start from the theme's `--you-text` and adjust until every pair passes.
- [ ] **Step 4: Run** the script again. Expected: no new failures, and the existing pairs are unchanged.
- [ ] **Step 5: Commit** both files. Subject: `Colour for the edge of if-need-be marks in every palette`.

---

### Task 4: Brush and painting in Edit mine

**Files:**
- Modify: `src/app/(main)/events/[id]/_components/AvailabilityPanel.tsx`

**Interfaces:**
- Consumes: `ifNeedBeOn`, `applyBrush`, `paintRanges`, `withoutOverlap`, `freeIvOf` (Tasks 1–2).

- [ ] **Step 1: State.** `need: Record<string, Iv[]>` beside `mine`, seeded from `event.needIv` for `meId`, with each day put through `withoutOverlap(mine[day], need[day])`. `needRef` mirrors it. `useFollow` adopts the event's copy unless a drag is in progress or it matches. `brush: 'free' | 'need'` starts at `'free'` and goes back to `'free'` whenever `mode` becomes `'edit'`. `others` splits into `othersFree` (`freeIvOf`) and `othersNeed` (`event.needIv` minus you). `youAny` counts either kind.
- [ ] **Step 2: One write path.** `commitBoth(free, need)` normalizes, runs `withoutOverlap` per day, sets both states and calls `persist(free, {}, ifNeedBeOn() ? need : undefined)`. `commitDays` goes through it with the current `needRef`, so a resized, nudged or deleted free block takes back the if-need-be minutes it now covers.
- [ ] **Step 3: Painting.** Replace `setIn`/`flipIn` sweeps with `paintRanges` over the trail's cells. The sweep's kind is `on ? brush : 'erase'`, and `on` is "this cell isn't already fully this brush's kind". The drag keeps `base` and `baseNeed`. A press on your own free block still arms selection, and a press in a partial cell still drops a 5-minute band, but only with the Free brush. The If need be brush always paints. Release commits both maps once.
- [ ] **Step 4: Shortcuts use the brush.** `fillPreset`, `toggleDay`, `toggleDays`, `sweepDays`, `toggleTime` call `paintRanges` with `brush` (or `'erase'` where they clear today). `fillAllDays` and the calendar import stay Free-only and pass `need` to `planImport`. `clearAllMine`, `clearWeekMine` and `toggleNoneWork` clear both kinds. The undo snapshot becomes `{ free, need }` and `undoRestore` restores both.
- [ ] **Step 5: Toggle.** In the Edit mine toolbar, when `ifNeedBeOn() && editable && mode === 'edit'`: `<SegmentedControl label="Brush" size="sm" value={brush} options={[{ v: 'free', l: 'Free', icon: FreeSwatch }, { v: 'need', l: 'If need be', icon: NeedSwatch }]} />`. `FreeSwatch`/`NeedSwatch` are tiny components taking `size`: a full clay square, and a half clay square with the edge line. Wrap the row (`flex-wrap`) so it fits 360px, and give segments `h-11 sm:h-7` like `PresetFills`.
- [ ] **Step 6: Draw your marks.** For each `needSegments(need[d.key], w0, w1)` segment, draw an absolutely placed div at `left: 0; width: 50%` with `background: linear-gradient(clay, clay), var(--s1)` (the same `clayFor(oCount)` step as Free), `borderRight: 1.5px solid var(--you-need-edge)`, and a 6px radius on the top corners when `first` and the bottom corners when `last`. Drop the dashed `--need-*` block from the earlier attempt.
- [ ] **Step 7: Run** `npx tsc --noEmit && npm test`. Expected: clean, all pass.
- [ ] **Step 8: Check in the browser** (`npm run dev`, `NEXT_PUBLIC_IF_NEED_BE_ON=1`, a demo plan). Paint If need be over Free and Free over If need be, erase across both, use a quick fill with each brush, Clear then Undo (both come back), and import then Undo. With the flag off, the toggle is gone and painting is exactly as before.
- [ ] **Step 9: Commit** `AvailabilityPanel.tsx`. Subject: `Edit mine gets a Free or If need be brush and draws if-need-be marks half width`.

---

### Task 5: What everyone else sees

**Files:**
- Modify: `AvailabilityPanel.tsx`, `availability/parts.tsx` (`CellDetail`), `availability/DayCalendar.tsx`, `StageSummary.tsx`

- [ ] **Step 1: Hoisted maps.** `freeCombinedByDay` (free, with your live free) and `needCombinedByDay` (if need be, with your live need), each built once per render, with filtered versions for the person filter. `combinedByDay` stays the union for `bestWindow`/`bestBlock`, and those now pass the filtered `needCombinedByDay` as `needIv`.
- [ ] **Step 2: View cells.** Heat bands come from `freeCombinedByDay`. The count is `countLabel(...)` from `cellPeople`: `main` as today, then `extra` in `font-medium` (lighter than `main`'s bold), and a `+2`-only cell sits on its plain background. The title reads "3 free, 1 if need be". With exactly one person in the filter, draw that person's need marks half width as in Task 4 Step 6.
- [ ] **Step 3: Edit cells.** Others' heat comes from `othersFree` only. The corner count adds the `+N` from `othersNeed` and your own need.
- [ ] **Step 4: Cell detail.** `CellDetail` takes `needIds?: string[]` and, when it isn't empty, lists them under an "If need be" heading after the free list. Free stays as it is now.
- [ ] **Step 5: Day polls.** `DayCalendar` takes `needMarked?: (key: string) => boolean` and `needIds?: Record<string, string[]>`, draws your if-need-be day half width, shades from `freeIds` only, and shows `+N`.
- [ ] **Step 6: Best-time lines.** The grid footer appends `needClause(bw.needIds.length)` after "{count} of {total} free" and `needClause(block.needIds.length)` on the days line. `StageSummary` appends `needClause(best.needIds.length)` (or the block's) after "works for the most people so far" (before the full stop).
- [ ] **Step 7: Run** `npx tsc --noEmit && npm test`. Then in the browser: a demo with marks shows "3 +1", a lighter `+N`, grouped detail, and the clause. A plan with none reads exactly as before.
- [ ] **Step 8: Commit** the four files. Subject: `The grid counts if-need-be people as +N, lists them apart and says when the best time leans on them`.

---

### Task 6: Attendance note, demo marks, docs

**Files:**
- Modify: `AttendancePanel.tsx`, `src/lib/events.ts` (one demo's `needIv`), `docs/roadmap.md`
- Create: `docs/backend/phase-14-if-need-be.md`

- [ ] **Step 1: Attendance.** Compute `needOnlyIds(event, slot.dayKey, slot.s, slot.e)` once for the shown slot (locked slot or best window). Next to each such person's name in the roster, add `<span className="text-[11.5px] text-dim">if need be</span>`. No new group or colour.
- [ ] **Step 2: Demo.** Give `GAME_NIGHT` (or whichever demo shows a busy grid) a `needIv` with 3–4 people on a few slots next to their free marks, never overlapping their own free marks. Add a test that the demo's `needIv` and `availIv` never share a minute for the same person.
- [ ] **Step 3: Docs.** The phase-14 walkthrough says what migration 0019 adds and the order: run 0019 in the SQL editor, set the flag for Preview, then for Production at merge. In `docs/roadmap.md` under "Waiting on switches", add: "**Migration 0019** (`if_need_be`) has to be run in the SQL editor. Then set `NEXT_PUBLIC_IF_NEED_BE_ON=1`."
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npm run lint && npm run build`. Expected: all clean.
- [ ] **Step 5: Verify both themes** with the project's verify skill (`.claude/skills/verify`): Edit mine and View on desktop and a 360px phone, light and dark, house and one other palette.
- [ ] **Step 6: Commit** the files. Subject: `Attendance notes who comes only if need be, a demo shows the mark, and the switch is written down`.

---

### Task 7: Push for the preview

- [ ] **Step 1:** `git log --oneline main..` shows the two existing commits plus Tasks 0–6, and `git status` shows only the unrelated design edits left unstaged.
- [ ] **Step 2: Push** `feature/if-need-be` to `origin` through `git-committer` (first push, `-u`).
- [ ] **Step 3: Tell the user** the two switches only they can flip before the preview shows the brush: run `supabase/migrations/0019_if_need_be.sql` in the live project's SQL editor (previews share it, and the column has a default so production is unaffected), and set `NEXT_PUBLIC_IF_NEED_BE_ON=1` for the Preview environment in Vercel, then redeploy the preview.
