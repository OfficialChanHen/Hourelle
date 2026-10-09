'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Move, RotateCcw, X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useViewportWidth } from '@/hooks/useViewportWidth'
import { coverShapes } from '@/lib/cover-shapes'
import { CoverCrops } from './CoverCrops'

/* ── choosing which part of a photo survives the crop ──
   A cover is never shown at one shape. Home's cards and the Plans shelf are short and
   wide, the plan page's picture is closer to square, and a phone's Home lists later
   plans with an upright cover. A photo dropped into all three fills each of them and
   loses something different to each, which is why a face can sit perfectly on the
   card and be cropped off the phone row.

   So the host does not pick a rectangle, they pick a point to keep, and every frame
   crops around it. That is exactly what object-position means, and it is why the
   answer is two numbers rather than a box: one box could only ever be right for one
   of the shapes.

   The picking is done by dragging the photo inside a frame, which is the gesture
   everybody already knows from every other photo cropper. The finger works in a
   card's shape, and every place's crop is drawn underneath, live, at its real
   proportions for this screen (lib/cover-shapes), so nothing has to be taken on
   trust. The photo can never be dragged past its own edges, so no frame
   ever shows a strip of nothing.

   Everything here is pointer events rather than a library: it is one gesture on one
   element, and the keyboard is served by the arrow keys below rather than by
   pretending a photo is a slider. */

export type Pos = { x: number; y: number }


const clamp = (n: number) => Math.min(100, Math.max(0, n))

export function CoverPosition({ src, value, onChange, onClose }: {
  src: string
  value: Pos
  onChange: (p: Pos) => void
  onClose: () => void
}) {
  const [pos, setPos] = useState<Pos>(value)
  const root = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; from: Pos } | null>(null)

  /* How far a drag moves the point. With object-cover the picture is scaled to
     cover the frame, so only the overflow — the part hanging outside — can be
     travelled. Moving the pointer across the whole of that overflow takes the
     position from one end to the other, so a pixel of pointer is a pixel of photo
     and the picture keeps up with the finger exactly. An axis with no overflow here
     can still be cropped by another place, so it moves the point anyway (below). */
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
    // an axis this frame cannot move along still moves the point, a frame's width
    // or height of drag for the whole way: the frame stays put, and the other places
    // below, which crop that way, follow the finger
    const f = frame.current
    const tx = t.x || f?.clientWidth || 1, ty = t.y || f?.clientHeight || 1
    // dragging the picture right shows what was off its left edge, which is a
    // smaller object-position, hence the minus
    setPos({
      x: clamp(d.from.x - ((e.clientX - d.x) / tx) * 100),
      y: clamp(d.from.y - ((e.clientY - d.y) / ty) * 100),
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
  // focus starts on the photo, where the arrow keys already work
  useFocusTrap(root, { initial: frame })

  // no mount guard: this only ever renders after the host has pressed Position, so
  // document.body is always there by the time the portal asks for it
  const objectPosition = `${pos.x}% ${pos.y}%`
  // the finger works in a Plans card's shape on this screen
  const { card } = coverShapes(useViewportWidth())
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Position the cover photo">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-s1 p-4 shadow-soft sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-[22px] leading-[1.15] tracking-[-0.01em]">Position the photo</h2>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-dim">Drag to choose what stays in frame. Arrow keys nudge it, and Shift moves it further.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1 flex-none rounded-full p-1 text-faint hover:bg-s2 hover:text-text"><X size={18} /></button>
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
          style={{ aspectRatio: String(card.w / card.h) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={img} src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition }} />
          <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-semibold text-white">
            <Move size={12} /> Drag
          </span>
        </div>

        {/* and every place's crop, drawn from the same two numbers, so the cost of the
            choice is visible before it is made rather than discovered later */}
        <div className="mt-3">
          <CoverCrops image={src} pos={pos} from="#E4EDE7" to="#CFE0D5" height={80} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPos({ x: 50, y: 50 })}
            className="flex h-10 items-center gap-1.5 rounded-full px-2.5 text-[13.5px] font-semibold text-dim hover:bg-s2 hover:text-text"
          >
            <RotateCcw size={14} /> Middle
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="flex h-10 items-center rounded-full border border-border2 bg-s1 px-4 text-[14px] font-semibold hover:bg-s2">Cancel</button>
            <button
              type="button"
              onClick={() => { onChange(pos); onClose() }}
              className="flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent"
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
