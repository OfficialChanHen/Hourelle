'use client'
/* ── three ways to start: the row above an empty grid ──
   With nothing marked yet, the quick answers sit side by side as three flat tiles:
   bring your calendar, use your usual week, or say none of these days work. Each
   carries a small week drawn in the grid's own colours: a calendar's free hours and
   striped busy ones, your real usual week, and an empty week. The tiles are a
   decision surface, so they stay flat and straight; the weeks paint in once.

   Once you mark anything the strip folds away and the toolbar's Import chip takes
   over. It holds while a drag is still going, so the grid never jumps under a
   finger. */

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import Link from 'next/link'
import { Popover, PopoverItem, PopoverTitle } from '@/components/ui/Popover'
import { CalendarPlus } from 'lucide-react'
import { reducedMotion } from '@/lib/prefs'
import type { Iv } from '@/lib/events'

// the hours a mini week spans, as clock minutes: the grid's own 6 AM to 11 PM
const FROM = 6 * 60, TO = 23 * 60
type Block = { s: number; e: number; busy?: boolean }

const BUSY: CSSProperties = { background: 'repeating-linear-gradient(-45deg, var(--s3) 0 1.5px, var(--dim) 1.5px 2.5px)', opacity: 0.55 }
const FREE: CSSProperties = { background: 'color-mix(in srgb, var(--you-text) 30%, var(--you-many))', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--you-text) 55%, transparent)' }

// a calendar as the import reads it: free hours to paint, busy ones to stripe
const SAMPLE: Block[][] = [
  [{ s: 540, e: 720, busy: true }, { s: 1080, e: 1320 }],
  [{ s: 420, e: 600 }, { s: 780, e: 1020, busy: true }],
  [{ s: 600, e: 1140, busy: true }],
  [{ s: 480, e: 660 }, { s: 1020, e: 1260 }],
  [{ s: 720, e: 900, busy: true }, { s: 1140, e: 1380 }],
]

// the shape a usual week might take, shown ghosted until you paint your own
const GHOST: Block[][] = [[{ s: 1080, e: 1320 }], [{ s: 1080, e: 1320 }], [{ s: 1080, e: 1320 }], [{ s: 1080, e: 1320 }], [{ s: 1140, e: 1380 }], [{ s: 600, e: 1320 }], [{ s: 600, e: 1080 }]]

function MiniWeek({ cols, tone = 'plain' }: { cols: Block[][]; tone?: 'plain' | 'none' | 'ghost' }) {
  return (
    <span aria-hidden className={`flex h-[34px] flex-none items-stretch gap-[3px] rounded-lg border p-1 sm:h-[44px] sm:p-[5px] ${tone === 'none' ? 'border-brick-border bg-s1' : tone === 'ghost' ? 'border-dashed border-border2 bg-s1' : 'border-border bg-s1'}`}>
      {cols.map((blocks, i) => (
        <span
          key={i}
          className={`relative w-[6px] overflow-hidden rounded-[2px] sm:w-[8px] ${tone === 'none' ? 'bg-brick-bg' : 'bg-s2'}`}
        >
          {blocks.map((b, j) => {
            const s = Math.max(b.s, FROM), e = Math.min(b.e, TO)
            if (e <= s) return null
            return (
              <span
                key={j}
                data-paint
                className={`absolute inset-x-0 rounded-[2px] ${tone === 'ghost' ? 'opacity-40' : ''}`}
                style={{ top: `${((s - FROM) / (TO - FROM)) * 100}%`, height: `${((e - s) / (TO - FROM)) * 100}%`, ...(b.busy ? BUSY : FREE) }}
              />
            )
          })}
        </span>
      ))}
    </span>
  )
}

// the usual week is Sunday first; the glyph reads Monday first like the profile
function weekCols(days: Iv[][] | undefined, whole: boolean[] | undefined, dayPoll: boolean): Block[][] {
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order.map((d) => (dayPoll
    ? (whole?.[d] ? [{ s: FROM, e: TO }] : [])
    : (days?.[d] ?? []).map((iv) => ({ s: iv.s, e: iv.e }))))
}

const tile = 'flex min-h-11 w-full min-w-0 flex-col items-start gap-1.5 rounded-xl border p-2 text-left sm:gap-2 sm:p-2.5 lg:flex-row lg:items-center lg:gap-3 lg:pr-4'
const idle = 'border-border bg-s0 hover:border-border2 hover:bg-s1'

function TileText({ title, line }: { title: ReactNode; line?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[12.5px] font-semibold leading-tight sm:text-[13px]">{title}</span>
      {line && <span className="hidden text-[12px] leading-snug text-dim sm:block">{line}</span>}
    </span>
  )
}

