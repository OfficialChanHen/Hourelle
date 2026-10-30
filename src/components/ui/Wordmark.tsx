'use client'

import { useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* The timeld wordmark: time and meld share their "me". The word is set once and used as
   a mask; inside it the two inks are plain vector shapes, so the edges stay sharp at any
   size. Time's ink holds "ti" and the top left of the me, meld's the bottom right, split
   by a wavy cut along a slant through the me, with a streak of each ink running into the
   other like combed marbling. The waves keep drifting slowly while it is on screen.

   On the first load, and again on a mouse hover, it plays the merge: the me starts in
   meld's ink, time's ink pours in from the top left past the cut and settles back, the
   waves swell and calm, and the streaks run out of the cut. Reduced motion shows it still.

   Everything is drawn at font-size 100 in the SVG's own units and the caller's text
   size scales it (the SVG is 0.92em tall), so the header, the footer and the sign-in
   card each set their own size the way they did before. */

type Widths = { ti: number; tim: number; time: number; all: number }
// Lora 600 at 100 units with -0.025em tracking; measured again once the font is in
const FALLBACK: Widths = { ti: 68.52, tim: 157.02, time: 210.54, all: 299.48 }

const TOP = 14, H = 92
// the cut crosses where the m meets the e, rising to the right at about 43 degrees
const ANGLE = 0.75, CY = 62
const U = [Math.cos(ANGLE), -Math.sin(ANGLE)], N = [-U[1], U[0]]   // N points down and right, into meld
// a streak: which ink, how far from the cut (+ is into meld's side), where along the slant
// it runs, its widest half-width, and its own wave
const STREAKS = [
  { time: true, off: 13, a: -30, b: 44, w: 8, amp: 6, k: 14, ph: 1.2 },
  { time: false, off: -16, a: -62, b: 14, w: 9, amp: 7, k: 12, ph: 2.4 },
]
const FACE = { fontFamily: 'var(--font-lora), Georgia, serif', fontWeight: 600, letterSpacing: '-0.025em' }

// the intro plays once per page load, on the first wordmark that mounts
let introPlayed = false

type Flow = { phase: number; off: number; amp: number; sw: number }
const REST: Flow = { phase: 0, off: 0, amp: 1, sw: 1 }

const f2 = (v: number) => v.toFixed(2)
// a smooth path through points (Catmull-Rom as cubic Beziers)
function smooth(P: number[][], closed: boolean) {
  const n = P.length
  const g = (i: number) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))])
  let d = `M ${f2(P[0][0])},${f2(P[0][1])}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = g(i - 1), b = g(i), c = g(i + 1), e = g(i + 2)
    d += ` C ${f2(b[0] + (c[0] - a[0]) / 6)},${f2(b[1] + (c[1] - a[1]) / 6)} ${f2(c[0] - (e[0] - b[0]) / 6)},${f2(c[1] - (e[1] - b[1]) / 6)} ${f2(c[0])},${f2(c[1])}`
  }
  return closed ? d + ' Z' : d
}

// the shapes of time's ink in the me, and of the two streaks
function marble(w: Widths, s: Flow) {
  const cx = w.tim + 8
  const at = (t: number, o: number) => [cx + U[0] * t + N[0] * o, CY + U[1] * t + N[1] * o]
  // the shape holds still and only a small ripple travels along it, so the balance of
  // the two inks in the me stays the same while it drifts
  const ripple = (t: number, k: number) => 2.4 * Math.sin(t / 9 + k + s.phase)
  const cut = (t: number) => s.off + s.amp * (9 * Math.sin(t / 16 + 0.8) + 3 * Math.sin(t / 6.5 + 2)) + ripple(t, 0)
  const edge: number[][] = []
  for (let t = -120; t <= 120; t += 6) edge.push(at(t, cut(t)))
  const far = [at(120, -300), at(-120, -300)]
  const time = `${smooth(edge, false)} L ${f2(far[0][0])},${f2(far[0][1])} L ${f2(far[1][0])},${f2(far[1][1])} Z`
  const streaks = STREAKS.map((k) => {
    const top: number[][] = [], bot: number[][] = []
    for (let i = 0; i <= 16; i++) {
      const t = k.a + (k.b - k.a) * (i / 16)
      const half = k.w * s.sw * Math.pow(Math.sin((Math.PI * i) / 16), 0.8)
      const o = k.off + cut(t) * 0.6 + s.amp * k.amp * Math.sin(t / k.k + k.ph) + ripple(t, k.ph) * 0.6
      top.push(at(t, o - half)); bot.unshift(at(t, o + half))
    }
    return smooth(top.concat(bot.slice(1, -1)), true)
  })
  return { time, streaks }
}

export function Wordmark({ className = '' }: { className?: string }) {
  const id = 'wm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  // the first wordmark on a page load starts hidden, so its intro never flashes the
  // finished logo first; the effect below shows it (still, under reduced motion)
  const [intro] = useState(() => !introPlayed)

  useGSAP((_, contextSafe) => {
    const el = svgRef.current
    if (!el || !contextSafe) return
    const svg: SVGSVGElement = el
    const q = <T extends Element>(sel: string) => svg.querySelector(sel) as T
    const root = q<SVGGElement>('[data-k="root"]'), word = q<SVGTextElement>('[data-k="word"]')
    const timeP = q<SVGPathElement>('[data-k="time"]'), left = q<SVGRectElement>('[data-k="left"]'), clip = q<SVGRectElement>('[data-k="clip"]')
    const streaks = Array.from(svg.querySelectorAll<SVGPathElement>('[data-k="streak"]'))

    const reduce = reducedMotion()
    let w = FALLBACK
    let tl: gsap.core.Timeline | null = null, drift: gsap.core.Tween | null = null, onScreen = true
    const st = { ...REST, o: 1 }

    function render() {
      const m = marble(w, st)
      timeP.setAttribute('d', m.time)
      streaks.forEach((p, i) => p.setAttribute('d', m.streaks[i]))
      root.setAttribute('opacity', st.o.toFixed(3))
    }

    // measure the real letters once the font is in, and fit the box to them
    function fit() {
      const m = (txt: string) => {
        const t = word.cloneNode() as SVGTextElement
        t.textContent = txt
        t.setAttribute('visibility', 'hidden')
        svg.appendChild(t)
        const len = t.getComputedTextLength()
        t.remove()
        return len
      }
      const got = { ti: m('ti'), tim: m('tim'), time: m('time'), all: m('timeld') }
      if (got.ti > 0 && got.tim > got.ti) w = got
      svg.setAttribute('viewBox', `-4 ${TOP} ${f2(w.all + 8)} ${H}`)
      svg.style.width = `${((w.all + 8) / H) * 0.92}em`
      left.setAttribute('width', f2(60 + w.ti + 2))
      clip.setAttribute('width', f2(60 + w.time))
    }

    // the drift: the waves keep moving along the slant, slowly, while it is on screen
    function startDrift() {
      drift?.kill()
      drift = gsap.to(st, { phase: `+=${Math.PI * 2}`, duration: 26, ease: 'none', repeat: -1, paused: !onScreen, onUpdate: render })
    }

    function play(delay: number) {
      tl?.kill(); drift?.kill()
      Object.assign(st, { phase: 0, off: -70, amp: 0.4, sw: 0, o: 0 })
      render()
      tl = gsap.timeline({ delay, onUpdate: render, onComplete: startDrift })
        .to(st, { o: 1, duration: 0.4, ease: 'power1.out' }, 0)
        .to(st, { off: 22, duration: 0.9, ease: 'power2.in' }, 0)
        .to(st, { off: 0, duration: 1.1, ease: 'elastic.out(1, 0.55)' }, 0.9)
        .to(st, { amp: 2.2, duration: 0.8, ease: 'sine.inOut' }, 0.2)
        .to(st, { amp: 1, duration: 1.4, ease: 'sine.out' }, 1.0)
        .to(st, { sw: 1, duration: 1.2, ease: 'power2.out' }, 0.8)
        .to(st, { phase: 1.6, duration: 2.4, ease: 'power2.out' }, 0)
    }

    const start = contextSafe(() => {
      if (!svg.isConnected) return
      fit()
      Object.assign(st, REST, { o: 1 })
      if (reduce) { render(); return }
      if (intro) play(0.25)
      else { render(); startDrift() }
    })
    // a mouse hover plays the merge again, once it has finished the last one
    const onEnter = contextSafe((e: PointerEvent) => {
      if (reduce || e.pointerType !== 'mouse' || tl?.isActive()) return
      play(0)
    })
    // nothing to see off screen, so the drift rests there
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) drift?.resume()
      else drift?.pause()
    })

    if (intro) introPlayed = true
    document.fonts.ready.then(start)
    svg.addEventListener('pointerenter', onEnter)
    io.observe(svg)
    return () => {
      svg.removeEventListener('pointerenter', onEnter)
      io.disconnect()
    }
  }, { scope: svgRef })

  // the still logo, drawn from the fallback widths so the server renders it whole
  const W = FALLBACK.all
  const m = marble(FALLBACK, REST)
  return (
    <svg
      ref={svgRef}
      viewBox={`-4 ${TOP} ${W + 8} ${H}`}
      role="img"
      aria-label="timeld"
      className={`inline-block shrink-0 overflow-visible ${className}`}
      style={{ height: '0.92em', width: `${((W + 8) / H) * 0.92}em` }}
    >
      <defs>
        {/* the word itself is the mask, so the inks only ever show inside the letters */}
        <mask id={`${id}k`} maskUnits="userSpaceOnUse" x={-60} y={-60} width={W + 120} height={220}>
          <text data-k="word" x={0} y={100} fontSize={100} fill="white" style={FACE}>timeld</text>
        </mask>
        {/* time's ink stops at the end of the me */}
        <clipPath id={`${id}c`}>
          <rect data-k="clip" x={-60} y={-60} width={60 + FALLBACK.time} height={220} />
        </clipPath>
      </defs>
      <g data-k="root" mask={`url(#${id}k)`} opacity={intro ? 0 : 1}>
        <rect x={-60} y={-60} width={W + 120} height={220} style={{ fill: 'var(--wm-meld)' }} />
        <rect data-k="left" x={-60} y={-60} width={60 + FALLBACK.ti + 2} height={220} style={{ fill: 'var(--wm-time)' }} />
        <path data-k="time" d={m.time} clipPath={`url(#${id}c)`} style={{ fill: 'var(--wm-time)' }} />
        {STREAKS.map((k, i) => (
          <path key={i} data-k="streak" d={m.streaks[i]} clipPath={k.time ? `url(#${id}c)` : undefined} style={{ fill: k.time ? 'var(--wm-time)' : 'var(--wm-meld)' }} />
        ))}
      </g>
    </svg>
  )
}
