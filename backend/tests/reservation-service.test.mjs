import assert from 'node:assert/strict'
import { test } from 'node:test'
import Branch from '../src/models/Branch.js'
import Order from '../src/models/Order.js'
import Reservation from '../src/models/Reservation.js'
import ReservationNotification from '../src/models/ReservationNotification.js'
import Table from '../src/models/Table.js'
import Tenant from '../src/models/Tenant.js'
import TenantWebsiteSettings from '../src/models/TenantWebsiteSettings.js'
import User from '../src/models/User.js'
import {
  changeReservationStatus,
  createPublicReservation,
  createStaffReservation,
  getPendingReservationCount,
  listReservations,
  markReservationNotificationsRead,
  updateReservation,
  updateReservationSettings,
  arriveAndOpenReservation
} from '../src/services/reservationService.js'

const tenantId = '64b000000000000000000001'
const branchId = '64b000000000000000000002'
const tableId = '64b000000000000000000003'
const secondTableId = '64b000000000000000000004'
const reservationId = '64b000000000000000000005'
const orderId = '64b000000000000000000006'

const query = (value) => {
  const result = {
    select() { return result },
    sort() { return result },
    limit() { return result },
    session() { return result },
    lean() { return Promise.resolve(value) },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject) }
  }
  return result
}

const tomorrow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const date = new Date(Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day) + 1))
  return date.toISOString().slice(0, 10)
}

const branch = {
  _id: branchId,
  tenantId,
  name: 'Merkez',
  isActive: true,
  reservationSettings: { onlineEnabled: true }
}

const table = (id = tableId) => ({
  _id: id,
  name: id === tableId ? 'Masa 1' : 'Masa 2',
  capacity: 4,
  isActive: true,
  status: 'empty',
  activeOrderId: null
})

const customerPayload = (date = tomorrow(), time = '12:00') => ({
  customerName: 'Test Müşteri',
  phone: '05551234567',
  guestCount: 2,
  date,
  time
})

const mockCommonAvailability = (t, {
  availableTables = [table()],
  activeOrders = [],
  site = false,
  enabledBranches = [branch],
  activeBranches = enabledBranches,
  selectedBranch = branch
} = {}) => {
  t.mock.method(Branch, 'findOne', () => query(selectedBranch))
  t.mock.method(Branch, 'find', (filter) => query(
    filter?.['reservationSettings.onlineEnabled'] === true ? enabledBranches : activeBranches
  ))
  t.mock.method(Reservation, 'updateMany', async () => ({ modifiedCount: 0 }))
  t.mock.method(Reservation, 'find', () => query([]))
  t.mock.method(Table, 'find', () => query(availableTables))
  t.mock.method(Order, 'find', () => query(activeOrders))
  if (site) {
    t.mock.method(TenantWebsiteSettings, 'findOne', () => query({
      tenantId,
      enabled: true,
      published: true
    }))
    t.mock.method(Tenant, 'findOne', () => query({
      _id: tenantId,
      systemType: 'restaurant',
      isActive: true,
      status: 'active',
      settings: {}
    }))
  }
}

test('staff reservation creation assigns an available table and stores the requested interval', async (t) => {
  mockCommonAvailability(t)
  let stored
  t.mock.method(Reservation, 'create', async (input) => {
    stored = input
    return { ...input, _id: reservationId, createdAt: new Date() }
  })

  test('tenant admin can enable online reservations and settings persist within the selected tenant branch', async (t) => {
    t.mock.method(Branch, 'findOne', (filter) => {
      assert.equal(String(filter._id), branchId)
      assert.equal(String(filter.tenantId), tenantId)
      return query({ ...branch, reservationSettings: { onlineEnabled: false } })
    })
    let update
    t.mock.method(Branch, 'updateOne', async (filter, operation) => {
      update = { filter, operation }
      return { modifiedCount: 1 }
    })

    const result = await updateReservationSettings({
      tenantId,
      branchId,
      actor: { id: null, role: 'tenant_admin' },
      input: { onlineEnabled: true }
    })

    assert.deepEqual(update.filter, { _id: branchId, tenantId })
    assert.equal(update.operation.$set.reservationSettings.onlineEnabled, true)
    assert.equal(result.settings.onlineEnabled, true)
  })

  const reservation = await createStaffReservation({
    tenantId,
    branchId,
    actor: { id: null, role: 'tenant_admin' },
    payload: customerPayload()
  })

  assert.equal(reservation.tableId, tableId)
  assert.equal(reservation.status, 'pending')
  assert.equal(reservation.endAt.getTime() - reservation.startAt.getTime(), 60 * 60 * 1000)
  assert.equal(stored.slotKeys.length, 4)
  assert.equal(stored.tenantId, tenantId)
  assert.equal(stored.branchId, branchId)
})

