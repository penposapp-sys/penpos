import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getScopedDarkModeStorageKey, getScopedThemeStorageKey, resolveThemeScope, themes } from './themeConfig.js'

const buildRuntimeTheme = (themeKey, darkMode) => {
  const baseTheme = themes[themeKey] || themes.default
  if (!darkMode) {
    return {
      ...baseTheme,
      darkMode: false,
      appBg: '#f8fafc',
      appSurface: '#ffffff',
      appSurfaceSoft: themeKey === 'default' ? '#f3f4f6' : '#f8fafc',
      textPrimary: '#0f172a',
      textSecondary: '#334155',
      mutedText: '#64748b',
      inputBg: '#ffffff',
      buttonBg: '#e5e7eb',
      buttonBorder: '#d1d5db',
      surfaceElevated: themeKey === 'default' ? '#f3f4f6' : '#f8fafc',
      cardShadow: '0 12px 28px rgba(15, 23, 42, 0.06)'
    }
  }

  return {
    ...baseTheme,
    darkMode: true,
    appBg: '#090909',
    appSurface: '#121211',
    appSurfaceSoft: '#1b1a18',
    accentText: '#f4f1ec',
    accentSoft: 'rgba(255,255,255,0.08)',
    accentHover: baseTheme.accentHover || baseTheme.accent,
    sidebar: 'linear-gradient(180deg, rgba(18,18,17,0.96) 0%, rgba(9,9,9,0.98) 100%)',
    topbar: 'rgba(18,18,17,0.78)',
    card: 'linear-gradient(180deg, rgba(48,47,44,0.72) 0%, rgba(28,27,25,0.76) 45%, rgba(13,13,12,0.88) 100%)',
    border: 'rgba(255,255,255,0.075)',
    text: '#f4f1ec',
    textPrimary: '#f4f1ec',
    textSecondary: '#b8b4ad',
    mutedText: '#77736d',
    surfaceElevated: '#1b1a18',
    inputBg: 'rgba(21, 20, 18, 0.82)',
    buttonBg: 'rgba(255,255,255,0.06)',
    buttonBorder: 'rgba(255,255,255,0.08)',
    cardShadow: '0 10px 40px rgba(0,0,0,0.42)'
  }
}

const ThemeContext = createContext({
  themeScope: 'public',
  themeKey: 'default',
  setThemeKey: () => {},
  darkMode: false,
  setDarkMode: () => {},
  theme: buildRuntimeTheme('default', false)
})

const readStoredThemeKey = (scope) => {
  try {
    const stored = localStorage.getItem(getScopedThemeStorageKey(scope))
    return stored && themes[stored] ? stored : 'default'
  } catch {
    return 'default'
  }
}

const readStoredDarkMode = (scope) => {
  try {
    return localStorage.getItem(getScopedDarkModeStorageKey(scope)) === 'true'
  } catch {
    return false
  }
}

export function ThemeProvider({ children }) {
  const location = useLocation()
  const themeScope = useMemo(() => resolveThemeScope(location.pathname), [location.pathname])
  const [themeKey, setThemeKeyState] = useState(() => readStoredThemeKey(resolveThemeScope(window.location.pathname)))
  const [darkMode, setDarkModeState] = useState(() => readStoredDarkMode(resolveThemeScope(window.location.pathname)))

  const theme = useMemo(() => buildRuntimeTheme(themeKey, darkMode), [themeKey, darkMode])

  useEffect(() => {
    setThemeKeyState(readStoredThemeKey(themeScope))
    setDarkModeState(readStoredDarkMode(themeScope))
  }, [themeScope])

  useEffect(() => {
    try {
      localStorage.setItem(getScopedThemeStorageKey(themeScope), themeKey)
      localStorage.setItem(getScopedDarkModeStorageKey(themeScope), String(theme.darkMode === true))
    } catch {}

    const root = document.documentElement
    root.dataset.theme = theme.darkMode ? 'dark' : 'light'
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-accent-hover', theme.accentHover)
    root.style.setProperty('--theme-accent-soft', theme.accentSoft)
    root.style.setProperty('--theme-accent-text', theme.accentText)
    root.style.setProperty('--theme-active-glow', theme.activeGlow || '0 18px 45px rgba(15, 23, 42, 0.22)')
    root.style.setProperty('--theme-gradient', theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover || theme.accent})`)
    root.style.setProperty('--theme-card-bg', theme.card)
    root.style.setProperty('--theme-border', theme.border)
    root.style.setProperty('--theme-text', theme.text)
    root.style.setProperty('--theme-muted', theme.mutedText)
    root.style.setProperty('--app-bg', theme.appBg || theme.card)
    root.style.setProperty('--app-surface', theme.appSurface || theme.card)
    root.style.setProperty('--app-surface-soft', theme.appSurfaceSoft || theme.surfaceElevated)
    root.style.setProperty('--app-border', theme.border)
    root.style.setProperty('--app-text', theme.textPrimary || theme.text)
    root.style.setProperty('--app-text-secondary', theme.textSecondary || theme.mutedText)
    root.style.setProperty('--app-text-muted', theme.mutedText)
    root.style.setProperty('--app-input', theme.inputBg)
    root.style.setProperty('--app-button-bg', theme.buttonBg)
    root.style.setProperty('--panel', theme.card)
    root.style.setProperty('--panelElevated', theme.surfaceElevated)
    root.style.setProperty('--border', theme.border)
    root.style.setProperty('--text', theme.text)
    root.style.setProperty('--text-primary', theme.textPrimary || theme.text)
    root.style.setProperty('--text-secondary', theme.textSecondary || theme.mutedText)
    root.style.setProperty('--muted', theme.mutedText)
    root.style.setProperty('--input-bg', theme.inputBg)
    root.style.setProperty('--button-bg', theme.buttonBg)
    root.style.setProperty('--button-border', theme.buttonBorder)
    root.style.setProperty('--card-shadow', theme.cardShadow)
  }, [theme, themeKey, themeScope])

  const value = useMemo(() => ({
    themeScope,
    themeKey,
    setThemeKey: (next) => setThemeKeyState(themes[next] ? next : 'default'),
    darkMode,
    setDarkMode: (next) => setDarkModeState(Boolean(next)),
    theme
  }), [darkMode, theme, themeKey, themeScope])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
