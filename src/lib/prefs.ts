/* ── device preferences: tiny, local, and real ──
   Settings that can work without a backend do work — stored per browser, read by
   the surfaces they affect. Anything that needs a server says so honestly in the
   settings UI instead of pretending. */

const H24_KEY = 'aline.pref.h24'
const NOTIFY_KEY = 'aline.pref.notify'
export const PREFS_CHANGED = 'aline:prefs-changed'

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREFS_CHANGED))
}

// clock style for time labels (grids, pickers): false = 12-hour, true = 24-hour
export function prefH24(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(H24_KEY) === '1' } catch { return false }
}
export function setPrefH24(v: boolean): void {
  try { v ? localStorage.setItem(H24_KEY, '1') : localStorage.removeItem(H24_KEY) } catch { /* private mode */ }
  announce()
}

// which reminders the visitor wants once email exists — stored now, honest about
// when they start doing anything
export type NotifyPrefs = { eventDay: boolean; deadlines: boolean; replies: boolean }
const NOTIFY_DEFAULTS: NotifyPrefs = { eventDay: true, deadlines: true, replies: false }

export function prefNotify(): NotifyPrefs {
  if (typeof window === 'undefined') return NOTIFY_DEFAULTS
  try {
    const raw = localStorage.getItem(NOTIFY_KEY)
    return raw ? { ...NOTIFY_DEFAULTS, ...(JSON.parse(raw) as Partial<NotifyPrefs>) } : NOTIFY_DEFAULTS
  } catch {
    return NOTIFY_DEFAULTS
  }
}
export function setPrefNotify(patch: Partial<NotifyPrefs>): void {
  try { localStorage.setItem(NOTIFY_KEY, JSON.stringify({ ...prefNotify(), ...patch })) } catch { /* private mode */ }
  announce()
}

// color palette override ('studio', 'daylight', …) — null, or the house key 'aline',
// means the house look. The raw key is also read by the inline script in
// app/layout.tsx, which runs before hydration and can't import this module; keep the
// key AND the moved-key table below in sync with it.
const PALETTE_KEY = 'aline.palette'
// appearances that were renamed or retired. A browser that picked one before lands on
// its nearest survivor instead of on a palette the stylesheet no longer defines.
const MOVED: Record<string, string> = { gcal: 'daylight', pro: 'studio', drain: 'aline', pride: 'aline' }
export function prefPalette(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PALETTE_KEY)
    return raw ? MOVED[raw] ?? raw : null
  } catch { return null }
}
export function setPrefPalette(p: string): void {
  try { localStorage.setItem(PALETTE_KEY, p) } catch { /* private mode */ }
}

// one-time UI hints ("drag to reorder", …): shown until dismissed, per browser
const hintKey = (name: string) => `aline.hint.${name}`
export function hintDismissed(name: string): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(hintKey(name)) === '1' } catch { return false }
}
export function dismissHint(name: string): void {
  try { localStorage.setItem(hintKey(name), '1') } catch { /* private mode */ }
}
