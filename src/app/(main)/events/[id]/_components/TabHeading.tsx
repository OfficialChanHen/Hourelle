import type { ReactNode } from 'react'
import { SoftShapes } from '@/components/ui/SoftShapes'

/* The top of a plan tab, said the way the plan header says it: a small eyebrow, then
   where things stand as one serif sentence, then a line of detail under it. Soft
   shapes sit behind this region only; the working parts of the tab below stay flat.
   `aside` holds the tab's own controls (copy a summary, a view switch), on the right
   from a tablet up and under the sentence on a phone. */
export function TabHeading({ eyebrow, title, sub, aside }: {
  eyebrow: string
  title: ReactNode
  sub?: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="relative isolate flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3 pt-2 sm:pb-5">
      <SoftShapes variant="band" />
      <div className="min-w-0 max-w-[760px] flex-1 basis-[420px]">
        <p className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint sm:text-[11px]">{eyebrow}</p>
        <h2 className="mt-2 font-serif text-[26px] font-normal leading-[1.2] tracking-[-0.01em] sm:text-[30px] lg:text-[32px]">{title}</h2>
        {sub && <div className="mt-2.5 text-[14px] leading-[1.55] text-dim sm:text-[15px]">{sub}</div>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  )
}
