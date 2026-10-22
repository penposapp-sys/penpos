import mongoose from 'mongoose'
import { createHash } from 'node:crypto'
import Branch from '../models/Branch.js'
import Order from '../models/Order.js'
import Reservation from '../models/Reservation.js'
import ReservationNotification from '../models/ReservationNotification.js'
import Table from '../models/Table.js'
import Tenant from '../models/Tenant.js'
import TenantWebsiteSettings from '../models/TenantWebsiteSettings.js'
import User from '../models/User.js'
import { error } from '../utils/errors.js'
import { getUserAccessibleBranchIds } from '../utils/branchVisibility.js'
import { normalizeTenantWebsiteSlug, resolveTenantWebsiteReservationBranch } from './tenantWebsiteService.js'
import { resolveTenantPackageType } from '../utils/systemType.js'
import { log as auditLog } from './auditService.js'
import { startOrderForTableService } from './tableService.js'
import { notifyReservationUsers } from './pushNotificationService.js'
import { error as logError } from '../utils/logger.js'
import {
  BLOCKING_STATUSES,
  buildReservationSlotKeys,
  canTransitionReservation,
  dateToWallClock,
  DEFAULT_RESERVATION_SETTINGS,
  isReservationTableAvailable,
  normalizeReservationSettings,
  RESERVATION_STATUSES,
  wallClockToDate
} from '../utils/reservations.js'

const ACTIVE_ORDER_STATUSES = ['open', 'sent', 'completed']
const RESERVATION_DAY_MS = 24 * 60 * 60 * 1000
const capacityFilter = (guestCount) => {
  const values = [{ capacity: { $gte: guestCount } }]
  if (guestCount <= 4) values.push({ capacity: { $exists: false } })
  return { $or: values }
}

const getNowWallClock = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return wallClockToDate(`${value.year}-${value.month}-${value.day}`, `${value.hour}:${value.minute}`)
}

const toDto = (doc) => {
  const { date, time } = dateToWallClock(doc.startAt)
  return {
    id: String(doc._id),
    tenantId: String(doc.tenantId),
    branchId: String(doc.branchId),
    tableId: doc.tableId ? String(doc.tableId) : '',
    customerName: String(doc.customerName || ''),
    phone: String(doc.phone || ''),
    guestCount: Number(doc.guestCount || 1),
    date,
    time,
    startAt: doc.startAt,
    endAt: doc.endAt,
    note: String(doc.note || ''),
    source: String(doc.source || 'staff'),
    status: String(doc.status || 'pending'),
    holdExpiresAt: doc.holdExpiresAt || null,
    orderId: doc.orderId ? String(doc.orderId) : '',
    history: Array.isArray(doc.history) ? doc.history.map((entry) => ({
      action: String(entry.action || ''),
      status: String(entry.status || ''),
      changedAt: entry.changedAt || null,
      details: entry.details || {}
    })) : [],
    createdAt: doc.createdAt || null
  }
}

const requireBranch = async (tenantId, branchId, { active = true } = {}) => {
  if (!mongoose.isValidObjectId(String(branchId || ''))) throw error('invalid_branch', 'Şube bilgisi geçersiz.', 400)
  const filter = { _id: branchId, tenantId }
  if (active) filter.isActive = true
  const branch = await Branch.findOne(filter).lean()
  if (!branch) throw error('branch_not_found', 'Şube bulunamadı.', 404)
  return branch
}

const ensureStaffBranch = (actor, branchId) => {
  if (String(actor?.role || '') !== 'staff') return
  const allowed = getUserAccessibleBranchIds(actor)
  if (allowed.length > 0 && !allowed.includes(String(branchId))) {
    throw error('branch_not_allowed', 'Bu şubeye erişim yetkiniz yok.', 403)
  }
}

const getSettings = (branch) => normalizeReservationSettings(branch?.reservationSettings || DEFAULT_RESERVATION_SETTINGS)

const expirePendingHolds = async (tenantId, branchId, now = new Date()) => {
  await Reservation.updateMany(
    { tenantId, branchId, status: 'pending', holdExpiresAt: { $lte: now }, 'slotKeys.0': { $exists: true } },
    { $set: { slotKeys: [] } }
  )
}

