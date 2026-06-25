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
  if (darkMode) {
    return {
      ...themes.white,
      name: 'Mobile Performance Dark',
      darkMode: true,
      accent: '#d39b69',
      accentHover: '#e1b78f',
      accentSoft: 'rgba(211, 155, 105, 0.12)',
      accentText: '#f8e7d6',
      appShellBg: '#0f1115',
      appShell: '#0f1115',
      sidebar: '#171a21',
      topbar: '#171a21',
      activeGlow: 'none',
      gradient: '#d39b69',
      chart: '#d39b69',
      card: '#171a21',
      border: '#2c323d',
      text: '#f3f4f6',
      textPrimary: '#f3f4f6',
      textSecondary: '#c7ccd4',
      mutedText: '#9ca3af',
      appBg: '#0f1115',
      appSurface: '#171a21',
      appSurfaceSoft: '#20242c',
      appSurface2: '#171a21',
      appSurface3: '#20242c',
      inputBg: '#171a21',
      buttonBg: '#20242c',
      buttonText: '#f3f4f6',
      buttonBorder: '#2c323d',
      buttonActiveBg: '#d39b69',
      buttonActiveText: '#111111',
      surfaceElevated: '#20242c',
      cardShadow: 'none',
    }
  }

  return {
    ...themes.white,
    name: 'Mobile Performance Light',
    darkMode: false,
    accent: '#111827',
    accentHover: '#1f2937',
    accentSoft: '#eef2f7',
    accentText: '#111827',
    sidebar: '#ffffff',
    topbar: '#ffffff',
    activeGlow: 'none',
    gradient: '#111827',
    chart: '#111827',
    card: '#ffffff',
    border: '#d9dee5',
    text: '#111827',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    mutedText: '#6b7280',
    appBg: '#f6f7f9',
    appSurface: '#ffffff',
    appSurfaceSoft: '#f1f3f5',
    inputBg: '#ffffff',
    buttonBg: '#ffffff',
    buttonBorder: '#d9dee5',
    surfaceElevated: '#f1f3f5',
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
      '--sidebar-item-text-active': coloredSidebarTheme ? '#182136' : '#ffffff',
      '--sidebar-item-icon': coloredSidebarTheme ? '#f9fafb' : (theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff'),
      '--sidebar-item-icon-active': coloredSidebarTheme ? theme.accent : '#ffffff',
      '--sidebar-item-icon-bg': coloredSidebarTheme ? 'rgba(255,255,255,0.10)' : (theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.12)'),
      '--sidebar-item-icon-active-bg': coloredSidebarTheme ? 'rgba(24,33,54,0.08)' : (theme.themeFamily === 'white' && !theme.darkMode ? '#ffffff' : '#111111'),
      '--sidebar-item-hover-bg': coloredSidebarTheme ? 'rgba(255,255,255,0.08)' : (theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.08)'),
      '--sidebar-active-bg': coloredSidebarTheme
        ? 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(245,247,250,0.96))'
        : (theme.themeFamily === 'white' ? '#111111' : '#181818'),
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
  '--sidebar-nav-text-active': '#ffffff',
  '--sidebar-nav-icon': theme.themeFamily === 'white' && !theme.darkMode ? '#111111' : '#ffffff',
  '--sidebar-nav-icon-active': '#ffffff',
  '--sidebar-nav-icon-bg': theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.12)',
  '--sidebar-nav-hover-bg': theme.themeFamily === 'white' && !theme.darkMode ? '#f3f4f6' : 'rgba(255,255,255,0.08)',
  '--sidebar-nav-icon-active-bg': theme.themeFamily === 'white' && !theme.darkMode ? '#ffffff' : '#111111',
  '--menu-active-bg': theme.themeFamily === 'white' ? '#111111' : '#181818',
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

