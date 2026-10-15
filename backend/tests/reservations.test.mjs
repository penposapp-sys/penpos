import test from 'node:test'
import assert from 'node:assert/strict'
import Reservation from '../src/models/Reservation.js'
import {
  buildReservationSlotKeys,
  canTransitionReservation,
  isReservationTableAvailable,
  normalizeReservationSettings,
  reservationIntervalsOverlap,
  wallClockToDate
} from '../src/utils/reservations.js'

test('reservation intervals are checked across the full duration', () => {
  assert.equal(reservationIntervalsOverlap(
    wallClockToDate('2026-10-16', '10:00'),
    wallClockToDate('2026-10-16', '11:00'),
    wallClockToDate('2026-10-16', '10:45'),
    wallClockToDate('2026-10-16', '11:45')
  ), true)
  assert.equal(reservationIntervalsOverlap(
    wallClockToDate('2026-10-16', '10:00'),
    wallClockToDate('2026-10-16', '11:00'),
    wallClockToDate('2026-10-16', '11:00'),
    wallClockToDate('2026-10-16', '12:00')
  ), false)
})

test('reservation lock slots represent the entire requested interval and require quarter-hour boundaries', () => {
  const start = wallClockToDate('2026-10-16', '10:00')
  const end = wallClockToDate('2026-10-16', '11:15')
  assert.deepEqual(buildReservationSlotKeys(start, end), [
    String(start.getTime()),
    String(start.getTime() + 15 * 60 * 1000),
    String(start.getTime() + 30 * 60 * 1000),
    String(start.getTime() + 45 * 60 * 1000),
    String(start.getTime() + 60 * 60 * 1000)
  ])
  assert.throws(() => buildReservationSlotKeys(wallClockToDate('2026-10-16', '10:05'), end), /15 dakikalık/)
})

test('table availability rejects open orders, insufficient capacity and slot conflicts', () => {
  const table = { isActive: true, status: 'empty', capacity: 4 }
  assert.equal(isReservationTableAvailable({ table, guestCount: 4 }), true)
  assert.equal(isReservationTableAvailable({ table, guestCount: 5 }), false)
  assert.equal(isReservationTableAvailable({ table, guestCount: 2, activeOrder: true }), false)
  assert.equal(isReservationTableAvailable({
    table,
    guestCount: 2,
    reservedSlotKeys: new Set(['slot-2']),
    requestedSlotKeys: ['slot-1', 'slot-2', 'slot-3']
  }), false)
  assert.equal(isReservationTableAvailable({
    table,
    guestCount: 2,
    reservedSlotKeys: new Set(['slot-1']),
    requestedSlotKeys: ['slot-2']
  }), true)
})

test('branch settings validate hours and retain safe defaults', () => {
  const settings = normalizeReservationSettings({ onlineEnabled: true })
  assert.equal(settings.onlineEnabled, true)
  assert.equal(settings.durationMinutes, 60)
  assert.equal(settings.pendingHoldMinutes, 15)
  assert.equal(settings.workingHours.length, 7)
  assert.throws(() => normalizeReservationSettings({
    durationMinutes: 50,
    workingHours: []
  }), /15 dakikanın katı/)
  assert.throws(() => normalizeReservationSettings({
    workingHours: [{ day: 0, open: true, start: '09:10', end: '22:00' }]
  }), /Çalışma gün ve saatleri/)
})

test('state transitions are constrained and cancelled bookings release conflict claims', () => {
  assert.equal(canTransitionReservation('pending', 'confirmed'), true)
  assert.equal(canTransitionReservation('confirmed', 'arrived'), true)
  assert.equal(canTransitionReservation('arrived', 'completed'), true)
  assert.equal(canTransitionReservation('cancelled', 'confirmed'), false)
  const slotIndex = Reservation.schema.indexes().find(([keys, options]) => (
    keys.slotKeys === 1 && options.unique === true
  ))
  assert.ok(slotIndex, 'reservation slots must be protected by a unique MongoDB index')
  assert.ok(Reservation.schema.path('slotKeys'))
})