const normalizeCustomer = (payload = {}) => {
  const customerName = String(payload.customerName || payload.name || '').trim()
  const phone = String(payload.phone || '').trim()
  const guestCount = Number(payload.guestCount || payload.partySize)
  const note = String(payload.note || '').trim()
  if (customerName.length < 2 || customerName.length > 120) throw error('invalid_reservation', 'Ad soyad 2-120 karakter olmalı.', 400)
  if (phone.length < 7 || phone.length > 40) throw error('invalid_reservation', 'Telefon numarası geçersiz.', 400)
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100) throw error('invalid_reservation', 'Kişi sayısı 1-100 arasında olmalı.', 400)
  if (note.length > 1000) throw error('invalid_reservation', 'Not en fazla 1000 karakter olabilir.', 400)
  return { customerName, phone, guestCount, note }
}

const resolveRequestedTime = (payload, settings) => {
  const startAt = wallClockToDate(payload.date, payload.time)
  const endAt = new Date(startAt.getTime() + (settings.durationMinutes + settings.bufferMinutes) * 60 * 1000)
  const now = getNowWallClock()
  if (startAt.getTime() < now.getTime() + settings.minAdvanceMinutes * 60 * 1000) {
    throw error('reservation_too_soon', 'Bu saat için rezervasyon alınamıyor.', 400)
  }
  if (startAt.getTime() > now.getTime() + settings.maxAdvanceDays * RESERVATION_DAY_MS) {
    throw error('reservation_too_far', 'Seçilen tarih rezervasyon aralığının dışında.', 400)
  }
  const day = startAt.getUTCDay()
  const hours = settings.workingHours.find((item) => item.day === day)
  const [, openHour, openMinute] = /^(\d{2}):(\d{2})$/.exec(hours?.start || '') || []
  const [, closeHour, closeMinute] = /^(\d{2}):(\d{2})$/.exec(hours?.end || '') || []
  const startMinute = startAt.getUTCHours() * 60 + startAt.getUTCMinutes()
  const openMinuteOfDay = Number(openHour) * 60 + Number(openMinute)
  const closeMinuteOfDay = Number(closeHour) * 60 + Number(closeMinute)
  if (!hours?.open || startMinute < openMinuteOfDay
    || startMinute + settings.durationMinutes + settings.bufferMinutes > closeMinuteOfDay) {
    throw error('outside_working_hours', 'Seçilen saat çalışma saatleri dışında.', 400)
  }
  return { startAt, endAt, slotKeys: buildReservationSlotKeys(startAt, endAt) }
}

const getAvailableTableIds = async ({ tenantId, branchId, guestCount, slotKeys, now, excludeReservationId = null }) => {
  const reservationFilter = {
    tenantId,
    branchId,
    tableId: { $ne: null },
    status: { $in: BLOCKING_STATUSES },
    slotKeys: { $in: slotKeys },
    $or: [
      { status: { $ne: 'pending' } },
      { holdExpiresAt: { $gt: now } }
    ]
  }
  if (excludeReservationId) reservationFilter._id = { $ne: excludeReservationId }
  const reservations = await Reservation.find(reservationFilter).select('tableId').lean()
  const reservedIds = new Set(reservations.map((item) => String(item.tableId)))
  const tables = await Table.find({
    tenantId,
    branchId,
    isActive: true,
    ...capacityFilter(guestCount),
    _id: { $nin: Array.from(reservedIds, (id) => new mongoose.Types.ObjectId(id)) }
  }).sort({ name: 1 }).select('_id name capacity status activeOrderId').lean()
  const activeOrders = tables.length
    ? await Order.find({
      tenantId,
      branchId,
      tableId: { $in: tables.map((table) => table._id) },
      status: { $in: ACTIVE_ORDER_STATUSES }
    }).select('tableId').lean()
    : []
  const busyTableIds = new Set(activeOrders.map((order) => String(order.tableId)))
  return tables
    .filter((table) => isReservationTableAvailable({
      table,
      guestCount,
      occupied: table.status === 'occupied' || Boolean(table.activeOrderId) || busyTableIds.has(String(table._id)),
      now: getNowWallClock(),
      requestedSlotKeys: slotKeys
    }))
    .map((table) => ({ id: String(table._id), name: String(table.name || ''), capacity: Number(table.capacity || 4) }))
}

