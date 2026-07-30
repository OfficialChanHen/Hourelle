import { JoinFlow } from './JoinFlow'

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JoinFlow id={id} />
}
