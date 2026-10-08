// Small PDT/EDT pill — required on every time display.
// Abbreviations come from Intl for the day the time is on (`day`, YYYY-MM-DD), so a
// December time in Los Angeles reads PST even when looked at in October; without a
// day, today. Cached because piles render this a lot.
const cache = new Map<string, string>()

export function tzAbbr(tz: string, day?: string): string {
  const at = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00Z`) : new Date()
  const key = `${tz}|${day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : 'now'}`
  const hit = cache.get(key)
  if (hit) return hit
  let label: string
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at)
    label = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC'
  } catch {
    // unknown zone string: fall back to the last path segment, uppercased
    label = tz.split('/').pop()?.slice(0, 3).toUpperCase() ?? 'UTC'
  }
  cache.set(key, label)
  return label
}

export function TimezonePill({ tz, day }: { tz: string; day?: string }) {
  const label = tzAbbr(tz, day)
  // align-middle centers the chip against surrounding text when it sits inline in a
  // sentence; flex parents ignore it, so toolbars keep their own alignment
  return (
    <span className="inline-flex items-center rounded-[5px] bg-s2 px-[5px] py-px align-middle font-mono text-[10px] leading-normal text-dim">
      {label}
    </span>
  )
}
