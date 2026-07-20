export const todayYmd = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const normalizeSalesEntryDate = (value) => {
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

export const readSalesEntryDate = () => {
  return todayYmd()
}

export const writeSalesEntryDate = (value) => {
  const normalized = normalizeSalesEntryDate(value) || todayYmd()
  return normalized
}
