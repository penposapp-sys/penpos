export const normalizeManualEntryDateInput = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(year, month - 1, day)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return ''
  return `${yearText}-${monthText}-${dayText}`
}

export const parseManualEntryDate = (value, { now = new Date() } = {}) => {
  const normalized = normalizeManualEntryDateInput(value)
  if (!normalized) return null
  const [yearText, monthText, dayText] = normalized.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const baseNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  return new Date(
    year,
    month - 1,
    day,
    baseNow.getHours(),
    baseNow.getMinutes(),
    baseNow.getSeconds(),
    baseNow.getMilliseconds()
  )
}