const buildMobileThemeVars = (darkMode) => (
  darkMode
    ? {
        '--app-shell-bg': '#0f1115',
        '--app-shell': '#0f1115',
        '--app-bg': '#0f1115',
        '--app-surface': '#171a21',
        '--app-surface-soft': '#20242c',
        '--app-surface-2': '#171a21',
        '--app-surface-3': '#20242c',
        '--app-border': '#2c323d',
        '--app-text': '#f3f4f6',
        '--app-text-secondary': '#c7ccd4',
        '--app-text-muted': '#9ca3af',
        '--app-input': '#171a21',
        '--app-button-bg': '#20242c',
        '--app-button-text': '#f3f4f6',
        '--app-button-active-bg': '#d39b69',
        '--app-button-disabled-bg': '#3a3a3a',
        '--app-button-disabled-text': '#9ca3af',
        '--app-contrast-surface': '#121211',
        '--app-contrast-text': '#f4f1ec',
        '--app-contrast-border': 'rgba(255,255,255,0.12)',
        '--panel': '#171a21',
        '--panelElevated': '#20242c',
        '--panel-shell-bg': '#171a21',
        '--menu-active-bg': '#20242c',
        '--card-bg': '#171a21',
        '--card-hover': '#171a21',
        '--border-soft': '#2c323d',
        '--border-hover': '#2c323d',
        '--glass-blur': 'none',
        '--shadow-soft': 'none',
        '--shadow-glow': 'none',
        '--sidebar-bg': '#171a21',
        '--sidebar-nav-text': '#f3f4f6',
        '--sidebar-nav-text-active': '#ffffff',
        '--sidebar-nav-icon': '#cbd5e1',
        '--sidebar-nav-icon-active': '#ffffff',
        '--sidebar-nav-icon-bg': 'rgba(255,255,255,0.08)',
        '--sidebar-nav-icon-active-bg': 'rgba(255,255,255,0.14)',
        '--sidebar-logo-bg': '#171a21',
        '--sidebar-logo-border': '#2c323d',
        '--sidebar-item-text': '#f3f4f6',
        '--sidebar-item-text-active': '#ffffff',
        '--sidebar-item-icon': '#cbd5e1',
        '--sidebar-item-icon-active': '#ffffff',
        '--sidebar-item-icon-bg': 'rgba(255,255,255,0.08)',
        '--sidebar-item-icon-active-bg': 'rgba(255,255,255,0.14)',
        '--sidebar-item-hover-bg': 'rgba(255,255,255,0.08)',
        '--sidebar-active-bg': '#20242c',
        '--sidebar-active-border': '#2c323d',
        '--sidebar-active-shadow': 'none',
        '--sidebar-logout-bg': '#20242c',
        '--sidebar-logout-text': '#ffffff',
        '--sidebar-logout-icon-bg': 'rgba(255,255,255,0.08)',
        '--sidebar-logout-icon-color': '#ffffff',
        '--topbar-bg': '#171a21',
        '--topbar-border': '#2c323d',
        '--topbar-shadow': 'none',
        '--surface-glass': 'rgba(23, 26, 33, 0.92)',
        '--body-backdrop': 'none',
        '--modal-backdrop': 'rgba(0, 0, 0, 0.35)',
        '--theme-accent': '#d39b69',
        '--theme-accent-hover': '#e1b78f',
        '--theme-accent-soft': 'rgba(211, 155, 105, 0.12)',
        '--theme-accent-text': '#f8e7d6',
        '--theme-active-glow': 'none',
        '--theme-gradient': '#d39b69',
        '--theme-card-bg': '#171a21',
        '--theme-border': '#2c323d',
        '--theme-text': '#f3f4f6',
        '--theme-muted': '#9ca3af',
        '--border': '#2c323d',
        '--text': '#f3f4f6',
        '--text-primary': '#f3f4f6',
        '--text-secondary': '#c7ccd4',
        '--muted': '#9ca3af',
        '--button-text': '#f3f4f6',
        '--button-active-bg': '#d39b69',
        '--app-button-active-text': '#111111',
        '--button-active-text': '#111111',
        '--button-disabled-bg': '#3a3a3a',
        '--button-disabled-text': '#9ca3af',
        '--card-shadow': 'none',
      }
    : {
        '--app-shell-bg': '#f6f7f9',
        '--app-shell': '#f6f7f9',
        '--app-bg': '#f6f7f9',
        '--app-surface': '#ffffff',
        '--app-surface-soft': '#f1f3f5',
        '--app-surface-2': '#f1f3f5',
        '--app-surface-3': '#e5e7eb',
        '--app-border': '#d9dee5',
        '--app-text': '#111827',
        '--app-text-secondary': '#4b5563',
        '--app-text-muted': '#6b7280',
        '--app-input': '#ffffff',
        '--app-button-bg': '#ffffff',
        '--app-button-text': '#111111',
        '--app-button-active-bg': '#111111',
        '--app-button-disabled-bg': '#e5e7eb',
        '--app-button-disabled-text': '#6b7280',
        '--app-contrast-surface': '#ffffff',
        '--app-contrast-text': '#111111',
        '--app-contrast-border': '#d1d5db',
        '--panel': '#ffffff',
        '--panelElevated': '#f1f3f5',
        '--panel-shell-bg': '#ffffff',
        '--menu-active-bg': '#f1f3f5',
        '--card-bg': '#ffffff',
        '--card-hover': '#ffffff',
        '--border-soft': '#d9dee5',
        '--border-hover': '#d9dee5',
        '--glass-blur': 'none',
        '--shadow-soft': 'none',
        '--shadow-glow': 'none',
        '--sidebar-bg': '#ffffff',
        '--sidebar-nav-text': '#111827',
        '--sidebar-nav-text-active': '#111827',
        '--sidebar-nav-icon': '#111827',
        '--sidebar-nav-icon-active': '#ffffff',
        '--sidebar-nav-icon-bg': '#f3f4f6',
        '--sidebar-nav-icon-active-bg': '#ffffff',
        '--sidebar-logo-bg': '#ffffff',
        '--sidebar-logo-border': '#d9dee5',
        '--sidebar-item-text': '#111827',
        '--sidebar-item-text-active': '#111827',
        '--sidebar-item-icon': '#111827',
        '--sidebar-item-icon-active': '#ffffff',
        '--sidebar-item-icon-bg': '#f3f4f6',
        '--sidebar-item-icon-active-bg': '#ffffff',
        '--sidebar-item-hover-bg': '#f3f4f6',
        '--sidebar-active-bg': '#f1f3f5',
        '--sidebar-active-border': '#d9dee5',
        '--sidebar-active-shadow': 'none',
        '--sidebar-logout-bg': '#ffffff',
        '--sidebar-logout-text': '#111827',
        '--sidebar-logout-icon-bg': '#111111',
        '--sidebar-logout-icon-color': '#ffffff',
        '--topbar-bg': '#ffffff',
        '--topbar-border': '#d9dee5',
        '--topbar-shadow': 'none',
        '--surface-glass': 'rgba(255,255,255,0.92)',
        '--body-backdrop': 'none',
        '--modal-backdrop': 'rgba(15, 23, 42, 0.35)',
        '--theme-accent': '#111827',
        '--theme-accent-hover': '#1f2937',
        '--theme-accent-soft': '#eef2f7',
        '--theme-accent-text': '#111827',
        '--theme-active-glow': 'none',
        '--theme-gradient': '#111827',
        '--theme-card-bg': '#ffffff',
        '--theme-border': '#d9dee5',
        '--theme-text': '#111827',
        '--theme-muted': '#6b7280',
        '--border': '#d9dee5',
        '--text': '#111827',
        '--text-primary': '#111827',
        '--text-secondary': '#4b5563',
        '--muted': '#6b7280',
        '--button-text': '#111111',
        '--button-active-bg': '#111111',
        '--app-button-active-text': '#ffffff',
        '--button-active-text': '#ffffff',
        '--button-disabled-bg': '#e5e7eb',
        '--button-disabled-text': '#6b7280',
        '--card-shadow': 'none',
      }
)

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