test('online creation rejects a time whose only table has an open order', async (t) => {
  mockCommonAvailability(t, {
    activeOrders: [{ tableId }],
    site: true
  })
  let createCalled = false
  t.mock.method(Reservation, 'create', async () => {
    createCalled = true
    throw new Error('Reservation must not be created')
  })

  await assert.rejects(
    createPublicReservation({ slug: 'example', payload: customerPayload() }),
    (err) => err.status === 409 && err.payload.error === 'reservation_conflict'
  )
  assert.equal(createCalled, false)
})

test('public reservation creation uses the only reservation-enabled branch when no default branch is selected', async (t) => {
  const otherBranch = {
    _id: '64b000000000000000000008',
    tenantId,
    name: 'İkinci Şube',
    isActive: true,
    reservationSettings: { onlineEnabled: false }
  }
  mockCommonAvailability(t, {
    site: true,
    enabledBranches: [branch],
    activeBranches: [branch, otherBranch]
  })
  t.mock.method(User, 'find', () => query([]))
  let stored
  t.mock.method(Reservation, 'create', async (input) => {
    stored = input
    return { ...input, _id: reservationId, createdAt: new Date() }
  })

  const result = await createPublicReservation({
    slug: 'example',
    payload: customerPayload()
  })

  assert.equal(result.reservation.status, 'pending')
  assert.equal(String(stored.tenantId), tenantId)
  assert.equal(String(stored.branchId), branchId)
})

test('public reservation creation keeps automatic confirmation for the enabled branch', async (t) => {
  const autoConfirmBranch = {
    ...branch,
    reservationSettings: { onlineEnabled: true, autoConfirm: true }
  }
  mockCommonAvailability(t, {
    site: true,
    enabledBranches: [autoConfirmBranch],
    activeBranches: [autoConfirmBranch],
    selectedBranch: autoConfirmBranch
  })
  t.mock.method(User, 'find', () => query([]))
  let stored
  t.mock.method(Reservation, 'create', async (input) => {
    stored = input
    return { ...input, _id: reservationId, createdAt: new Date() }
  })

  const result = await createPublicReservation({
    slug: 'example',
    payload: customerPayload()
  })

  assert.equal(result.reservation.status, 'confirmed')
  assert.equal(stored.status, 'confirmed')
  assert.equal(stored.holdExpiresAt, null)
})

test('public reservation creation rejects a branch whose online reservation service is disabled', async (t) => {
  const disabledBranch = {
    ...branch,
    reservationSettings: { onlineEnabled: false }
  }
  mockCommonAvailability(t, {
    site: true,
    enabledBranches: [],
    activeBranches: [disabledBranch],
    selectedBranch: disabledBranch
  })

  await assert.rejects(
    createPublicReservation({
      slug: 'example',
      payload: customerPayload()
    }),
    (err) => err.status === 403 && err.payload.error === 'online_reservations_disabled'
  )
})

test('staff cannot update reservation settings through the service API', async () => {
  await assert.rejects(
    updateReservationSettings({
      tenantId,
      branchId,
      actor: { id: 'staff-1', role: 'staff', branchId },
      input: { onlineEnabled: true }
    }),
    (err) => err.status === 403
  )
})

test('reservation listing always scopes tenant and branch ids to the authorized input', async (t) => {
  let reservationFilter
  t.mock.method(Reservation, 'find', (filter) => {
    reservationFilter = filter
    return query([])
  })
  t.mock.method(ReservationNotification, 'countDocuments', async () => 0)

  const result = await listReservations({
    tenantId,
    branchIds: [branchId],
    actor: { id: 'manager-1' },
    date: '2026-10-16',
    status: 'pending'
  })

  assert.deepEqual(reservationFilter, {
    tenantId,
    branchId: { $in: [branchId] },
    startAt: {
      $gte: new Date('2026-10-16T00:00:00.000Z'),
      $lt: new Date('2026-10-17T00:00:00.000Z')
    },
    status: 'pending'
  })
  assert.deepEqual(result.reservations, [])
})

test('a unique-slot race retries another available table', async (t) => {
  mockCommonAvailability(t, { availableTables: [table(), table(secondTableId)] })
  let attempts = 0
  t.mock.method(Reservation, 'create', async (input) => {
    attempts += 1
    if (attempts === 1) throw Object.assign(new Error('duplicate slot'), { code: 11000 })
    return { ...input, _id: reservationId, createdAt: new Date() }
  })

  const reservation = await createStaffReservation({
    tenantId,
    branchId,
    actor: { id: null, role: 'tenant_admin' },
    payload: customerPayload()
  })

  assert.equal(attempts, 2)
  assert.equal(reservation.tableId, secondTableId)
})

