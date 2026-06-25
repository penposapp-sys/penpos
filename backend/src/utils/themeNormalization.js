const WHITE_THEME_IDS = new Set(['white', 'default', 'mono'])
const COLORED_THEME_IDS = new Set(['colored', 'ocean', 'emerald', 'amber', 'ruby', 'coffee', 'indigo', 'slate'])

export function normalizeThemeId(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (WHITE_THEME_IDS.has(raw)) return 'white'
  if (COLORED_THEME_IDS.has(raw)) return 'colored'
  return 'white'
}
