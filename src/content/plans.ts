/* The two plans, as data, so the welcome step, the plans page and the Settings
   section all say the same thing. Hosting is free and stays free; Plus is a
   thank-you with a few extras, and it is not on sale yet. */
export type PlanKey = 'free' | 'plus'

export type Plan = {
  key: PlanKey
  name: string
  price: string        // the monthly figure, and the only figure Free has
  priceNote: string
  yearly?: string      // the same plan bought by the year
  monthlyNote?: string
  yearlyNote?: string
  tagline: string
  features: string[]
  soon?: boolean
}

/* These figures are what the pages say; Stripe holds what is actually charged.
   Change one and change the other, or the page lies.

   Plus is a supporter tier while the features it promises are still being built.
   Nothing in the Free list has ever moved to Plus and nothing ever will: the
   product spreads because guests use it, and a guest never pays. See
   docs/plus-and-reach.md. */

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
    price: '$4',
    priceNote: 'a month',
    yearly: '$36',
    monthlyNote: 'a month, cancel any time',
    yearlyNote: 'a year, which is three months free',
    tagline: 'For the people keeping this going.',
    features: [
      'Everything in Free, which is the whole product',
      'You keep it running: no ads, no tracking, nobody to answer to',
      'A Plus mark on your profile',
      'A reply within two days when you write in',
      'New features first, starting with locked-in plans written to your calendar and moved when they move',
    ],
  },
}
