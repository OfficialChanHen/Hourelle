// Filling your times on many plans at once, from one calendar question.
//
// The plan page's Import button asks the calendar about one plan's days. Here the
// question covers every chosen plan in one go: the span from the earliest first day
// to the latest last day, asked once (in chunks if it is long), and each plan then
// reads its own days out of the answer in its own timezone through the same
// `planImport` the plan page uses. One trip to Google or Microsoft whatever the count.

import { availIvOf, getEvent, gridStartMinOf, listEvents, myTimesPatch, nowIn, patchEventWith, phaseOf, stepOf, youReplied, type AppEvent, type AvailIntervals, type Iv } from './events'
import { gridSpanUtc, ISO_DAY, lockedPlanBusyUtc, mockBusyUtc, planImport, googleBusyRange, outlookBusyRange, type UtcBusy } from './calendar-import'

export type FillProvider = 'google' | 'outlook'

/* A plan the fill can write to: one you are on, still deciding its time, with real
   dates of which at least one is still ahead. A plan with its time set (locked, or
   fixed at creation) has nothing left to answer, and a sample has no real days. */
export function fillablePlans(events: AppEvent[] = listEvents()): AppEvent[] {
  return events.filter((ev) => {
    if (ev.demo || ev.confirmed || phaseOf(ev) !== 'planning') return false
    if (!ev.participants.some((p) => p.you)) return false
    if (!ev.days.length || !ev.days.every((d) => ISO_DAY.test(d.key))) return false
    const today = nowIn(ev.timezone).dayKey
    return ev.days.some((d) => d.key >= today)
  })
}

/** Checked to begin with: the plans you have not answered. A plan you answered by
 *  hand is listed but left off, since adding every free hour would change it. */
export const checkedByDefault = (ev: AppEvent) => !youReplied(ev)

// what one plan looked like for you before the fill, so Undo can put exactly your
// part back and nobody else's
type Before = { id: string; meId: string; times: Record<string, Iv[]>; stripes: Record<string, Iv[]>; unavailable: boolean }
export type FillResult = { id: string; title: string; addedMin: number; addedDays: number; dayPoll: boolean; striped: boolean }
export type FillOutcome =
  | { ok: true; results: FillResult[]; undo: Before[] }
  | { ok: false; error: 'auth' | 'scope' | string }

function myRows(iv: AvailIntervals | undefined, meId: string, days: { key: string }[]): Record<string, Iv[]> {
  return Object.fromEntries(days.map((d) => [d.key, iv?.[d.key]?.[meId] ?? []]))
}

/** Ask the calendar once for the whole span the plans cover. `token` is the
 *  provider's own; without a backend there is none and the sample calendar answers. */
export async function busyFor(plans: AppEvent[], provider: FillProvider, token: string | null): Promise<{ busy: UtcBusy[]; error?: string }> {
  if (!token) return { busy: mockBusyUtc(plans.flatMap((p) => p.days)) }
  let s = Infinity, e = -Infinity
  for (const ev of plans) {
    const span = gridSpanUtc(ev.days, gridStartMinOf(ev), ev.times.length * stepOf(ev.granularity), ev.timezone)
    if (span) { s = Math.min(s, span.s); e = Math.max(e, span.e) }
  }
  if (!(e > s)) return { busy: [] }
  return provider === 'google' ? googleBusyRange(token, s, e) : outlookBusyRange(token, s, e)
}

/** Write the import into each plan. Each write reads the plan as this device holds it
 *  at that moment (patchEventWith), so someone's times arriving meanwhile are kept. */
export function applyFill(ids: string[], busyCal: UtcBusy[]): FillOutcome {
  // your locked-in plans are busy too, whether or not they are on that calendar
  const busy = [...busyCal, ...lockedPlanBusyUtc(listEvents())]
  const results: FillResult[] = []
  const undo: Before[] = []
  for (const id of ids) {
    const seen = getEvent(id)
    const meId = seen?.participants.find((p) => p.you)?.id
    if (!seen || !meId) continue
    const preview = planImport(seen, meId, myRows(availIvOf(seen), meId, seen.days), busy)
    results.push({ id, title: seen.title, addedMin: preview.addedMin, addedDays: preview.addedDays, dayPoll: seen.granularity === 'day', striped: preview.stripesChanged })
    // a plan the calendar has nothing new for is left alone, not written back unchanged
    if (!preview.timesChanged && !preview.stripesChanged) continue
    patchEventWith(id, (cur) => {
      const mine = myRows(availIvOf(cur), meId, cur.days)
      const out = planImport(cur, meId, mine, busy)
      const wasUnavailable = !!cur.unavailableIds?.includes(meId)
      undo.push({ id, meId, times: mine, stripes: myRows(cur.importedIv, meId, cur.days), unavailable: wasUnavailable })
      return {
        ...(out.stripesChanged ? { importedIv: out.importedIv } : {}),
        ...(out.timesChanged ? {
          ...myTimesPatch(cur, meId, cur.days, out.times, cur.times.length, stepOf(cur.granularity)),
          // marking any time takes back an earlier "none of these days work"
          ...(wasUnavailable ? { unavailableIds: (cur.unavailableIds ?? []).filter((x) => x !== meId) } : {}),
        } : {}),
      }
    })
  }
  return { ok: true, results, undo }
}

/** Put your part of every plan back as it was before the fill. */
export function undoFill(undo: Before[]): void {
  for (const b of undo) {
    if (!getEvent(b.id)) continue
    patchEventWith(b.id, (cur) => {
      const importedIv: AvailIntervals = { ...(cur.importedIv ?? {}) }
      for (const d of cur.days) {
        const day = { ...(importedIv[d.key] ?? {}) }
        if (b.stripes[d.key]?.length) day[b.meId] = b.stripes[d.key]
        else delete day[b.meId]
        importedIv[d.key] = day
      }
      const others = (cur.unavailableIds ?? []).filter((x) => x !== b.meId)
      return {
        ...myTimesPatch(cur, b.meId, cur.days, b.times, cur.times.length, stepOf(cur.granularity)),
        importedIv,
        unavailableIds: b.unavailable ? [...others, b.meId] : others,
      }
    })
  }
}

/* The way back from Google or Microsoft: the fill that sent you there is written
   down before you leave and picked up once, on return. */
const PENDING = 'hourelle.fill.pending'
export function rememberPending(provider: FillProvider, ids: string[]) {
  try { sessionStorage.setItem(PENDING, JSON.stringify({ provider, ids })) } catch { /* private mode */ }
}
export function takePending(): { provider: FillProvider; ids: string[] } | null {
  try {
    const raw = sessionStorage.getItem(PENDING)
    sessionStorage.removeItem(PENDING)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
