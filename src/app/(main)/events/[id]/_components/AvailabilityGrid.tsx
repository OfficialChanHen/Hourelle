'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { participants, event } from '@/lib/sample'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DATES = ['14', '15', '16', '17', '18', '19', '20']
const WEEKEND = new Set([5, 6])

const START_MIN = 6 * 60 // 6:00
const END_MIN = 23 * 60 // 23:00
const FINE = 15 // selection resolution
const OTHERS = participants.length - 1 // everyone but you

type Mode = 'view' | 'edit'
type Step = 15 | 30 | 60

// deterministic "others free" count (0..OTHERS) with a midday + weekend bias
function othersCount(dayIdx: number, minute: number) {
  const s = Math.sin(dayIdx * 12.9898 + minute * 0.0413) * 43758.5453
  const f = s - Math.floor(s)
  const mid = Math.max(0, 1 - Math.abs(minute - 810) / 560) // peak ~13:30
  const weekend = WEEKEND.has(dayIdx) ? 0.18 : 0
  return Math.max(0, Math.min(OTHERS, Math.round((f * 0.5 + mid * 0.55 + weekend) * OTHERS)))
}

function label(minute: number) {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  const ampm = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return { hr, m, ampm, isHour: m === 0, isHalf: m === 30 }
}

export function AvailabilityGrid() {
  const [mode, setMode] = useState<Mode>('edit')
  const [step, setStep] = useState<Step>(30)
  // your selection at FINE resolution: key `${day}:${minute}`
  const [mine, setMine] = useState<Set<string>>(() => seedMine())
  const painting = useRef<null | boolean>(null) // true=add, false=erase
  const gridRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const out: number[] = []
    for (let m = START_MIN; m < END_MIN; m += step) out.push(m)
    return out
  }, [step])

  useEffect(() => {
    const end = () => (painting.current = null)
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [])

  function subSlots(day: number, minute: number) {
    const keys: string[] = []
    for (let m = minute; m < minute + step; m += FINE) keys.push(`${day}:${m}`)
    return keys
  }
  function cellMine(day: number, minute: number) {
    return subSlots(day, minute).every((k) => mine.has(k))
  }
  function paintCell(day: number, minute: number, add: boolean) {
    setMine((prev) => {
      const next = new Set(prev)
      for (const k of subSlots(day, minute)) add ? next.add(k) : next.delete(k)
      return next
    })
  }
  function onDown(day: number, minute: number) {
    if (mode !== 'edit') return
    const add = !cellMine(day, minute)
    painting.current = add
    paintCell(day, minute, add)
  }
  function onEnter(day: number, minute: number) {
    if (mode !== 'edit' || painting.current === null) return
    paintCell(day, minute, painting.current)
  }

  function preset(from: number, to: number) {
    setMine((prev) => {
      const next = new Set(prev)
      for (let d = 0; d < DAYS.length; d++) for (let m = from; m < to; m += FINE) next.add(`${d}:${m}`)
      return next
    })
  }
  function toggleDay(day: number) {
    setMine((prev) => {
      const next = new Set(prev)
      let allOn = true
      for (let m = START_MIN; m < END_MIN; m += FINE) if (!next.has(`${day}:${m}`)) { allOn = false; break }
      for (let m = START_MIN; m < END_MIN; m += FINE) allOn ? next.delete(`${day}:${m}`) : next.add(`${day}:${m}`)
      return next
    })
  }

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={mode} onChange={(v) => setMode(v as Mode)} options={[{ v: 'view', l: 'View' }, { v: 'edit', l: 'Edit mine' }]} />
        <Segmented value={String(step)} onChange={(v) => setStep(Number(v) as Step)} options={[{ v: '15', l: '15 min' }, { v: '30', l: '30 min' }, { v: '60', l: '1 hr' }]} />
        <div className="hidden items-center gap-1.5 sm:flex">
          <PresetBtn label="Morning" onClick={() => preset(8 * 60, 12 * 60)} disabled={mode !== 'edit'} />
          <PresetBtn label="Afternoon" onClick={() => preset(12 * 60, 17 * 60)} disabled={mode !== 'edit'} />
          <PresetBtn label="Evening" onClick={() => preset(17 * 60, 21 * 60)} disabled={mode !== 'edit'} />
        </div>
        <button
          onClick={() => setMine(new Set())}
          disabled={mode !== 'edit'}
          className="ml-auto rounded-lg border border-border bg-s1 px-3 py-1.5 text-[12px] font-semibold text-dim enabled:hover:text-brick-text disabled:opacity-40"
        >
          Clear mine
        </button>
      </div>

      {/* grid */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-s1 shadow-soft">
        <div ref={gridRef} className="scroll-slim max-h-[560px] overflow-auto" style={{ touchAction: mode === 'edit' ? 'none' : 'auto' }}>
          <div className="grid min-w-[680px]" style={{ gridTemplateColumns: `64px repeat(${DAYS.length}, 1fr)` }}>
            {/* header row */}
            <div className="sticky top-0 left-0 z-30 border-b border-r border-border bg-s1" />
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => mode === 'edit' && toggleDay(i)}
                className={`sticky top-0 z-20 flex flex-col items-center gap-0.5 border-b border-border py-2.5 ${
                  WEEKEND.has(i) ? 'bg-s0 text-faint' : 'bg-s1 text-text'
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[.1em]">{d}</span>
                <span className="font-serif text-[18px] leading-none tracking-[-0.01em]">Jul {DATES[i]}</span>
                {mode === 'edit' && (
                  <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-[5px] border border-border2 text-[9px] text-faint">✓</span>
                )}
              </button>
            ))}

            {/* body */}
            {rows.map((minute) => {
              const { hr, m, ampm, isHour, isHalf } = label(minute)
              return (
                <Row key={minute}>
                  <div className="sticky left-0 z-10 -mt-px flex items-start justify-end border-r border-border bg-s1 pr-2 pt-0.5">
                    <span
                      className={`text-[11px] tabular-nums ${
                        isHour ? 'font-bold text-dim' : isHalf ? 'font-medium text-faint' : 'font-light text-faint/70'
                      }`}
                    >
                      {m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2, '0')}`}
                    </span>
                  </div>
                  {DAYS.map((_, day) => {
                    const isMine = cellMine(day, minute)
                    const others = othersCount(day, minute)
                    const { bg, text, dot, full } = cellStyle(isMine, others, day)
                    return (
                      <div
                        key={day}
                        onPointerDown={() => onDown(day, minute)}
                        onPointerEnter={() => onEnter(day, minute)}
                        className={`relative -mt-px -mr-px flex h-7 items-center justify-center border-b border-r border-border/70 ${
                          mode === 'edit' ? 'cursor-pointer' : ''
                        } ${WEEKEND.has(day) && others === 0 && !isMine ? 'bg-s0' : ''}`}
                        style={{ background: bg }}
                        title={`${others}${isMine ? ' + you' : ''} free`}
                      >
                        {full && <span className="text-[9px] font-bold" style={{ color: text }}>{others}</span>}
                        {dot && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--you-text)' }} />
                        )}
                      </div>
                    )
                  })}
                </Row>
              )
            })}
          </div>
        </div>
      </div>

      <Legend tz={event.timezone} />
    </div>
  )
}

