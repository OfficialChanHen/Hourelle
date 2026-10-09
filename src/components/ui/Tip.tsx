'use client'

import { useRef, useState, type ReactNode } from 'react'
import * as RTooltip from '@radix-ui/react-tooltip'
import { CHROME_TOP, LAYER_Z, layerOf, type Layer } from '@/lib/layers'

/**
 * Theme-aware tooltip for the places a native `title` falls short: it follows the
 * app's tokens in every look and mode (native tooltips are OS-drawn and ignore the
 * theme), and it works on touch.
 *
 * On Radix's Tooltip: the hover and focus delays, Escape, the aria-describedby link
 * from the words to the bubble, a portal nothing can clip, and placement that flips
 * and shifts to stay on screen, where the hand-rolled one worked out its own flip
 * against the top 64 pixels and clamped itself to the window by hand.
 *
 * What Radix leaves out on purpose is touch: a finger has no hover, so its tooltip
 * never opens for one. Here a tap opens it and a second tap closes it, and the tap
 * never falls through to the card link the words sit in. That is the one piece kept
 * by hand, and it only runs for touch.
 */
// w-fit keeps the bubble centered over the visible words, not a full-width row;
// max-w-full still lets inner `truncate` spans clip inside narrow cards
export function Tip({ text, children, className = 'block w-fit max-w-full' }: { text: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const touch = useRef(false)
  const wasOpen = useRef(false)
  // over whatever the words sit in (lib/layers), worked out as the bubble opens
  const [layer, setLayer] = useState<Layer>('page')
  const trig = useRef<HTMLSpanElement>(null)
  const show = (o: boolean) => { if (o) setLayer(layerOf(trig.current)); setOpen(o) }
  return (
    <RTooltip.Provider delayDuration={250} skipDelayDuration={200}>
      <RTooltip.Root open={open} onOpenChange={(o) => { if (!touch.current) show(o) }}>
        <RTooltip.Trigger asChild>
          <span
            ref={trig}
            className={className}
            // a keyboard reaches the words too, and Radix opens the bubble on focus
            tabIndex={0}
            // read before Radix's own pointerdown, which closes the bubble
            onPointerDownCapture={(e) => { touch.current = e.pointerType === 'touch'; wasOpen.current = open }}
            onClick={(e) => {
              // a finger has no hover: the tap belongs to the tooltip, not the card behind it
              if (!touch.current) return
              e.preventDefault()
              e.stopPropagation()
              show(!wasOpen.current)
            }}
          >
            {children}
          </span>
        </RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content
            side="top"
            sideOffset={6}
            collisionPadding={{ top: layer === 'page' ? CHROME_TOP : 8, right: 8, bottom: 8, left: 8 }}
            onPointerDownOutside={() => setOpen(false)}
            style={{ zIndex: LAYER_Z[layer] + 1 }}
            className="max-w-[260px] rounded-[9px] border border-border2 bg-s1 px-2.5 py-1.5 text-[12px] font-medium leading-[1.45] text-text shadow-soft"
          >
            {text}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  )
}
