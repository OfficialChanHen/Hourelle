// The image behind a plan's link preview (see lib/server/preview-image).
//
// The plain link already grants all of it (it is what the join page's teaser
// shows), so the image needs no token. A plan that does not exist, or a demo, is a
// 404 and the chat app falls back to the title and description it was given.

import { previewEvent } from '@/lib/server/preview'
import { previewImage } from '@/lib/server/preview-image'
import { previewOf } from '@/lib/link-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = previewOf(await previewEvent((await params).id))
  if (!p) return new Response('Not found', { status: 404 })
  return previewImage(p)
}
