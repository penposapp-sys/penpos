import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { THEME_STORAGE_KEY, themes } from './themeConfig.js'

const ThemeContext = createContext({
  themeKey: 'default',
  setThemeKey: () => {},
  theme: themes.default
})

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKeyState] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      return stored && themes[stored] ? stored : 'default'
    } catch {
      return 'default'
    }
  })

  const theme = useMemo(() => themes[themeKey] || themes.default, [themeKey])

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeKey)
    } catch {}

    const root = document.documentElement
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-accent-hover', theme.accentHover)
    root.style.setProperty('--theme-accent-soft', theme.accentSoft)
    root.style.setProperty('--theme-accent-text', theme.accentText)
    root.style.setProperty('--theme-card-bg', theme.card)
    root.style.setProperty('--theme-border', theme.border)
    root.style.setProperty('--theme-text', theme.text)
    root.style.setProperty('--panel', theme.card)
    root.style.setProperty('--panelElevated', themeKey === 'default' ? '#f3f4f6' : '#f8fafc')
    root.style.setProperty('--border', theme.border)
    root.style.setProperty('--text', theme.text)
  }, [theme, themeKey])

  const value = useMemo(() => ({
    themeKey,
    setThemeKey: (next) => setThemeKeyState(themes[next] ? next : 'default'),
    theme
  }), [themeKey, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