export function StartStrip({
  open, soon, week, weekDays, weekWhole, dayPoll, providers = ['Google Calendar', 'Outlook'], note, noneSaid, onPick, onWeek, onNone,
}: {
  // false folds it away; it stays mounted until the fold has run
  open: boolean
  soon: boolean
  week: 'ready' | 'empty' | null
  weekDays?: Iv[][]
  weekWhole?: boolean[]
  dayPoll: boolean
  providers?: string[]
  note?: string
  noneSaid: boolean
  onPick: (provider: string) => void
  onWeek: () => void
  onNone: () => void
}) {
  const [shown, setShown] = useState(open)
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  if (open && !shown) setShown(true)

  // the weeks paint in once, a column at a time, the way a drag fills the grid
  useGSAP(() => {
    if (!shown || reducedMotion()) return
    gsap.from('[data-paint]', { scaleY: 0, transformOrigin: '50% 0%', duration: 0.45, ease: 'power2.out', stagger: 0.025, delay: 0.1 })
  }, { scope: ref, dependencies: [shown] })

  // folding: the height closes and the grid rises into the space; coming back after
  // an undo opens the same way. The first mount just appears.
  useGSAP(() => {
    const el = ref.current
    if (first.current) { first.current = false; return }
    if (!el) return
    const still = reducedMotion()
    if (open) {
      if (!still) gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out', clearProps: 'height,opacity' })
      return
    }
    if (still) { setShown(false); return }
    gsap.to(el, { height: 0, opacity: 0, duration: 0.32, ease: 'power2.inOut', onComplete: () => setShown(false) })
  }, { dependencies: [open] })

  if (!shown) return null
  const count = 2 + (week ? 1 : 0)
  return (
    <div ref={ref} className="overflow-hidden" aria-hidden={!open || undefined} inert={!open || undefined}>
      <div role="group" aria-label="Ways to fill your times" className={`grid gap-2 pb-3 sm:gap-2.5 ${count === 3 ? 'grid-cols-3 sm:grid-cols-[repeat(3,minmax(0,300px))]' : 'grid-cols-2 sm:grid-cols-[repeat(2,minmax(0,300px))]'}`}>
        <Popover
          align="start"
          width={248}
          className={`${tile} ${idle}`}
          trigger={() => (
            <>
              <MiniWeek cols={SAMPLE} />
              <TileText title={<><span className="sm:hidden">Calendar</span><span className="hidden sm:inline">Import from calendar</span></>} line={soon ? 'Almost ready' : 'Google or Outlook'} />
            </>
          )}
        >
          {(close) => (
            <>
              <PopoverTitle>{soon ? 'Coming soon' : 'Fills your free times'}</PopoverTitle>
              {soon ? (
                <p className="px-2.5 pb-2 pt-1 text-[12.5px] leading-[1.5] text-dim">Filling your times from Google Calendar or Outlook is almost ready. For now, drag across the grid to mark when you&rsquo;re free.</p>
              ) : (
                <>
                  {note && <p className="mb-1.5 px-2.5 text-[12px] leading-[1.45] text-dim">{note}</p>}
                  {providers.map((name) => (
                    <PopoverItem key={name} onClick={() => { close(); onPick(name) }} icon={<CalendarPlus size={15} className="text-accent-text" />}>
                      {name}
                    </PopoverItem>
                  ))}
                </>
              )}
            </>
          )}
        </Popover>

        {week === 'ready' && (
          <button type="button" onClick={onWeek} className={`${tile} ${idle}`}>
            <MiniWeek cols={weekCols(weekDays, weekWhole, dayPoll)} />
            <TileText
              title={<><span className="sm:hidden">Usual week</span><span className="hidden sm:inline">{dayPoll ? 'Use my usual days' : 'Use my usual week'}</span></>}
              line={dayPoll ? 'The days you keep free' : 'The hours you keep free'}
            />
          </button>
        )}
        {week === 'empty' && (
          <Link href={dayPoll ? '/profile#usual-days' : '/profile#usual-week'} className={`${tile} ${idle}`}>
            <MiniWeek cols={GHOST} tone="ghost" />
            <TileText
              title={<><span className="sm:hidden">Usual week</span><span className="hidden sm:inline">{dayPoll ? 'Set up my usual days' : 'Set up my usual week'}</span></>}
              line="Once, on your profile"
            />
          </Link>
        )}

        <button
          type="button"
          onClick={onNone}
          aria-pressed={noneSaid}
          className={`${tile} ${noneSaid ? 'border-brick-border bg-brick-bg text-brick-text' : `${idle} hover:text-brick-text`}`}
        >
          <MiniWeek cols={[[], [], [], [], []]} tone={noneSaid ? 'none' : 'plain'} />
          <TileText
            title={noneSaid
              ? <><span className="sm:hidden">None of these</span><span className="hidden sm:inline">You said none of these days work</span></>
              : <><span className="sm:hidden">None of these</span><span className="hidden sm:inline">None of these days work</span></>}
            line={noneSaid ? <span className="text-brick-text">Tap again to take it back</span> : 'Tells the group you can’t make it'}
          />
        </button>
      </div>
    </div>
  )
}