const getDailyAvailability = async ({ tenantId, branch, date, guestCount, allowDisabled = false, excludeReservationId = null }) => {
  const settings = getSettings(branch)
  if (!allowDisabled && !settings.onlineEnabled) throw error('online_reservations_disabled', 'Online rezervasyon şu anda kapalı.', 403)
  const dateStart = wallClockToDate(date, '00:00')
  const now = getNowWallClock()
  if (dateStart.getTime() > now.getTime() + settings.maxAdvanceDays * RESERVATION_DAY_MS) {
    throw error('reservation_too_far', 'Seçilen tarih rezervasyon aralığının dışında.', 400)
  }
  if (dateStart.getTime() < new Date(now.toISOString().slice(0, 10)).getTime()) {
    throw error('reservation_in_past', 'Geçmiş tarih seçilemez.', 400)
  }
  await expirePendingHolds(tenantId, branch._id)
  const day = dateStart.getUTCDay()
  const hours = settings.workingHours.find((item) => item.day === day)
  if (!hours?.open) return { settings, slots: [] }
  const [openHour, openMinute] = hours.start.split(':').map(Number)
  const [closeHour, closeMinute] = hours.end.split(':').map(Number)
  const startMinutes = openHour * 60 + openMinute
  const closeMinutes = closeHour * 60 + closeMinute
  const candidateSlots = []
  for (let minute = startMinutes; minute + settings.durationMinutes + settings.bufferMinutes <= closeMinutes; minute += 15) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
    let range
    try {
      range = resolveRequestedTime({ date, time }, settings)
    } catch (err) {
      if (['reservation_too_soon', 'reservation_too_far'].includes(err?.payload?.error)) continue
      throw err
    }
    candidateSlots.push({ time, ...range })
  }
  const allSlotKeys = [...new Set(candidateSlots.flatMap((slot) => slot.slotKeys))]
  if (!allSlotKeys.length) return { settings, slots: [] }
  const [tables, reservations] = await Promise.all([
    Table.find({
      tenantId,
      branchId: branch._id,
      isActive: true,
      ...capacityFilter(guestCount)
    }).sort({ name: 1 }).select('_id name capacity status activeOrderId').lean(),
    Reservation.find({
      tenantId,
      branchId: branch._id,
      ...(excludeReservationId ? { _id: { $ne: excludeReservationId } } : {}),
      tableId: { $ne: null },
      status: { $in: BLOCKING_STATUSES },
      slotKeys: { $in: allSlotKeys },
      $or: [{ status: { $ne: 'pending' } }, { holdExpiresAt: { $gt: new Date() } }]
    }).select('tableId slotKeys').lean()
  ])
  const tableIds = tables.map((table) => table._id)
  const activeOrders = tableIds.length
    ? await Order.find({
      tenantId,
      branchId: branch._id,
      tableId: { $in: tableIds },
      status: { $in: ACTIVE_ORDER_STATUSES }
    }).select('tableId').lean()
    : []
  const busyTableIds = new Set(activeOrders.map((order) => String(order.tableId)))
  const nowWallClock = getNowWallClock()
  const reservedSlotsByTable = new Map()
  for (const reservation of reservations) {
    const key = String(reservation.tableId)
    const keys = reservedSlotsByTable.get(key) || new Set()
    for (const slotKey of reservation.slotKeys || []) keys.add(slotKey)
    reservedSlotsByTable.set(key, keys)
  }
  const slots = candidateSlots.map(({ time, slotKeys }) => {
    const requestedSlots = new Set(slotKeys)
    const availableTables = tables.filter((table) => {
      const key = String(table._id)
      const reserved = reservedSlotsByTable.get(key)
      return isReservationTableAvailable({
        table,
        guestCount,
        occupied: table.status === 'occupied' || Boolean(table.activeOrderId) || busyTableIds.has(key),
        now: nowWallClock,
        reservedSlotKeys: reserved || [],
        requestedSlotKeys: [...requestedSlots]
      })
    }).map((table) => ({ id: String(table._id), name: String(table.name || ''), capacity: Number(table.capacity || 4) }))
    return { time, available: availableTables.length > 0, tables: availableTables }
  })
  return { settings, slots }
}

