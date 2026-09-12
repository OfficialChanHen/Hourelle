'use client'

// The live room for one event: who has it open, and who is typing. Joins on mount,
// leaves on unmount, and stays quiet when there is no backend to talk to.

import { useEffect, useMemo, useRef, useState } from 'react'
import { joinEventRoom, type Peer, type Room } from '@/lib/room'

export function useEventRoom(eventId: string, me: Peer | null) {
  const [peers, setPeers] = useState<Peer[]>([])
  const [typing, setTyping] = useState<Peer[]>([])
  const room = useRef<Room | null>(null)
  // the identity is an object rebuilt every render; only its contents should rejoin
  const key = me ? `${me.id}|${me.name}|${me.initials}|${me.color}` : ''

  useEffect(() => {
    if (!me || !key) return
    const r = joinEventRoom(eventId, me, { onPeers: setPeers, onTyping: setTyping })
    room.current = r
    return () => { r.leave(); room.current = null; setPeers([]); setTyping([]) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, key])

  return useMemo(() => ({
    // everyone here but you — you already know you are here
    here: peers.filter((p) => p.id !== me?.id),
    typing,
    onType: () => room.current?.typing(),
    onStopTyping: () => room.current?.stopped(),
  }), [peers, typing, me?.id])
}
