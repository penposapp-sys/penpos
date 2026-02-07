const toYmd = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const startOfDayLocal = (ymd) => {
  const s = String(ymd || '').trim()
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d, 0, 0, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

export const addDaysLocal = (date, days) => {
  const dt = date instanceof Date ? date : new Date(date)
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + Number(days || 0), 0, 0, 0, 0)
}

export const getLocalRangeExclusive = (period, start, end) => {
  const p = String(period || 'today').trim()

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)

  if (p === 'today') {
    const from = todayStart
    const to = addDaysLocal(from, 1)
    return { from, to, startYmd: toYmd(from), endYmd: toYmd(from) }
  }

  if (p === 'week') {
    const day = today.getDay()
    const diffToMonday = (day + 6) % 7
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday, 0, 0, 0, 0)
    const from = monday
    const to = addDaysLocal(todayStart, 1)
    return { from, to, startYmd: toYmd(from), endYmd: toYmd(todayStart) }
  }

  if (p === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
    const from = first
    const to = addDaysLocal(todayStart, 1)
    return { from, to, startYmd: toYmd(from), endYmd: toYmd(todayStart) }
  }

  if (p === 'year') {
    const first = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0)
    const from = first
    const to = addDaysLocal(todayStart, 1)
    return { from, to, startYmd: toYmd(from), endYmd: toYmd(todayStart) }
  }

  if (p === 'range') {
    const s = startOfDayLocal(start)
    const e = startOfDayLocal(end)
    if (!s || !e) {
      const err = new Error('Invalid range')
      err.status = 400
      err.payload = { error: 'invalid_request', code: 'invalid_request', message: 'start/end required (YYYY-MM-DD)' }
      throw err
    }
    if (s.getTime() > e.getTime()) {
      const err = new Error('Invalid range')
      err.status = 400
      err.payload = { error: 'invalid_request', code: 'invalid_request', message: 'start must be <= end' }
      throw err
    }
    const from = s
    const to = addDaysLocal(e, 1)
    return { from, to, startYmd: toYmd(s), endYmd: toYmd(e) }
  }

  const err = new Error('Invalid period')
  err.status = 400
  err.payload = { error: 'invalid_request', code: 'invalid_request', message: 'period must be today|week|month|year|range' }
  throw err
}