const resolvePublicSite = async (slug) => {
  const normalizedSlug = normalizeTenantWebsiteSlug(slug)
  const site = await TenantWebsiteSettings.findOne({ slug: normalizedSlug }).lean()
  if (!site) throw error('not_found', 'Bu restoran web sitesi bulunamadı.', 404)
  const tenant = await Tenant.findOne({ _id: site.tenantId, isActive: true, status: 'active' }).lean()
  if (!tenant) throw error('not_found', 'Bu restoran web sitesi bulunamadı.', 404)
  if (resolveTenantPackageType({ systemType: tenant.systemType }) === 'canteen'
    || resolveTenantPackageType({ systemType: tenant.vertical }) === 'canteen'
    || resolveTenantPackageType({ systemType: tenant.businessType }) === 'canteen'
    || String(tenant.businessType || '').toLowerCase() === 'store') {
    throw error('not_found', 'Bu restoran web sitesi bulunamadı.', 404)
  }
  if (site.enabled !== true || site.published !== true) throw error('site_unpublished', 'Restoran web sitesi yayında değil.', 404)
  const branch = await resolveTenantWebsiteReservationBranch(tenant)
  if (!branch) throw error('reservation_branch_not_configured', 'Online rezervasyon için web sitesinde geçerli bir şube seçilmelidir.', 409)
  return { tenant, branch }
}

const notifyBranchStaff = async ({ tenantId, branchId, reservation }) => {
  const users = await User.find({
    tenantId,
    isDeleted: { $ne: true },
    isActive: true,
    $or: [{ role: 'tenant_admin' }, { permissions: { $in: ['manage_tables', 'reservations_view'] } }]
  }).select('_id role branchId branchIds accessibleBranchIds')
  const visible = users.filter((user) => {
    if (String(user.role) === 'tenant_admin') return true
    const accessible = getUserAccessibleBranchIds(user)
    return accessible.includes(String(branchId))
  })
  if (visible.length) {
    await ReservationNotification.insertMany(visible.map((user) => ({
      tenantId,
      branchId,
      reservationId: reservation._id,
      userId: user._id
    })), { ordered: false })
  }
  try {
    await notifyReservationUsers({
      tenantId,
      branchId,
      reservationId: String(reservation._id),
      customerName: reservation.customerName,
      guestCount: reservation.guestCount,
      startAt: reservation.startAt,
    })
  } catch (err) {
    logError('[RESERVATION_PUSH_NOTIFICATION_FAILED]', {
      tenantId: String(tenantId),
      branchId: String(branchId),
      reservationId: String(reservation._id),
      message: String(err?.message || err)
    })
  }
}

const reserveAndCreate = async ({ tenantId, branch, actorId, payload, source, customerAccessKeyHash = '' }) => {
  const settings = getSettings(branch)
  const customer = normalizeCustomer(payload)
  const { startAt, endAt, slotKeys } = resolveRequestedTime(payload, settings)
  await expirePendingHolds(tenantId, branch._id)
  const chosenTableId = String(payload.tableId || '').trim()
  const candidates = await getAvailableTableIds({
    tenantId,
    branchId: branch._id,
    guestCount: customer.guestCount,
    slotKeys,
    now: new Date()
  })
  if (chosenTableId && !candidates.some((table) => table.id === chosenTableId)) {
    const conflict = error('reservation_conflict', 'Seçilen masa bu saat için uygun değil.', 409)
    conflict.payload.details = { availableTables: candidates }
    throw conflict
  }
  if (source === 'website' && !chosenTableId && candidates.length === 0) {
    throw error('reservation_conflict', 'Bu saat için uygun masa bulunmuyor. Lütfen uygun saatlerden birini seçin.', 409)
  }
  const candidateIds = chosenTableId ? [chosenTableId] : candidates.map((table) => table.id)
  const status = source === 'website' && settings.autoConfirm ? 'confirmed'
    : (source === 'staff' && payload.status === 'confirmed' ? 'confirmed' : 'pending')
  const holdExpiresAt = status === 'pending'
    ? new Date(Date.now() + settings.pendingHoldMinutes * 60 * 1000)
    : null
  let lastConflict
  for (const tableId of [...candidateIds, ...(candidateIds.length ? [] : [null])]) {
    let reservation
    try {
      reservation = await Reservation.create({
        tenantId,
        branchId: branch._id,
        tableId,
        ...customer,
        startAt,
        endAt,
        source,
        ...(source === 'website' && customerAccessKeyHash ? { customerAccessKeyHash } : {}),
        status,
        holdExpiresAt,
        slotKeys: tableId ? slotKeys : [],
        history: [{ action: 'created', status, changedBy: actorId || null, details: { source } }]
      })
    } catch (err) {
      if (err?.code === 11000 && tableId) {
        lastConflict = err
        continue
      }
      throw err
    }
    try {
      if (source === 'website') await notifyBranchStaff({ tenantId, branchId: branch._id, reservation })
      if (actorId) await auditLog(tenantId, actorId, 'reservation_create', 'Reservation', reservation._id, { branchId: String(branch._id), status, source })
      return toDto(reservation)
    } catch (err) {
      if (source === 'website') {
        await ReservationNotification.deleteMany({ tenantId, reservationId: reservation._id })
        await Reservation.deleteOne({ _id: reservation._id, tenantId })
      }
      throw err
    }
  }
  if (lastConflict || candidateIds.length === 0) {
    throw error('reservation_conflict', 'Bu saat için uygun masa kalmadı. Lütfen başka saat seçin.', 409)
  }
  throw error('reservation_conflict', 'Rezervasyon oluşturulamadı.', 409)
}

