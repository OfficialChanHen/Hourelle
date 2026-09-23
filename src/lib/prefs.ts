/* ── device preferences: tiny, local, and real ──
   Settings that can work without a backend do work — stored per browser, read by
   the surfaces they affect. Anything that needs a server says so honestly in the
   settings UI instead of pretending. */

const H24_KEY = 'hourelle.pref.h24'
const NOTIFY_KEY = 'hourelle.pref.notify'
export const PREFS_CHANGED = 'hourelle:prefs-changed'

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
// `email` is the channel: off, nothing below it is sent by mail whatever it says
export type NotifyPrefs = { email: boolean; lockIn: boolean; eventDay: boolean; deadlines: boolean; replies: boolean }
export const NOTIFY_DEFAULTS: NotifyPrefs = { email: true, lockIn: true, eventDay: true, deadlines: true, replies: false }

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

// whether the availability grid shows the whole calendar week or only the days the
// event actually asks about. Off by default: a poll that starts midweek opens on the
// days being answered, and the seam buttons in the grid still open the rest.
const WHOLE_WEEK_KEY = 'hourelle.pref.whole-week'
export function prefWholeWeek(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(WHOLE_WEEK_KEY) === '1' } catch { return false }
}
export function setPrefWholeWeek(v: boolean): void {
  try { v ? localStorage.setItem(WHOLE_WEEK_KEY, '1') : localStorage.removeItem(WHOLE_WEEK_KEY) } catch { /* private mode */ }
  announce()
}

// alert sounds for a new message and a new notification. On by default: they are
// short, quiet, and the only way the app can reach you while you are on another tab.
const SOUND_KEY = 'hourelle.pref.sound'
export function prefSound(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return false }
}
export function setPrefSound(v: boolean): void {
  try { v ? localStorage.removeItem(SOUND_KEY) : localStorage.setItem(SOUND_KEY, '0') } catch { /* private mode */ }
  announce()
}

// color palette override ('studio', 'daylight', …) — null, or the house key 'hourelle',
// means the house look. The raw key is also read by the inline script in
// app/layout.tsx, which runs before hydration and can't import this module; keep the
// key AND the moved-key table below in sync with it.
const PALETTE_KEY = 'hourelle.palette'
// appearances that were renamed or retired. A browser that picked one before lands on
// its nearest survivor instead of on a palette the stylesheet no longer defines.
const MOVED: Record<string, string> = { gcal: 'daylight', pro: 'studio', drain: 'hourelle', pride: 'hourelle', aline: 'hourelle' }
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

