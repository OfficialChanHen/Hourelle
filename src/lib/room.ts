'use client'

/* ── who is here right now, and who is typing ──
   Availability, votes and chat are facts: they belong in tables and they have to
   survive a reload. This is the other kind of information — true for a few seconds
   and worthless after — so it never touches the database. A Supabase Realtime
   channel per event carries it: presence for who has the page open, a broadcast for
   who is mid-sentence. Nothing here is persisted, and nothing here is trusted for
   anything but a hint on screen.

   The room is a nicety, so every failure is silence: no backend, a refused socket or
   a dropped connection all just mean an empty room, and the page is unchanged. */

import { supabase, backendOn } from './db'
import type { PersonColor } from './colors'

export type Peer = { id: string; name: string; initials: string; color: PersonColor }

// how long a "still typing" ping stays believable. The sender re-pings well inside
// this, so the only way it expires is if they actually stopped (or walked away).
const TYPING_TTL = 4000
const TYPING_PING = 1600

type RoomHandlers = { onPeers: (peers: Peer[]) => void; onTyping: (typing: Peer[]) => void }

export type Room = {
  /** Call on every keystroke; it rate-limits itself down to one ping per 1.6s. */
  typing: () => void
  /** Sent on send, on blur, and on leaving — so the line clears at once. */
  stopped: () => void
  leave: () => void
}

const NO_ROOM: Room = { typing: () => {}, stopped: () => {}, leave: () => {} }

export function joinEventRoom(eventId: string, me: Peer, handlers: RoomHandlers): Room {
  if (!backendOn || !me.id) return NO_ROOM

  const channel = supabase!.channel(`event:${eventId}`, {
    config: { presence: { key: me.id }, broadcast: { self: false } },
  })

  // id → when they were last known to be typing
  const typers = new Map<string, { peer: Peer; at: number }>()
  let sweep: ReturnType<typeof setInterval> | null = null
  let lastPing = 0
  let gone = false

  const emitTyping = () => {
    const now = Date.now()
    let changed = false
    for (const [id, t] of typers) if (now - t.at > TYPING_TTL) { typers.delete(id); changed = true }
    if (changed || typers.size) handlers.onTyping([...typers.values()].map((t) => t.peer))
    if (!typers.size && sweep) { clearInterval(sweep); sweep = null }
  }

  channel
    .on('presence', { event: 'sync' }, () => {
      // one entry per person, whatever the device count — two tabs are still one face
      const state = channel.presenceState<Peer>()
      const peers = Object.values(state).map((entries) => entries[0]).filter((p): p is Peer & { presence_ref: string } => !!p?.id)
      handlers.onPeers(peers.map(({ id, name, initials, color }) => ({ id, name, initials, color })))
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      const p = payload as Peer
      if (!p?.id || p.id === me.id) return
      typers.set(p.id, { peer: p, at: Date.now() })
      handlers.onTyping([...typers.values()].map((t) => t.peer))
      if (!sweep) sweep = setInterval(emitTyping, 900)
    })
    .on('broadcast', { event: 'stopped' }, ({ payload }) => {
      const id = (payload as { id?: string })?.id
      if (!id || !typers.delete(id)) return
      handlers.onTyping([...typers.values()].map((t) => t.peer))
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !gone) void channel.track(me)
    })

  return {
    typing: () => {
      const now = Date.now()
      if (now - lastPing < TYPING_PING) return
      lastPing = now
      void channel.send({ type: 'broadcast', event: 'typing', payload: me })
    },
    stopped: () => {
      lastPing = 0
      void channel.send({ type: 'broadcast', event: 'stopped', payload: { id: me.id } })
    },
    leave: () => {
      gone = true
      if (sweep) clearInterval(sweep)
      void channel.send({ type: 'broadcast', event: 'stopped', payload: { id: me.id } })
      void supabase!.removeChannel(channel)
    },
  }
}

/** "Kim is typing", "Kim and Sam are typing", "Kim, Sam and 2 others are typing".
 *  First names only: the line is glanced at, not read. */
export function typingLine(peers: Peer[]): string | null {
  const names = peers.map((p) => p.name.trim().split(/\s+/)[0] || p.name).filter(Boolean)
  if (!names.length) return null
  // the trailing dots are the sentence still being written
  if (names.length === 1) return `${names[0]} is typing...`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing...`
  return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`
}
