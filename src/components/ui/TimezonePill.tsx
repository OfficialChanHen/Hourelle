// Small PDT/EDT pill — required on every time display.
const abbr: Record<string, string> = {
  'America/Los_Angeles': 'PDT',
  'America/Denver': 'MDT',
  'America/Chicago': 'CDT',
  'America/New_York': 'EDT',
  'Europe/London': 'BST',
  'Asia/Singapore': 'SGT',
  UTC: 'UTC',
}

export function TimezonePill({ tz }: { tz: string }) {
  const label = abbr[tz] ?? tz.split('/').pop()?.slice(0, 3).toUpperCase() ?? 'UTC'
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-s2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-faint">
      {label}
    </span>
  )
}
