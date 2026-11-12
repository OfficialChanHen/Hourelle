import type { AppEvent, Participant } from './events'

/* Co-hosts: people the host trusts to run the plan with them. A co-host may do what
   the host does day to day (edit the details, invite, remove people, lock it in or
   reopen it) but not the host's own calls: deleting the plan, the budget, and who
   else co-hosts. Only someone with an account can be one, because the database has
   to know who is asking (migration 0021 holds the same line). Pure, so the server
   routes and the tests read the same rules the screens do. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isCohost = (p: Pick<Participant, 'cohost' | 'host'>): boolean => !!p.cohost && !p.host

/** Could this person be made a co-host? An account on a plan owned by an account. */
export function canBeCohost(ev: Pick<AppEvent, 'participants'>, p: Participant): boolean {
  const host = ev.participants.find((x) => x.host)
  return !!host && UUID_RE.test(host.id) && !p.host && !p.guest && UUID_RE.test(p.id)
}

/** In a view (viewOf): may this browser manage the plan, as its host or a co-host? */
export function canManage(ev: Pick<AppEvent, 'hostedByYou' | 'participants' | 'demo'>): boolean {
  if (ev.demo) return false
  return !!ev.hostedByYou || ev.participants.some((p) => p.you && isCohost(p))
}

/** On the server: does this account host the plan or co-host it? */
export function managesEvent(ev: Pick<AppEvent, 'participants'>, hostId: string | null, accountId: string): boolean {
  if (hostId && hostId === accountId) return true
  return ev.participants.some((p) => p.id === accountId && isCohost(p))
}

/** The host making someone a co-host, or taking it back. */
export function setCohostPatch(ev: Pick<AppEvent, 'participants'>, pid: string, on: boolean): Pick<AppEvent, 'participants'> {
  return {
    participants: ev.participants.map((p) => (p.id === pid ? { ...p, cohost: on || undefined } : p)),
  }
}
