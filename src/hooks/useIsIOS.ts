'use client'

import { useEffect, useState } from 'react'

// whether this is an iOS device — the one platform whose native chrome is frosted
// glass, so ours can dress to match there. Detected after mount (SSR knows no UA);
// iPadOS 13+ masquerades as a Mac, but a Mac with touch points gives it away.
export function useIsIOS(): boolean {
  const [ios, setIos] = useState(false)
  useEffect(() => {
    const classic = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const ipadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    setIos(classic || ipadOS)
  }, [])
  return ios
}
