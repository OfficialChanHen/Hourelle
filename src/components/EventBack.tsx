'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { BackLink } from '@/components/ui/BackLink'
import { getEvent } from '@/lib/events'

/* ── the way back to the event you came from ──
   The footer is on every page, an event's included, and its pages (About, Help,
   Demos, Privacy, Terms) sit outside the app's own navigation. A guest has no header
   to speak of and no account, so following one of them used to leave the browser's
   own button as the only way back to the event they had just joined.

   So a footer link followed from an event carries it (?from=<id>), and every footer
   page offers the way back to that event, by name, for anyone. Moving between footer
   pages keeps it, since the footer reads the arriving ?from= as well as the event in
   the address. Pages that have their own way back keep it for everyone else.

   The address is read with useSearchParams under Suspense, because these pages are
   rendered ahead of time and their props know nothing of the query on a real visit. */
const ID = /^[\w-]{1,80}$/

/** The event this page was reached from: the one in the address, or the one carried in. */
export function useFromEvent(): { id: string | null; title: string | null } {
  const pathname = usePathname()
  const carried = useSearchParams().get('from')
  const inPath = /^\/events\/([^/?#]+)/.exec(pathname ?? '')?.[1] ?? null
  const id = [inPath, carried].find((x): x is string => !!x && ID.test(x)) ?? null
  // the name is on this device (a guest joined here); read after mount
  const [title, setTitle] = useState<string | null>(null)
  useEffect(() => { setTitle(id ? getEvent(id)?.title ?? null : null) }, [id])
  return { id, title }
}

function Back({ fallback }: { fallback?: { href: string; label: string } }) {
  const { id, title } = useFromEvent()
  if (id) return <BackLink href={`/events/${id}`} label={title ?? 'Back to the event'} />
  return fallback ? <BackLink href={fallback.href} label={fallback.label} onlyWithAccount /> : null
}

/** The back link at the top of a footer page: to the event it was reached from, or to
 *  `fallback` for an account when there is none. */
export function EventBack({ fallback }: { fallback?: { href: string; label: string } }) {
  return <Suspense fallback={null}><Back fallback={fallback} /></Suspense>
}
