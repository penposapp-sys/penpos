import { error } from './errors.js'

export const RESERVATION_STATUSES = ['pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show']
export const BLOCKING_STATUSES = ['pending', 'confirmed', 'arrived']
export const DEFAULT_RESERVATION_SETTINGS = Object.freeze({
  onlineEnabled: false,
  timezone: 'Europe/Istanbul',
  durationMinutes: 60,
  bufferMinutes: 0,
  minAdvanceMinutes: 0,
  maxAdvanceDays: 90,
  pendingHoldMinutes: 15,
  autoConfirm: false,
  workingHours: [
    { day: 0, open: true, start: '09:00', end: '22:00' },
    { day: 1, open: true, start: '09:00', end: '22:00' },
    { day: 2, open: true, start: '09:00', end: '22:00' },
    { day: 3, open: true, start: '09:00', end: '22:00' },
    { day: 4, open: true, start: '09:00', end: '22:00' },
    { day: 5, open: true, start: '09:00', end: '22:00' },
    { day: 6, open: true, start: '09:00', end: '22:00' }
  ]
})

const parseClock = (value) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''))
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export const normalizeReservationSettings = (input = {}) => {
  const source = input && typeof input === 'object' ? input : {}
  const settings = {
    ...DEFAULT_RESERVATION_SETTINGS,
    ...source,
    workingHours: Array.isArray(source.workingHours) ? source.workingHours : DEFAULT_RESERVATION_SETTINGS.workingHours
  }
  const numeric = ['durationMinutes', 'bufferMinutes', 'minAdvanceMinutes', 'maxAdvanceDays', 'pendingHoldMinutes']
  for (const key of numeric) {
    const value = Number(settings[key])
    if (!Number.isInteger(value)) throw error('invalid_reservation_settings', `${key} değeri tam sayı olmalı.`, 400)
    settings[key] = value
  }
  if (settings.durationMinutes < 15 || settings.durationMinutes > 480 || settings.durationMinutes % 15 !== 0) {
    throw error('invalid_reservation_settings', 'Rezervasyon süresi 15-480 dakika arasında ve 15 dakikanın katı olmalı.', 400)
  }
  if (settings.bufferMinutes < 0 || settings.bufferMinutes > 240 || settings.bufferMinutes % 15 !== 0
    || settings.minAdvanceMinutes < 0 || settings.maxAdvanceDays < 1 || settings.maxAdvanceDays > 365
    || settings.pendingHoldMinutes < 5 || settings.pendingHoldMinutes > 1440) {
    throw error('invalid_reservation_settings', 'Rezervasyon süre ayarları geçersiz.', 400)
  }
  const hours = new Map()
  for (const row of settings.workingHours) {
    const day = Number(row?.day)
    const start = String(row?.start || '')
    const end = String(row?.end || '')
    if (!Number.isInteger(day) || day < 0 || day > 6 || hours.has(day)
      || (row?.open && (
        parseClock(start) === null || parseClock(end) === null || parseClock(end) <= parseClock(start)
        || parseClock(start) % 15 !== 0 || parseClock(end) % 15 !== 0
      ))) {
      throw error('invalid_reservation_settings', 'Çalışma gün ve saatleri geçersiz.', 400)
    }
    hours.set(day, { day, open: row.open === true, start, end })
  }
  settings.workingHours = Array.from({ length: 7 }, (_, day) => hours.get(day) || { day, open: false, start: '09:00', end: '22:00' })
  settings.onlineEnabled = source.onlineEnabled === true
  settings.autoConfirm = source.autoConfirm === true
  settings.timezone = 'Europe/Istanbul'
  return settings
}

export const buildReservationSlotKeys = (startAt, endAt) => {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  const step = 15 * 60 * 1000
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || start % step !== 0 || end % step !== 0) {
    throw error('invalid_reservation_time', 'Rezervasyon saati 15 dakikalık aralıklara uygun olmalı.', 400)
  }
  const keys = []
  for (let ts = start; ts < end; ts += step) keys.push(String(ts))
  return keys
}

export const reservationIntervalsOverlap = (leftStart, leftEnd, rightStart, rightEnd) =>
  new Date(leftStart).getTime() < new Date(rightEnd).getTime()
  && new Date(rightStart).getTime() < new Date(leftEnd).getTime()

export const isReservationTableAvailable = ({
  table,
  guestCount,
  activeOrder = false,
  reservedSlotKeys = [],
  requestedSlotKeys = []
}) => {
  if (!table || table.isActive === false || table.status === 'occupied' || activeOrder) return false
  if (Number(table.capacity || 4) < Number(guestCount || 0)) return false
  const reserved = reservedSlotKeys instanceof Set ? reservedSlotKeys : new Set(reservedSlotKeys)
  return !requestedSlotKeys.some((slotKey) => reserved.has(slotKey))
}

export const canTransitionReservation = (from, to) => {
  const transitions = {
    pending: ['confirmed', 'arrived', 'cancelled', 'no_show'],
    confirmed: ['arrived', 'cancelled', 'no_show'],
    arrived: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: []
  }
  return transitions[String(from || '')]?.includes(String(to || '')) || false
}

export const wallClockToDate = (dateValue, timeValue) => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''))
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(timeValue || ''))
  if (!dateMatch || !timeMatch) throw error('invalid_reservation_time', 'Tarih veya saat biçimi geçersiz.', 400)
  const [, year, month, day] = dateMatch
  const [, hour, minute] = timeMatch
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)))
  if (value.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    throw error('invalid_reservation_time', 'Tarih geçersiz.', 400)
  }
  return value
}

export const dateToWallClock = (value) => {
  const date = new Date(value)
  return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 16) }
}
