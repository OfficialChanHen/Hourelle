import Link from 'next/link'
import { Plus, type LucideIcon } from 'lucide-react'
import { PhotoFrame } from './PhotoFrame'

/* Nothing here yet, said the same way everywhere, and said warmly: the title is a
   short friendly line, the body says what fills the spot. It is one of the app's
   moments, so it wears the scrapbook look: an empty taped photo, tilted a little,
   with a dashed slot where the picture will go. Always offer a way out: `action` is
   the thing to do, `secondary` is the quieter alternative (usually the demo shelf,
   for someone with nothing of their own yet). `compact` is for an empty section
   inside a fuller page. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  secondary,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: { label: string; href: string }
  // a quieter second way out (e.g. the demo shelf), under the primary button
  secondary?: { label: string; href: string }
  compact?: boolean
}) {
  return (
    <div className={`mx-auto w-full max-w-[440px] ${compact ? 'pt-2' : 'pt-4'}`}>
      <PhotoFrame tilt={-1} tape="center">
        <div className={`grid place-items-center rounded-lg border border-dashed border-border2 bg-s2 text-dim ${compact ? 'h-[84px]' : 'h-[120px]'}`}>
          <Icon size={26} aria-hidden />
        </div>
        <div className={`px-3 text-center ${compact ? 'pb-2 pt-4' : 'pb-4 pt-5'}`}>
          <p className="font-serif text-[24.5px] tracking-[-0.01em]">{title}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-[1.5] text-dim">{body}</p>
          {action && (
            <Link
              href={action.href}
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent sm:h-9"
            >
              <Plus size={17} /> {action.label}
            </Link>
          )}
          {secondary && (
            <div className="mt-1.5">
              <Link href={secondary.href} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-accent-text hover:underline sm:min-h-0 sm:py-1">
                {secondary.label}
              </Link>
            </div>
          )}
        </div>
      </PhotoFrame>
    </div>
  )
}