export const getReservationAvailability = async ({ slug, date, guestCount }) => {
  const { tenant, branch } = await resolvePublicSite(slug)
  const count = Number(guestCount)
  if (!Number.isInteger(count) || count < 1 || count > 100) throw error('invalid_reservation', 'Kişi sayısı geçersiz.', 400)
  const result = await getDailyAvailability({ tenantId: tenant._id, branch, date, guestCount: count })
  return { branchName: branch.name, slots: result.slots }
}

export const createPublicReservation = async ({ slug, payload }) => {
  const { tenant, branch } = await resolvePublicSite(slug)
  if (!getSettings(branch).onlineEnabled) throw error('online_reservations_disabled', 'Online rezervasyon şu anda kapalı.', 403)
  const rawAccessKey = String(payload.customerAccessKey || '').trim()
  if (rawAccessKey && !/^[a-f\d]{64}$/i.test(rawAccessKey)) {
    throw error('invalid_reservation_access_key', 'Rezervasyon geçmişi anahtarı geçersiz.', 400)
  }
  const customerAccessKeyHash = rawAccessKey
    ? createHash('sha256').update(rawAccessKey.toLowerCase()).digest('hex')
    : ''
  const reservation = await reserveAndCreate({ tenantId: tenant._id, branch, payload, source: 'website', customerAccessKeyHash })
  return {
    reservation: {
      id: reservation.id,
      customerName: reservation.customerName,
      date: reservation.date,
      time: reservation.time,
      status: reservation.status
    },
    message: reservation.status === 'confirmed'
      ? 'Rezervasyonunuz onaylandı.'
      : 'Rezervasyon başvurunuz alındı. Restoran onayını bekliyor.'
  }
}

export const getPublicReservationHistory = async ({ slug, accessKey }) => {
  const { tenant, branch } = await resolvePublicSite(slug)
  const rawAccessKey = String(accessKey || '').trim()
  if (!/^[a-f\d]{64}$/i.test(rawAccessKey)) {
    throw error('invalid_reservation_access_key', 'Rezervasyon geçmişi anahtarı geçersiz.', 400)
  }
  const customerAccessKeyHash = createHash('sha256').update(rawAccessKey.toLowerCase()).digest('hex')
  const reservations = await Reservation.find({
    tenantId: tenant._id,
    branchId: branch._id,
    source: 'website',
    customerAccessKeyHash
  }).sort({ startAt: -1, createdAt: -1 }).limit(10)
    .select('_id tableId guestCount startAt status createdAt')
    .lean()
  const tableIds = [...new Set(reservations.map((item) => item.tableId).filter(Boolean).map(String))]
  const tables = tableIds.length
    ? await Table.find({ tenantId: tenant._id, branchId: branch._id, _id: { $in: tableIds } }).select('_id name').lean()
    : []
  const tableNames = new Map(tables.map((table) => [String(table._id), String(table.name || '')]))
  return {
    reservations: reservations.map((item) => {
      const { date, time } = dateToWallClock(item.startAt)
      return {
        id: String(item._id),
        date,
        time,
        guestCount: Number(item.guestCount || 1),
        status: String(item.status || 'pending'),
        tableName: tableNames.get(String(item.tableId || '')) || '',
        createdAt: item.createdAt || null
      }
    })
  }
}

export const getReservationSettings = async ({ tenantId, branchId, actor }) => {
  ensureStaffBranch(actor, branchId)
  const branch = await requireBranch(tenantId, branchId)
  return { branchId: String(branch._id), branchName: branch.name, settings: getSettings(branch) }
}

