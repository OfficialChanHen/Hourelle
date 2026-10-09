import { Avatar } from './Avatar'
import type { AppEvent } from '@/lib/events'

/* Whose plan this is, as a name tag on its picture, like the return address on an
   envelope: the host's face and "Hosting" when it is yours, "From Sam" when you were
   invited. Words and a face, never a colour, so it reads at a glance for everyone.
   It sits on the cover (the picture is already the card's scrapbook part), bottom
   left, so it never covers the name or the details. */
// `inline` is the same words and face in a line of text, for a row whose picture is too
// small to carry a tag (Home's compact rows)
export function HostTag({ e, size = 'md', inline = false }: { e: Pick<AppEvent, 'participants' | 'hostedByYou' | 'hostName'>; size?: 'sm' | 'md'; inline?: boolean }) {
  const host = e.participants.find((p) => p.host)
  const name = (host?.name || e.hostName || '').split(' ')[0]
  const label = e.hostedByYou ? 'Hosting' : name ? `From ${name}` : 'Invited'
  if (inline) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-dim">
        {host && <Avatar initials={host.initials} color={host.color} face={host.face} size={17} font={7} />}
        <span className="truncate">{label}</span>
      </span>
    )
  }
  const sm = size === 'sm'
  const face = sm ? 15 : 22
  return (
    <span
      className={`absolute z-[2] inline-flex max-w-[calc(100%-8px)] items-center rounded-full bg-s1 font-semibold text-text shadow-[0_1px_3px_rgba(60,40,20,.18)] ${sm ? 'bottom-1 left-1 h-5 gap-1 pl-0.5 pr-[7px] text-[11px]' : 'bottom-2.5 left-2.5 h-7 gap-1.5 pl-[3px] pr-[11px] text-[12.5px]'}`}
    >
      {host && <Avatar initials={host.initials} color={host.color} face={host.face} size={face} font={Math.round(face * 0.4)} />}
      <span className="truncate">{label}</span>
    </span>
  )
}