// accessibility: how much the app moves, and two ways of making it easier to find
// your place in it. Each is an attribute on <html> that globals.css reads, set before
// paint by the inline script in app/layout.tsx (keep A11Y_KEY and the attribute
// names in sync with it). Motion 'system' follows the device's reduce-motion setting.
const A11Y_KEY = 'hourelle.pref.a11y'
export type A11yPrefs = { motion: 'system' | 'reduce'; links: boolean; focus: boolean }
export const A11Y_DEFAULTS: A11yPrefs = { motion: 'system', links: false, focus: false }
export function prefA11y(): A11yPrefs {
  if (typeof window === 'undefined') return A11Y_DEFAULTS
  try {
    const raw = localStorage.getItem(A11Y_KEY)
    return raw ? { ...A11Y_DEFAULTS, ...(JSON.parse(raw) as Partial<A11yPrefs>) } : A11Y_DEFAULTS
  } catch { return A11Y_DEFAULTS }
}
export function applyA11y(p: A11yPrefs): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const set = (name: string, on: boolean, v: string) => (on ? root.setAttribute(name, v) : root.removeAttribute(name))
  set('data-motion', p.motion === 'reduce', 'reduce')
  set('data-links', p.links, 'underline')
  set('data-focus', p.focus, 'strong')
}
export function setPrefA11y(patch: Partial<A11yPrefs>): void {
  const next = { ...prefA11y(), ...patch }
  try { localStorage.setItem(A11Y_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  applyA11y(next)
  announce()
}
/** Should this animation be skipped? True when the device asks for less motion or
 *  the person chose it here. Every animation that checks for reduced motion asks this. */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return document.documentElement.getAttribute('data-motion') === 'reduce'
    || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** The look back to how it ships: the house warm neutral, and the theme following
 *  the device. Called when an account ends, so the next person at this browser
 *  starts where everyone starts rather than inside the last one's choices. */
export function resetAppearance(): void {
  try {
    localStorage.removeItem(PALETTE_KEY)
    localStorage.setItem('theme', 'system') // next-themes reads this key
  } catch { /* private mode */ }
  if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-palette')
  announce()
}

// one-time UI hints ("drag to reorder", …): shown until dismissed, per browser
const hintKey = (name: string) => `hourelle.hint.${name}`
export function hintDismissed(name: string): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(hintKey(name)) === '1' } catch { return false }
}
export function dismissHint(name: string): void {
  try { localStorage.setItem(hintKey(name), '1') } catch { /* private mode */ }
  announce()
}
export function resetHint(name: string): void {
  try { localStorage.removeItem(hintKey(name)) } catch { /* private mode */ }
  announce()
}
/** Every one-time hint shown again, and nothing else touched. */
export function resetHints(): void {
  try {
    const hints: string[] = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('hourelle.hint.')) hints.push(k) }
    for (const k of hints) localStorage.removeItem(k)
  } catch { /* private mode */ }
  announce()
}

// the tour: four stops on the first event page opened after it was asked for. The
// welcome steps and Settings ask; the event page runs it once and marks it done
// under the hint prefix, so "show the hints again" brings it back with the rest.
const TOUR_KEY = 'hourelle.tour.wanted'
export function tourWanted(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(TOUR_KEY) === '1' } catch { return false }
}
export function setTourWanted(v: boolean): void {
  try { v ? localStorage.setItem(TOUR_KEY, '1') : localStorage.removeItem(TOUR_KEY) } catch { /* private mode */ }
}
/** Start the tour on the page that is open right now, done or not. */
export const TOUR_START = 'hourelle:tour-start'
export function startTour(): void {
  resetHint('tour')
  setTourWanted(true)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOUR_START))
}

// "First time here?" belongs to a person's arrival at an event, not to the device: a
// guest new to an event is asked, whoever used this browser before (an account that
// already took the tour, another guest). The join flow names the event it is asking
// about; that event's page asks, once, and either answer clears it. Someone coming
// back to an entry they already had is not new there, and the join flow never asks.
const ASK_KEY = 'hourelle.tour.ask'
export function askAboutTour(eventId: string): void {
  try { localStorage.setItem(ASK_KEY, eventId) } catch { /* private mode */ }
}
export function tourAskPending(eventId: string): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(ASK_KEY) === eventId } catch { return false }
}
export function answerTourAsk(): void {
  try { localStorage.removeItem(ASK_KEY) } catch { /* private mode */ }
}

/** Every device setting back to how it started: 12-hour clock, event days, sounds on,
 *  the default reminders, the house look, no accessibility overrides, and every one-time hint shown again. The
 *  theme is next-themes' and the caller resets it; the palette attribute on <html>
 *  is cleared here so the page changes at once. */
export function resetPrefs(): void {
  try {
    for (const k of [H24_KEY, NOTIFY_KEY, WHOLE_WEEK_KEY, SOUND_KEY, PALETTE_KEY, A11Y_KEY]) localStorage.removeItem(k)
    const hints: string[] = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('hourelle.hint.')) hints.push(k) }
    for (const k of hints) localStorage.removeItem(k)
  } catch { /* private mode */ }
  if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-palette')
  applyA11y(A11Y_DEFAULTS)
  announce()
}
