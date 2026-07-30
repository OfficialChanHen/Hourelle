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
