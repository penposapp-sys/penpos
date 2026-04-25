import { error } from '../utils/errors.js'
import { listTables, createTable, confirmNameAvailable, updateById, findByIdAndTenant } from '../repositories/tableRepository.js'
import { createOrder } from '../repositories/orderRepository.js'
import Table from '../models/Table.js'
import Order from '../models/Order.js'
import User from '../models/User.js'
import { computePaymentSummary } from '../utils/orderFinancial.js'
import { getTenantPlan, ensureNotExpired } from './planService.js'
import mongoose from 'mongoose'
import { applyBranchFilter } from '../utils/branchFilter.js'

export const listTablesService = async (tenantId, branchFilter) => {
  const list = await listTables(tenantId, branchFilter)
  return list.map(t => ({
    id: t.id,
    name: t.name,
    status: t.status,
    isActive: !!t.isActive,
    branchId: t.branchId ? String(t.branchId) : null,
    activeOrderId: t.activeOrderId || null
  }))
}

export const getTableMetaService = async (tenantId, tableId) => {
  const t = await findByIdAndTenant(tableId, tenantId)
  if (!t) throw error('not_found', 'Table not found', 404)
  return { id: t.id, name: t.name, branchId: t.branchId }
}

export const createTableService = async (tenantId, userId, dto) => {
  await ensureNotExpired(tenantId, userId)
  const plan = await getTenantPlan(tenantId)
  if (plan && plan.limits && typeof plan.limits.tables === 'number' && plan.limits.tables !== -1) {
    const count = await Table.countDocuments({ tenantId, isActive: true })
    if (count >= plan.limits.tables) {
      await (await import('./auditService.js')).log(tenantId, userId, 'plan_limit_asildi', 'Tenant', tenantId, { type: 'tables', limit: plan.limits.tables })
      throw error('plan_limit_exceeded', 'Masa limiti aşıldı', 403)
    }
  }
  const ok = await confirmNameAvailable(tenantId, dto.name)
  if (!ok) throw error('name_in_use', 'Name already in use', 400)
  const t = await createTable({ tenantId, branchId: dto.branchId, name: dto.name })
  await (await import('./auditService.js')).log(tenantId, userId, 'table_create', 'Table', t.id, { name: dto.name })
  return { id: t.id, name: t.name, status: t.status }
}

export const updateTableService = async (tenantId, userId, id, dto) => {
  const t = await findByIdAndTenant(id, tenantId)
  if (!t) throw error('not_found', 'Table not found', 404)
  if (dto.name) {
    const ok = await confirmNameAvailable(tenantId, dto.name, t.id)
    if (!ok) throw error('name_in_use', 'Name already in use', 400)
  }
  const updated = await updateById(id, { name: dto.name ?? t.name })
  await (await import('./auditService.js')).log(tenantId, userId, 'table_update', 'Table', updated.id, { name: updated.name })
  return { id: updated.id, name: updated.name, status: updated.status }
}

export const deleteTableService = async (tenantId, userId, id) => {
  const t = await findByIdAndTenant(id, tenantId)
  if (!t) throw error('not_found', 'Table not found', 404)
  if (t.status === 'occupied') throw error('table_occupied', 'Table occupied', 400)
  const updated = await updateById(id, { isActive: false })
  await (await import('./auditService.js')).log(tenantId, userId, 'masa_silindi', 'Table', updated.id, {})
  return { id: updated.id, isActive: updated.isActive }
}

export const startOrderForTableService = async (tenantId, userId, tableId, branchId, { createdByName } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(tableId)) {
    const e = new Error('Invalid tableId')
    e.status = 400
    e.payload = { code: 'invalid_request', message: 'Invalid tableId' }
    throw e
  }
  const t = await findByIdAndTenant(tableId, tenantId)
  if (!t || !t.isActive) {
    const e = new Error('Table not found')
    e.status = 404
    e.payload = { code: 'not_found', message: 'Table not found' }
    throw e
  }
  if (t.status === 'occupied' && t.activeOrderId) {
    const e = new Error('Table already occupied')
    e.status = 409
    e.payload = { code: 'table_in_use', message: 'Table already occupied', details: { orderId: String(t.activeOrderId) } }
    throw e
  }
  const effectiveBranchId = t.branchId
  const existing = await Order.findOne({
    tenantId,
    tableId,
    branchId: effectiveBranchId,
    status: { $in: ['open', 'sent', 'completed'] }
  }).sort({ updatedAt: -1, createdAt: -1 })
  if (existing) {
    const e = new Error('Table already occupied')
    e.status = 409
    e.payload = { code: 'table_in_use', message: 'Table already occupied', details: { orderId: existing.id } }
    throw e
  }
  const order = await createOrder({
    tenantId,
    branchId: effectiveBranchId,
    createdBy: userId,
    createdByUserId: userId,
    createdByName: String(createdByName || '').trim(),
    tableId,
    status: 'open',
    items: [],
    totals: { subtotal: 0, grandTotal: 0 }
  })
  await updateById(tableId, { status: 'occupied', activeOrderId: order.id })
  await (await import('./auditService.js')).log(tenantId, userId, 'table_start_order', 'Table', tableId, { orderId: order.id })
  return { success: true, orderId: order.id }
}

