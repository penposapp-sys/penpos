import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getScopedDarkModeStorageKey, getScopedThemeStorageKey, normalizeThemeId, resolveThemeScope, themes } from './themeConfig.js'
import {
  COARSE_POINTER_QUERY,
  MOBILE_WIDTH_QUERY,
  SYSTEM_DARK_QUERY,
  getLaunchSystemDarkMode,
  isMobileRuntime as detectMobileRuntime,
  isSystemDarkMode as detectSystemDarkMode,
  subscribeToMediaQuery,
} from '../utils/device.js'

const RUNTIME_THEME_VAR_KEYS = [
  '--app-shell-bg',
  '--app-shell',
  '--theme-accent',
  '--theme-accent-hover',
  '--theme-accent-soft',
  '--theme-accent-text',
  '--theme-active-glow',
  '--theme-gradient',
  '--theme-card-bg',
  '--theme-border',
  '--theme-text',
  '--theme-muted',
  '--app-bg',
  '--app-surface',
  '--app-surface-soft',
  '--app-border',
  '--app-text',
  '--app-text-secondary',
  '--app-text-muted',
  '--app-input',
  '--app-button-bg',
  '--app-button-active-bg',
  '--app-button-disabled-bg',
  '--app-button-disabled-text',
  '--panel',
  '--panelElevated',
  '--card-bg',
  '--card-hover',
  '--panel-shell-bg',
  '--menu-active-bg',
  '--border-soft',
  '--border-hover',
  '--glass-blur',
  '--shadow-soft',
  '--shadow-glow',
  '--sidebar-bg',
  '--sidebar-nav-text',
  '--sidebar-nav-text-active',
  '--sidebar-nav-icon',
  '--sidebar-nav-icon-active',
  '--sidebar-nav-icon-bg',
  '--sidebar-nav-icon-active-bg',
  '--sidebar-logo-bg',
  '--sidebar-logo-border',
  '--sidebar-item-text',
  '--sidebar-item-text-active',
  '--sidebar-item-icon',
  '--sidebar-item-icon-active',
  '--sidebar-item-icon-bg',
  '--sidebar-item-icon-active-bg',
  '--sidebar-item-hover-bg',
  '--sidebar-active-bg',
  '--sidebar-active-border',
  '--sidebar-active-shadow',
  '--sidebar-logout-bg',
  '--sidebar-logout-text',
  '--sidebar-logout-icon-bg',
  '--sidebar-logout-icon-color',
  '--topbar-bg',
  '--topbar-border',
  '--topbar-shadow',
  '--surface-glass',
  '--body-backdrop',
  '--modal-backdrop',
  '--border',
  '--text',
  '--text-primary',
  '--text-secondary',
  '--muted',
  '--input-bg',
  '--button-bg',
  '--button-border',
  '--app-button-text',
  '--button-text',
  '--button-active-bg',
  '--app-button-active-text',
  '--button-active-text',
  '--button-disabled-bg',
  '--button-disabled-text',
  '--card-shadow',
]

const getButtonTokens = (themeFamily, darkMode) => {
  if (themeFamily === 'white' && !darkMode) {
    return {
      buttonBg: '#ffffff',
      buttonText: '#111111',
      buttonBorder: '#d1d5db',
      buttonActiveBg: '#111111',
      buttonActiveText: '#ffffff',
      buttonDisabledBg: '#e5e7eb',
      buttonDisabledText: '#6b7280',
    }
  }

  if (themeFamily !== 'white' && !darkMode) {
    return {
      buttonBg: '#5b514c',
      buttonText: '#ffffff',
      buttonBorder: '#6a605b',
      buttonActiveBg: '#111111',
      buttonActiveText: '#ffffff',
      buttonDisabledBg: '#d1d5db',
      buttonDisabledText: '#6b7280',
    }
  }

  if (themeFamily === 'white' && darkMode) {
    return {
      buttonBg: '#2a2a2a',
      buttonText: '#ffffff',
      buttonBorder: '#3a3a3a',
      buttonActiveBg: '#3f3f46',
      buttonActiveText: '#f5f5f5',
      buttonDisabledBg: '#3a3a3a',
      buttonDisabledText: '#9ca3af',
    }
  }

  return {
    buttonBg: '#3f3936',
    buttonText: '#ffffff',
    buttonBorder: '#5b514c',
    buttonActiveBg: '#ea7a1a',
    buttonActiveText: '#111111',
    buttonDisabledBg: '#3a3a3a',
    buttonDisabledText: '#9ca3af',
  }
}

