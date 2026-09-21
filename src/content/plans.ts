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

/* ── the two plans, line by line ──
   A comparison only means something if the Free column can say no. Most of these
   rows are a yes on both, because Free is the whole product and nothing has ever
   been moved out of it; what Plus adds is the supporting, the mark, the promise on
   support and being first. `'soon'` is its own answer, and it is the honest one for
   the calendar sync: it is not built, so it is not a tick on either side. */
export type Answer = true | false | 'soon'
export type Row = { label: string; free: Answer; plus: Answer; note?: string }

export const COMPARISON: { group: string; rows: Row[] }[] = [
  {
    group: 'Planning',
    rows: [
      { label: 'Unlimited events, guests and places', free: true, plus: true },
      { label: 'Availability grid, day polls and quick fills', free: true, plus: true },
      { label: 'Place votes, itineraries and driving routes', free: true, plus: true },
      { label: 'Chat, RSVPs and attendance', free: true, plus: true },
      { label: 'Guests answer without an account', free: true, plus: true },
    ],
  },
  {
    group: 'Email and calendars',
    rows: [
      { label: 'Invites, nudges and lock-in announcements', free: true, plus: true },
      { label: 'Reminders before the day', free: true, plus: true },
      { label: 'Import your free time from Google or Outlook', free: true, plus: true },
      { label: 'Calendar files and add-to-calendar links', free: true, plus: true },
      { label: 'Locked-in plans written to your calendar, and moved when they move', free: false, plus: 'soon' },
    ],
  },
  {
    group: 'The rest',
    rows: [
      { label: 'No ads, no tracking, nothing sold', free: true, plus: true },
      { label: 'Keeping Hourelle running', free: false, plus: true },
      { label: 'A Plus mark on your profile', free: false, plus: true },
      { label: 'A reply within two days when you write in', free: false, plus: true, note: 'Everyone gets an answer; Plus gets a deadline.' },
      { label: 'New features first', free: false, plus: true },
    ],
  },
]

/* ── what buying one actually signs you up for ──
   Said before the button, not after it: an automatic renewal has to be disclosed
   plainly, and cancelling has to be as easy as starting. Both are true here, since
   Stripe's own portal does the cancelling. */
export const BILLING_TERMS = {
  renews: 'Renews automatically until you cancel.',
  cancel: 'Cancel any time, in two clicks, and Plus runs to the end of what you paid for.',
  savingChip: 'Yearly recommended',
  yearlyLine: 'Three months free, which works out at $3 a month.',
  monthlyLine: 'Yearly is three months free, at $3 a month.',
}
