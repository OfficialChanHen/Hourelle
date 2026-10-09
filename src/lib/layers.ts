/* ── the stacking order, in one place ──
   From the bottom: the page, then anything that drops out of the page (menus,
   settings, pickers, tooltips), then the header and the phone tab bar, then the
   full-screen modals. A dropdown never covers the header or the tab bar; the only
   things above those are the modals, and the dropdowns opened inside a modal or
   from the header and tab bar themselves.

   A floating panel works out its layer from where its trigger sits, when it opens:
   inside a modal (anything aria-modal) it goes over the modals, inside the header or
   tab bar (data-chrome) just over those, anywhere else under them. Inside another
   floating panel (data-layer) it takes that panel's layer and lands on top of it.

   Header and tab bar: z-40. Modals: z-50 and z-70. Tour: z-42. */

export type Layer = 'page' | 'chrome' | 'modal'

export function layerOf(el: Element | null | undefined): Layer {
  // a panel opened from inside another floating panel takes that panel's layer
  const host = el?.closest('[data-layer]')?.getAttribute('data-layer')
  if (host === 'page' || host === 'chrome' || host === 'modal') return host
  if (el?.closest('[aria-modal="true"]')) return 'modal'
  if (el?.closest('[data-chrome]')) return 'chrome'
  return 'page'
}

// a floating panel's z-index per layer; something floating over one of these (a
// time list inside a settings panel, a tooltip in a menu) takes the next one up
export const LAYER_Z: Record<Layer, number> = { page: 35, chrome: 45, modal: 75 }

// the header's height: a page panel treats it as the edge of the screen and flips
// or shifts rather than slide under it
export const CHROME_TOP = 66