function cellStyle(isMine: boolean, others: number, _day: number) {
  if (isMine) {
    const bg = others >= 4 ? 'var(--you-many)' : others >= 1 ? 'var(--you-some)' : 'var(--you-only)'
    return { bg, text: 'var(--you-text)', dot: true, full: false }
  }
  if (others === 0) return { bg: 'var(--s2)', text: 'inherit', dot: false, full: false }
  if (others <= 2) return { bg: 'var(--heat-low)', text: 'inherit', dot: false, full: false }
  if (others <= 4) return { bg: 'var(--heat-mid)', text: 'inherit', dot: false, full: false }
  if (others <= OTHERS - 1) return { bg: 'var(--heat-high)', text: 'inherit', dot: false, full: false }
  return { bg: 'var(--heat-full)', text: 'var(--on-accent)', dot: false, full: true }
}

function seedMine() {
  // a believable starting selection for "you"
  const s = new Set<string>()
  const add = (day: number, from: number, to: number) => {
    for (let m = from; m < to; m += FINE) s.add(`${day}:${m}`)
  }
  add(5, 10 * 60, 13 * 60) // Sat 10–13
  add(5, 15 * 60, 17 * 60)
  add(6, 9 * 60, 12 * 60) // Sun morning
  add(4, 17 * 60, 20 * 60) // Fri evening
  return s
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-s2 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === o.v ? 'bg-accent text-on-accent' : 'text-dim hover:text-text'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function PresetBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border bg-s1 px-3 py-1.5 text-[12px] font-semibold text-dim enabled:hover:border-accent-border enabled:hover:text-accent-text disabled:opacity-40"
    >
      {label}
    </button>
  )
}

function Legend({ tz }: { tz: string }) {
  const swatch = (bg: string, ring = false) => (
    <span className={`h-3.5 w-3.5 rounded-[4px] ${ring ? 'ring-1 ring-border' : ''}`} style={{ background: bg }} />
  )
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-1.5 text-[11.5px] text-dim">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-faint">Free</span>
        {swatch('var(--s2)', true)}
        {swatch('var(--heat-low)')}
        {swatch('var(--heat-mid)')}
        {swatch('var(--heat-high)')}
        {swatch('var(--heat-full)')}
        <span className="text-faint">none → all</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11.5px] text-dim">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-faint">You</span>
        {swatch('var(--you-only)')}
        {swatch('var(--you-some)')}
        {swatch('var(--you-many)')}
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-[11.5px] text-dim">
        <span>Times in</span>
        <TimezonePill tz={tz} />
      </div>
    </div>
  )
}
