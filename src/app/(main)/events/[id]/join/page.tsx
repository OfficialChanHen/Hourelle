// The invite link's landing page. Everything about joining is a browser decision —
// who this browser already is, whether the token names someone on the list — so the
// server component does nothing but unwrap the route param and hand it over.

import { JoinFlow } from './JoinFlow'

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JoinFlow id={id} />
}
