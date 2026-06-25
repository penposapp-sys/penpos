import { Capacitor } from '@capacitor/core'

export const MOBILE_MAX_WIDTH_PX = 768
export const MOBILE_WIDTH_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`
export const COARSE_POINTER_QUERY = '(pointer: coarse)'
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

const canUseWindow = () => typeof window !== 'undefined'

const getMatchMedia = () => {
  if (!canUseWindow() || typeof window.matchMedia !== 'function') return null
  return window.matchMedia.bind(window)
}

export const getLaunchSystemDarkMode = () => {
  if (!canUseWindow()) return false
  try {
    if (typeof window.__PENPOS_MOBILE_LAUNCH_DARK__ === 'boolean') {
      return window.__PENPOS_MOBILE_LAUNCH_DARK__ === true
    }
  } catch {
  }
  return matchesMediaQuery(SYSTEM_DARK_QUERY)
}

export const isCapacitorNativePlatform = () => {
  try {
    return Capacitor.isNativePlatform() === true
  } catch {
    return false
  }
}

export const matchesMediaQuery = (query) => {
  const matchMedia = getMatchMedia()
  if (!matchMedia) return false
  try {
    return matchMedia(query).matches === true
  } catch {
    return false
  }
}

export const isMobileRuntime = () => (
  isCapacitorNativePlatform() ||
  matchesMediaQuery(MOBILE_WIDTH_QUERY) ||
  matchesMediaQuery(COARSE_POINTER_QUERY)
)

export const isSystemDarkMode = () => matchesMediaQuery(SYSTEM_DARK_QUERY)

export const subscribeToMediaQuery = (query, listener) => {
  const matchMedia = getMatchMedia()
  if (!matchMedia || typeof listener !== 'function') return () => {}
  const mediaQueryList = matchMedia(query)
  const wrappedListener = () => listener(mediaQueryList.matches)

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', wrappedListener)
    return () => mediaQueryList.removeEventListener('change', wrappedListener)
  }

  if (typeof mediaQueryList.addListener === 'function') {
    mediaQueryList.addListener(wrappedListener)
    return () => mediaQueryList.removeListener(wrappedListener)
  }

  return () => {}
}
