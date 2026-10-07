/* How many have answered, said one way everywhere: always a count out of everyone in
   the plan, so how many reads at a glance.

     while deciding   "3 of 9 have answered"
     once locked      "4 of 6 have replied", and with `detail` the same sentence with
                      who said what after a colon: "4 of 6 have replied: 3 going, 1 maybe"

   Screens differ only in whether they add the detail, never in the wording. No
   closing full stop: a caller writing a sentence adds its own. */

type Rsvp = 'attending' | 'maybe' | 'not_going' | 'pending'

const verb = (n: number, of: number) => (n === 1 && of === 1 ? 'has' : 'have')

/** "3 of 9 have answered": marked times or said none of them work. */
export function answeredLine(answered: number, total: number): string {
  return `${answered} of ${total} ${verb(answered, total)} answered`
}

/** "4 of 6 have replied", with `detail` ": 3 going, 1 maybe, 1 can't make it". */
export function repliedLine(people: { rsvp: Rsvp | string }[], detail = false): string {
  let going = 0, maybe = 0, out = 0
  for (const p of people) {
    if (p.rsvp === 'attending') going++
    else if (p.rsvp === 'maybe') maybe++
    else if (p.rsvp === 'not_going') out++
  }
  const replied = going + maybe + out
  const base = `${replied} of ${people.length} ${verb(replied, people.length)} replied`
  if (!detail || !replied) return base
  const parts = [going && `${going} going`, maybe && `${maybe} maybe`, out && `${out} can’t make it`].filter(Boolean)
  return `${base}: ${parts.join(', ')}`
}
