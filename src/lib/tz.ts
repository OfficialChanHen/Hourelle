// Zone arithmetic with nothing else attached, so the server (the .ics in an email)
// and the browser (calendar import, the grid) share one definition. All maths on
// UTC instants; IANA names; DST-correct because Intl does the work.

// minutes a zone is ahead of UTC at a given instant
export function tzOffsetMin(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'))
  return (asUtc - utcMs) / 60000
}

// "clockMin minutes into dayIso, in tz" → UTC epoch ms (two-pass to settle DST edges)
export function zonedToUtc(dayIso: string, clockMin: number, tz: string): number {
  const [y, m, d] = dayIso.split('-').map(Number)
  const naive = Date.UTC(y, m - 1, d, 0, clockMin)
  const utc = naive - tzOffsetMin(tz, naive) * 60000
  return naive - tzOffsetMin(tz, utc) * 60000
}
