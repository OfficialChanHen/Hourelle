import type { AppEvent, GridDay, Participant } from '@/lib/events'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function day(key: string): GridDay {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return { key, dow: DOW[dt.getDay()], date: `${MON[m - 1]} ${d}` }
}

export function person(id: string, extra: Partial<Participant> = {}): Participant {
  return { id, name: `${id} Person`, initials: id.slice(0, 2), color: 'sage', rsvp: 'pending', ...extra } as Participant
}

/** A plan with sensible defaults: hourly grid 9 AM to 3 PM in Chicago, the host H as you. */
export function plan(extra: Partial<AppEvent> = {}): AppEvent {
  const days = extra.days ?? [day('2026-10-20'), day('2026-10-21')]
  return {
    id: 'plan-1', title: 'Board game night', hostName: 'H Person', hostedByYou: true, description: '',
    timezone: 'America/Chicago', startDate: days[0].key, endDate: days[days.length - 1].key,
    granularity: '60', budget: '', location: { mode: 'later', planMode: 'vote', places: [], platform: '', meetingLink: '' },
    participants: [person('H', { host: true, you: true, rsvp: 'attending' })],
    days, times: ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM'],
    avail: {}, availIv: {}, votes: {}, messages: [], createdAt: 1, status: 'planning',
    ...extra,
  } as AppEvent
}

/** Save plans the way the app does, so functions that read storage find them. */
export function saved(...events: AppEvent[]): void {
  localStorage.setItem('hourelle.events.v1', JSON.stringify(events))
}
