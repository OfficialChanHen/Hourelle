'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Pointer-based drag reorder that works with both mouse and touch (native HTML5 drag
 * emits nothing on touchscreens). Put `scope` on the list container, `data-reorder-item`
 * on each row, and spread `handleProps(index)` onto a drag handle. As the pointer moves
 * over other rows the list reorders live via `onMove(from, to)`.
 */
export function usePointerReorder(onMove: (from: number, to: number) => void) {
  const scope = useRef<HTMLDivElement>(null)
  const from = useRef<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const onMoveRef = useRef(onMove)
  useEffect(() => { onMoveRef.current = onMove }, [onMove])

  useEffect(() => {
    function move(e: PointerEvent) {
      if (from.current === null || !scope.current) return
      e.preventDefault()
      const items = Array.from(scope.current.querySelectorAll<HTMLElement>('[data-reorder-item]'))
      let target = from.current
      for (let k = 0; k < items.length; k++) {
        const r = items[k].getBoundingClientRect()
        if (e.clientY < r.top + r.height / 2) { target = k; break }
        target = k // past the last midpoint → append
      }
      if (target !== from.current) {
        onMoveRef.current(from.current, target)
        from.current = target
        setDragIndex(target)
      }
    }
    function up() { from.current = null; setDragIndex(null) }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const handleProps = (index: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      from.current = index
      setDragIndex(index)
    },
    style: { touchAction: 'none' as const, cursor: 'grab' },
  })

  return { scope, dragIndex, handleProps }
}