export const updateReservationSettings = async ({ tenantId, branchId, actor, input }) => {
  if (String(actor?.role || '') !== 'tenant_admin') throw error('forbidden', 'Rezervasyon ayarlarını yalnızca firma yöneticisi değiştirebilir.', 403)
  const branch = await requireBranch(tenantId, branchId)
  const settings = normalizeReservationSettings(input)
  await Branch.updateOne({ _id: branch._id, tenantId }, { $set: { reservationSettings: settings } })
  await auditLog(tenantId, actor.id, 'reservation_settings_update', 'Branch', branch._id, { branchId: String(branch._id) })
  return { branchId: String(branch._id), branchName: branch.name, settings }
}

export const listReservations = async ({ tenantId, branchIds, actor, date, status }) => {
  const allowedBranchIds = Array.isArray(branchIds) ? branchIds.map(String) : []
  const filter = { tenantId, branchId: { $in: allowedBranchIds } }
  if (date) {
    const start = wallClockToDate(date, '00:00')
    const end = new Date(start.getTime() + RESERVATION_DAY_MS)
    filter.startAt = { $gte: start, $lt: end }
  }
  if (status && RESERVATION_STATUSES.includes(status)) filter.status = status
  const docs = await Reservation.find(filter).sort({ startAt: 1, createdAt: -1 }).lean()
  const tableIds = [...new Set(docs.map((item) => item.tableId).filter(Boolean).map(String))]
  const tables = tableIds.length
    ? await Table.find({ tenantId, _id: { $in: tableIds } }).select('_id name').lean()
    : []
  const tableNames = new Map(tables.map((item) => [String(item._id), String(item.name || '')]))
  const results = docs.map((doc) => ({ ...toDto(doc), tableName: tableNames.get(String(doc.tableId || '')) || '' }))
  const unreadCount = await ReservationNotification.countDocuments({
    tenantId,
    branchId: { $in: allowedBranchIds },
    userId: actor.id,
    readAt: null
  })
  return { reservations: results, unreadCount }
}

export const getPendingReservationCount = async ({ tenantId, branchIds }) => {
  const branches = Array.isArray(branchIds) ? branchIds.map(String) : []
  const [pendingCount, unreadCount] = await Promise.all([
    Reservation.countDocuments({
      tenantId,
      branchId: { $in: branches },
      status: 'pending',
      $or: [{ holdExpiresAt: null }, { holdExpiresAt: { $gt: new Date() } }]
    }),
    ReservationNotification.countDocuments({ tenantId, branchId: { $in: branches }, readAt: null })
  ])
  return { pendingCount, unreadCount }
}

export const createStaffReservation = async ({ tenantId, branchId, actor, payload }) => {
  ensureStaffBranch(actor, branchId)
  const branch = await requireBranch(tenantId, branchId)
  return reserveAndCreate({ tenantId, branch, actorId: actor.id, payload, source: 'staff' })
}

const requireReservation = async (tenantId, id, branchIds, { session = null } = {}) => {
  if (!mongoose.isValidObjectId(String(id || ''))) throw error('invalid_reservation', 'Rezervasyon kimliği geçersiz.', 400)
  let query = Reservation.findOne({ _id: id, tenantId, branchId: { $in: branchIds } })
  if (session) query = query.session(session)
  const doc = await query
  if (!doc) throw error('not_found', 'Rezervasyon bulunamadı.', 404)
  return doc
}

const getEditableRange = (payload, current, settings) => {
  const currentTime = dateToWallClock(current.startAt)
  const startAt = wallClockToDate(payload.date || currentTime.date, payload.time || currentTime.time)
  const customer = normalizeCustomer({
    customerName: payload.customerName ?? current.customerName,
    phone: payload.phone ?? current.phone,
    guestCount: payload.guestCount ?? current.guestCount,
    note: payload.note ?? current.note
  })
  const range = resolveRequestedTime({ date: dateToWallClock(startAt).date, time: dateToWallClock(startAt).time }, settings)
  return { ...range, customer }
}

