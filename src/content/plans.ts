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
    price: '$3',
    priceNote: 'a month',
    yearly: '$30',
    monthlyNote: 'a month',
    yearlyNote: 'a year',
    tagline: 'For the people keeping this going.',
    features: [
      'Everything in Free, which is the whole product',
      'Pays for what this runs on: the servers, the database, the email and the maps',
      'No ads, no tracking, nobody to answer to',
      'A Plus mark on your profile, and a reply within two days when you write in',
      'New features first, starting with a calendar that keeps itself in step',
    ],
  },
}

/* ── the few lines that decide it, on the cards themselves ──
   Short on purpose. A comparison is only worth reading if every row could go
   either way, so these are the ones that actually differ or actually matter.
   `'soon'` is its own answer and the honest one for the calendar connection: the
   emailed entry already updates itself, a direct link to Google or Outlook is not
   built, so neither column gets a tick for it. */
export type Answer = true | false | 'soon'
export type Row = { label: string; free: Answer; plus: Answer }

export const CRUCIAL: Row[] = [
  { label: 'Everything that settles a plan: times, places, attendance and chat', free: true, plus: true },
  { label: 'As many events, guests and places as you like, and guests never need an account', free: true, plus: true },
  { label: 'Invites, nudges and reminders by email', free: true, plus: true },
  { label: 'Add a locked-in plan to any calendar, and the emailed entry updates itself when the plan moves', free: true, plus: true },
  { label: 'Your calendar kept in step on its own, with no email to open', free: false, plus: 'soon' },
  { label: 'Pays for what this runs on: the servers, the database, the email and the maps', free: false, plus: true },
  { label: 'A Plus mark on your profile, a reply within two days, and new features first', free: false, plus: true },
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
