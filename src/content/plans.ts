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
    priceNote: 'always',
    tagline: 'The whole thing, for everyone.',
    features: [
      'Unlimited events, guests and places',
      'The availability grid, day polls and quick fills',
      'Place votes, itineraries and driving routes',
      'Chat, RSVPs and attendance',
      'Invites, nudges, lock-in announcements and reminders by email',
      'Calendar import from Google and Outlook (coming soon)',
      'Calendar files and links to add a plan to any calendar',
    ],
  },
  plus: {
    key: 'plus',
    name: 'Hourelle Plus',
    price: '$3',
    priceNote: 'a month',
    yearly: '$30',
    monthlyNote: 'a month',
    yearlyNote: 'a year',
    tagline: 'For the people who keep it going.',
    features: [
      'Everything in Free',
      'Helps pay for better maps and a faster app',
      'A Plus mark and a reply within two days',
      'New features first',
      'No ads, no tracking, nobody to answer to',
    ],
  },
}

/* ── the few lines that decide it, on the cards themselves ──
   Short on purpose, and in this order: what Free has, then what only Plus has,
   then the one thing nobody has yet. `'soon'` is its own answer and the honest one
   for the calendar connection: adding a plan to a calendar is already free and the
   emailed entry updates itself, but a direct link to Google or Outlook is not
   built, so neither column gets a tick. It goes last, because a promise should
   never sit above a fact. */
export type Answer = true | false | 'soon'
export type Row = { label: string; free: Answer; plus: Answer }

export const CRUCIAL: Row[] = [
  { label: 'Times, places, attendance and chat', free: true, plus: true },
  { label: 'Any number of events, guests and places', free: true, plus: true },
  { label: 'Guests answer without an account', free: true, plus: true },
  { label: 'Invites, reminders and add to calendar', free: true, plus: true },
  { label: 'Helps pay for better maps and a faster app', free: false, plus: true },
  { label: 'A Plus mark and a reply within two days', free: false, plus: true },
  { label: 'New features first', free: false, plus: true },
  { label: 'Calendar sync that keeps your times up to date', free: false, plus: 'soon' },
]

/** What a Plus card lists: the whole of Free in one line, then only what it adds. */
export const PLUS_ADDS: Row[] = CRUCIAL.filter((r) => r.free !== true)

/* ── what buying one actually signs you up for ──
   Said before the button, not after it: an automatic renewal has to be disclosed
   plainly, and cancelling has to be as easy as starting. Both are true here, since
   Stripe's own portal does the cancelling. */
export const BILLING_TERMS = {
  renews: 'Renews automatically until you cancel.',
  cancel: 'Cancel any time, in two clicks, and Plus runs to the end of what you paid for.',
  saving: 'Two months free',
  recommended: 'Recommended',
}