const buildDesktopSurfaceTheme = (darkMode) => darkMode
  ? {
      appBg: '#1f1f1f',
      appSurface: '#242424',
      appSurfaceSoft: '#2a2a2a',
      textPrimary: '#ffffff',
      textSecondary: '#f1f1f1',
      mutedText: '#d6d6d6',
      inputBg: '#242424',
      buttonBg: '#2a2a2a',
      buttonBorder: '#3a3a3a',
      surfaceElevated: '#2a2a2a',
      cardShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
    }
  : {
      appBg: '#f8fafc',
      appSurface: '#ffffff',
      appSurfaceSoft: '#f3f4f6',
      textPrimary: '#111111',
      textSecondary: '#374151',
      mutedText: '#6b7280',
      inputBg: '#ffffff',
      buttonBg: '#ffffff',
      buttonBorder: '#d1d5db',
      surfaceElevated: '#f1f5f9',
      cardShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
    }

const buildThemePalette = (themeFamily, darkMode) => {
  if (themeFamily === 'white') {
    if (darkMode) {
      return {
        accent: '#ffffff',
        accentHover: '#f4f4f5',
        accentSoft: '#2a2a2a',
        accentText: '#ffffff',
        sidebar: 'linear-gradient(180deg, #202020 0%, #171717 100%)',
        topbar: 'linear-gradient(90deg, #202020 0%, #171717 100%)',
        borderAccent: '#3a3a3a',
      }
    }

    return {
      accent: '#111111',
      accentHover: '#27272a',
      accentSoft: '#f4f4f5',
      accentText: '#111111',
      sidebar: '#ffffff',
      topbar: '#ffffff',
      borderAccent: '#d1d5db',
    }
  }

  if (darkMode) {
    return {
      accent: '#ea7a1a',
      accentHover: '#f59e0b',
      accentSoft: '#3a312d',
      accentText: '#ffffff',
      sidebar: 'linear-gradient(180deg, #3f3936 0%, #2e2927 100%)',
      topbar: 'linear-gradient(90deg, #3f3936 0%, #342f2c 100%)',
      borderAccent: '#4a4340',
    }
  }

  return {
    accent: '#ea7a1a',
    accentHover: '#d96a0c',
    accentSoft: '#f6e7dc',
    accentText: '#111111',
    sidebar: 'linear-gradient(180deg, #5b514c 0%, #4a433f 100%)',
    topbar: 'linear-gradient(90deg, #5b514c 0%, #4f4742 100%)',
    borderAccent: '#6a605b',
  }
}

const buildRuntimeTheme = (themeKey, darkMode) => {
  const themeFamily = normalizeThemeId(themeKey)
  const palette = themes[themeFamily] || themes.white
  const surface = buildDesktopSurfaceTheme(darkMode)
  const familyPalette = buildThemePalette(themeFamily, darkMode)
  const accent = familyPalette.accent || palette.accent || themes.white.accent
  const accentHover = familyPalette.accentHover || palette.accentHover || accent
  const accentSoft = familyPalette.accentSoft || palette.accentSoft || themes.white.accentSoft
  const accentText = familyPalette.accentText || palette.accentText || surface.textPrimary
  const borderAccent = familyPalette.borderAccent || palette.borderAccent || accentSoft
  const sidebar = familyPalette.sidebar || palette.sidebar || '#ffffff'
  const topbar = familyPalette.topbar || palette.topbar || sidebar
  const buttonTokens = getButtonTokens(themeFamily, darkMode)

  return {
    ...palette,
    ...surface,
    ...buttonTokens,
    darkMode: !!darkMode,
    themeKey: themeFamily,
    themeFamily,
    accent,
    accentHover,
    accentSoft,
    accentText,
    borderAccent,
    border: borderAccent,
    card: surface.appSurface,
    text: surface.textPrimary,
    sidebar,
    topbar,
    activeGlow: 'none',
    chart: accent,
    gradient: `linear-gradient(135deg, ${accent}, ${accentHover})`,
  }
}

