// Where to send someone after they log in: a page of ours, or nothing.
// "Starts with / but not //" is not enough. Browsers read a backslash as a slash
// and drop tabs and newlines, so `/\evil.com` and `/\t/evil.com` both leave the
// site. The address is resolved the way the browser will, and kept only if it
// stays on this origin.

const HERE = 'https://local.invalid'

/** The path, query and hash of `raw` when it is one of our own pages, else null. */
export function localPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null
  let url: URL
  try { url = new URL(raw, HERE) } catch { return null }
  if (url.origin !== HERE) return null
  const path = url.pathname + url.search + url.hash
  // a path that only resolved here after the parser rewrote it is refused too
  return path.startsWith('//') || path.includes('\\') ? null : path
}
