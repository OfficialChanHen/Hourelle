/* ── a locked slot, said one way everywhere ──
   A slot is a day, or a run of days (endDayKey), and it has times unless it runs
   0 to 24:00. On a run the times are the two ends of the whole stretch, not hours
   kept each day: Friday 6 PM to Sunday noon starts at six on the Friday and ends at
   noon on the Sunday, the way a calendar entry spanning days does.

   A run locked with its own hours each day carries them as `sessions`, one per day
   kept (a skipped day has none); the outer fields still give the span. An open end
   (`openEnd`) has a start and no agreed end: its endMin is only how late most of the
   group could stay when it was locked, never said as the end.

   Pure and dependency-free so the server's emails and the client's pages read the
   same sentence. Callers bring their own day and clock formatting, since the pages
   use the event's day labels and the viewer's clock style and the mail cannot. */
export type Session = { dayKey: string; startMin: number; endMin: number }
export type SlotLike = { dayKey: string; endDayKey?: string; startMin: number; endMin: number; sessions?: Session[]; openEnd?: boolean }

export const isAllDay = (c: SlotLike): boolean => !c.sessions && c.startMin === 0 && c.endMin === 24 * 60

/** The slot as one session per day: the ones it carries, else its span cut at each
 *  midnight. `nextDay` gives the day after a key, so this file stays free of dates. */
export function sessionsOf(c: SlotLike, nextDay: (key: string) => string): Session[] {
  if (c.sessions?.length) return c.sessions
  if (!c.endDayKey || c.endDayKey <= c.dayKey) return [{ dayKey: c.dayKey, startMin: c.startMin, endMin: c.endMin }]
  const out: Session[] = []
  for (let k = c.dayKey, i = 0; k <= c.endDayKey && i < 90; k = nextDay(k), i++) {
    out.push({ dayKey: k, startMin: k === c.dayKey ? c.startMin : 0, endMin: k === c.endDayKey ? c.endMin : 24 * 60 })
  }
  return out
}

const sessionLine = (s: Session, openEnd: boolean | undefined, day: (key: string) => string, time: (min: number) => string) =>
  openEnd ? `${day(s.dayKey)}, ${time(s.startMin)}, open end` : `${day(s.dayKey)}, ${time(s.startMin)} – ${time(s.endMin)}`

/** "Sat, Aug 16, 5:00 PM – 9:00 PM", "Fri, Aug 14 – Sun, Aug 16",
 *  "Fri, Aug 14, 6:00 PM – Sun, Aug 16, 12:00 PM", "Fri, Aug 14 – Sun, Aug 16, 3 days"
 *  for a run with its own hours each day, or "Sat, Aug 16, 8:00 PM, open end". */
export function slotWhen(c: SlotLike, day: (key: string) => string, time: (min: number) => string): string {
  const a = day(c.dayKey)
  if (c.sessions && c.sessions.length > 1) {
    const n = c.sessions.length
    return `${a} – ${day(c.sessions[n - 1].dayKey)}, ${n} days`
  }
  if (c.sessions?.length) return sessionLine(c.sessions[0], c.openEnd, day, time)
  if (isAllDay(c)) return c.endDayKey ? `${a} – ${day(c.endDayKey)}` : a
  if (c.openEnd) return sessionLine(c, true, day, time)
  if (c.endDayKey) return `${a}, ${time(c.startMin)} – ${day(c.endDayKey)}, ${time(c.endMin)}`
  return `${a}, ${time(c.startMin)} – ${time(c.endMin)}`
}

/** One line per day where there is room for them; a slot without its own hours each
 *  day is its one sentence. */
export function slotLines(c: SlotLike, day: (key: string) => string, time: (min: number) => string): string[] {
  if (!c.sessions?.length) return [slotWhen(c, day, time)]
  return c.sessions.map((s) => sessionLine(s, c.openEnd, day, time))
}

/** Has the slot ended, given today's key and the minute of the day, both in the
 *  event's zone? A timed slot ends at its end time on its last day; an all-day one,
 *  or an open end, at midnight after its last day. */
export function slotOver(c: SlotLike, todayKey: string, minute: number): boolean {
  const lastSession = c.sessions?.[c.sessions.length - 1]
  const last = lastSession?.dayKey ?? c.endDayKey ?? c.dayKey
  if (todayKey > last) return true
  if (c.openEnd || isAllDay(c)) return false
  return todayKey === last && minute >= (lastSession?.endMin ?? c.endMin)
}
