'use client'

// Keep a piece of panel state following a prop that can change under it.
// The panels seed their editable state from the event once, then own it — right
// for the demo (which lives only in memory) and for edits in flight. But the
// event also changes from outside while a tab is open: someone else's vote or
// availability lands over the websocket, the host adds a place on another device.
// Before this hook, that data sat in the cache until the next navigation.
//
// The state is reset only when the prop's value actually changes, compared by
// JSON, so a same-shaped object on a re-render does not count and the panel's own
// edit (which comes back through the parent as the very value it just set) is a
// no-op. It runs during render — the derived-state pattern React documents — so
// the fresh value is on screen in the same paint as the rest of the event.

import { useState } from 'react'

export function useFollow<T>(remote: T, apply: (value: T) => void): void {
  const sig = JSON.stringify(remote) ?? ''
  const [seen, setSeen] = useState(sig)
  if (sig !== seen) {
    setSeen(sig)
    apply(remote)
  }
}
