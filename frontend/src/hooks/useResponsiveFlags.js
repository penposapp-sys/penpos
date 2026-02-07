import { useEffect, useState } from 'react'

export function useResponsiveFlags() {
  const [flags, setFlags] = useState(() => ({
    isMobilePortrait: false,
    isTablet: false,
    isDesktop: false
  }))

  useEffect(() => {
    const mobilePortraitMql = window.matchMedia('(max-width: 520px) and (orientation: portrait)')
    const tabletMql = window.matchMedia('(min-width: 521px) and (max-width: 1024px)')
    const desktopMql = window.matchMedia('(min-width: 1025px)')

    const apply = () => {
      setFlags({
        isMobilePortrait: !!mobilePortraitMql.matches,
        isTablet: !!tabletMql.matches,
        isDesktop: !!desktopMql.matches
      })
    }

    apply()

    const add = (mql, fn) => {
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', fn)
      else mql.addListener(fn)
    }
    const remove = (mql, fn) => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', fn)
      else mql.removeListener(fn)
    }

    add(mobilePortraitMql, apply)
    add(tabletMql, apply)
    add(desktopMql, apply)

    return () => {
      remove(mobilePortraitMql, apply)
      remove(tabletMql, apply)
      remove(desktopMql, apply)
    }
  }, [])

  return flags
}
