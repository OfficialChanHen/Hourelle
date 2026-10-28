/* What a page view tells Vercel Analytics: the page, never the plan. A plan's address
   is its link (anyone holding it can open the plan), and invite and sign-in
   addresses carry tokens in the query or the hash, so the id becomes [id] and
   everything after the path is dropped before anything leaves the browser. */
export function redactUrl(url: string): string {
  const u = new URL(url)
  const path = u.pathname.replace(/^\/events\/[^/]+/, '/events/[id]')
  return `${u.origin}${path}`
}
