'use client'

import { createEvent, deleteEvent, getEvent, initialsOf, listEvents, patchEvent, pickColor, type AppEvent, type Participant } from './events'

/* A practice event: the tour runs on it, and everything can be tried on it because
   it is the person's own, not a read-only sample. Five made-up people have already
   answered and three places are on the ballot, so the grid has colour and the map
   has pins from the first look. One per account, found again by its flag; deleting
   it is the same as deleting any event. */

const PEOPLE: [string, string][] = [['Sarah Reyes', 'p-sr'], ['Kyle Lin', 'p-kl'], ['Priya Rao', 'p-pr'], ['Maya Nair', 'p-mn'], ['Alex Tan', 'p-at']]
const PLACES = [
  { id: 'pr-tartine', name: 'Tartine Manufactory', place: '595 Alabama St, San Francisco', lat: 37.7618, lng: -122.4112 },
  { id: 'pr-presidio', name: 'Presidio Picnic Lawn', place: 'Presidio, San Francisco', lat: 37.7989, lng: -122.4662 },
  { id: 'pr-ferry', name: 'Ferry Building', place: '1 Ferry Building, San Francisco', lat: 37.7955, lng: -122.3937 },
]
// who is free when, in clock minutes, by day index into the event's days
const ANSWERS: [string, number, number, number][] = [
  ['p-sr', 0, 10 * 60, 14 * 60], ['p-sr', 2, 9 * 60, 15 * 60],
  ['p-kl', 2, 10 * 60, 16 * 60], ['p-kl', 3, 13 * 60, 17 * 60],
  ['p-pr', 1, 9 * 60, 11 * 60], ['p-pr', 2, 9 * 60, 12 * 60],
  ['p-mn', 2, 11 * 60, 17 * 60], ['p-mn', 4, 9 * 60, 12 * 60],
  ['p-at', 2, 9 * 60, 13 * 60], ['p-at', 0, 13 * 60, 17 * 60],
]

function iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** The account's practice event, made on first ask. Resolves its id. */
export function ensurePracticeEvent(): string {
  const have = listEvents().find((e) => e.practice && e.hostedByYou && !e.demo)
  if (have) return have.id

  // the coming week, Monday to Friday
  const start = new Date(); start.setHours(12, 0, 0, 0)
  start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7))
  const end = new Date(start); end.setDate(end.getDate() + 4)
  let tz = 'UTC'
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { /* UTC */ }
  const ev = createEvent({
    title: 'Practice run',
    description: 'A sample event of your own, to try things on. Everyone in it is made up. Delete it whenever you like.',
    startDate: iso(start), endDate: iso(end),
    granularity: '30', timezone: tz, budget: '', durationMin: 120,
    locMode: 'vote', planMode: 'vote', picked: PLACES.map((p) => ({ id: p.id, name: p.name, place: p.place })),
    platform: '', meetingLink: '', emails: [], accounts: [],
  })
  const fresh = getEvent(ev.id) ?? ev

  const participants: Participant[] = [...fresh.participants]
  for (const [name, id] of PEOPLE) {
    const initials = initialsOf(name)
    participants.push({ id, initials, name, color: pickColor(participants, { initials, name }), rsvp: 'pending' })
  }
  const avail: AppEvent['avail'] = Object.fromEntries(Object.entries(fresh.avail).map(([k, v]) => [k, v.map((ids) => [...ids])]))
  const availIv: NonNullable<AppEvent['availIv']> = Object.fromEntries(fresh.days.map((d) => [d.key, { ...(fresh.availIv?.[d.key] ?? {}) }]))
  const step = 30
  for (const [pid, dayIdx, s, e] of ANSWERS) {
    const day = fresh.days[dayIdx]?.key
    if (!day) continue
    availIv[day][pid] = [{ s, e }]
    for (let i = s / step; i < e / step; i++) avail[day]?.[i]?.push(pid)
  }
  const places = fresh.location.places.map((p) => { const src = PLACES.find((x) => x.id === p.id); return src ? { ...p, lat: src.lat, lng: src.lng } : p })
  // the made-up people added the places; the ballot already leans one way
  const addedBy: Record<string, string> = { 'pr-tartine': 'p-sr', 'pr-presidio': 'p-kl' }
  patchEvent(ev.id, {
    practice: true,
    participants,
    avail,
    availIv,
    votes: { 'pr-tartine': ['p-sr', 'p-pr'], 'pr-presidio': ['p-kl'], 'pr-ferry': ['p-mn'] },
    location: { ...fresh.location, guestsCanSuggest: true, places: places.map((p) => ({ ...p, addedBy: addedBy[p.id] ?? p.addedBy })) },
  })
  return ev.id
}

/** A fresh practice event for a repeat of the tour: whatever was tried on the old
 *  one is gone with it, so the tour starts from the same place every time. */
export function resetPracticeEvent(): string {
  for (const e of listEvents()) if (e.practice && e.hostedByYou && !e.demo) deleteEvent(e.id)
  return ensurePracticeEvent()
}
