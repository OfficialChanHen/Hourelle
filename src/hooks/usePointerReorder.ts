'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Pointer-based drag reorder that works with both mouse and touch (native HTML5 drag
 * emits nothing on touchscreens). Put `scope` on the list container, `data-reorder-item`
 * on each row, and spread `handleProps(index)` onto a drag handle. As the pointer moves
 * over other rows the list reorders live via `onMove(from, to)`.
 *
 * If `scope` is itself scrollable, dragging near its top/bottom edge auto-scrolls it (and
 * keeps scrolling while the pointer is held there), reordering as new rows come into view.
 */
export function usePointerReorder(onMove: (from: number, to: number) => void) {
  const scope = useRef<HTMLDivElement>(null)
  const from = useRef<number | null>(null)
  const lastY = useRef(0)
  const raf = useRef(0)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const onMoveRef = useRef(onMove)
  useEffect(() => { onMoveRef.current = onMove }, [onMove])

  function evaluate() {
    if (from.current === null || !scope.current) return
    const items = Array.from(scope.current.querySelectorAll<HTMLElement>('[data-reorder-item]'))
    const y = lastY.current
    let target = from.current
    for (let k = 0; k < items.length; k++) {
      const r = items[k].getBoundingClientRect()
      if (y < r.top + r.height / 2) { target = k; break }
      target = k // past the last midpoint → append
    }
    if (target !== from.current) {
      onMoveRef.current(from.current, target)
      from.current = target
      setDragIndex(target)
    }
  }
  // keep scrolling (and reordering) while the pointer is held near a scrollable scope's edge
  function tick() {
    const el = scope.current
    if (from.current === null || !el) { raf.current = 0; return }
    const r = el.getBoundingClientRect()
    const EDGE = 32, MAX = 14, y = lastY.current
    let dy = 0
    if (y < r.top + EDGE) dy = -Math.min(MAX, (r.top + EDGE - y) / 3)
    else if (y > r.bottom - EDGE) dy = Math.min(MAX, (y - (r.bottom - EDGE)) / 3)
    if (dy) { const before = el.scrollTop; el.scrollTop = before + dy; if (el.scrollTop !== before) evaluate() }
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      if (from.current === null) return
      e.preventDefault()
      lastY.current = e.clientY
      evaluate()
      if (!raf.current) raf.current = requestAnimationFrame(tick)
    }
    function up() {
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0 }
      from.current = null
      setDragIndex(null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  const handleProps = (index: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      from.current = index
      lastY.current = e.clientY
      setDragIndex(index)
    },
    style: { touchAction: 'none' as const, cursor: 'grab' },
  })

  return { scope, dragIndex, handleProps }
}
