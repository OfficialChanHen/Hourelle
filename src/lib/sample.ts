import type { PersonColor } from './colors'

export type Participant = {
  id: string
  name: string
  initials: string
  color: PersonColor
  rsvp: 'attending' | 'maybe' | 'not_going' | 'pending'
}

export const me: Participant = { id: 'p0', name: 'Jordan Mille', initials: 'JM', color: 'sage', rsvp: 'attending' }

export const participants: Participant[] = [
  me,
  { id: 'p1', name: 'Avery Lin', initials: 'AL', color: 'clay', rsvp: 'attending' },
  { id: 'p2', name: 'Priya Shah', initials: 'PS', color: 'plum', rsvp: 'attending' },
  { id: 'p3', name: 'Marco Diaz', initials: 'MD', color: 'sky', rsvp: 'maybe' },
  { id: 'p4', name: 'Tess Okafor', initials: 'TO', color: 'rose', rsvp: 'attending' },
  { id: 'p5', name: 'Liam Park', initials: 'LP', color: 'wheat', rsvp: 'pending' },
  { id: 'p6', name: 'Noor Aziz', initials: 'NA', color: 'fern', rsvp: 'attending' },
  { id: 'p7', name: 'Sam Reyes', initials: 'SR', color: 'stone', rsvp: 'not_going' },
]

export const event = {
  id: 'weekend-offsite',
  title: 'Summer Team Offsite',
  host_name: 'Jordan Mille',
  description: 'Two days of planning, food, and a hike. Help lock the time and the spots.',
  status: 'availability' as const,
  timezone: 'America/Los_Angeles',
  dateRange: 'Jul 18 – Jul 20',
  daysAway: 18,
}

export type ChatMessage = {
  id: string
  authorId: string
  body: string
  time: string
  mine?: boolean
}

export const messages: ChatMessage[] = [
  { id: 'm1', authorId: 'p1', body: 'Dropped my availability — Friday afternoon is tight for me though.', time: '9:41 AM' },
  { id: 'm2', authorId: 'p2', body: 'Same. Saturday looks way more open across the board.', time: '9:44 AM' },
  { id: 'm3', authorId: 'p4', body: 'I can do either, slight preference for the morning sessions.', time: '9:52 AM' },
  { id: 'm4', authorId: 'p0', body: "Great — looks like Sat 10–12 has the most overlap. Let's aim there.", time: '10:03 AM', mine: true },
  { id: 'm5', authorId: 'p6', body: 'Works for me — booking the room now.', time: '10:05 AM' },
]
