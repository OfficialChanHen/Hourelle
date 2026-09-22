'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Move, RotateCcw, X } from 'lucide-react'

/* ── choosing which part of a photo survives the crop ──
   A cover is never shown at one shape. The card in a list is short and wide, the
   event's own header is wider still, and the home hero is wider again. A photo
   dropped into all three fills each of them and loses something different to each,
   which is why a face can sit perfectly on the card and be cropped off the header.

   So the host does not pick a rectangle, they pick a point to keep, and every frame
   crops around it. That is exactly what object-position means, and it is why the
   answer is two numbers rather than a box: one box could only ever be right for one
   of the shapes.

   The picking is done by dragging the photo inside a frame, which is the gesture
   everybody already knows from every other photo cropper. The frame the finger is in
   is the tightest of the three, because a point that survives the tightest crop
   survives them all — and the other shapes are drawn underneath, live, so nothing
   has to be taken on trust. Both are bounded: the photo can never be dragged past
   its own edges, so no frame ever shows a strip of nothing.

   Everything here is pointer events rather than a library: it is one gesture on one
   element, and the keyboard is served by the arrow keys below rather than by
   pretending a photo is a slider. */

export type Pos = { x: number; y: number }

// the shapes a cover is actually drawn at, widest last. The first is the one the
// finger works in, because it keeps the least.
const SHAPES: { label: string; ratio: number }[] = [
  { label: 'On a card', ratio: 330 / 150 },
  { label: 'On the event page', ratio: 1240 / 260 },
]

const clamp = (n: number) => Math.min(100, Math.max(0, n))

export function CoverPosition({ src, value, onChange, onClose }: {
  src: string
  value: Pos
  onChange: (p: Pos) => void
  onClose: () => void
}) {
  const [pos, setPos] = useState<Pos>(value)
  const frame = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; from: Pos } | null>(null)

  /* How far a drag moves the point. With object-cover the picture is scaled to
     cover the frame, so only the overflow — the part hanging outside — can be
     travelled. Moving the pointer across the whole of that overflow takes the
     position from one end to the other, so a pixel of pointer is a pixel of photo
     and the picture keeps up with the finger exactly. An axis with no overflow
     (the photo is exactly that shape) cannot move at all, which is correct. */
  const travel = useCallback(() => {
    const f = frame.current, i = img.current
    if (!f || !i || !i.naturalWidth) return { x: 0, y: 0 }
    const fw = f.clientWidth, fh = f.clientHeight
    const scale = Math.max(fw / i.naturalWidth, fh / i.naturalHeight)
    return { x: Math.max(0, i.naturalWidth * scale - fw), y: Math.max(0, i.naturalHeight * scale - fh) }
  }, [])

  function onDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, from: pos }
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const t = travel()
    // dragging the picture right shows what was off its left edge, which is a
    // smaller object-position, hence the minus
    setPos({
      x: t.x ? clamp(d.from.x - ((e.clientX - d.x) / t.x) * 100) : d.from.x,
      y: t.y ? clamp(d.from.y - ((e.clientY - d.y) / t.y) * 100) : d.from.y,
    })
  }
  const onUp = () => { drag.current = null }

  // arrows for anyone not holding a pointer, and Escape to leave
  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const d = by[e.key]
    if (!d) return
    e.preventDefault()
    setPos((p) => ({ x: clamp(p.x + d[0]), y: clamp(p.y + d[1]) }))
  }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    // the page behind must not scroll while a drag is in progress on top of it
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = prev }
  }, [onClose])

  // no mount guard: this only ever renders after the host has pressed Position, so
  // document.body is always there by the time the portal asks for it
  const objectPosition = `${pos.x}% ${pos.y}%`
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Position the cover photo">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-s1 p-4 shadow-soft sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-[22px] leading-[1.15] tracking-[-0.01em]">Position the photo</h2>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-dim">Drag to choose what stays in frame. Arrow keys nudge it, and Shift moves it further.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1 flex-none rounded-[8px] p-1 text-faint hover:bg-s2 hover:text-text"><X size={18} /></button>
        </div>

        {/* the frame the gesture happens in: the tightest of the shapes, so a point
            that survives here survives everywhere */}
        <div
          ref={frame}
          tabIndex={0}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
          aria-label="Drag the photo to position it"
          className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-xl border border-border bg-s2 outline-none active:cursor-grabbing focus-visible:border-accent"
          style={{ aspectRatio: String(SHAPES[0].ratio) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={img} src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition }} />
          <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-semibold text-white">
            <Move size={12} /> {SHAPES[0].label}
          </span>
        </div>

        {/* and the wider shapes, drawn from the same two numbers, so the cost of the
            choice is visible before it is made rather than discovered later */}
        <div className="mt-2.5 grid gap-2.5">
          {SHAPES.slice(1).map((s) => (
            <div key={s.label} className="relative w-full overflow-hidden rounded-xl border border-border bg-s2" style={{ aspectRatio: String(s.ratio) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition }} />
              <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-semibold text-white">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPos({ x: 50, y: 50 })}
            className="flex h-10 items-center gap-1.5 rounded-[10px] px-2.5 text-[13.5px] font-semibold text-dim hover:bg-s2 hover:text-text"
          >
            <RotateCcw size={14} /> Middle
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="flex h-10 items-center rounded-[10px] border border-border2 bg-s1 px-4 text-[14px] font-semibold hover:bg-s2">Cancel</button>
            <button
              type="button"
              onClick={() => { onChange(pos); onClose() }}
              className="flex h-10 items-center rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent"
            >
              Save position
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
