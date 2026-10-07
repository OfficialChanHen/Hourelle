'use client'

import { createContext, useContext } from 'react'

/* Everything inside a <Still> is drawn but never animated: pencil marks appear already
   drawn, faces peeking over a card neither rise nor follow the scroll. For copies that
   nobody sees, like a Deck's ghosts (drawn only to size the stack), so they cost layout
   and nothing more: no tweens ticking, no observers, on a phone that has frames to spare
   for the card that is actually moving. */
const StillContext = createContext(false)

export function Still({ children }: { children: React.ReactNode }) {
  return <StillContext.Provider value>{children}</StillContext.Provider>
}

/** Whether this part of the page is a still copy, so animations should not run. */
export const useStill = () => useContext(StillContext)
