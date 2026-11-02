// The invite link's landing page. Everything about joining is a browser decision —
// who this browser already is, whether the token names someone on the list — so the
// server component does nothing but unwrap the route param and hand it over.

import type { Metadata } from 'next'
import { JoinFlow } from './JoinFlow'
import { previewMetadata } from '@/lib/server/preview'

// what the link shows when it is pasted into a chat: the plan, or for a personal
// link whose person was removed, nothing beyond the site's own preview
export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ invite?: string | string[] }>
}): Promise<Metadata> {
  const { id } = await params
  const { invite } = await searchParams
  return previewMetadata(id, typeof invite === 'string' ? invite : null)
}

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JoinFlow id={id} />
}
