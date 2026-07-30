// Sample data mirrored from the Gatherly Editorial reference (public/Gatherly Editorial.dc.html)

export const event = {
  id: 'q3-offsite',
  title: 'Q3 Team Offsite Planning',
  host_name: 'Acme Engineering Org',
  description:
    'Two days of strategy, workshops, and a team dinner to align on Q3 goals. Travel is reimbursed for out-of-town folks.',
  status: 'planning' as const,
  timezone: 'America/Los_Angeles',
  when: 'Jul 13, 2026 · 9:00 AM',
  timeUntil: '14 days',
  budgetTotal: '$4,200',
  budgetPerPerson: '$420 / person (est.)',
  slug: 'gatherly.app/e/q3-offsite',
}

// participant ids (initials) in the order shown in the reference
export const participantIds = ['JM', 'SR', 'AT', 'KL', 'PR', 'DW', 'MN', 'CL']
export const notGoingIds = ['DW']

// ─── Availability grid ───
export const gridTimes = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM']
// ISO day keys, like every real event — the demo has to speak the current data
// dialect (lock-in date math, phase derivation) or it drifts behind the app
export const gridDays = [
  { key: '2026-08-24', dow: 'Mon', date: 'Aug 24', best: false },
  { key: '2026-08-25', dow: 'Tue', date: 'Aug 25', best: false },
  { key: '2026-08-26', dow: 'Wed', date: 'Aug 26', best: true },
  { key: '2026-08-27', dow: 'Thu', date: 'Aug 27', best: false },
  { key: '2026-08-28', dow: 'Fri', date: 'Aug 28', best: false },
] as const

// avail[dayKey][timeIndex] = ids of everyone free in that slot
export const avail: Record<string, string[][]> = {
  '2026-08-24': [['JM', 'SR', 'KL'], ['JM', 'AT'], [], ['SR', 'PR', 'CL'], ['JM', 'SR', 'AT', 'KL']],
  '2026-08-25': [['JM', 'SR', 'AT', 'KL', 'PR'], ['JM', 'SR', 'KL'], ['AT', 'PR'], [], ['SR', 'KL', 'MN', 'CL']],
  '2026-08-26': [
    ['JM', 'SR', 'AT', 'KL', 'PR', 'DW', 'MN', 'CL'],
    ['JM', 'SR', 'AT', 'KL', 'PR'],
    ['JM', 'SR', 'KL', 'PR', 'MN'],
    ['SR', 'AT', 'MN'],
    ['JM', 'SR', 'AT'],
  ],
  '2026-08-27': [['JM', 'AT'], ['JM', 'AT', 'KL', 'PR'], [], ['AT', 'MN'], ['SR', 'KL']],
  '2026-08-28': [[], [], [], ['KL'], []],
}

// ─── Chat ───
export type ChatMessage = { id: string; name: string; time: string; text: string; you: boolean }
export const messages: ChatMessage[] = [
  { id: 'SR', name: 'Sarah R', time: '2h ago', text: 'Can we avoid Thu Aug 27? Travel might be tricky that week', you: false },
  { id: 'KL', name: 'Kyle L', time: '1h ago', text: '+1. Wed Aug 26 looks strongest on the grid', you: false },
  { id: 'JM', name: 'You', time: '45m ago', text: "Good call, lock Aug 26? Budget's at $4.2k", you: true },
  { id: 'PR', name: 'Priya R', time: '30m ago', text: 'Works! Morning slot so people can travel same day?', you: false },
]
