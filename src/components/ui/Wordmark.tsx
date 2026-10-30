'use client'

import { useId, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* The Timeld wordmark: time and meld share their "me". The word is set once and used as
   a mask; inside it the two inks are plain vector shapes, so the edges stay sharp at any
   size. Time's ink holds "ti" and the top left of the me, meld's the bottom right, split
   by a wavy cut along a slant through the me, with a streak of each ink running into the
   other like combed marbling.

   Once per browser session, on the first wordmark that mounts and only once its tab is in
   view, it plays the meld, so the name reads as the two words it is made of: time and meld
   start apart, each in its own ink, drift together until they share their me, soften
   where they overlap and settle into the marbled cut. A ripple then runs along the cut for
   a few seconds and comes to rest; the logo stays still while people work. A mouse hover
   eases the words apart and brings them back. Reduced motion shows it still.

   Everything is drawn at font-size 100 in the SVG's own units and the caller's text
   size scales it (the SVG is 0.92em tall), so the header, the footer and the sign-in
   card each set their own size the way they did before. */

type Widths = { ti: number; tim: number; time: number; all: number }
// Lora 600 at 100 units with -0.025em tracking; measured again once the font is in
const FALLBACK: Widths = { ti: 97.1, tim: 188.53, time: 239.12, all: 328 }

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

// the intro plays once per browser session (the root layout flags the first visit on
// <html> before paint), on the first wordmark that mounts
const INTRO_KEY = 'hourelle.wm.intro'
let introClaimed = false

// rip scales the ripple that travels along the cut; at rest it is 0, so the logo is still
type Flow = { phase: number; off: number; amp: number; sw: number; rip: number }
const REST: Flow = { phase: 0, off: 0, amp: 1, sw: 1, rip: 0 }

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
  // the two inks in the me stays the same while it moves
  const ripple = (t: number, k: number) => 2.4 * s.rip * Math.sin(t / 9 + k + s.phase)
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

/* still: never plays (the landing page's header, while its hero plays the intro).
   anchor: 'time' keeps time where it ends and brings meld in from the right, for a big
   logo at a column's left edge where time moving left would run off the page. */
export function Wordmark({ className = '', still = false, anchor = 'centre' }: { className?: string; still?: boolean; anchor?: 'centre' | 'time' }) {
  const id = 'wm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)

  useGSAP((_, contextSafe) => {
    const el = svgRef.current
    if (!el || !contextSafe) return
    const svg: SVGSVGElement = el
    const q = <T extends Element>(sel: string) => svg.querySelector(sel) as T
    const root = q<SVGGElement>('[data-k="root"]'), word = q<SVGTextElement>('[data-k="word"]')
    const marbleG = q<SVGGElement>('[data-k="marble"]'), pair = q<SVGGElement>('[data-k="pair"]')
    const pTime = q<SVGTextElement>('[data-k="pt"]'), pMeld = q<SVGTextElement>('[data-k="pm"]')
    const ink = q<SVGGElement>('[data-k="ink"]'), blur = q<SVGElement>('[data-k="blur"]'), pblur = q<SVGElement>('[data-k="pblur"]')
    const timeP = q<SVGPathElement>('[data-k="time"]'), left = q<SVGRectElement>('[data-k="left"]'), clip = q<SVGRectElement>('[data-k="clip"]')
    const streaks = Array.from(svg.querySelectorAll<SVGPathElement>('[data-k="streak"]'))

    const reduce = reducedMotion()
    let w = FALLBACK
    let tl: gsap.core.Timeline | null = null, settle: gsap.core.Tween | null = null
    // shift: how far apart the two words stand; pair/mo: the two-word layer and the
    // marbled one, crossfading; soft/psoft: their blurs while the inks meld
    const st = { ...REST, o: 1, shift: 0, pair: 0, mo: 1, soft: 0, psoft: 0 }

    const filterIf = (g: Element, v: number, fe: Element, f: string) => {
      if (v > 0.05) { fe.setAttribute('stdDeviation', v.toFixed(2)); g.setAttribute('filter', `url(#${f})`) }
      else g.removeAttribute('filter')
    }
    function render() {
      const m = marble(w, st)
      timeP.setAttribute('d', m.time)
      streaks.forEach((p, i) => p.setAttribute('d', m.streaks[i]))
      root.style.opacity = st.o.toFixed(3)
      marbleG.setAttribute('opacity', st.mo.toFixed(3))
      // the blurs only run while the inks are melding; at rest the edges are crisp
      filterIf(ink, st.soft, blur, `${id}f`)
      if (st.pair > 0.001) {
        pair.style.display = ''
        pair.setAttribute('opacity', st.pair.toFixed(3))
        const lead = anchor === 'time' ? 0 : st.shift / 2
        pTime.setAttribute('transform', `translate(${f2(-lead)},0)`)
        pMeld.setAttribute('transform', `translate(${f2(st.shift - lead)},0)`)
        filterIf(pair, st.psoft, pblur, `${id}p`)
      } else pair.style.display = 'none'
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
      const got = { ti: m('Ti'), tim: m('Tim'), time: m('Time'), all: m('Timeld') }
      if (got.ti > 0 && got.tim > got.ti) w = got
      svg.setAttribute('viewBox', `-4 ${TOP} ${f2(w.all + 8)} ${H}`)
      svg.style.width = `${((w.all + 8) / H) * 0.92}em`
      left.setAttribute('width', f2(60 + w.ti + 2))
      clip.setAttribute('width', f2(60 + w.time))
      pMeld.setAttribute('x', f2(w.ti))
    }
    // far enough apart that the two words stand clear of each other, with a word gap
    const apart = () => w.time - w.ti + 26

    // after a meld the ripple runs along the cut for a few seconds and comes to rest
    function settleRipple() {
      settle?.kill()
      settle = gsap.to(st, { phase: '+=2.4', rip: 0, duration: 3, ease: 'sine.inOut', onUpdate: render })
    }

    // the words drift together, overlap in their me, soften there and settle into the cut
    function together(t: gsap.core.Timeline, at: number) {
      t.to(st, { shift: 0, duration: 1.25, ease: 'power2.inOut' }, at)
        .to(st, { psoft: 1.1, duration: 0.45, ease: 'sine.in' }, at + 0.75)
        .to(st, { pair: 0, mo: 1, duration: 0.6, ease: 'sine.inOut' }, at + 0.95)
        .to(st, { soft: 0, amp: 1, duration: 0.9, ease: 'sine.inOut' }, at + 0.95)
        .to(st, { sw: 1, duration: 0.8, ease: 'sine.out' }, at + 1.05)
    }
    const melding = { amp: 0.3, sw: 0, rip: 1, phase: -0.6, soft: 4 }

    function intro() {
      tl?.kill(); settle?.kill()
      Object.assign(st, melding, { o: 0, shift: apart(), pair: 1, mo: 0, psoft: 0 })
      render()
      tl = gsap.timeline({ delay: 0.2, onUpdate: render, onComplete: settleRipple })
        .to(st, { o: 1, duration: 0.3, ease: 'sine.out' }, 0)
      together(tl, 0)
    }
    // a hover first eases the words apart, then brings them back together
    function replay() {
      tl?.kill(); settle?.kill()
      tl = gsap.timeline({ onUpdate: render, onComplete: settleRipple })
        .to(st, { pair: 1, mo: 0, psoft: 0, duration: 0.25, ease: 'sine.out' }, 0)
        .to(st, { shift: apart() * 0.55, duration: 0.45, ease: 'power2.out' }, 0)
        .set(st, melding, 0.25)
      together(tl, 0.45)
    }

    // the first wordmark of a session's first visit claims the intro and drops the flag
    // that held it back before paint, so any later wordmark shows at once
    const html = document.documentElement
    // a still one shows at once and leaves the flag for the wordmark that will play
    if (still) { root.style.opacity = '1'; return }
    const claim = !introClaimed && html.hasAttribute('data-wm-intro')
    if (claim) {
      introClaimed = true
      try { sessionStorage.setItem(INTRO_KEY, '1') } catch {}
      if (!reduce) { st.o = 0; root.style.opacity = '0' }
    }
    html.removeAttribute('data-wm-intro')

    const start = contextSafe(() => {
      if (!svg.isConnected) return
      fit()
      if (!claim || reduce) { Object.assign(st, REST, { o: 1, shift: 0, pair: 0, mo: 1, soft: 0, psoft: 0 }); render(); return }
      // a tab opened in the background waits until it is seen
      if (document.visibilityState === 'visible') intro()
      else document.addEventListener('visibilitychange', onShow)
    })
    const onShow = contextSafe(() => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', onShow)
      intro()
    })
    // a mouse hover plays the meld again, once it has finished the last one
    const onEnter = contextSafe((e: PointerEvent) => {
      if (reduce || e.pointerType !== 'mouse' || tl?.isActive()) return
      replay()
    })

    document.fonts.ready.then(start)
    svg.addEventListener('pointerenter', onEnter)
    return () => {
      svg.removeEventListener('pointerenter', onEnter)
      document.removeEventListener('visibilitychange', onShow)
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
      aria-label="Timeld"
      className={`inline-block shrink-0 overflow-visible ${className}`}
      style={{ height: '0.92em', width: `${((W + 8) / H) * 0.92}em` }}
    >
      <defs>
        {/* the word itself is the mask, so the inks only ever show inside the letters */}
        <mask id={`${id}k`} maskUnits="userSpaceOnUse" x={-60} y={-60} width={W + 120} height={220}>
          <text data-k="word" x={0} y={100} fontSize={100} fill="white" style={FACE}>Timeld</text>
        </mask>
        {/* the soft edge while the inks meld */}
        <filter id={`${id}f`} filterUnits="userSpaceOnUse" x={-60} y={-60} width={W + 120} height={220}>
          <feGaussianBlur data-k="blur" stdDeviation={0} />
        </filter>
        <filter id={`${id}p`} filterUnits="userSpaceOnUse" x={-300} y={-60} width={W + 600} height={220}>
          <feGaussianBlur data-k="pblur" stdDeviation={0} />
        </filter>
        {/* time's ink stops at the end of the me */}
        <clipPath id={`${id}c`}>
          <rect data-k="clip" x={-60} y={-60} width={60 + FALLBACK.time} height={220} />
        </clipPath>
      </defs>
      <g data-k="root" data-wm-root="">
        <g data-k="marble" mask={`url(#${id}k)`}>
          <rect x={-60} y={-60} width={W + 120} height={220} style={{ fill: 'var(--wm-meld)' }} />
          <rect data-k="left" x={-60} y={-60} width={60 + FALLBACK.ti + 2} height={220} style={{ fill: 'var(--wm-time)' }} />
          <g clipPath={`url(#${id}c)`}>
            <g data-k="ink">
              <path data-k="time" d={m.time} style={{ fill: 'var(--wm-time)' }} />
              {STREAKS.map((k, i) => (
                <path key={i} data-k="streak" d={m.streaks[i]} style={{ fill: k.time ? 'var(--wm-time)' : 'var(--wm-meld)' }} />
              ))}
            </g>
          </g>
        </g>
        {/* the intro's two words, apart until they meld */}
        <g data-k="pair" aria-hidden="true" style={{ display: 'none' }}>
          <text data-k="pm" x={FALLBACK.ti} y={100} fontSize={100} style={{ ...FACE, fill: 'var(--wm-meld)' }}>meld</text>
          <text data-k="pt" x={0} y={100} fontSize={100} style={{ ...FACE, fill: 'var(--wm-time)' }}>Time</text>
        </g>
      </g>
    </svg>
  )
}
