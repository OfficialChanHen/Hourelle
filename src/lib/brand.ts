/* The product's name, while Timeld is still being tried out. Development and Vercel
   previews say Timeld; production, and anything else not marked otherwise, keeps
   Hourelle until the new name is settled. NEXT_PUBLIC_BRAND=timeld|hourelle overrides
   both. Every name a person can read comes from here, so switching for good is one line. */
export type Brand = 'timeld' | 'hourelle'

function pick(): Brand {
  const set = process.env.NEXT_PUBLIC_BRAND
  if (set === 'timeld' || set === 'hourelle') return set
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return 'timeld'
  return 'hourelle'
}

export const BRAND: Brand = pick()
export const APP_NAME = BRAND === 'timeld' ? 'Timeld' : 'Hourelle'
