'use client'

/* ── two short alerts, synthesized ──
   A new message and a new notification sound different, because they mean different
   things: a message is someone talking (a quick bright rise), a notification is the
   app tapping you on the shoulder (a lower single bell). Both are built from
   oscillators rather than audio files, so there is nothing to download, nothing to
   cache, and nothing to go missing.

   Browsers refuse to make noise before the person has interacted with the page, so
   the audio context is created on demand and woken on the first gesture. Until then
   a play is a silent no-op, which is exactly the right behaviour. */

import { prefSound } from './prefs'

let ctx: AudioContext | null = null
let primed = false

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    type WithLegacy = typeof window & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext ?? (window as WithLegacy).webkitAudioContext
    if (!Ctor) return null
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null // no audio device, a locked-down browser: stay quiet
  }
}

/** Wake the audio on the first tap or key, so a message arriving later can be heard.
 *  Mounted once; the listeners take themselves off after the first gesture. */
export function primeSound(): void {
  if (primed || typeof window === 'undefined') return
  primed = true
  const wake = () => {
    audio()
    window.removeEventListener('pointerdown', wake)
    window.removeEventListener('keydown', wake)
  }
  window.addEventListener('pointerdown', wake, { once: true })
  window.addEventListener('keydown', wake, { once: true })
}

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number }

function play(notes: Note[]): void {
  if (!prefSound()) return
  const a = audio()
  if (!a || a.state !== 'running') return
  for (const n of notes) {
    const osc = a.createOscillator()
    const amp = a.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.value = n.freq
    const t0 = a.currentTime + n.at
    // exponential ramps, never a straight cut: a square edge on a gain node is a click
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(n.gain ?? 0.07, t0 + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur)
    osc.connect(amp)
    amp.connect(a.destination)
    osc.start(t0)
    osc.stop(t0 + n.dur + 0.03)
  }
}

/** Someone said something: two quick notes a fourth apart, rising. */
export function playMessage(): void {
  play([
    { freq: 659.25, at: 0, dur: 0.09, gain: 0.06 },
    { freq: 880, at: 0.072, dur: 0.13, gain: 0.055 },
  ])
}

/** The app has something for you: one lower note with its fifth under it, left to ring. */
export function playNotification(): void {
  play([
    { freq: 523.25, at: 0, dur: 0.5, type: 'triangle', gain: 0.075 },
    { freq: 783.99, at: 0.012, dur: 0.4, gain: 0.03 },
  ])
}

/* ── which room is on screen ──
   A message you are already watching arrive does not need a sound. The chat drawer
   says which event it is showing while it is open, and the alert watcher skips it. */
let watching: string | null = null
export function setWatchingChat(eventId: string | null): void { watching = eventId }
export function watchingChat(): string | null { return watching }
