import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'

const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth <= 767
const getPresetSize = (preset, mobile = isMobileViewport()) => {
  const base = mobile ? 10 : 12
  if (preset === 'small') return Math.max(mobile ? 8 : 12, base - 2)
  if (preset === 'large') return Math.min(mobile ? 20 : 24, base + 2)
  return base
}
const getDefaultPreference = () => ({ preset: 'normal', size: getPresetSize('normal') })
const getSizeBounds = () => typeof window !== 'undefined' && window.innerWidth <= 767
  ? { min: 8, max: 20 }
  : { min: 12, max: 24 }

const GlobalTypographyContext = createContext(null)

export function GlobalTypographyProvider({ children }) {
  const [preference, setPreference] = useState(getDefaultPreference)
  const [sizeBounds, setSizeBounds] = useState(getSizeBounds)

  useEffect(() => {
    const updateBounds = () => setSizeBounds(getSizeBounds())
    window.addEventListener('resize', updateBounds)
    return () => window.removeEventListener('resize', updateBounds)
  }, [])

  useEffect(() => {
    if (preference.preset !== 'custom') {
      const size = getPresetSize(preference.preset)
      if (size !== preference.size) setPreference((current) => ({ ...current, size }))
      return
    }
    const size = Math.min(sizeBounds.max, Math.max(sizeBounds.min, preference.size))
    if (size !== preference.size) setPreference({ preset: 'custom', size })
  }, [preference, sizeBounds])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--app-font-size', `${preference.size}px`)
    root.dataset.appFontSize = String(preference.size)
  }, [preference])

  const setPreset = useCallback((preset) => {
    if (!['small', 'normal', 'large'].includes(preset)) return
    setPreference({ preset, size: getPresetSize(preset) })
  }, [])
  const setCustomSize = useCallback((value) => {
    const numericValue = Number(value)
    const size = Math.min(
      sizeBounds.max,
      Math.max(sizeBounds.min, Number.isFinite(numericValue) ? Math.round(numericValue) : getDefaultPreference().size)
    )
    setPreference({ preset: 'custom', size })
  }, [sizeBounds])
  const setPreferenceValue = useCallback((value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return
    const size = Math.min(sizeBounds.max, Math.max(sizeBounds.min, Math.round(numericValue)))
    setPreference({ preset: 'custom', size })
  }, [sizeBounds])
  const resetPreference = useCallback(() => setPreference(getDefaultPreference()), [])

  const value = useMemo(() => ({
    preference,
    sizeBounds,
    setPreset,
    setCustomSize,
    setPreferenceValue,
    resetPreference,
  }), [preference, resetPreference, setCustomSize, setPreset, setPreferenceValue, sizeBounds])

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
