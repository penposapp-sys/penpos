import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'penpos-global-typography'
const PRESET_SIZES = { small: 14, normal: 16, large: 18 }
const DEFAULT_PREFERENCE = { preset: 'normal', size: PRESET_SIZES.normal }
const getSizeBounds = () => typeof window !== 'undefined' && window.innerWidth <= 767
  ? { min: 8, max: 20 }
  : { min: 12, max: 24 }

const readPreference = () => {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCE
  let storedPreference
  try {
    storedPreference = window.localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Yazı boyutu tercihi tarayıcı depolamasından okunamadı.', error)
    return DEFAULT_PREFERENCE
  }

  if (!storedPreference) return DEFAULT_PREFERENCE
  try {
    const parsed = JSON.parse(storedPreference)
    const size = Number(parsed?.size)
    if (!Number.isFinite(size)) return DEFAULT_PREFERENCE
    const { min, max } = getSizeBounds()
    const safeSize = Math.min(max, Math.max(min, Math.round(size)))
    const preset = Object.hasOwn(PRESET_SIZES, parsed?.preset) ? parsed.preset : 'custom'
    return { preset, size: preset === 'custom' ? safeSize : PRESET_SIZES[preset] }
  } catch (error) {
    console.warn('Kayıtlı yazı boyutu tercihi okunamadı; varsayılan kullanılıyor.', error)
    return DEFAULT_PREFERENCE
  }
}

const GlobalTypographyContext = createContext(null)

export function GlobalTypographyProvider({ children }) {
  const [preference, setPreference] = useState(readPreference)
  const [sizeBounds, setSizeBounds] = useState(getSizeBounds)

  useEffect(() => {
    const updateBounds = () => setSizeBounds(getSizeBounds())
    window.addEventListener('resize', updateBounds)
    return () => window.removeEventListener('resize', updateBounds)
  }, [])

  useEffect(() => {
    if (preference.preset !== 'custom') return
    const size = Math.min(sizeBounds.max, Math.max(sizeBounds.min, preference.size))
    if (size !== preference.size) setPreference({ preset: 'custom', size })
  }, [preference, sizeBounds])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--app-font-size', `${preference.size}px`)
    root.dataset.appFontSize = String(preference.size)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference))
    } catch (error) {
      console.warn('Yazı boyutu tercihi tarayıcı depolamasına kaydedilemedi.', error)
    }
  }, [preference])

  const value = useMemo(() => ({
    preference,
    sizeBounds,
    setPreset: (preset) => {
      if (!Object.hasOwn(PRESET_SIZES, preset)) return
      setPreference({ preset, size: PRESET_SIZES[preset] })
    },
    setCustomSize: (value) => {
      const numericValue = Number(value)
      const size = Math.min(
        sizeBounds.max,
        Math.max(sizeBounds.min, Number.isFinite(numericValue) ? Math.round(numericValue) : DEFAULT_PREFERENCE.size)
      )
      setPreference({ preset: 'custom', size })
    },
  }), [preference, sizeBounds])

  return (
    <GlobalTypographyContext.Provider value={value}>
      {children}
    </GlobalTypographyContext.Provider>
  )
}

export function useGlobalTypography() {
  const context = useContext(GlobalTypographyContext)
  if (!context) throw new Error('useGlobalTypography must be used within GlobalTypographyProvider')
  return context
}
