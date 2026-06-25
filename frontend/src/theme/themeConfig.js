export const THEME_STORAGE_KEY = 'penpos-theme-key'
export const DARK_MODE_STORAGE_KEY = 'penpos-dark-mode'

const WHITE_THEME_IDS = new Set(['white', 'default', 'mono'])
const COLORED_THEME_IDS = new Set(['colored', 'ocean', 'emerald', 'amber', 'ruby', 'coffee', 'indigo', 'slate'])

export function normalizeThemeId(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (WHITE_THEME_IDS.has(raw)) return 'white'
  if (COLORED_THEME_IDS.has(raw)) return 'white'
  return 'white'
}

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

const makeTheme = (theme) => ({
  description: '',
  ...theme,
})

export const themes = {
  white: makeTheme({
    key: 'white',
    name: 'Beyaz Tema',
    description: 'Sadece açık modda çalışır. Beyaz sidebar, siyah seçili menü ve sade görünüm kullanır.',
    accent: '#111111',
    accentHover: '#27272a',
    accentSoft: '#f4f4f5',
    accentText: '#ffffff',
    sidebar: '#ffffff',
    topbar: '#ffffff',
    borderAccent: '#d1d5db',
  }),
  colored: makeTheme({
    key: 'colored',
    name: 'Renkli Tema',
    description: 'Açık ve koyu modda çalışır. Sidebar ve butonlarda koyu kahve/gri renk ailesi kullanır.',
    accent: '#ea7a1a',
    accentHover: '#d96a0c',
    accentSoft: '#f6e7dc',
    accentText: '#ffffff',
    sidebar: '#5b514c',
    topbar: '#4f4742',
    borderAccent: '#6a605b',
  }),
}

export const themeKeys = ['white']
export const themeOptions = themeKeys.map((key) => themes[key])
