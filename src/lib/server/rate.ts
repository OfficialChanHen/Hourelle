// A small per-address limit for routes anyone may call without logging in.
// Kept in the server's memory, so each running instance counts on its own and a
// cold start forgets: it stops a script hammering one instance, not a determined
// crowd. That is the job here; a shared store can replace it if one is ever needed.

const hits = new Map<string, number[]>()

/** The caller's address as Vercel passes it on, or one shared bucket without it. */
function addressOf(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim()
}

/** True when this address has already made `limit` calls to `route` within the
 *  last `windowMs`; otherwise counts this call and returns false. */
export function tooMany(route: string, req: Request, limit: number, windowMs: number, now = Date.now()): boolean {
  const key = `${route}:${addressOf(req)}`
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) { hits.set(key, recent); return true }
  recent.push(now)
  hits.set(key, recent)
  // an address seen once is not kept for ever
  if (hits.size > 5000) for (const [k, ts] of hits) if (!ts.some((t) => now - t < windowMs)) hits.delete(k)
  return false
}