export const updateReservation = async ({ tenantId, id, branchIds, actor, payload }) => {
  const current = await requireReservation(tenantId, id, branchIds)
  ensureStaffBranch(actor, current.branchId)
  if (!['pending', 'confirmed'].includes(current.status)) throw error('reservation_not_editable', 'Bu rezervasyon artık düzenlenemez.', 409)
  const branch = await requireBranch(tenantId, current.branchId)
  const settings = getSettings(branch)
  const { startAt, endAt, slotKeys, customer } = getEditableRange(payload, current, settings)
  const tableId = String(payload.tableId ?? current.tableId ?? '').trim()
  const candidates = await getAvailableTableIds({
    tenantId,
    branchId: current.branchId,
    guestCount: customer.guestCount,
    slotKeys,
    now: new Date(),
    excludeReservationId: current._id
  })
  const tableAvailable = !tableId || candidates.some((table) => table.id === tableId)
  if (!tableAvailable) {
    const conflict = error('reservation_conflict', 'Seçilen masa bu saat için uygun değil.', 409)
    conflict.payload.details = { availableTables: candidates }
    throw conflict
  }
  const nextSlotKeys = tableId ? slotKeys : []
  const oldStatus = current.status
  let next
  try {
    next = await Reservation.findOneAndUpdate(
      { _id: current._id, tenantId, branchId: current.branchId, __v: current.__v },
      {
        $set: {
          ...customer,
          startAt,
          endAt,
          tableId: tableId || null,
          slotKeys: nextSlotKeys,
          holdExpiresAt: current.status === 'pending'
            ? new Date(Date.now() + settings.pendingHoldMinutes * 60 * 1000)
            : null
        },
        $push: { history: { action: 'updated', status: oldStatus, changedBy: actor.id, details: { date: dateToWallClock(startAt).date, time: dateToWallClock(startAt).time, tableId } } },
        $inc: { __v: 1 }
      },
      { new: true, runValidators: true }
    )
  } catch (err) {
    if (err?.code === 11000) throw error('reservation_conflict', 'Bu masa ve saat başka bir rezervasyona ayrıldı.', 409)
    throw err
  }
  if (!next) throw error('reservation_changed', 'Rezervasyon başka bir işlemde güncellendi. Listeyi yenileyin.', 409)
  await auditLog(tenantId, actor.id, 'reservation_update', 'Reservation', next._id, { branchId: String(next.branchId), oldStatus })
  return toDto(next)
}

export const changeReservationStatus = async ({ tenantId, id, branchIds, actor, status }) => {
  if (!['pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'].includes(String(status))) {
    throw error('invalid_reservation_status', 'Rezervasyon durumu geçersiz.', 400)
  }
  const current = await requireReservation(tenantId, id, branchIds)
  ensureStaffBranch(actor, current.branchId)
  if (!canTransitionReservation(current.status, status)) throw error('invalid_reservation_transition', 'Bu durum geçişine izin verilmiyor.', 409)
  const holdExpiresAt = status === 'pending'
    ? new Date(Date.now() + getSettings(await requireBranch(tenantId, current.branchId)).pendingHoldMinutes * 60 * 1000)
    : null
  let slotKeys = ['cancelled', 'completed', 'no_show'].includes(status) ? [] : current.slotKeys
  if (['confirmed', 'arrived'].includes(status) && current.tableId) {
    const rangeKeys = buildReservationSlotKeys(current.startAt, current.endAt)
    const available = await getAvailableTableIds({
      tenantId,
      branchId: current.branchId,
      guestCount: current.guestCount,
      slotKeys: rangeKeys,
      now: new Date(),
      excludeReservationId: current._id
    })
    if (!available.some((table) => table.id === String(current.tableId))) {
      throw error('reservation_conflict', 'Bu rezervasyonun masası seçilen saatte artık uygun değil.', 409)
    }
    slotKeys = rangeKeys
  }
  let updated
  try {
    updated = await Reservation.findOneAndUpdate(
      { _id: current._id, tenantId, branchId: current.branchId, status: current.status, __v: current.__v },
      {
        $set: { status, holdExpiresAt, slotKeys },
        $push: { history: { action: 'status_changed', status, changedBy: actor.id, details: { previousStatus: current.status } } },
        $inc: { __v: 1 }
      },
      { new: true, runValidators: true }
    )
  } catch (err) {
    if (err?.code === 11000) throw error('reservation_conflict', 'Bu masa ve saat başka bir rezervasyona ayrıldı.', 409)
    throw err
  }
  if (!updated) throw error('reservation_changed', 'Rezervasyon başka bir işlemde güncellendi. Listeyi yenileyin.', 409)
  await auditLog(tenantId, actor.id, 'reservation_status_update', 'Reservation', updated._id, { branchId: String(updated.branchId), status })
  return toDto(updated)
}