const buildMobileRuntimeTheme = (darkMode) => {
  const runtimeTheme = buildRuntimeTheme('white', darkMode)

  return {
    ...runtimeTheme,
    name: darkMode ? 'Mobile Performance Dark' : 'Mobile Performance Light',
    activeGlow: 'none',
    cardShadow: 'none',
  }
}

const ThemeContext = createContext({
  themeScope: 'public',
  themeKey: 'white',
  setThemeKey: () => {},
  darkMode: false,
  setDarkMode: () => {},
  theme: buildRuntimeTheme('white', false),
  isMobileRuntime: false,
  systemDarkMode: false,
})

const getCurrentPathname = () => {
  if (typeof window === 'undefined') return ''
  return String(window.location?.pathname || '')
}

const getCurrentThemeScope = () => resolveThemeScope(getCurrentPathname())

const getScopeThemeDefaults = (scope) => (
  scope === 'public'
    ? { themeKey: 'white', darkMode: false }
    : { themeKey: 'white', darkMode: false }
)

const readStoredThemeKey = (scope) => {
  if (typeof window === 'undefined') return getScopeThemeDefaults(scope).themeKey
  if (scope === 'public') return getScopeThemeDefaults(scope).themeKey
  try {
    const stored = localStorage.getItem(getScopedThemeStorageKey(scope))
    return normalizeThemeId(stored)
  } catch {
    return getScopeThemeDefaults(scope).themeKey
  }
}

const readStoredDarkMode = (scope) => {
  if (typeof window === 'undefined') return getScopeThemeDefaults(scope).darkMode
  if (scope === 'public') return getScopeThemeDefaults(scope).darkMode
  try {
    return localStorage.getItem(getScopedDarkModeStorageKey(scope)) === 'true'
  } catch {
    return getScopeThemeDefaults(scope).darkMode
  }
}

const clearRuntimeThemeVars = (root) => {
  RUNTIME_THEME_VAR_KEYS.forEach((key) => root.style.removeProperty(key))
}

