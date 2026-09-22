'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BackLink } from '@/components/ui/BackLink'
import { getEvent } from '@/lib/events'

/* The way back from Help depends on the way in. The tour ends on "Watch the clips",
   and a guest who follows it arrives here with no header to speak of and no account
   to go back to: the only way back to the event they just joined was the browser's
   own button. So a link that came from an event carries it (?from=<id>), and the way
   back is to that event, by name, for anyone. Everyone else keeps the way back to
   their profile, which only an account has.

   The address is read with useSearchParams under Suspense, because this page is
   rendered ahead of time and its props know nothing of the query on a real visit. */
function useFrom() {
  const from = useSearchParams().get('from')
  const id = from && /^[\w-]{1,80}$/.test(from) ? from : null
  // the name is on this device (a guest joined here); read after mount
  const [title, setTitle] = useState<string | null>(null)
  useEffect(() => { if (id) setTitle(getEvent(id)?.title ?? null) }, [id])
  return { id, title }
}

function Back() {
  const { id, title } = useFrom()
  if (id) return <BackLink href={`/events/${id}`} label={title ?? 'Back to the event'} />
  return <BackLink href="/profile" label="Profile" onlyWithAccount />
}

/* The tour's link lands on the clips, well below the back link at the top, so the
   way back is also said where the watching ends: one button under the four clips,
   and only for someone who came from an event. */
function AfterClips() {
  const { id, title } = useFrom()
  if (!id) return null
  return (
    <Link href={`/events/${id}`} className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent sm:h-10 sm:w-auto sm:justify-start">
      <ArrowLeft size={16} className="flex-none" /> <span className="truncate">{title ? `Back to ${title}` : 'Back to the event'}</span>
    </Link>
  )
}

export function HelpBack() {
  return <Suspense fallback={null}><Back /></Suspense>
}
export function HelpBackAfterClips() {
  return <Suspense fallback={null}><AfterClips /></Suspense>
}
