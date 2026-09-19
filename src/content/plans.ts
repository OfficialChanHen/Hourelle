/* The two plans, as data, so the welcome step, the plans page and the Settings
   section all say the same thing. Hosting is free and stays free; Plus is a
   thank-you with a few extras, and it is not on sale yet. */
export type PlanKey = 'free' | 'plus'

export type Plan = {
  key: PlanKey
  name: string
  price: string
  priceNote: string
  tagline: string
  features: string[]
  soon?: boolean
}

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: 'free',
    name: 'Free',
    price: 'Free',
    priceNote: 'for everyone, always',
    tagline: 'Everything you need to host and to join.',
    features: [
      'Unlimited events, guests and places',
      'The availability grid, day polls and quick fills',
      'Place votes, itineraries and driving routes',
      'Chat, RSVPs and attendance',
      'Invites, nudges, lock-in announcements and reminders by email',
      'Calendar import from Google and Outlook',
      'Calendar files and links to add a plan to any calendar',
      'No ads, no tracking',
    ],
  },
  plus: {
    key: 'plus',
    name: 'Hourelle Plus',
    price: '$2',
    priceNote: 'a month, or $15 a year',
    tagline: 'A thank-you, with a few extras.',
    features: [
      'Everything in Free',
      'Keeps your calendar in step: locked-in plans written to Google or Outlook, and moved when they move',
      'Unlimited calendar imports',
      'A Plus mark on your profile',
      'A reply within two days on support',
      'First access to new features',
    ],
    soon: true,
  },
}