const applyRuntimeThemeVars = (root, vars) => {
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

const buildDesktopThemeVars = (theme) => ({
  ...(() => {
    const coloredSidebarTheme = theme.themeFamily !== 'white'
    return {
      '--sidebar-logo-bg': coloredSidebarTheme
        ? 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(243,244,246,0.96))'
        : theme.card,
      '--sidebar-logo-border': coloredSidebarTheme ? 'rgba(255,255,255,0.42)' : (theme.borderAccent || theme.border),
      '--sidebar-item-text': coloredSidebarTheme ? '#f9fafb' : (theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff'),
      '--sidebar-item-text-active': coloredSidebarTheme ? '#182136' : (theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff'),
      '--sidebar-item-icon': coloredSidebarTheme ? '#f9fafb' : (theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff'),
      '--sidebar-item-icon-active': coloredSidebarTheme ? theme.accent : (theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff'),
      '--sidebar-item-icon-bg': coloredSidebarTheme ? 'rgba(255,255,255,0.10)' : (theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.12)'),
      '--sidebar-item-icon-active-bg': coloredSidebarTheme ? 'rgba(24,33,54,0.08)' : (theme.themeFamily === 'white' && !theme.darkMode ? '#ffffff' : '#111111'),
      '--sidebar-item-hover-bg': coloredSidebarTheme ? 'rgba(255,255,255,0.08)' : (theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.08)'),
      '--sidebar-active-bg': coloredSidebarTheme
        ? 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(245,247,250,0.96))'
        : (theme.themeFamily === 'white' && !theme.darkMode ? '#ffffff' : (theme.themeFamily === 'white' ? '#111111' : '#181818')),
      '--sidebar-active-border': coloredSidebarTheme ? 'rgba(255,255,255,0.62)' : (theme.borderAccent || theme.border),
      '--sidebar-active-shadow': coloredSidebarTheme ? '0 12px 26px rgba(12, 18, 28, 0.16)' : 'none',
      '--sidebar-logout-bg': coloredSidebarTheme
        ? 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(245,247,250,0.96))'
        : theme.buttonBg,
      '--sidebar-logout-text': coloredSidebarTheme ? '#182136' : '#ffffff',
      '--sidebar-logout-icon-bg': coloredSidebarTheme ? '#111111' : (theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : 'rgba(255,255,255,0.12)'),
      '--sidebar-logout-icon-color': coloredSidebarTheme ? '#ffffff' : (theme.themeFamily === 'white' && !theme.darkMode ? '#ffffff' : '#ffffff'),
    }
  })(),
  '--theme-accent': theme.accent,
  '--theme-accent-hover': theme.accentHover,
  '--theme-accent-soft': theme.accentSoft,
  '--theme-accent-text': theme.accentText,
  '--theme-active-glow': theme.activeGlow || 'none',
  '--theme-gradient': theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover || theme.accent})`,
  '--theme-card-bg': theme.card,
  '--theme-border': theme.borderAccent || theme.border,
  '--theme-text': theme.text,
  '--theme-muted': theme.mutedText,
  '--app-bg': theme.appBg || theme.card,
  '--app-surface': theme.appSurface || theme.card,
  '--app-surface-soft': theme.appSurfaceSoft || theme.surfaceElevated,
  '--app-border': theme.borderAccent || theme.border,
  '--app-text': theme.textPrimary || theme.text,
  '--app-text-secondary': theme.textSecondary || theme.mutedText,
  '--app-text-muted': theme.mutedText,
  '--app-input': theme.inputBg,
  '--app-button-bg': theme.buttonBg,
  '--app-button-text': theme.buttonText || theme.textPrimary || theme.text,
  '--app-button-active-bg': theme.buttonActiveBg || theme.accent,
  '--app-button-disabled-bg': theme.buttonDisabledBg || theme.appSurfaceSoft || theme.surfaceElevated,
  '--app-button-disabled-text': theme.buttonDisabledText || theme.mutedText,
  '--app-contrast-surface': theme.darkMode ? '#121211' : '#ffffff',
  '--app-contrast-text': theme.darkMode ? '#f4f1ec' : '#111111',
  '--app-contrast-border': theme.darkMode ? 'rgba(255,255,255,0.12)' : '#d1d5db',
  '--panel': theme.card,
  '--panelElevated': theme.surfaceElevated,
  '--sidebar-bg': theme.themeFamily !== 'white'
    ? 'linear-gradient(180deg, #2f2624 0%, #6a371f 54%, #2a201d 100%)'
    : theme.sidebar,
  '--sidebar-nav-text': theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff',
  '--sidebar-nav-text-active': theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff',
  '--sidebar-nav-icon': theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff',
  '--sidebar-nav-icon-active': theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff',
  '--sidebar-nav-icon-bg': theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.12)',
  '--sidebar-nav-hover-bg': theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.08)',
  '--sidebar-nav-icon-active-bg': theme.themeFamily === 'white' && !theme.darkMode ? '#ffffff' : '#111111',
  '--menu-active-bg': theme.themeFamily === 'white' && !theme.darkMode ? '#ffffff' : (theme.themeFamily === 'white' ? '#111111' : '#181818'),
  '--topbar-bg': theme.topbar,
  '--topbar-border': theme.borderAccent || theme.border,
  '--border': theme.borderAccent || theme.border,
  '--text': theme.text,
  '--text-primary': theme.textPrimary || theme.text,
  '--text-secondary': theme.textSecondary || theme.mutedText,
  '--muted': theme.mutedText,
  '--input-bg': theme.inputBg,
  '--button-bg': theme.buttonBg,
  '--button-border': theme.buttonBorder,
  '--button-text': theme.buttonText || theme.textPrimary || theme.text,
  '--button-active-bg': theme.buttonActiveBg || theme.accent,
  '--app-button-active-text': theme.buttonActiveText || '#ffffff',
  '--button-active-text': theme.buttonActiveText || '#ffffff',
  '--button-disabled-bg': theme.buttonDisabledBg || theme.appSurfaceSoft || theme.surfaceElevated,
  '--button-disabled-text': theme.buttonDisabledText || theme.mutedText,
  '--card-shadow': theme.cardShadow,
})

const buildMobileThemeVars = (darkMode) => {
  const runtimeTheme = buildRuntimeTheme('white', darkMode)
  const desktopVars = buildDesktopThemeVars(runtimeTheme)

  return {
    ...desktopVars,
    '--app-shell-bg': runtimeTheme.appShellBg || runtimeTheme.appBg || runtimeTheme.card,
    '--app-shell': runtimeTheme.appShell || runtimeTheme.appBg || runtimeTheme.card,
    '--app-surface-2': runtimeTheme.appSurface || runtimeTheme.card,
    '--app-surface-3': runtimeTheme.appSurfaceSoft || runtimeTheme.surfaceElevated,
    '--panel-shell-bg': runtimeTheme.appSurface || runtimeTheme.card,
    '--card-bg': runtimeTheme.card,
    '--card-hover': runtimeTheme.card,
    '--border-soft': runtimeTheme.borderAccent || runtimeTheme.border,
    '--border-hover': runtimeTheme.borderAccent || runtimeTheme.border,
    '--glass-blur': 'none',
    '--shadow-soft': 'none',
    '--shadow-glow': 'none',
    '--topbar-shadow': 'none',
    '--surface-glass': darkMode ? 'rgba(18, 18, 17, 0.92)' : 'rgba(255,255,255,0.92)',
    '--body-backdrop': 'none',
    '--modal-backdrop': darkMode ? 'rgba(0, 0, 0, 0.35)' : 'rgba(15, 23, 42, 0.35)',
    '--card-shadow': 'none',
  }
}

export function ThemeProvider({ children }) {
  const location = useLocation()
  const themeScope = useMemo(() => resolveThemeScope(location.pathname), [location.pathname])
  const isPublicScope = themeScope === 'public'
  const initialMobileRuntime = detectMobileRuntime()
  const [mobileRuntime, setMobileRuntime] = useState(() => initialMobileRuntime)
  const [systemDarkMode, setSystemDarkMode] = useState(() => getLaunchSystemDarkMode())
  const [storedThemeKey, setStoredThemeKey] = useState(() => readStoredThemeKey(getCurrentThemeScope()))
  const [storedDarkMode, setStoredDarkMode] = useState(() => readStoredDarkMode(getCurrentThemeScope()))

  useEffect(() => {
    const updateMobileRuntime = () => setMobileRuntime(detectMobileRuntime())
    const updateSystemDarkMode = () => {
      setSystemDarkMode((current) => (detectMobileRuntime() ? current : detectSystemDarkMode()))
    }
    const updateAll = () => {
      updateMobileRuntime()
      updateSystemDarkMode()
    }

    updateAll()

    const unsubscribers = [
      subscribeToMediaQuery(MOBILE_WIDTH_QUERY, updateMobileRuntime),
      subscribeToMediaQuery(COARSE_POINTER_QUERY, updateMobileRuntime),
      subscribeToMediaQuery(SYSTEM_DARK_QUERY, updateAll),
    ]

    if (typeof window === 'undefined') {
      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
    }

    window.addEventListener('resize', updateMobileRuntime)
    window.addEventListener('orientationchange', updateMobileRuntime)

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      window.removeEventListener('resize', updateMobileRuntime)
      window.removeEventListener('orientationchange', updateMobileRuntime)
    }
  }, [])

  useEffect(() => {
    const defaults = getScopeThemeDefaults(themeScope)
    setStoredThemeKey(isPublicScope ? defaults.themeKey : readStoredThemeKey(themeScope))
    setStoredDarkMode(isPublicScope ? defaults.darkMode : readStoredDarkMode(themeScope))
  }, [isPublicScope, themeScope])

  useEffect(() => {
    if (isPublicScope || typeof window === 'undefined') return
    try {
      localStorage.setItem(getScopedThemeStorageKey(themeScope), storedThemeKey)
      localStorage.setItem(getScopedDarkModeStorageKey(themeScope), String(storedDarkMode === true))
    } catch {}
  }, [isPublicScope, storedDarkMode, storedThemeKey, themeScope])

  const themeKey = normalizeThemeId(storedThemeKey)
  const darkMode = storedDarkMode === true
  const theme = useMemo(
    () => (mobileRuntime ? buildMobileRuntimeTheme(darkMode) : buildRuntimeTheme(themeKey, darkMode)),
    [darkMode, mobileRuntime, themeKey]
  )

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const body = document.body
    const mobileSystemClass = darkMode ? 'mobile-system-dark' : 'mobile-system-light'

    root.classList.toggle('mobile-performance-mode', mobileRuntime)
    root.classList.remove('mobile-system-dark', 'mobile-system-light')
    root.classList.remove('theme-white', 'theme-colored')
    root.classList.remove('tenant-dark-mode')
    if (mobileRuntime) {
      root.classList.add(mobileSystemClass)
      root.classList.add('theme-white')
    } else {
      if (!isPublicScope) root.classList.add(theme.themeFamily === 'white' ? 'theme-white' : 'theme-colored')
    }

    if (body) {
      body.classList.toggle('mobile-performance-mode', mobileRuntime)
      body.classList.remove('mobile-system-dark', 'mobile-system-light')
      body.classList.remove('theme-white', 'theme-colored')
      body.classList.remove('tenant-dark-mode')
      if (mobileRuntime) {
        body.classList.add(mobileSystemClass)
        body.classList.add('theme-white')
      } else {
        if (!isPublicScope) body.classList.add(theme.themeFamily === 'white' ? 'theme-white' : 'theme-colored')
      }
    }

    clearRuntimeThemeVars(root)

    if (mobileRuntime) {
      root.dataset.theme = darkMode ? 'dark' : 'light'
      body?.setAttribute('data-theme', darkMode ? 'dark' : 'light')
      applyRuntimeThemeVars(root, buildMobileThemeVars(darkMode))
      return
    }

    root.dataset.theme = theme.darkMode ? 'dark' : 'light'
    body?.setAttribute('data-theme', theme.darkMode ? 'dark' : 'light')
    applyRuntimeThemeVars(root, buildDesktopThemeVars(theme))
    root.classList.toggle('tenant-dark-mode', !isPublicScope && theme.darkMode)
    body?.classList.toggle('tenant-dark-mode', !isPublicScope && theme.darkMode)
  }, [darkMode, isPublicScope, mobileRuntime, theme])

  const value = useMemo(() => ({
    themeScope,
    themeKey,
    setThemeKey: (next) => {
      if (isPublicScope) return
      const nextThemeKey = normalizeThemeId(next)
      setStoredThemeKey(nextThemeKey)
      try {
        localStorage.setItem(getScopedThemeStorageKey(themeScope), nextThemeKey)
      } catch {}
    },
    darkMode,
    setDarkMode: (next) => {
      if (isPublicScope) return
      const nextDarkMode = Boolean(next)
      setStoredDarkMode(nextDarkMode)
      try {
        localStorage.setItem(getScopedDarkModeStorageKey(themeScope), String(nextDarkMode))
      } catch {}
    },
    theme,
    isMobileRuntime: mobileRuntime,
    systemDarkMode,
  }), [darkMode, isPublicScope, mobileRuntime, systemDarkMode, theme, themeKey, themeScope])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