export const getActiveOrderForTableService = async (tenantId, tableId, branchId) => {
  const t = await findByIdAndTenant(tableId, tenantId)
  if (!t || !t.isActive) throw error('not_found', 'Table not found', 404)
  if (branchId && String(t.branchId) !== String(branchId)) throw error('forbidden', 'Invalid branch', 403)

  if (!t.activeOrderId) {
    return { success: true, hasActive: false, orderId: null }
  }

  const order = await Order.findOne({
    _id: t.activeOrderId,
    tenantId,
    'items.0': { $exists: true }
  }).sort({ updatedAt: -1, createdAt: -1 })

  if (!order) {
    return { success: true, hasActive: false, orderId: null }
  }

  return {
    success: true,
    hasActive: true,
    orderId: order.id,
    status: order.status
  }
}

export const getTablesOverviewService = async (tenantId, branchFilter) => {
  let branchId = null
  let branchIds = []
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    branchId = branchFilter.branchId || null
    branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
  } else {
    branchId = branchFilter || null
  }
  let tableFilter = { tenantId, isActive: true }
  tableFilter = applyBranchFilter(tableFilter, branchIds.length > 0 ? branchIds : (branchId ? [branchId] : []))
  const tables = await Table.find(tableFilter).lean()
  const activeOrderIds = tables.map(t => t.activeOrderId).filter(Boolean)
  const orders = activeOrderIds.length
    ? await Order.find({ tenantId, _id: { $in: activeOrderIds }, status: { $in: ['open', 'sent', 'completed'] } }).lean()
    : []
  const orderById = new Map(orders.map(o => [String(o._id), o]))
  const creatorIds = Array.from(new Set(
    (orders || [])
      .map(o => String(o?.createdByUserId || o?.createdBy || ''))
      .filter(id => mongoose.Types.ObjectId.isValid(id))
  ))
  const creators = creatorIds.length
    ? await User.find({ tenantId, _id: { $in: creatorIds } }).select('name').lean()
    : []
  const creatorNameById = new Map((creators || []).map(u => [String(u._id), String(u?.name || '').trim()]))

  const activeByTable = {}
  const paidByTable = {}
  for (const t of tables) {
    const key = String(t._id)
    if (!t.activeOrderId) {
      activeByTable[key] = { hasActive: false, orderId: null, status: null }
      continue
    }
    const ord = orderById.get(String(t.activeOrderId))
    if (!ord) {
      activeByTable[key] = { hasActive: false, orderId: null, status: null }
      continue
    }
    activeByTable[key] = { hasActive: true, orderId: String(ord._id), status: ord.status }

    const payments = Array.isArray(ord.payments) ? ord.payments : []
    const paidTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const grandTotal = ord.totals?.grandTotal || 0
    const remaining = Math.max(0, grandTotal - paidTotal)
    const isPaid = grandTotal > 0 && remaining <= 0.01
    paidByTable[key] = {
      isPaid,
      note: ord.note || '',
      createdAt: ord.createdAt,
      hasCancelAlert: ord.cancelAlertActive === true,
      createdByName: String(
        creatorNameById.get(String(ord?.createdByUserId || ord?.createdBy || '')) ||
        ord.createdByName ||
        ''
      ).trim()
    }
  }
  return {
    success: true,
    tables: tables.map(t => ({
      id: String(t._id),
      name: t.name,
      status: t.status,
      activeOrderId: t.activeOrderId ? String(t.activeOrderId) : null,
      isActive: t.isActive,
      branchId: t.branchId
    })),
    activeByTable,
    paidByTable
  }
}

