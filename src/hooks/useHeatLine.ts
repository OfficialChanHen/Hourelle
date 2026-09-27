'use client'

import { useSyncExternalStore } from 'react'

/* What the grid's colours mean, said the way the grid looks right now. More people
   free is a darker cell on a light theme and a brighter one on a dark theme, and the
   ramp is green in the house and Studio palettes but blue in Daylight and High
   contrast, so one fixed sentence ("the darker the green") was wrong somewhere
   whichever way it was put. Read from the attributes on <html>, and followed live,
   so switching theme changes the words too. Copy that needs it writes HEAT_LINE
   where the sentence goes. */
export const HEAT_LINE = '{heat}'
const LIGHT_GREEN = 'The darker the green, the more people are free.'

function read(): string {
  const root = document.documentElement
  const dark = root.getAttribute('data-theme') === 'dark'
  const palette = root.getAttribute('data-palette')
  const hue = palette === 'daylight' || palette === 'contrast' ? 'blue' : 'green'
  return `The ${dark ? 'brighter' : 'darker'} the ${hue}, the more people are free.`
}
function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] })
  return () => mo.disconnect()
}

/** The sentence for the theme on screen. */
export function useHeatLine(): string {
  return useSyncExternalStore(subscribe, read, () => LIGHT_GREEN)
}
/** Copy with HEAT_LINE in it, filled in. */
export function withHeatLine(text: string, line: string): string {
  return text.split(HEAT_LINE).join(line)
}
