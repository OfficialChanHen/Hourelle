import { avs, type Avatar } from './people'
import type { PersonColor } from './colors'

type BadgeTone = 'teal' | 'ochre' | 'brick' | 'accent' | 'neutral'

export type EventCard = {
  title: string
  badge: { text: string; tone: BadgeTone }
  days: { text: string; tone: BadgeTone }
  date: string
  tz: string
  avatars: Avatar[]
  more: string
  meta?: { icon: string; text: string }[]
  host?: string
  hostId?: string
  going?: string
  cover: [string, string]
}

export const heroLifecycle = ['Invites', 'Availability', 'Location', 'Confirmed', 'Reminders', 'Complete']
export const heroCurrentIdx = 3

export const hero = {
  badges: { time: 'Today · 2:00 PM', confirmed: 'Confirmed' },
  title: 'Product Launch Kickoff',
  location: 'Salesforce Tower, SF',
  tz: 'America/Los_Angeles',
  avatars: avs(['JM', 'SR', 'AT', 'KL', 'PR', 'DW']),
  more: '+6',
  attending: '12 attending',
  stats: [
    { icon: 'users', label: 'Attending', value: '12 / 14', accent: false },
    { icon: 'clock', label: 'Starts in', value: '2h', accent: true },
    { icon: 'wallet', label: 'Budget', value: '$8,500', accent: false },
  ],
  cover: ['#EAE3D5', '#D7CFBD'] as [string, string],
}

export const yourEvents: EventCard[] = [
  {
    title: 'Q3 Team Offsite', badge: { text: 'Planning', tone: 'ochre' }, days: { text: '14 days', tone: 'accent' },
    date: 'Jul 13 · 9:00 AM', tz: 'PDT', avatars: avs(['JM', 'SR', 'AT']), more: '+5',
    meta: [{ icon: 'wallet', text: '$4,200' }, { icon: 'users', text: '7 going' }, { icon: 'route', text: '6 stops' }],
    cover: ['#E4EDE7', '#CFE0D5'],
  },
  {
    title: 'Design Sprint Workshop', badge: { text: 'Confirmed', tone: 'teal' }, days: { text: '29 days', tone: 'neutral' },
    date: 'Jul 28 · 10:00 AM', tz: 'PDT', avatars: avs(['JM', 'SR', 'KL']), more: '+3',
    meta: [{ icon: 'wallet', text: '$1,200' }, { icon: 'users', text: '6 going' }, { icon: 'map-pin', text: '1 venue' }],
    cover: ['#E7E2EE', '#D9CFE4'],
  },
  {
    title: 'End of Year Party', badge: { text: 'Planning', tone: 'ochre' }, days: { text: '172 days', tone: 'neutral' },
    date: 'Dec 18 · 6:00 PM', tz: 'PST', avatars: avs(['JM', 'SR', 'AT']), more: '+19',
    meta: [{ icon: 'wallet', text: '$15,000' }, { icon: 'users', text: '22 invited' }],
    cover: ['#EEE1DD', '#E4CCC7'],
  },
]

export const upcomingEvents: EventCard[] = [
  {
    title: 'All-Hands Meeting', badge: { text: 'Attending', tone: 'accent' }, days: { text: '8 days', tone: 'accent' },
    date: 'Jul 17 · 10:00 AM', tz: 'PDT', hostId: 'SR', host: 'Hosted by Sarah R', avatars: avs(['SR', 'JM', 'AT']), more: '+21', going: '24 going',
    cover: ['#DEE7EC', '#C7DAE2'],
  },
  {
    title: 'Customer Advisory Board', badge: { text: 'Maybe', tone: 'ochre' }, days: { text: '22 days', tone: 'neutral' },
    date: 'Jul 21 · 1:00 PM', tz: 'EDT', hostId: 'KL', host: 'Hosted by Kyle L', avatars: avs(['KL', 'SR', 'PR']), more: '+5', going: '8 going',
    cover: ['#EFE7D6', '#E4D3B4'],
  },
  {
    title: 'Team Retrospective', badge: { text: 'Attending', tone: 'accent' }, days: { text: '31 days', tone: 'neutral' },
    date: 'Jul 30 · 3:00 PM', tz: 'PDT', hostId: 'AT', host: 'Hosted by Alex T', avatars: avs(['AT', 'JM', 'MN']), more: '+9', going: '12 going',
    cover: ['#E4EADB', '#CDDCBB'],
  },
]

export const pastEvents: EventCard[] = [
  {
    title: 'Summer Team BBQ', badge: { text: 'Complete', tone: 'teal' }, days: { text: '2 weeks ago', tone: 'neutral' },
    date: 'Jun 14 · 12:00 PM', tz: 'PDT', avatars: avs(['JM', 'SR', 'AT']), more: '+15', going: '18 went · Dolores Park',
    cover: ['#E4E2DC', '#D2CCBE'],
  },
  {
    title: 'Onboarding Week', badge: { text: 'Complete', tone: 'teal' }, days: { text: '8 weeks ago', tone: 'neutral' },
    date: 'May 2 · 9:00 AM', tz: 'PDT', avatars: avs(['SR', 'KL', 'MN']), more: '+9', going: '12 went · HQ',
    cover: ['#E4E2DC', '#D2CCBE'],
  },
  {
    title: 'Q2 Planning Review', badge: { text: 'Complete', tone: 'teal' }, days: { text: '10 weeks ago', tone: 'neutral' },
    date: 'Apr 18 · 2:00 PM', tz: 'EDT', avatars: avs(['JM', 'AT', 'PR']), more: '+6', going: '9 went · Remote',
    cover: ['#E4E2DC', '#D2CCBE'],
  },
]

export const allEvents = [...yourEvents, ...upcomingEvents]

// avatar color re-export convenience
export type { PersonColor }
