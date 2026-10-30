'use client'

import { useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* The timeld wordmark: time and meld share their "me". A slanted cut runs through it
   from the foot of the m to the top of the e, so time keeps the top left in its ink and
   meld the bottom right in its own, with thin veins of each ink running into the other
   and a slow drift along the slant that never stops.

   On the first load, and again on a mouse hover, it plays the liquid merge: the two
   words start apart, ripple as they slide together, drops of each ink leave the facing
   edges and run together in the gap, then the cut settles. Reduced motion shows it still.

   Everything is drawn at font-size 100 in the SVG's own units and the caller's text
   size scales it (the SVG is 0.92em tall), so the header, the footer and the sign-in
   card each set their own size the way they did before. */

type Widths = { ti: number; me: number; ld: number }
// Lora 600 at 100 units with -0.025em tracking; measured again once the font is in
const FALLBACK: Widths = { ti: 68.52, me: 142.02, ld: 88.94 }

const TOP = 14, H = 92
// the "/" through the me: the foot of the m to the top of the e
const Y_TOP = 46, Y_BOT = 102
// veins in the mask: white pushes time's ink out into meld's, black pulls meld's back in
const VEINS = [
  { off: 7, a: -38, b: 12, w: 4, c: 'white' }, { off: 14, a: -8, b: 34, w: 2.8, c: 'white' },
  { off: 22, a: -30, b: 0, w: 2, c: 'white' }, { off: 30, a: 6, b: 24, w: 1.4, c: 'white' },
  { off: -8, a: -14, b: 38, w: 3.8, c: 'black' }, { off: -16, a: -40, b: -6, w: 2.6, c: 'black' },
  { off: -24, a: 2, b: 30, w: 1.8, c: 'black' }, { off: -31, a: -26, b: -8, w: 1.3, c: 'black' },
]
const DROPS = 10
const D = 400
const FACE = { fontFamily: 'var(--font-lora), Georgia, serif', fontWeight: 600, letterSpacing: '-0.025em' }

// the intro plays once per page load, on the first wordmark that mounts
let introPlayed = false

function slant(w: Widths) {
  const x0 = w.ti, x1 = w.ti + w.me
  const cx = (x0 + x1) / 2, cy = (Y_TOP + Y_BOT) / 2
  const dx = (x1 - 6) - (x0 + 6), dy = Y_TOP - Y_BOT
  const len = Math.hypot(dx, dy)
  const u = [dx / len, dy / len]
  const n = u[1] > 0 ? [u[1], -u[0]] : [-u[1], u[0]]   // the normal pointing down and right
  const at = (off: number, along: number) => [cx + n[0] * off + u[0] * along, cy + n[1] * off + u[1] * along]
  return { x0, x1, u, at }
}
const pts = (arr: number[][]) => arr.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
const halfPlane = (s: ReturnType<typeof slant>, off: number) => pts([s.at(off, -D), s.at(off, D), s.at(off - D, D), s.at(off - D, -D)])

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
    const root = q<SVGGElement>('[data-k="root"]'), gA = q<SVGGElement>('[data-k="time"]'), gB = q<SVGGElement>('[data-k="meld"]')
    const tB = q<SVGTextElement>('[data-k="meld"] text')
    const half = q<SVGPolygonElement>('[data-k="half"]'), left = q<SVGRectElement>('[data-k="left"]')
    const veins = Array.from(svg.querySelectorAll<SVGLineElement>('[data-k="vein"]'))
    const drops = Array.from(svg.querySelectorAll<SVGCircleElement>('[data-k="drop"]'))
    const turbM = q<SVGElement>('[data-k="turbM"]'), offN = q<SVGElement>('[data-k="offN"]')
    const dispM = q<SVGElement>('[data-k="dispM"]'), blurM = q<SVGElement>('[data-k="blurM"]')
    const turbG = q<SVGElement>('[data-k="turbG"]'), dispG = q<SVGElement>('[data-k="dispG"]'), blurG = q<SVGElement>('[data-k="blurG"]')

    const reduce = reducedMotion()
    let w = FALLBACK, s = slant(w), big = false
    let tl: gsap.core.Timeline | null = null, drift: gsap.core.Tween | null = null, onScreen = true

    const rest = () => ({ off: 5, S: big ? 27 : 7, B: big ? 0.7 : 0.35 })
    const st = { off: 5, S: 7, B: 0.35, flow: 0, churn: 0, shift: 0, o: 1, gs: 0, gd: 0, gf: 0 }
    // each drop leaves one word's facing edge and lands near the middle of the me
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const drop = drops.map((_, i) => ({
      fromA: i % 2 === 0, t: 0, dx: rnd() * 16, y0: 52 + rnd() * 40,
      tx: (rnd() - 0.5) * 34, ty: 58 + rnd() * 30, r: 3.5 + rnd() * 5,
    }))

    function render() {
      half.setAttribute('points', halfPlane(s, st.off))
      veins.forEach((el, i) => {
        const v = VEINS[i], p = s.at(st.off + v.off, v.a), e = s.at(st.off + v.off, v.b)
        el.setAttribute('x1', p[0].toFixed(2)); el.setAttribute('y1', p[1].toFixed(2))
        el.setAttribute('x2', e[0].toFixed(2)); el.setAttribute('y2', e[1].toFixed(2))
      })
      offN.setAttribute('dx', (s.u[0] * st.flow).toFixed(2))
      offN.setAttribute('dy', (s.u[1] * st.flow).toFixed(2))
      turbM.setAttribute('baseFrequency', `${(0.022 + 0.005 * Math.sin(st.churn)).toFixed(4)} ${(0.034 + 0.007 * Math.cos(st.churn * 1.2)).toFixed(4)}`)
      dispM.setAttribute('scale', st.S.toFixed(2))
      blurM.setAttribute('stdDeviation', st.B.toFixed(2))

      // the liquid part: the words slide in from either side, rippled and fused by the goo
      gA.setAttribute('transform', `translate(${(-st.shift / 2).toFixed(2)},0)`)
      gB.setAttribute('transform', `translate(${(st.shift / 2).toFixed(2)},0)`)
      root.setAttribute('opacity', st.o.toFixed(3))
      const meX = s.x0 + w.me / 2
      drop.forEach((p, i) => {
        const sx = p.fromA ? s.x1 - st.shift / 2 - p.dx : s.x0 + st.shift / 2 + p.dx
        const e = p.t * p.t * (3 - 2 * p.t)
        drops[i].setAttribute('cx', (sx + (meX + p.tx - sx) * e).toFixed(2))
        drops[i].setAttribute('cy', (p.y0 + (p.ty - p.y0) * e).toFixed(2))
        drops[i].setAttribute('r', (p.r * Math.sin(Math.PI * p.t)).toFixed(2))
      })
      turbG.setAttribute('baseFrequency', `${(0.014 + 0.004 * Math.sin(st.gf)).toFixed(4)} ${(0.022 + 0.005 * Math.cos(st.gf * 1.3)).toFixed(4)}`)
      dispG.setAttribute('scale', st.gd.toFixed(2))
      blurG.setAttribute('stdDeviation', st.gs.toFixed(2))
      if (st.gs > 0.05 || st.gd > 0.1) root.setAttribute('filter', `url(#${id}g)`)
      else root.removeAttribute('filter')
    }

    // measure the real letters once the font is in, and fit the box to them
    function fit() {
      const m = (txt: string) => {
        const t = tB.cloneNode() as SVGTextElement
        t.textContent = txt
        t.removeAttribute('x')
        root.appendChild(t)
        const len = t.getComputedTextLength()
        t.remove()
        return len
      }
      const got = { ti: m('ti'), me: m('me'), ld: m('ld') }
      if (got.ti > 0 && got.me > 0) w = got
      s = slant(w)
      const W = w.ti + w.me + w.ld
      svg.setAttribute('viewBox', `-4 ${TOP} ${(W + 8).toFixed(2)} ${H}`)
      svg.style.width = `${((W + 8) / H) * 0.92}em`
      tB.setAttribute('x', w.ti.toFixed(2))
      left.setAttribute('width', (300 + w.ti - 2).toFixed(2))
      big = parseFloat(getComputedStyle(svg).fontSize) >= 40
      veins.forEach((el) => { el.style.display = big ? '' : 'none' })
    }

    // the drift: the marble keeps moving along the slant, slowly, for as long as it is on screen
    function startDrift() {
      drift?.kill()
      drift = gsap.to(st, { flow: '+=400', churn: `+=${Math.PI * 2}`, duration: 26, ease: 'none', repeat: -1, paused: !onScreen, onUpdate: render })
    }

    function play(delay: number) {
      tl?.kill(); drift?.kill()
      const r = rest()
      Object.assign(st, { off: 90, S: 0, B: 0.4, flow: 0, churn: 0, gs: 0, gd: 0, gf: 0, o: 0, shift: w.me + (big ? 54 : 24) })
      drop.forEach((p) => { p.t = 0 })
      render()
      tl = gsap.timeline({ delay, onUpdate: render, onComplete: startDrift })
        .to(st, { o: 1, duration: 0.45, ease: 'power1.out' }, 0)
        .to(st, { shift: 0, duration: 1.6, ease: 'power3.inOut' }, 0)
        .to(st, { gs: big ? 6 : 4, duration: 0.8, ease: 'sine.in' }, 0)
        .to(st, { gs: 0, duration: 0.9, ease: 'sine.out' }, 0.8)
        .to(st, { gd: big ? 16 : 10, duration: 0.7, ease: 'sine.inOut' }, 0.1)
        .to(st, { gd: 0, duration: 1.0, ease: 'sine.inOut' }, 0.8)
        .to(st, { gf: 6, duration: 1.8, ease: 'none' }, 0)
        .to(st, { off: r.off, duration: 1.0, ease: 'power2.inOut' }, 0.9)
        .to(st, { S: big ? 64 : 16, duration: 0.5, ease: 'sine.in' }, 1.0)
        .to(st, { S: r.S, duration: 1.9, ease: 'sine.out' }, 1.5)
        .to(st, { B: big ? 1.5 : 0.6, duration: 0.5, ease: 'sine.in' }, 1.0)
        .to(st, { B: r.B, duration: 1.5, ease: 'sine.out' }, 1.5)
        .to(st, { flow: 90, duration: 3.2, ease: 'power2.out' }, 0.9)
        .to(st, { churn: 4, duration: 3.2, ease: 'power1.out' }, 0.9)
      drop.forEach((p, i) => tl!.to(p, { t: 1, duration: 0.85, ease: 'power1.inOut' }, 0.15 + i * 0.06))
    }

    const start = contextSafe(() => {
      if (!svg.isConnected) return
      fit()
      Object.assign(st, rest(), { o: 1, shift: 0 })
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
    render()
    document.fonts.ready.then(start)
    svg.addEventListener('pointerenter', onEnter)
    io.observe(svg)
    return () => {
      svg.removeEventListener('pointerenter', onEnter)
      io.disconnect()
    }
  }, { scope: svgRef })

  // the still logo, drawn from the fallback widths so the server renders it whole
  const s = slant(FALLBACK)
  const W = FALLBACK.ti + FALLBACK.me + FALLBACK.ld
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
        {/* the marble: flowing noise pushes the cut and its veins around */}
        <filter id={`${id}m`} filterUnits="userSpaceOnUse" x={-200} y={-200} width={W + 400} height={600}>
          <feTurbulence data-k="turbM" type="fractalNoise" baseFrequency="0.022 0.034" numOctaves={3} seed={5} result="n" />
          <feOffset data-k="offN" in="n" dx={0} dy={0} result="no" />
          <feDisplacementMap data-k="dispM" in="SourceGraphic" in2="no" scale={7} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur data-k="blurM" in="d" stdDeviation={0.35} />
        </filter>
        {/* where time's ink shows: all of "ti", then its side of the slanted cut */}
        <mask id={`${id}k`} maskUnits="userSpaceOnUse" x={-300} y={-300} width={W + 600} height={800}>
          <rect data-k="left" x={-300} y={-300} width={300 + FALLBACK.ti - 2} height={800} fill="white" />
          <g filter={`url(#${id}m)`}>
            <polygon data-k="half" fill="white" points={halfPlane(s, 5)} />
            {VEINS.map((v, i) => (
              <line key={i} data-k="vein" stroke={v.c} strokeWidth={v.w} strokeLinecap="round" style={{ display: 'none' }} />
            ))}
          </g>
        </mask>
        {/* the liquid: noise ripples the ink, then a goo pass fuses anything close */}
        <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
          <feTurbulence data-k="turbG" type="fractalNoise" baseFrequency="0.014 0.022" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap data-k="dispG" in="SourceGraphic" in2="n" scale={0} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur data-k="blurG" in="d" stdDeviation={0} result="b" />
          <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g" />
          <feComposite in="d" in2="g" operator="atop" />
        </filter>
      </defs>
      <g data-k="root" opacity={intro ? 0 : 1}>
        {/* meld runs whole under time, so the marble never shows paper */}
        <g data-k="meld">
          <text x={FALLBACK.ti} y={100} fontSize={100} style={{ ...FACE, fill: 'var(--wm-meld)' }}>meld</text>
        </g>
        <g data-k="time">
          <text x={0} y={100} fontSize={100} mask={`url(#${id}k)`} style={{ ...FACE, fill: 'var(--wm-time)' }}>time</text>
        </g>
        <g aria-hidden="true">
          {Array.from({ length: DROPS }, (_, i) => (
            <circle key={i} data-k="drop" r={0} style={{ fill: i % 2 === 0 ? 'var(--wm-time)' : 'var(--wm-meld)' }} />
          ))}
        </g>
      </g>
    </svg>
  )
}