test('reservation edits recheck availability and reject a newly occupied table', async (t) => {
  const current = {
    _id: reservationId,
    tenantId,
    branchId,
    tableId,
    customerName: 'Test Müşteri',
    phone: '05551234567',
    guestCount: 2,
    note: '',
    status: 'pending',
    startAt: new Date(`${tomorrow()}T12:00:00.000Z`),
    endAt: new Date(`${tomorrow()}T13:00:00.000Z`),
    slotKeys: [],
    __v: 0
  }
  t.mock.method(Reservation, 'findOne', () => query(current))
  t.mock.method(Branch, 'findOne', () => query(branch))
  t.mock.method(Reservation, 'find', () => query([{ tableId }]))
  t.mock.method(Table, 'find', () => query([]))
  t.mock.method(Order, 'find', () => query([]))

  await assert.rejects(
    updateReservation({
      tenantId,
      id: reservationId,
      branchIds: [branchId],
      actor: { id: null, role: 'tenant_admin' },
      payload: { date: tomorrow(), time: '14:00', tableId }
    }),
    (err) => err.status === 409 && err.payload.error === 'reservation_conflict'
  )
})

test('cancelling a reservation releases its slot claims', async (t) => {
  const current = {
    _id: reservationId,
    tenantId,
    branchId,
    tableId,
    status: 'confirmed',
    startAt: new Date(`${tomorrow()}T12:00:00.000Z`),
    endAt: new Date(`${tomorrow()}T13:00:00.000Z`),
    slotKeys: ['slot-a', 'slot-b'],
    __v: 0
  }
  t.mock.method(Reservation, 'findOne', () => query(current))
  let update
  t.mock.method(Reservation, 'findOneAndUpdate', async (_filter, changes) => {
    update = changes
    return { ...current, ...changes.$set, __v: 1 }
  })

  const result = await changeReservationStatus({
    tenantId,
    id: reservationId,
    branchIds: [branchId],
    actor: { id: null, role: 'tenant_admin' },
    status: 'cancelled'
  })

  assert.equal(result.status, 'cancelled')
  assert.deepEqual(update.$set.slotKeys, [])
})

test('arrival reuses an existing open order instead of creating another', async (t) => {
  const current = {
    _id: reservationId,
    tenantId,
    branchId,
    tableId,
    status: 'confirmed',
    startAt: new Date(`${tomorrow()}T12:00:00.000Z`),
    endAt: new Date(`${tomorrow()}T13:00:00.000Z`),
    orderId: null,
    orderOpening: false,
    slotKeys: ['slot-a'],
    __v: 0
  }
  t.mock.method(Reservation, 'findOne', () => query(current))
  t.mock.method(Order, 'findOne', () => ({
    sort() { return this },
    select() { return this },
    lean: async () => ({ _id: orderId })
  }))
  let updateCount = 0
  t.mock.method(Reservation, 'findOneAndUpdate', async (_filter, changes) => {
    updateCount += 1
    return updateCount === 1
      ? { ...current, ...changes.$set }
      : { ...current, ...changes.$set, __v: 1 }
  })

  const result = await arriveAndOpenReservation({
    tenantId,
    id: reservationId,
    branchIds: [branchId],
    actor: { id: null, role: 'tenant_admin' }
  })

  assert.equal(result.orderId, orderId)
  assert.equal(result.opened, false)
  assert.equal(result.reservation.status, 'arrived')
})

test('pending and unread notification counts remain tenant/branch scoped', async (t) => {
  let reservationFilter
  let notificationFilter
  t.mock.method(Reservation, 'countDocuments', async (filter) => {
    reservationFilter = filter
    return 2
  })
  t.mock.method(ReservationNotification, 'countDocuments', async (filter) => {
    notificationFilter = filter
    return 1
  })
  let readFilter
  t.mock.method(ReservationNotification, 'updateMany', async (filter) => {
    readFilter = filter
    return { modifiedCount: 3 }
  })

  assert.deepEqual(await getPendingReservationCount({ tenantId, branchIds: [branchId] }), {
    pendingCount: 2,
    unreadCount: 1
  })
  assert.equal(reservationFilter.tenantId, tenantId)
  assert.deepEqual(reservationFilter.branchId.$in, [branchId])
  assert.equal(notificationFilter.tenantId, tenantId)
  assert.deepEqual(notificationFilter.branchId.$in, [branchId])

  const readResult = await markReservationNotificationsRead({
    tenantId,
    branchIds: [branchId],
    userId: '64b000000000000000000007'
  })
  assert.deepEqual(readResult, { modifiedCount: 3 })
  assert.equal(readFilter.tenantId, tenantId)
  assert.deepEqual(readFilter.branchId.$in, [branchId])
})
