'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useFromEvent } from '@/components/EventBack'

/* The tour's link lands on the clips, well below the back link at the top, so the
   way back is also said where the watching ends: one button under the four clips,
   and only for someone who came from an event. */
function AfterClips() {
  const { id, title } = useFromEvent()
  if (!id) return null
  return (
    <Link href={`/events/${id}`} className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent sm:h-10 sm:w-auto sm:justify-start">
      <ArrowLeft size={16} className="flex-none" /> <span className="truncate">{title ? `Back to ${title}` : 'Back to the event'}</span>
    </Link>
  )
}

export function HelpBackAfterClips() {
  return <Suspense fallback={null}><AfterClips /></Suspense>
}
