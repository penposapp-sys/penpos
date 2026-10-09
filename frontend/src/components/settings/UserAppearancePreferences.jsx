import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import { useGlobalTypography } from '../../context/GlobalTypographyContext.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import { registerUnsavedAppearanceChanges } from '../../lib/unsavedAppearanceChanges.js'
import ThemeSelectionCards from './ThemeSelectionCards.jsx'

const PRESETS = [
  ['small', 'Küçük'],
  ['normal', 'Normal'],
  ['large', 'Büyük'],
]

const samePreferences = (left, right) =>
  left.themeKey === right.themeKey &&
  left.darkMode === right.darkMode &&
  left.fontSize === right.fontSize

export default function UserAppearancePreferences() {
  const { preference, sizeBounds, setCustomSize, setPreferenceValue } = useGlobalTypography()
  const { themeKey, darkMode, setThemeKey, setDarkMode } = useTheme()
  const [saved, setSaved] = useState(() => ({
    themeKey,
    darkMode,
    fontSize: preference.size,
  }))
  const [draft, setDraft] = useState(saved)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const ownerRef = useRef({})
  const initialFontSizeRef = useRef(preference.size)

  const dirty = useMemo(() => !samePreferences(saved, draft), [draft, saved])

  const applyPreferences = useCallback((values) => {
    setThemeKey(values.themeKey)
    setDarkMode(values.darkMode)
    setPreferenceValue(values.fontSize)
  }, [setDarkMode, setPreferenceValue, setThemeKey])

  const discard = useCallback(() => {
    setDraft(saved)
    applyPreferences(saved)
  }, [applyPreferences, saved])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const response = await api('/api/user/preferences/appearance', { silent: true })
        if (!response?.ok || response?.success === false) {
          const message = response?.message || 'Görünüm tercihleri alınamadı.'
          if (!cancelled) toast.error(message)
          return
        }
        const preferences = response.preferences || {}
        const initial = {
          themeKey: preferences.themeKey || 'white',
          darkMode: preferences.darkMode === true,
          fontSize: Number.isInteger(preferences.fontSize) ? preferences.fontSize : initialFontSizeRef.current,
        }
        if (cancelled) return
        setSaved(initial)
        setDraft(initial)
        applyPreferences(initial)
      } catch (error) {
        if (!cancelled) toast.error(error?.message || 'Görünüm tercihleri alınamadı.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [applyPreferences])

  useEffect(() => {
    registerUnsavedAppearanceChanges(ownerRef.current, dirty, discard)
    return () => registerUnsavedAppearanceChanges(ownerRef.current, false, discard)
  }, [dirty, discard])

  useEffect(() => {
    if (draft.fontSize < sizeBounds.min || draft.fontSize > sizeBounds.max) {
      const fontSize = Math.min(sizeBounds.max, Math.max(sizeBounds.min, draft.fontSize))
      setDraft((current) => ({ ...current, fontSize }))
      setSaved((current) => ({ ...current, fontSize }))
    }
  }, [draft.fontSize, sizeBounds])

  const changeFontSize = (size) => {
    setDraft((current) => ({ ...current, fontSize: size }))
    setCustomSize(size)
  }
  const baseFontSize = sizeBounds.min === 8 ? 10 : 12
  const presetSizes = {
    small: Math.max(sizeBounds.min, baseFontSize - 2),
    normal: baseFontSize,
    large: Math.min(sizeBounds.max, baseFontSize + 2),
  }
  const selectedPreset = draft.fontSize === presetSizes.normal
    ? 'normal'
    : draft.fontSize === presetSizes.large
      ? 'large'
      : draft.fontSize === presetSizes.small ? 'small' : null

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await api('/api/user/preferences/appearance', {
        method: 'PUT',
        data: draft,
        silent: true,
      })
      if (!response?.ok || response?.success === false) {
        toast.error(response?.message || 'Görünüm tercihleri kaydedilemedi.')
        return
      }
      const next = {
        themeKey: response.preferences?.themeKey || draft.themeKey,
        darkMode: response.preferences?.darkMode === true,
        fontSize: Number.isInteger(response.preferences?.fontSize)
          ? response.preferences.fontSize
          : draft.fontSize,
      }
      setSaved(next)
      setDraft(next)
      applyPreferences(next)
      window.dispatchEvent(new CustomEvent('appearance-preferences-updated', { detail: next }))
      registerUnsavedAppearanceChanges(ownerRef.current, false, discard)
      toast.success('Görünüm tercihleri kaydedildi.')
    } catch (error) {
      toast.error(error?.message || 'Görünüm tercihleri kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card global-typography-settings" aria-labelledby="user-appearance-title">
      <div className="global-typography-settings__header">
        <div>
          <h3 id="user-appearance-title">Kişisel Görünüm</h3>
          <p>Tema ve yazı boyutu yalnızca hesabınıza kaydedilir ve tüm ekranlarda uygulanır.</p>
        </div>
        <output className="global-typography-settings__value">{draft.fontSize} px</output>
      </div>

      <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
        <ThemeSelectionCards
          darkMode={draft.darkMode}
          onToggleDarkMode={(nextDarkMode) => {
            setDraft((current) => ({ ...current, darkMode: Boolean(nextDarkMode) }))
            setDarkMode(Boolean(nextDarkMode))
          }}
          darkModeLabel="Renk teması"
          darkModeDescription="Beyaz veya koyu görünümü kişisel hesabınıza kaydedin."
        />

        <div className="global-typography-settings__presets" role="group" aria-label="Hazır yazı boyutları">
          {PRESETS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="btn"
              aria-pressed={selectedPreset === value}
              onClick={() => changeFontSize(presetSizes[value])}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="global-typography-settings__slider-label" htmlFor="account-font-size">
          Manuel yazı boyutu
          <input
            id="account-font-size"
            type="range"
            min={sizeBounds.min}
            max={sizeBounds.max}
            step="1"
            value={draft.fontSize}
            onChange={(event) => changeFontSize(Number(event.target.value))}
            aria-valuetext={`${draft.fontSize} piksel`}
          />
          <span className="global-typography-settings__limits" aria-hidden="true">
            <span>{sizeBounds.min} px</span>
            <span>{sizeBounds.max} px</span>
          </span>
        </label>
        <p className="global-typography-settings__preview">
          Türkçe karakterler: ı İ, ş Ş, ğ Ğ, ü Ü, ö Ö, ç Ç
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          {dirty ? (
            <button type="button" className="btn" disabled={saving || loading} onClick={discard}>
              Değişiklikleri Geri Al
            </button>
          ) : null}
          <button type="submit" className="settings-ui-submit" disabled={!dirty || saving || loading}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </section>
  )
}
