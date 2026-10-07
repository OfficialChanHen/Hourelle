/* How many are in, said one way everywhere, always as a number out of a whole so it
   reads at a glance. Who counts is decided once, in lib/events (answeredIds, rsvpPool).

     while deciding   out of everyone invited: "3 of 9 have answered"
     once locked      going, out of the people available for the locked time:
                      "4 of 5 who can make it are going", and with `detail` the rest of
                      them after a colon: "4 of 5 who can make it are going: 1 maybe".
                      A plan whose date was set at creation never asked for times, so
                      there it is out of everyone: "4 of 6 are going"

   Screens differ only in whether they add the detail, never in the wording. No
   closing full stop: a caller writing a sentence adds its own. */

type Rsvp = 'attending' | 'maybe' | 'not_going' | 'pending'

const verb = (n: number, of: number) => (n === 1 && of === 1 ? 'has' : 'have')

/** "3 of 9 have answered": marked times or said none of them work. */
export function answeredLine(answered: number, total: number): string {
  return `${answered} of ${total} ${verb(answered, total)} answered`
}

/** "4 of 5 who can make it are going", with `detail` ": 1 maybe, 1 said no, 1 hasn't
 *  replied". `pool` is rsvpPool(event). */
export function goingLine(pool: { people: { rsvp: Rsvp | string }[]; byTimes: boolean }, detail = false): string {
  let going = 0, maybe = 0, no = 0, waiting = 0
  for (const p of pool.people) {
    if (p.rsvp === 'attending') going++
    else if (p.rsvp === 'maybe') maybe++
    else if (p.rsvp === 'not_going') no++
    else waiting++
  }
  const of = pool.people.length
  const base = pool.byTimes
    ? `${going} of ${of} who can make it ${going === 1 ? 'is' : 'are'} going`
    : `${going} of ${of} ${going === 1 && of === 1 ? 'is' : 'are'} going`
  if (!detail) return base
  const parts = [maybe && `${maybe} maybe`, no && `${no} said no`, waiting && `${waiting} ${waiting === 1 ? 'hasn’t' : 'haven’t'} replied`].filter(Boolean)
  return parts.length ? `${base}: ${parts.join(', ')}` : base
}
