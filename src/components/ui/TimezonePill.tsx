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
    <span className="inline-flex items-center rounded-[5px] bg-s2 px-[5px] py-px font-mono text-[9px] leading-normal text-dim">
      {label}
    </span>
  )
}
