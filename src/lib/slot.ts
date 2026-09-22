/* ── a locked slot, said one way everywhere ──
   A slot is a day, or a run of days (endDayKey), and it has times unless it runs
   0 to 24:00. On a run the times are the two ends of the whole stretch, not hours
   kept each day: Friday 6 PM to Sunday noon starts at six on the Friday and ends at
   noon on the Sunday, the way a calendar entry spanning days does.

   Pure and dependency-free so the server's emails and the client's pages read the
   same sentence. Callers bring their own day and clock formatting, since the pages
   use the event's day labels and the viewer's clock style and the mail cannot. */
export type SlotLike = { dayKey: string; endDayKey?: string; startMin: number; endMin: number }

export const isAllDay = (c: SlotLike): boolean => c.startMin === 0 && c.endMin === 24 * 60

/** "Sat, Aug 16, 5:00 PM – 9:00 PM", "Fri, Aug 14 – Sun, Aug 16", or
 *  "Fri, Aug 14, 6:00 PM – Sun, Aug 16, 12:00 PM". */
export function slotWhen(c: SlotLike, day: (key: string) => string, time: (min: number) => string): string {
  const a = day(c.dayKey)
  if (isAllDay(c)) return c.endDayKey ? `${a} – ${day(c.endDayKey)}` : a
  if (c.endDayKey) return `${a}, ${time(c.startMin)} – ${day(c.endDayKey)}, ${time(c.endMin)}`
  return `${a}, ${time(c.startMin)} – ${time(c.endMin)}`
}

/** Has the slot ended, given today's key and the minute of the day, both in the
 *  event's zone? A timed slot ends at its end time on its last day; an all-day one
 *  at midnight after its last day. */
export function slotOver(c: SlotLike, todayKey: string, minute: number): boolean {
  const last = c.endDayKey ?? c.dayKey
  if (todayKey > last) return true
  return !isAllDay(c) && todayKey === last && minute >= c.endMin
}