export const arriveAndOpenReservation = async ({ tenantId, id, branchIds, actor }) => {
  const current = await requireReservation(tenantId, id, branchIds)
  ensureStaffBranch(actor, current.branchId)
  if (!['pending', 'confirmed', 'arrived'].includes(current.status)) throw error('invalid_reservation_transition', 'Bu rezervasyon için adisyon açılamaz.', 409)
  if (!current.tableId) throw error('reservation_table_required', 'Önce rezervasyona masa atayın.', 409)
  if (current.orderId) return { reservation: toDto(current), orderId: String(current.orderId), opened: false }
  const claimed = await Reservation.findOneAndUpdate(
    { _id: current._id, tenantId, status: current.status, orderId: null, orderOpening: false },
    { $set: { orderOpening: true } },
    { new: true }
  )
  if (!claimed) {
    const latest = await requireReservation(tenantId, id, branchIds)
    if (latest.orderId) return { reservation: toDto(latest), orderId: String(latest.orderId), opened: false }
    throw error('reservation_arrival_in_progress', 'Bu rezervasyon için adisyon açma işlemi sürüyor.', 409)
  }
  try {
    const existing = await Order.findOne({
      tenantId,
      branchId: claimed.branchId,
      tableId: claimed.tableId,
      status: { $in: ACTIVE_ORDER_STATUSES }
    }).sort({ updatedAt: -1 }).select('_id').lean()
    const opened = existing
      ? { orderId: String(existing._id), success: true }
      : await startOrderForTableService(tenantId, actor.id, String(claimed.tableId), String(claimed.branchId), { createdByName: actor.name })
    const updated = await Reservation.findOneAndUpdate(
      { _id: claimed._id, tenantId, orderOpening: true },
      {
        $set: { status: 'arrived', orderId: opened.orderId, orderOpening: false },
        $push: { history: { action: 'arrived_order_opened', status: 'arrived', changedBy: actor.id, details: { orderId: opened.orderId } } },
        $inc: { __v: 1 }
      },
      { new: true }
    )
    if (!updated) throw error('reservation_changed', 'Rezervasyon durumu değişti.', 409)
    await auditLog(tenantId, actor.id, 'reservation_arrived_order_opened', 'Reservation', updated._id, { branchId: String(updated.branchId), orderId: opened.orderId })
    return { reservation: toDto(updated), orderId: opened.orderId, opened: !existing }
  } catch (err) {
    await Reservation.updateOne({ _id: claimed._id, tenantId, orderOpening: true }, { $set: { orderOpening: false } })
    throw err
  }
}

export const markReservationNotificationsRead = async ({ tenantId, branchIds, userId, notificationId }) => {
  const filter = { tenantId, branchId: { $in: branchIds }, userId, readAt: null }
  if (notificationId) {
    if (!mongoose.isValidObjectId(String(notificationId))) throw error('invalid_notification', 'Bildirim kimliği geçersiz.', 400)
    filter._id = notificationId
  }
  const result = await ReservationNotification.updateMany(filter, { $set: { readAt: new Date() } })
  return { modifiedCount: Number(result.modifiedCount || 0) }
}

export const getReservationNotifications = async ({ tenantId, branchIds, userId }) => {
  const notifications = await ReservationNotification.find({
    tenantId,
    branchId: { $in: branchIds },
    userId
  }).sort({ createdAt: -1 }).limit(30).populate({
    path: 'reservationId',
    select: 'customerName guestCount startAt status tableId phone',
    match: { tenantId, branchId: { $in: branchIds } }
  }).lean()
  return notifications.filter((item) => item.reservationId).map((item) => ({
    id: String(item._id),
    readAt: item.readAt || null,
    createdAt: item.createdAt,
    reservation: toDto(item.reservationId)
  }))
}

export const getBranchDailyAvailability = async ({ tenantId, branchId, actor, date, guestCount, excludeReservationId = '' }) => {
  ensureStaffBranch(actor, branchId)
  if (!Number.isInteger(Number(guestCount)) || Number(guestCount) < 1 || Number(guestCount) > 100) {
    throw error('invalid_reservation', 'Kişi sayısı 1-100 arasında olmalı.', 400)
  }
  const branch = await requireBranch(tenantId, branchId)
  let excludedId = null
  if (excludeReservationId) {
    const reservation = await requireReservation(tenantId, excludeReservationId, [String(branch._id)])
    ensureStaffBranch(actor, reservation.branchId)
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      throw error('reservation_not_editable', 'Bu rezervasyon artık düzenlenemez.', 409)
    }
    excludedId = reservation._id
  }
  const result = await getDailyAvailability({ tenantId, branch, date, guestCount, allowDisabled: true, excludeReservationId: excludedId })
  return { slots: result.slots, settings: result.settings }
}
