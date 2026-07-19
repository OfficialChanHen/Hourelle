// Small PDT/EDT pill — required on every time display.
// Abbreviations come from Intl for the current date, so PST/PDT flips with DST
// instead of being hardcoded to summer; cached because piles render this a lot.
const cache = new Map<string, string>()

export function tzAbbr(tz: string): string {
  const hit = cache.get(tz)
  if (hit) return hit
  let label: string
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date())
    label = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC'
  } catch {
    // unknown zone string: fall back to the last path segment, uppercased
    label = tz.split('/').pop()?.slice(0, 3).toUpperCase() ?? 'UTC'
  }
  cache.set(tz, label)
  return label
}

export function TimezonePill({ tz }: { tz: string }) {
  const label = tzAbbr(tz)
  return (
    <span className="inline-flex items-center rounded-[5px] bg-s2 px-[5px] py-px font-mono text-[10px] leading-normal text-dim">
      {label}
    </span>
  )
}
