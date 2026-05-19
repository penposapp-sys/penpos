export const THEME_STORAGE_KEY = 'penpos-theme-key'
export const DARK_MODE_STORAGE_KEY = 'penpos-dark-mode'

export function resolveThemeScope(pathname = '') {
  const path = String(pathname || '').toLowerCase()
  if (
    path.startsWith('/platform') ||
    path.startsWith('/platform-login') ||
    path.startsWith('/login/platform')
  ) {
    return 'platform'
  }
  if (
    path.startsWith('/canteen') ||
    path.startsWith('/login/kantin')
  ) {
    return 'canteen'
  }
  if (
    path.startsWith('/kermes') ||
    path.startsWith('/login/restoran')
  ) {
    return 'kermes'
  }
  return 'public'
}

export function getScopedThemeStorageKey(scope = 'public') {
  return `${THEME_STORAGE_KEY}:${scope}`
}

export function getScopedDarkModeStorageKey(scope = 'public') {
  return `${DARK_MODE_STORAGE_KEY}:${scope}`
}

export const themes = {
  default: {
    name: 'Mevcut Tema',
    accent: '#111827',
    accentHover: '#1f2937',
    accentSoft: '#eef0f3',
    accentText: '#111827',
    sidebar: 'linear-gradient(180deg, #111827 0%, #1f2937 52%, #0f172a 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #f8fafc 45%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(15, 23, 42, 0.22)',
    gradient: 'linear-gradient(90deg, #111827 0%, #374151 100%)',
    chart: '#111827',
    card: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a'
  },
  ocean: {
    name: 'Ocean Blue',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentSoft: '#dbeafe',
    accentText: '#1d4ed8',
    sidebar: 'linear-gradient(180deg, #020617 0%, #172554 48%, #0f172a 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #eff6ff 50%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(37, 99, 235, 0.24)',
    gradient: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)',
    chart: '#2563eb',
    card: '#ffffff',
    border: '#dbeafe',
    text: '#0f172a'
  },
  slate: {
    name: 'Premium Dark',
    accent: '#0f172a',
    accentHover: '#1e293b',
    accentSoft: '#e2e8f0',
    accentText: '#0f172a',
    sidebar: 'linear-gradient(180deg, #020617 0%, #0f172a 52%, #1e293b 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #f1f5f9 50%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(15, 23, 42, 0.24)',
    gradient: 'linear-gradient(90deg, #020617 0%, #334155 100%)',
    chart: '#0f172a',
    card: '#ffffff',
    border: '#cbd5e1',
    text: '#0f172a'
  },
  emerald: {
    name: 'Restaurant Green',
    accent: '#059669',
    accentHover: '#047857',
    accentSoft: '#d1fae5',
    accentText: '#047857',
    sidebar: 'linear-gradient(180deg, #022c22 0%, #064e3b 46%, #0f172a 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #ecfdf5 52%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(5, 150, 105, 0.24)',
    gradient: 'linear-gradient(90deg, #059669 0%, #14b8a6 100%)',
    chart: '#059669',
    card: '#ffffff',
    border: '#d1fae5',
    text: '#0f172a'
  },
  amber: {
    name: 'Warm Gold',
    accent: '#d97706',
    accentHover: '#b45309',
    accentSoft: '#fef3c7',
    accentText: '#b45309',
    sidebar: 'linear-gradient(180deg, #292524 0%, #78350f 48%, #18181b 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #fffbeb 50%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(217, 119, 6, 0.24)',
    gradient: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
    chart: '#d97706',
    card: '#ffffff',
    border: '#fde68a',
    text: '#0f172a'
  },
  ruby: {
    name: 'Ruby Red',
    accent: '#e11d48',
    accentHover: '#be123c',
    accentSoft: '#ffe4e6',
    accentText: '#be123c',
    sidebar: 'linear-gradient(180deg, #09090b 0%, #4c0519 46%, #111827 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #fff1f2 50%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(225, 29, 72, 0.24)',
    gradient: 'linear-gradient(90deg, #e11d48 0%, #ef4444 100%)',
    chart: '#e11d48',
    card: '#ffffff',
    border: '#fecdd3',
    text: '#0f172a'
  },
  coffee: {
    name: 'Coffee Brown',
    accent: '#57534e',
    accentHover: '#44403c',
    accentSoft: '#e7e5e4',
    accentText: '#44403c',
    sidebar: 'linear-gradient(180deg, #1c1917 0%, #44403c 48%, #0f172a 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #f5f5f4 52%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(87, 83, 78, 0.24)',
    gradient: 'linear-gradient(90deg, #57534e 0%, #a16207 100%)',
    chart: '#57534e',
    card: '#ffffff',
    border: '#d6d3d1',
    text: '#0f172a'
  },
  indigo: {
    name: 'Indigo Night',
    accent: '#6f6457',
    accentHover: '#5c5248',
    accentSoft: '#eee7dd',
    accentText: '#5c5248',
    sidebar: 'linear-gradient(180deg, #1c1a18 0%, #2a2622 48%, #151311 100%)',
    topbar: 'linear-gradient(90deg, #ffffff 0%, #f4eee6 50%, #ffffff 100%)',
    activeGlow: '0 18px 45px rgba(79, 65, 54, 0.2)',
    gradient: 'linear-gradient(90deg, #6f6457 0%, #968878 100%)',
    chart: '#6f6457',
    card: '#ffffff',
    border: '#dfd5c9',
    text: '#0f172a'
  },
  mono: {
    name: 'Clean Mono',
    accent: '#18181b',
    accentHover: '#27272a',
    accentSoft: '#f4f4f5',
    accentText: '#18181b',
    sidebar: 'linear-gradient(180deg, #fafafa 0%, #ffffff 50%, #f4f4f5 100%)',
    topbar: 'linear-gradient(90deg, #fafafa 0%, #ffffff 50%, #fafafa 100%)',
    activeGlow: '0 18px 45px rgba(24, 24, 27, 0.16)',
    gradient: 'linear-gradient(90deg, #18181b 0%, #71717a 100%)',
    chart: '#18181b',
    card: '#ffffff',
    border: '#e4e4e7',
    text: '#18181b'
  }
}

export const themeKeys = Object.keys(themes)