export const closeTableService = async (tenantId, tableId, branchId) => {
  if (!mongoose.Types.ObjectId.isValid(tableId)) {
    const e = new Error('Invalid table id')
    e.status = 400
    e.payload = { code: 'invalid_request', message: 'Invalid table id' }
    throw e
  }

  const t = await findByIdAndTenant(tableId, tenantId)
  if (!t) {
    const e = new Error('Table not found')
    e.status = 404
    e.payload = { code: 'not_found', message: 'Table not found' }
    throw e
  }

  if (branchId && String(t.branchId) !== String(branchId)) {
    const e = new Error('Invalid branch')
    e.status = 403
    e.payload = { code: 'forbidden', message: 'Invalid branch' }
    throw e
  }

  if (!t.activeOrderId) {
    const e = new Error('Table not closable')
    e.status = 409
    e.payload = {
      error: 'conflict',
      code: (t.status === 'empty' ? 'already_closed' : 'no_active_order'),
      message: (t.status === 'empty' ? 'Masa zaten kapalı' : 'Masada aktif sipariş yok'),
      details: { status: null }
    }
    throw e
  }

  const order = await Order.findOne({ _id: t.activeOrderId, tenantId })

  if (!order) {
    const e = new Error('Table not closable')
    e.status = 409
    e.payload = {
      error: 'conflict',
      code: 'no_active_order',
      message: 'Masada aktif sipariş bulunamadı',
      details: { status: null, paymentStatus: null, remaining: null }
    }
    throw e
  }

  const fin = computePaymentSummary(order)
  const remaining = Number(fin.balanceDue) || 0
  const hasLegacyPaid = (!order.payments || order.payments.length === 0) && order.paymentStatus === 'paid'

  if (remaining > 0.01 && !hasLegacyPaid) {
    const e = new Error('Table not closable')
    e.status = 409
    e.payload = {
      error: 'conflict',
      code: 'remaining_unsettled',
      message: 'Kalan tutar var, masa kapatılamaz',
      details: { status: order.status || null, paymentStatus: order.paymentStatus || null, remaining }
    }
    throw e
  }

  const items = Array.isArray(order.items) ? order.items : []
  const hasPendingItems = items.some(it => it && (it.status === 'open' || it.status === 'sent'))
  if (hasPendingItems) {
    const e = new Error('Kitchen not finished')
    e.status = 409
    e.payload = {
      error: 'conflict',
      code: 'kitchen_not_completed',
      message: 'Mutfak tamamlanmadı',
      details: { status: order.status, hasPendingItems: true }
    }
    throw e
  }

  await Order.findByIdAndUpdate(order._id, { status: 'closed', closedAt: new Date() })

  await Order.updateMany(
    {
      tenantId,
      tableId,
      _id: { $ne: order._id },
      status: { $in: ['open', 'sent', 'completed'] }
    },
    { $set: { status: 'closed', closedAt: new Date() } }
  )

  await updateById(tableId, { status: 'empty', activeOrderId: null })
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'table_close', 'Table', tableId, { previousOrderId: t.activeOrderId })
  return { tableId: String(t._id), cleared: true }
}

export const abandonIfEmpty = async ({ tenantId, branchId, tableId }) => {
  const table = await Table.findOne({ _id: tableId, tenantId })
  if (!table) {
    const e = new Error('Table not found')
    e.status = 404
    e.payload = { code: 'table_not_found', message: 'Table not found' }
    throw e
  }

  if (!table.activeOrderId) return { cleared: false }

  if (branchId && String(table.branchId) !== String(branchId)) {
    const e = new Error('Invalid branch')
    e.status = 403
    e.payload = { code: 'forbidden', message: 'Invalid branch' }
    throw e
  }

  const order = await Order.findOne({ _id: table.activeOrderId, tenantId })
  if (!order) return { cleared: false }

  const isEmpty =
    (Array.isArray(order.items) ? order.items.length : 0) === 0 &&
    (Array.isArray(order.payments) ? order.payments.length : 0) === 0 &&
    Number(order.discountPercent || 0) === 0 &&
    String(order.note || '').trim() === ''

  if (!isEmpty) return { cleared: false }

  try {
    console.log('[TABLE_ABANDON]', String(tableId), String(order._id))
  } catch {}

  await Order.updateOne({ _id: order._id }, { $set: { status: 'cancelled' } })
  await Table.updateOne({ _id: tableId }, { $set: { status: 'empty', activeOrderId: null } })
  return { cleared: true }
}
