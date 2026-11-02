// The picture a chat app shows under a plan's link: the cover, the name, the host,
// the dates or the locked time, and where the answers stand. Drawn with next/og on
// the warm paper of the house light theme, then turned into a JPEG, because WhatsApp
// and Meta's apps drop a preview image much past 300KB and a photo cover drawn as
// PNG is often more than that.
//
// The colours are the light theme's values from globals.css: an image has no CSS
// variables to read, and a chat app shows it on its own background, not ours.

import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { PREVIEW_SIZE } from './preview'
import type { LinkPreview, PreviewCover } from '@/lib/link-preview'
import { coverFor } from '@/lib/cover-kind'
import { COVER_PRESETS } from '@/components/ui/Cover'
import { APP_NAME, BRAND } from '@/lib/brand'

const INK = {
  bg: '#FAF6EF', s1: '#FFFDF9', s2: '#F3EDE3', border: '#EAE2D5',
  text: '#1F1B16', dim: '#655D52', faint: '#6B6358',
  accentText: '#23543D', tealText: '#31523F',
}

// literal paths, so the build traces just these files (next.config lists them too)
const fonts = Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/Lora-Regular.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/Lora-SemiBold.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/InstrumentSans-Medium.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/InstrumentSans-SemiBold.ttf')),
])
const icon = readFile(join(process.cwd(), 'public/brand', `${BRAND}-icon.svg`)).then((b) => `data:image/svg+xml;base64,${b.toString('base64')}`)

/** The preview picture for a plan, as a response ready to send. */
export async function previewImage(p: LinkPreview): Promise<Response> {
  const [[loraR, loraS, sansM, sansS], logo, photo] = await Promise.all([fonts, icon, photoOf(p.cover)])
  const png = new ImageResponse(<Card p={p} logo={logo} photo={photo} />, {
    ...PREVIEW_SIZE,
    fonts: [
      { name: 'Lora', data: loraR, weight: 400, style: 'normal' },
      { name: 'Lora', data: loraS, weight: 600, style: 'normal' },
      { name: 'Instrument Sans', data: sansM, weight: 500, style: 'normal' },
      { name: 'Instrument Sans', data: sansS, weight: 600, style: 'normal' },
    ],
  })
  const bytes = Buffer.from(await png.arrayBuffer())
  const jpeg = await toJpeg(bytes)
  return new Response(new Uint8Array(jpeg ?? bytes), {
    headers: {
      'Content-Type': jpeg ? 'image/jpeg' : 'image/png',
      // the URL carries a version that changes with the picture, so a shared cache
      // may keep each one; five minutes still lets a stale one go on its own
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
    },
  })
}

// sharp comes with Next; if it cannot load here, the PNG goes out as it is
async function toJpeg(png: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer()
  } catch {
    return null
  }
}

// a host's photo, fetched here rather than by the renderer so a slow or missing
// file falls back to the plan's plain cover instead of failing the whole picture
async function photoOf(c: PreviewCover): Promise<string | null> {
  if (c.kind !== 'photo') return null
  if (c.src.startsWith('data:')) return /^data:image\/(jpeg|png);/.test(c.src) ? c.src : null
  try {
    const res = await fetch(c.src, { signal: AbortSignal.timeout(3000) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !/^image\/(jpeg|png)$/.test(type)) return null
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

// the scenes are written with fragments, which the renderer's SVG writer cannot
// read, so they are opened up into a plain list of shapes first
function flat(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((n) => {
    if (!isValidElement(n)) return [n]
    const el = n as ReactElement<{ children?: ReactNode }>
    if (el.type === Fragment) return flat(el.props.children)
    return el.props.children === undefined ? [el] : [{ ...el, props: { ...el.props, children: flat(el.props.children) } }]
  })
}

const COVER_W = 430
const COVER_H = 470
// the scenes are drawn on a 400x160 frame with the subject in the middle; the
// renderer does not crop an SVG for us, so the middle slice of the frame that has
// the cover's own shape is cut out here
const SCENE_CROP = (() => { const w = (160 * COVER_W) / COVER_H; return `${(400 - w) / 2} 0 ${w} 160` })()

function CoverArt({ p, photo }: { p: LinkPreview; photo: string | null }) {
  const [from, to] = coverFor(p.id)
  const preset = p.cover.kind === 'preset' ? COVER_PRESETS.find((x) => x.id === (p.cover as { id: string }).id) : null
  const bg = preset ? `linear-gradient(135deg, ${preset.from}, ${preset.to})` : `linear-gradient(135deg, ${from}, ${to})`
  const fit = p.cover.kind === 'photo' && p.cover.fit === 'fit'
  const pos = p.cover.kind === 'photo' && p.cover.pos ? `${p.cover.pos.x}% ${p.cover.pos.y}%` : '50% 50%'
  return (
    <div style={{ display: 'flex', position: 'relative', width: COVER_W, height: COVER_H, borderRadius: 14, overflow: 'hidden', background: bg }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" width={COVER_W} height={COVER_H} style={{ width: COVER_W, height: COVER_H, objectFit: fit ? 'contain' : 'cover', objectPosition: pos }} />
      ) : preset ? (
        <svg width={COVER_W} height={COVER_H} viewBox={SCENE_CROP}>{flat(preset.scene)}</svg>
      ) : (
        <>
          <div style={{ position: 'absolute', right: -40, top: -60, width: 260, height: 260, borderRadius: 999, background: 'rgba(255,255,255,.22)' }} />
          <div style={{ position: 'absolute', left: 30, bottom: -50, width: 170, height: 170, borderRadius: 999, background: 'rgba(46,74,60,.07)' }} />
        </>
      )}
    </div>
  )
}

function Card({ p, logo, photo }: { p: LinkPreview; logo: string; photo: string | null }) {
  // long names wrap to three lines at most, then end in an ellipsis
  const title = p.title.length > 64 ? `${p.title.slice(0, 62).trimEnd()}…` : p.title
  const big = title.length <= 28
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: INK.bg, padding: 64, gap: 56, alignItems: 'center', fontFamily: 'Instrument Sans' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={44} height={44} />
          <span style={{ fontFamily: 'Lora', fontWeight: 600, fontSize: 32, color: INK.text, letterSpacing: '-0.01em' }}>{APP_NAME}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ maxWidth: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 20, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: INK.faint }}>Hosted by {p.host}</span>
          <span style={{ marginTop: 14, fontFamily: 'Lora', fontWeight: 400, fontSize: big ? 72 : 58, lineHeight: 1.06, letterSpacing: '-0.01em', color: INK.text }}>{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26, fontSize: 28, fontWeight: 500, color: INK.dim }}>
            <span>{p.when}</span>
            {p.tz && <span style={{ fontSize: 20, padding: '3px 10px', borderRadius: 8, background: INK.s2, color: INK.dim }}>{p.tz}</span>}
          </div>
        </div>

        <span style={{ fontSize: 30, fontWeight: 600, color: p.locked ? INK.tealText : INK.accentText }}>{p.status}</span>
      </div>

      <div style={{ display: 'flex', padding: 14, background: INK.s1, border: `2px solid ${INK.border}`, borderRadius: 24, boxShadow: '0 12px 32px rgba(60,40,20,.10)' }}>
        <CoverArt p={p} photo={photo} />
      </div>
    </div>
  )
}
