/* Warm covers for event cards and headers. Three sources, one component:
   the generated gradient (default), a preset photo ('preset:<id>'), or the
   host's own photo, which is a URL into Storage once it has been uploaded and a
   data URL until then (see lib/covers). */

import { isPhotoCover } from '@/lib/cover-kind'
import { CoverImg, FitBackdrop } from './CoverImg'

export type CoverPreset = {
  id: string
  name: string
  from: string
  to: string
  photo: string
  // the point a crop keeps, in percent: every surface crops the picture differently
  pos: { x: number; y: number }
  credit: { title: string; author: string; source: string; license: string; licenseUrl: string }
}

/* Each preset is a real photo someone took and shared under CC BY: snapshots from
   actual dinners, game nights and trips, not stock and not drawn. They were picked so
   the scene carries the picture (a table, hands, a road), never a stranger's face,
   then cropped and toned in public/covers as one roll of film: a little less colour,
   warm highlights, matte blacks, fine grain. CC BY asks for the credit and a note of
   the change, which the Templates page and the cover editor show (CoverCredit).
   The ids are stored on events, so they stay; the names follow the templates, and
   from/to are the colours drawn while the photo loads. */
export const COVER_PRESETS: CoverPreset[] = [
  {
    // a road winding up through the hills
    id: 'meadow', name: 'Weekend trip', from: '#E6F0D6', to: '#D3E6B5', photo: '/covers/meadow.jpg', pos: { x: 55, y: 62 },
    credit: { title: 'Long Lanh, 2/2015', author: 'Khánh Hmoong', source: 'https://www.flickr.com/photos/7997148@N05/16301728489', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    // wine and plates at the end of a dinner
    id: 'dusk', name: 'Dinner', from: '#FBE3D6', to: '#F5CDB8', photo: '/covers/dusk.jpg', pos: { x: 45, y: 55 },
    credit: { title: 'christmas dinner', author: 'julio.garciah', source: 'https://www.flickr.com/photos/26010466@N07/4279322300', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    // rocking chairs on a cabin porch
    id: 'coast', name: 'Team offsite', from: '#DCEAF6', to: '#C6DCF0', photo: '/covers/coast.jpg', pos: { x: 58, y: 62 },
    credit: { title: 'Cabin 17 rockers on the porch', author: 'vastateparksstaff', source: 'https://www.flickr.com/photos/37922399@N05/7765705394', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    // home-made dishes on a wooden table
    id: 'harvest', name: 'Potluck', from: '#F9EBC8', to: '#F4DFA5', photo: '/covers/harvest.jpg', pos: { x: 55, y: 58 },
    credit: { title: 'Day 256: Latin Kings', author: 'theogeo', source: 'https://www.flickr.com/photos/91252560@N00/3924764461', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    // a board game on a coffee table, snacks beside it
    id: 'evening', name: 'Game night', from: '#EADFF2', to: '#DCCBEA', photo: '/covers/evening.jpg', pos: { x: 45, y: 52 },
    credit: { title: 'Games night: Revolution!', author: 'wetwebwork', source: 'https://www.flickr.com/photos/82832950@N00/17105058310', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    // two cups and two pairs of hands across a table
    id: 'garden', name: 'Coffee catch-up', from: '#D9EEE5', to: '#BFE0CF', photo: '/covers/garden.jpg', pos: { x: 55, y: 58 },
    credit: { title: 'Hands On', author: 'flossyflotsam', source: 'https://www.flickr.com/photos/8260474@N07/6956425677', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    // a home-made cake with mismatched candles
    id: 'party', name: 'Birthday', from: '#F9E0E3', to: '#F3C9CF', photo: '/covers/party.jpg', pos: { x: 55, y: 62 },
    credit: { title: 'Tie-Dye cake lit', author: 'moonlightbulb', source: 'https://www.flickr.com/photos/24532534@N02/6113882554', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
  {
    // the back rows at a meetup talk
    id: 'city', name: 'Conference', from: '#EEE9E0', to: '#E0D8C9', photo: '/covers/city.jpg', pos: { x: 62, y: 62 },
    credit: { title: 'Agile London Meetup, May 2018', author: 'gdsteam', source: 'https://www.flickr.com/photos/93332172@N03/27280521477', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' },
  },
]

/** The CC BY credit for a preset photo: its title and who took it, then the licence
 *  and that it was changed, unless a list says those once above (`short`). Plain
 *  links in the dim ink, for a line under a picture. */
export function CoverCredit({ preset, lead = 'Photo', short = false }: { preset: CoverPreset; lead?: string; short?: boolean }) {
  const { title, author, source, license, licenseUrl } = preset.credit
  return (
    <span>
      {lead}: <a href={source} target="_blank" rel="noopener noreferrer" className={CREDIT_LINK}>{title}</a> by {author}
      {!short && <>, <a href={licenseUrl} target="_blank" rel="noopener noreferrer license" className={CREDIT_LINK}>{license}</a>, cropped and toned</>}
    </span>
  )
}
export const CREDIT_LINK = 'underline decoration-border2 underline-offset-2 hover:text-text'

export function coverPresetOf(src?: string): CoverPreset | null {
  return src?.startsWith('preset:') ? COVER_PRESETS.find((p) => p.id === src.slice(7)) ?? null : null
}

export function Cover({
  from,
  to,
  src,
  fit = 'fill',
  pos,
  className = '',
  rounded = '',
}: {
  from: string
  to: string
  src?: string
  // a photo either fills the frame (cropped) or fits inside it whole, on its own most common colour
  fit?: 'fill' | 'fit'
  // which part of a cropped photo survives the crop. Every frame in the app is a
  // different shape, so the host picks a point to keep rather than a rectangle: the
  // card keeps it, the header keeps it, and each crops around it.
  pos?: { x: number; y: number }
  className?: string
  rounded?: string
}) {
  // a host's own photo, whether it is still inside the document as a data URL or
  // has been moved to Storage and is now a URL. Both draw identically.
  if (isPhotoCover(src)) {
    const whole = fit === 'fit'
    // the photo sits on the event's default cover, so a picture that cannot load (a
    // file since deleted, a dropped connection) shows that cover rather than a blank
    return (
      <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
        <DefaultMarks />
        {/* already downscaled on the way in, and a data URL has nothing for
            next/image to fetch, so both sources go straight to an <img> */}
        {whole && <FitBackdrop src={src!} />}
        <CoverImg
          src={src!}
          className={`absolute inset-0 h-full w-full ${whole ? 'object-contain' : 'object-cover'}`}
          style={!whole && pos ? { objectPosition: `${pos.x}% ${pos.y}%` } : undefined}
        />
      </div>
    )
  }
  const preset = coverPresetOf(src)
  if (preset) {
    // hourelle-cover-scene: dimmed a little on the dark theme (globals.css), so a
    // bright picture sits in the charcoal page rather than glaring out of it
    return (
      <div className={`hourelle-cover-scene relative overflow-hidden ${rounded} ${className}`} style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preset.photo} alt="" loading="lazy" decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${preset.pos.x}% ${preset.pos.y}%` }}
        />
      </div>
    )
  }
  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <DefaultMarks />
    </div>
  )
}

// the two soft circles of the default cover, drawn under a photo too so a picture
// that fails to load leaves exactly the cover an event without one wears
function DefaultMarks() {
  return (
    <>
      <span className="absolute -right-6 -top-10 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,.22)' }} />
      <span className="absolute -bottom-8 left-4 h-20 w-20 rounded-full" style={{ background: 'rgba(46,74,60,.07)' }} />
    </>
  )
}
