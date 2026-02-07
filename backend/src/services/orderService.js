import { error } from '../utils/errors.js'
import { createOrder, findByIdAndTenant, updateById } from '../repositories/orderRepository.js'
import { findByIdAndTenant as findMenuItem } from '../repositories/menuItemRepository.js'
import Order from '../models/Order.js'
import mongoose from 'mongoose'
import CustomerAccount from '../models/CustomerAccount.js'
import AccountTransaction from '../models/AccountTransaction.js'
import Table from '../models/Table.js'
import OrderCounter from '../models/OrderCounter.js'
import { isMongoTransactionsSupported } from '../config/db.js'
import * as logger from '../utils/logger.js'
import User from '../models/User.js'
import { applyBranchFilter } from '../utils/branchFilter.js'

const toMoney = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const computeTotals = (items) => {
  const safeItems = Array.isArray(items) ? items : []
  const subtotal = safeItems
    .filter(it => it && it.status !== 'cancelled')
    .reduce((sum, it) => {
      const rawSubtotal = Number(it.subtotal)
      if (Number.isFinite(rawSubtotal)) {
        return sum + rawSubtotal
      }
      const qty = toMoney(it.qty ?? it.quantity)
      const price = toMoney(it.priceSnapshot ?? it.price)
      const fallbackSubtotal = qty * price
      return sum + toMoney(fallbackSubtotal)
    }, 0)
  const safeSubtotal = toMoney(subtotal)
  const grandTotal = toMoney(safeSubtotal)
  return { subtotal: safeSubtotal, grandTotal }
}

const normalizeLegacyItemStatuses = (order) => {
  if (!order || !Array.isArray(order.items)) return
  order.items = order.items.map(it => {
    const s = it.status
    const normalized = s === 'preparing' ? 'sent' : (s === 'ready' ? 'completed' : s)
    return { ...it, status: normalized }
  })
}

const computePaymentSummary = (order) => {
  if (!order) {
    return { total: 0, discountTotal: 0, netTotal: 0, paidTotal: 0, balanceDue: 0 }
  }
  const items = Array.isArray(order.items) ? order.items : []
  const total = items
    .filter(it => it && it.status !== 'cancelled')
    .reduce((sum, it) => sum + toMoney(it.subtotal), 0)
  const discountPercent = Math.max(0, Math.min(100, toMoney(order.discountPercent)))
  const discountTotal = toMoney((total * discountPercent) / 100)
  const netTotal = toMoney(Math.max(0, total - discountTotal))
  const payments = Array.isArray(order.payments) ? order.payments : []
  const paidTotal = payments.reduce((sum, p) => {
    const amount = toMoney(p && p.amount)
    return sum + amount
  }, 0)
  const veresiyePaid = order.settlementType === 'veresiye' ? toMoney(order.veresiyeAmount) : 0
  const paid = toMoney(paidTotal + veresiyePaid)
  const balanceDue = toMoney(Math.max(0, netTotal - paid))
  return { total, discountTotal, netTotal, paidTotal: paid, balanceDue }
}

const normalizeOpenDuplicatesForResponse = (items) => {
  const src = Array.isArray(items) ? items : []
  const map = new Map()
  for (const it of src) {
    if (!it || it.status !== 'open') continue
    const key = `${String(it.menuItemId)}|${String(it.note || '')}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...it, qty: Number(it.qty) || 0, subtotal: Number(it.subtotal) || 0 })
    } else {
      prev.qty += Number(it.qty) || 0
      prev.subtotal += Number(it.subtotal) || 0
      map.set(key, prev)
    }
  }

  const used = new Set()
  const out = []
  for (const it of src) {
    if (!it) continue
    if (it.status !== 'open') {
      out.push(it)
      continue
    }
    const key = `${String(it.menuItemId)}|${String(it.note || '')}`
    if (used.has(key)) continue
    used.add(key)
    out.push(map.get(key))
  }
  return out
}

export const buildOrderDayKey = (date) => {
  const d = date instanceof Date ? date : new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const getNextOrderSequence = async (tenantId, branchId) => {
  const now = new Date()
  const dayKey = buildOrderDayKey(now)
  if (!branchId) {
    const e = new Error('Branch required')
    e.status = 400
    e.payload = { error: 'branch_required', code: 'branch_required', message: 'Branch required' }
    throw e
  }

  const run = async () => {
    const counter = await OrderCounter.findOneAndUpdate(
      { tenantId, dayKey },
      { $inc: { seq: 1 }, $setOnInsert: { tenantId, dayKey, branchId, createdAt: now } },
      { upsert: true, new: true }
    ).lean()
    return { orderDayKey: dayKey, orderNo: Number(counter?.seq) || 1 }
  }

  try {
    return await run()
  } catch (e) {
    if (e && e.code === 11000) {
      return await run()
    }
    throw e
  }
}

const decorateOrder = (order) => {
  if (!order) return order
  const base = typeof order.toObject === 'function' ? order.toObject({ virtuals: true }) : { ...order }
  const summary = computePaymentSummary(base)
  const totals = base.totals || {}
  const paymentStatus = summary.netTotal > 0 && summary.balanceDue <= 0.01 ? 'paid' : 'unpaid'
  return {
    ...base,
    totals: {
      ...totals,
      total: summary.total,
      discountTotal: summary.discountTotal,
      netTotal: summary.netTotal,
      paidTotal: summary.paidTotal,
      balanceDue: summary.balanceDue,
      grandTotal: summary.netTotal
    },
    total: summary.total,
    discountTotal: summary.discountTotal,
    netTotal: summary.netTotal,
    paidTotal: summary.paidTotal,
    balanceDue: summary.balanceDue,
    paymentStatus
  }
}

export const createOrderService = async (tenantId, userId, branchId, { createdByName } = {}) => {
  const safeCreatedByName = String(createdByName || '').trim()
  const order = await createOrder({
    tenantId,
    branchId: branchId || null,
    createdBy: userId,
    createdByUserId: userId,
    createdByName: safeCreatedByName,
    items: [],
    status: 'open',
    totals: { subtotal: 0, grandTotal: 0 }
  })
  await (await import('./auditService.js')).log(tenantId, userId, 'order_create', 'Order', order.id, {})
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    totals: order.totals,
    note: order.note,
    orderNo: order.orderNo,
    orderDayKey: order.orderDayKey
  }
}

export const createWalkInOrderService = async (tenantId, userId, branchId, { customerName, note, createdByName } = {}) => {
  const safeCustomerName = (String(customerName || '').trim().slice(0, 40)) || 'Misafir'
  const safeNote = String(note || '').trim()
  const safeCreatedByName = String(createdByName || '').trim()
  const order = await createOrder({
    tenantId,
    branchId,
    createdBy: userId,
    createdByUserId: userId,
    createdByName: safeCreatedByName,
    items: [],
    status: 'open',
    totals: { subtotal: 0, grandTotal: 0 },
    saleType: 'walkin',
    customerName: safeCustomerName,
    note: safeNote,
    paymentStatus: 'unpaid'
  })
  await (await import('./auditService.js')).log(tenantId, userId, 'order_create_walkin', 'Order', order.id, { customerName: safeCustomerName })
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    totals: order.totals,
    note: order.note,
    saleType: order.saleType,
    customerName: order.customerName,
    orderNo: order.orderNo,
    orderDayKey: order.orderDayKey
  }
}

export const getWalkInOrdersService = async (tenantId, branchFilter, { status = 'active', limit = 50 } = {}) => {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50))
  let branchId = null
  let branchIds = []
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    branchId = branchFilter.branchId || null
    branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
  } else {
    branchId = branchFilter || null
  }
  let filter = {
    tenantId,
    saleType: 'walkin',
  }
  filter = applyBranchFilter(filter, branchIds.length > 0 ? branchIds : (branchId ? [branchId] : []))

  if (status === 'active') {
    filter.status = { $in: ['open', 'sent'] }
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean()
  const dto = (orders || []).map(o => {
    const items = Array.isArray(o?.items) ? o.items : []
    const hasSent = items.some(it => it?.status === 'sent')
    const hasCompleted = items.some(it => it?.status === 'completed')
    const hasOpen = items.some(it => it?.status === 'open')
    let uiStatus = 'open'
    if (hasSent) uiStatus = 'sent'
    else if (hasCompleted) uiStatus = 'ready'
    else if (hasOpen) uiStatus = 'open'
    else uiStatus = 'open'
    const uiStatusLabel = uiStatus === 'sent' ? 'Hazırlanıyor' : uiStatus === 'ready' ? 'Hazır' : 'Bekliyor'
    const d = decorateOrder(o)
    return {
      _id: d._id || d.id,
      customerName: d.customerName || '',
      orderNo: d.orderNo ?? null,
      orderDayKey: d.orderDayKey || '',
      createdAt: d.createdAt,
      status: d.status,
      uiStatus,
      uiStatusLabel,
      paymentStatus: d.paymentStatus,
      totals: {
        total: Number(d.total ?? d.totals?.total ?? 0),
        grandTotal: Number(d.totals?.grandTotal ?? d.netTotal ?? 0),
        netTotal: Number(d.netTotal ?? d.totals?.netTotal ?? 0),
        paidTotal: Number(d.paidTotal ?? d.totals?.paidTotal ?? 0),
        balanceDue: Number(d.balanceDue ?? d.totals?.balanceDue ?? 0),
      }
    }
  })
  return { orders: dto }
}

export const createDeliveryOrderService = async (tenantId, userId, branchId, { customerName, phone, address, note, createdByName } = {}) => {
  const safeCustomerName = String(customerName || '').trim()
  const safePhone = String(phone || '').trim()
  const safeAddress = String(address || '').trim()
  const safeNote = String(note || '').trim()
  const safeCreatedByName = String(createdByName || '').trim()
  const order = await createOrder({
    tenantId,
    branchId,
    createdBy: userId,
    createdByUserId: userId,
    createdByName: safeCreatedByName,
    items: [],
    status: 'open',
    totals: { subtotal: 0, grandTotal: 0 },
    saleType: 'delivery',
    customerName: safeCustomerName,
    customerPhone: safePhone,
    customerAddress: safeAddress,
    deliveryNote: safeNote,
    note: safeNote,
    deliveryStatus: 'pending',
    paymentStatus: 'unpaid'
  })
  await (await import('./auditService.js')).log(tenantId, userId, 'order_create_delivery', 'Order', order.id, { customerName: safeCustomerName })
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    totals: order.totals,
    note: order.note,
    saleType: order.saleType,
    customerName: order.customerName,
    deliveryStatus: order.deliveryStatus,
    orderNo: order.orderNo,
    orderDayKey: order.orderDayKey
  }
}

export const updateDeliveryStatusService = async (tenantId, id, deliveryStatus) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (order.saleType !== 'delivery') throw error('invalid_request', 'Not a delivery order', 400)

  const next = String(deliveryStatus || '').trim()
  const allowed = new Set(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'])
  if (!allowed.has(next)) {
    throw error('invalid_request', 'Invalid delivery status', 400)
  }

  const updates = { deliveryStatus: next }
  if (next === 'delivered') {
    const now = new Date()
    updates.deliveryAt = now
    updates.deliveredAt = now
  }

  const updated = await updateById(id, updates)
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_delivery_status', 'Order', updated.id, { deliveryStatus: next })
  const fresh = await Order.findById(updated.id).lean()
  const dto = decorateOrder(fresh)
  return { order: dto }
}

export const updateDeliveryCustomerService = async (tenantId, id, { customerName, phone, address } = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (order.saleType !== 'delivery') throw error('invalid_request', 'Not a delivery order', 400)

  const safeCustomerName = (String(customerName || '').trim().slice(0, 40))
  if (!safeCustomerName) throw error('invalid_request', 'Customer name required', 400)
  const safePhone = String(phone ?? '').trim().slice(0, 30)
  const safeAddress = String(address ?? '').trim().slice(0, 200)

  order.customerName = safeCustomerName
  order.customerPhone = safePhone
  order.customerAddress = safeAddress
  await order.save()

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_delivery_customer_update', 'Order', order.id, { customerName: safeCustomerName })

  const fresh = await Order.findById(order.id).lean()
  const dto = decorateOrder(fresh)
  return { order: dto }
}

export const getDeliveryOrdersService = async (tenantId, branchFilter, { status, from, to, page = 1, limit, onlyLastHours } = {}) => {
  let branchId = null
  let branchIds = []
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    branchId = branchFilter.branchId || null
    branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
  } else {
    branchId = branchFilter || null
  }
  let filter = {
    tenantId,
    saleType: 'delivery',
  }
  filter = applyBranchFilter(filter, branchIds.length > 0 ? branchIds : (branchId ? [branchId] : []))

  const s = String(status || '').trim()
  if (!s || s === 'active') {
    filter.deliveryStatus = { $in: ['pending', 'accepted', 'preparing', 'ready'] }
    filter.status = { $nin: ['cancelled', 'closed'] }
  } else if (s === 'delivered') {
    filter.deliveryStatus = 'delivered'
  } else if (s === 'cancelled') {
    filter.deliveryStatus = 'cancelled'
  } else {
    filter.deliveryStatus = s
  }

  const safeOnlyLastHours = Math.max(0, Math.min(24 * 14, Number(onlyLastHours) || 0))
  if (safeOnlyLastHours > 0 && (s === 'delivered')) {
    const cutoff = new Date(Date.now() - safeOnlyLastHours * 60 * 60 * 1000)
    filter.$or = [
      { deliveredAt: { $gte: cutoff } },
      { deliveredAt: null, deliveryAt: { $gte: cutoff } }
    ]
  }

  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }

  const defaultLimit = s === 'delivered' ? 50 : 20
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || defaultLimit))
  const safePage = Math.max(1, Number(page) || 1)
  const skip = (safePage - 1) * safeLimit

  const sort = s === 'delivered'
    ? { deliveredAt: -1, deliveryAt: -1, updatedAt: -1 }
    : { createdAt: -1 }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(safeLimit).lean(),
    Order.countDocuments(filter)
  ])

  return { orders, total }
}

export const getOrderService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  const obj = decorateOrder(order)
  const actor = await User.findById(obj.createdBy).select('name').lean()
  const createdByUser = actor ? { id: String(obj.createdBy), name: actor.name } : { id: String(obj.createdBy), name: '' }
  const normalizedItems = normalizeOpenDuplicatesForResponse(obj.items)
  return {
    id: obj.id,
    tableId: obj.tableId,
    status: obj.status,
    items: normalizedItems,
    totals: obj.totals,
    note: obj.note,
    mergeSourceOrderIds: obj.mergeSourceOrderIds || [],
    saleType: obj.saleType,
    customerName: obj.customerName,
    kitchenEnabled: obj.kitchenEnabled,
    sendToKitchen: obj.sendToKitchen,
    customerPhone: obj.customerPhone,
    customerAddress: obj.customerAddress,
    deliveryNote: obj.deliveryNote,
    deliveryStatus: obj.deliveryStatus,
    deliveryAt: obj.deliveryAt,
    servingType: obj.servingType ?? null,
    servingTypeUpdatedAt: obj.servingTypeUpdatedAt ?? null,
    discountPercent: obj.discountPercent || 0,
    payments: obj.payments || [],
    paymentStatus: obj.paymentStatus,
    paidAt: obj.paidAt,
    settlementType: obj.settlementType,
    veresiyeAccountId: obj.veresiyeAccountId,
    veresiyeAmount: obj.veresiyeAmount,
    veresiyeNote: obj.veresiyeNote,
    veresiyeAt: obj.veresiyeAt,
    orderNo: obj.orderNo ?? null,
    orderDayKey: obj.orderDayKey || '',
    createdBy: obj.createdBy,
    createdByUser,
    createdByName: createdByUser?.name || '',
    total: obj.total,
    discountTotal: obj.discountTotal,
    netTotal: obj.netTotal,
    paidTotal: obj.paidTotal,
    balanceDue: obj.balanceDue
  }
}

const isEditableStatus = (status) => ['open', 'sent', 'paid'].includes(status)
const isNotEditableStatus = (status) => ['closed', 'cancelled'].includes(status)

export const addItemService = async (tenantId, id, menuItemId, quantity = 1) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  if (!mongoose.Types.ObjectId.isValid(menuItemId)) throw error('invalid_request', 'Invalid menu item', 400)

  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  if (order.orderNo == null) {
    const seq = await getNextOrderSequence(tenantId, order.branchId)
    const updated = await Order.updateOne(
      { _id: order.id, tenantId, $or: [{ orderNo: null }, { orderNo: { $exists: false } }] },
      { $set: { orderNo: seq.orderNo, orderDayKey: seq.orderDayKey } }
    )
    if (updated && (updated.modifiedCount > 0 || updated.nModified > 0)) {
      order.orderNo = seq.orderNo
      order.orderDayKey = seq.orderDayKey
    } else {
      const fresh = await Order.findOne({ _id: order.id, tenantId }).select('orderNo orderDayKey').lean()
      order.orderNo = fresh?.orderNo ?? null
      order.orderDayKey = fresh?.orderDayKey || ''
    }
  }

  const qty = Math.max(1, Number(quantity) || 1)
  const item = await findMenuItem(menuItemId, tenantId)
  if (!item || !item.isActive) throw error('not_found', 'Menu item not found', 404)
  const price = typeof item.price === 'number' ? item.price : 0

  const incomingNote = ''
  const existingOpen = order.items.find(it =>
    String(it.menuItemId) === String(menuItemId) &&
    it.status === 'open' &&
    String(it.note || '') === String(incomingNote)
  )

  const wasCompleted = order.status === 'completed'
  if (existingOpen) {
    existingOpen.qty += qty
    existingOpen.subtotal = existingOpen.qty * (existingOpen.priceSnapshot || 0)
  } else {
    // const now = new Date() // Not needed for open item
    const newItem = {
      menuItemId: item.id,
      nameSnapshot: item.name || 'Unknown',
      priceSnapshot: price,
      qty: qty,
      subtotal: qty * price,
      note: incomingNote,
      status: 'open',
      sentAt: null
    }
    if (order.status === 'sent' || order.status === 'completed') {
      order.items.unshift(newItem)
    } else {
      order.items.push(newItem)
    }
    if (order.status === 'completed') {
      order.status = 'sent'
    }
  }

  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)

  const fin = computePaymentSummary(order)
  if (fin.netTotal > 0 && fin.balanceDue > 0.01) {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  } else {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
  }

  await order.save()
  if (wasCompleted && order.tableId) {
    try {
      await (await import('../repositories/tableRepository.js')).updateById(order.tableId, { status: 'occupied', activeOrderId: order.id })
    } catch {}
  }

  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setItemNoteService = async (tenantId, id, menuItemId, note) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const it = order.items.find(x => String(x.menuItemId) === String(menuItemId))
  if (!it) throw error('not_found', 'Item not in order', 404)
  it.note = String(note || '')
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_note', 'Order', order.id, { menuItemId })
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const completeItemService = async (tenantId, id, menuItemId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  const it = order.items.find(x => String(x.menuItemId) === String(menuItemId))
  if (!it) throw error('not_found', 'Item not in order', 404)
  it.status = 'completed'
  normalizeLegacyItemStatuses(order)
  const updated = await updateById(id, { items: order.items })
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_complete', 'Order', updated.id, { menuItemId })
  const dto = await getOrderService(tenantId, updated.id)
  return { order: dto }
}

export const completeItemByItemIdService = async (tenantId, id, itemId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const it = order.items.id(itemId)
  if (!it) throw error('not_found', 'Item not found', 404)
  if (it.status === 'cancelled') {
    const e = new Error('Item cancelled')
    e.status = 409
    e.payload = { code: 'item_cancelled', message: 'Item cancelled' }
    throw e
  }
  if (it.status === 'completed') {
    const e = new Error('Item already completed')
    e.status = 409
    e.payload = { code: 'item_already_completed', message: 'Item already completed' }
    throw e
  }
  if (it.status !== 'sent') {
    const e = new Error('Item not sent')
    e.status = 400
    e.payload = { code: 'invalid_state', message: 'Item not sent', details: { currentStatus: it.status, allowed: ['sent'] } }
    throw e
  }

  it.status = 'completed'
  normalizeLegacyItemStatuses(order)
  await order.save()

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const cancelItemService = async (tenantId, id, menuItemId, reason) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!['open', 'sent', 'completed'].includes(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open/sent/completed', details: { currentStatus: order.status, allowed: ['open', 'sent', 'completed'] } }
    throw e
  }
  const it = order.items.find(x => String(x.menuItemId) === String(menuItemId))
  if (!it) throw error('not_found', 'Item not in order', 404)
  if (it.status === 'cancelled') {
    const e = new Error('Item already cancelled')
    e.status = 409
    e.payload = { error: 'item_already_cancelled', message: 'Item already cancelled' }
    throw e
  }
  it.status = 'cancelled'
  it.note = reason ? String(reason) : it.note
  const totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  const fin = computePaymentSummary({ ...order.toObject?.() ?? order, items: order.items, totals })
  const paymentUpdates = (fin.netTotal > 0 && fin.balanceDue <= 0.01)
    ? { paymentStatus: 'paid', paidAt: order.paidAt || new Date() }
    : { paymentStatus: 'unpaid', paidAt: null }
  const updated = await updateById(id, { items: order.items, totals, ...paymentUpdates })
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_cancel', 'Order', updated.id, { menuItemId, reason })
  const dto = await getOrderService(tenantId, updated.id)
  return { order: dto }
}

export const cancelItemByItemIdService = async ({ orderId, itemId, reason, user }) => {
    const order = await findByIdAndTenant(orderId, user.tenantId)
    if (!order) throw error('not_found', 'Order not found', 404)
    if (isNotEditableStatus(order.status)) {
      const e = new Error('Order is not editable')
      e.status = 409
      e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
      throw e
    }
    const item = order.items.id(itemId)
    if (!item) throw error('not_found', 'Item not found', 404)
    if (item.status === 'cancelled') {
      const e = new Error('Item already cancelled')
      e.status = 409
      e.payload = { error: 'item_already_cancelled', message: 'Item already cancelled' }
      throw e
    }
    if (!['sent', 'completed'].includes(item.status)) {
      const e = new Error('Item not in cancellable status')
      e.status = 400
      e.payload = { error: 'invalid_state', message: 'Item not sent or completed', details: { currentStatus: item.status, allowed: ['sent', 'completed'] } }
      throw e
    }
    item.status = 'cancelled'
    if (reason) item.note = reason

    order.totals = computeTotals(order.items)
    normalizeLegacyItemStatuses(order)
  {
    const fin = computePaymentSummary(order)
    if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || new Date()
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
  }
    await order.save()
    const freshOrder = await Order.findById(order.id).lean()
    const dto = decorateOrder(freshOrder)
    return { order: dto }
  }

export const removeItemService = async (tenantId, id, menuItemId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('Order not in editable status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const idx = order.items.findIndex(it => String(it.menuItemId) === String(menuItemId))
  if (idx === -1) throw error('not_found', 'Item not in order', 404)
  const existing = order.items[idx]
  if (existing.qty > 1) {
    existing.qty -= 1
    existing.subtotal = existing.qty * (existing.priceSnapshot || 0)
  } else {
    order.items.splice(idx, 1)
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  {
    const fin = computePaymentSummary(order)
    if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || new Date()
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
  }
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setItemQuantityService = async (tenantId, id, menuItemId, quantity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const idx = order.items.findIndex(it => String(it.menuItemId) === String(menuItemId))
  if (idx === -1) throw error('not_found', 'Item not in order', 404)
  const qty = Math.max(0, Number(quantity) || 0)
  if (qty <= 0) {
    order.items.splice(idx, 1)
  } else {
    const it = order.items[idx]
    it.qty = qty
    it.subtotal = qty * (it.priceSnapshot || 0)
    order.items[idx] = it
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  {
    const fin = computePaymentSummary(order)
    if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || new Date()
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
  }
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setItemQuantityByItemIdService = async (tenantId, id, itemId, quantity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw error('invalid_request', 'Invalid item id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const it = order.items.id(itemId)
  if (!it) throw error('item_not_found', 'Item not found', 404)
  const qty = Math.max(0, Number(quantity) || 0)
  if (qty <= 0) {
    const idx = order.items.findIndex(x => String(x?._id) === String(itemId))
    if (idx === -1) throw error('item_not_found', 'Item not found', 404)
    order.items.splice(idx, 1)
  } else {
    it.qty = qty
    it.subtotal = qty * (it.priceSnapshot || 0)
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  {
    const fin = computePaymentSummary(order)
    if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || new Date()
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
  }
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const removeItemByItemIdService = async ({ tenantId, orderId, itemId }) => {
  return setItemQuantityByItemIdService(tenantId, orderId, itemId, 0)
}

export const setItemNoteByItemIdService = async (tenantId, id, itemId, note) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw error('invalid_request', 'Invalid item id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const it = order.items.id(itemId)
  if (!it) throw error('not_found', 'Item not in order', 404)
  it.note = String(note || '')
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_note', 'Order', order.id, { itemId, menuItemId: String(it.menuItemId) })
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const splitOrderService = async (tenantId, id, itemsToMove = [], targetTableId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('order_not_splitable', 'Order not splitable', 400)
  if (!Array.isArray(itemsToMove) || itemsToMove.length === 0) throw error('invalid_request', 'No items to split', 400)

  let targetTable = null
  if (targetTableId) {
    targetTable = await Table.findOne({ _id: targetTableId, tenantId, isActive: true })
    if (!targetTable || targetTable.status !== 'empty') throw error('target_table_not_empty', 'Target table not empty', 400)
  }

  const session = await mongoose.startSession()
  try {
    const seq = await getNextOrderSequence(tenantId, order.branchId)
    let newOrder = null
    await session.withTransaction(async () => {
      const sourceItemsMap = new Map(order.items.map(it => [String(it.menuItemId), { ...it }]))
      const newOrderItems = []
      for (const m of itemsToMove) {
        const key = String(m.menuItemId)
        const src = sourceItemsMap.get(key)
        if (!src) throw error('not_found', 'Menu item not in order', 404)
        if (m.qty < 1 || m.qty > src.qty) throw error('invalid_qty', 'Invalid qty', 400)
        // reduce from source
        src.qty -= m.qty
        src.subtotal = src.qty * src.priceSnapshot
        sourceItemsMap.set(key, src)
        // add to new order
        newOrderItems.push({
          menuItemId: src.menuItemId,
          nameSnapshot: src.nameSnapshot,
          priceSnapshot: src.priceSnapshot,
          qty: m.qty,
          subtotal: m.qty * src.priceSnapshot
        })
      }
      const updatedSourceItems = Array.from(sourceItemsMap.values()).filter(it => it.qty > 0)
      const updatedSourceTotals = computeTotals(updatedSourceItems)
      await Order.findByIdAndUpdate(order.id, { items: updatedSourceItems, totals: updatedSourceTotals }, { new: true, session })

      newOrder = await Order.create([{
        tenantId,
        branchId: order.branchId,
        createdBy: order.createdBy,
        orderNo: seq.orderNo,
        orderDayKey: seq.orderDayKey,
        tableId: targetTableId ?? order.tableId,
        status: 'open',
        items: newOrderItems,
        totals: computeTotals(newOrderItems),
        note: ''
      }], { session }).then(res => res[0])

      if (targetTableId) {
        await Table.findByIdAndUpdate(targetTableId, { status: 'occupied', activeOrderId: newOrder.id }, { new: true, session })
      }
    })
    return { newOrderId: newOrder.id }
  } finally {
    await session.endSession()
  }
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_split', 'Order', order.id, { newOrderId: newOrder.id, targetTableId })
}
export const setNoteService = async (tenantId, id, note) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  order.note = note ?? ''
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_set_note', 'Order', order.id, {})
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setCustomerNameService = async (tenantId, id, customerName) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('order_not_found', 'Order not found', 404)
  if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'closed') {
    throw error('order_not_editable', 'Order not editable', 409)
  }
  order.customerName = (String(customerName || '').trim().slice(0, 40)) || 'Misafir'
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_set_customer_name', 'Order', order.id, {})
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const cancelOrderService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  const summary = computePaymentSummary(order)
  if (summary.paidTotal > 0) throw error('invalid_state', 'Order paid', 400)

  const now = new Date()
  const isDelivery = String(order.saleType || '') === 'delivery'
  for (const it of order.items || []) {
    if (it && (it.status === 'open' || it.status === 'sent')) {
      it.status = 'cancelled'
    }
  }
  order.status = 'cancelled'
  if (isDelivery) {
    order.deliveryStatus = 'cancelled'
    order.closedAt = now
  }
  normalizeLegacyItemStatuses(order)
  await order.save()
  if (order.tableId) {
    await (await import('../repositories/tableRepository.js')).updateById(order.tableId, { status: 'empty', activeOrderId: null })
  }
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_cancel', 'Order', order.id, {})
  return { id: order.id, status: order.status }
}

export const sendOrderService = async (tenantId, id, { servingType, kitchenEnabled } = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('invalid_state', 'Order not open or sent', 400)
  const now = new Date()
  const batchId = new mongoose.Types.ObjectId().toString()

  const itemsToLabel = []

  if (kitchenEnabled !== undefined) {
    order.kitchenEnabled = Boolean(kitchenEnabled)
    order.sendToKitchen = Boolean(kitchenEnabled)
  }

  if (servingType !== undefined) {
    const v = servingType === null ? null : String(servingType)
    if (v === null) {
      // no-op
    } else if (!['tray', 'plate', 'package'].includes(v)) {
      throw error('invalid_request', 'Invalid servingType', 400)
    } else {
      order.servingType = v
      order.servingTypeUpdatedAt = now
    }
  }

  const normalizedServingType = ['tray', 'plate', 'package'].includes(order.servingType) ? order.servingType : null
  const itemServingType = (servingType !== undefined && servingType !== null) ? String(servingType) : normalizedServingType
  if (!Array.isArray(order.kitchenBatches)) order.kitchenBatches = []
  if (!order.kitchenBatches.some(b => String(b?.batchId || '') === batchId)) {
    order.kitchenBatches.push({ batchId, servingType: normalizedServingType, sentAt: now })
  }

  const hasOpenItems = (order.items || []).some(it => it && it.status === 'open')
  if (!hasOpenItems) {
    const e = new Error('No open items to send')
    e.status = 409
    e.payload = { error: 'no_open_items_to_send', message: 'No open items to send' }
    throw e
  }

  for (const it of order.items || []) {
    if (it.status === 'open') {
      it.status = 'sent'
      if (!it.sentAt) {
        it.sentAt = now
      }
      it.kitchenBatchId = batchId
      it.kitchenSentAt = now
      it.servingType = ['tray', 'plate', 'package'].includes(itemServingType) ? itemServingType : (normalizedServingType || null)
      itemsToLabel.push({
        menuItemId: it.menuItemId,
        nameSnapshot: it.nameSnapshot,
        qty: it.qty
      })
    }
  }
  order.currentKitchenBatchId = batchId
  order.status = 'sent'
  await order.save()

  try {
    if (order.kitchenEnabled !== false && order.sendToKitchen !== false && itemsToLabel.length > 0) {
      const { findByCodeAndScope } = await import('../repositories/printProfileRepository.js')
      const { createJob } = await import('./printingService.js')
      const labelProfile = await findByCodeAndScope('label', tenantId, 'kermes')
      if (labelProfile && labelProfile.isActive !== false) {
        const tableName = order.tableId ? String((await Table.findById(order.tableId).select('name').lean())?.name || '') : ''
        const top = tableName ? tableName : (order.saleType === 'delivery' ? 'PAKET' : (order.saleType === 'walkin' ? 'HIZLI' : 'SİPARİŞ'))
        for (const it of itemsToLabel) {
          const line2 = `${String(it.nameSnapshot || '').trim() || '-'} x${Number(it.qty || 1)}`
          const payload = `${top}\n${line2}\n`
          await createJob(tenantId, 'kermes', order.createdByUserId || order.createdBy, {
            type: 'label',
            profileId: String(labelProfile.id),
            payload: { type: 'raw', content: payload },
            meta: {
              orderId: String(order.id),
              tableId: order.tableId ? String(order.tableId) : null,
              kitchenBatchId: String(batchId),
              menuItemId: it.menuItemId ? String(it.menuItemId) : null,
              qty: Number(it.qty || 1)
            }
          })
        }
      }
    }
  } catch {
  }

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_send', 'Order', order.id, {})
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setKitchenModeService = async (tenantId, id, { kitchenEnabled, sendToKitchen } = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged', 'completed'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const next = kitchenEnabled !== undefined ? Boolean(kitchenEnabled) : (sendToKitchen !== undefined ? Boolean(sendToKitchen) : undefined)
  if (next === undefined) {
    throw error('invalid_request', 'kitchenEnabled or sendToKitchen required', 400)
  }
  const normalized = Boolean(next)
  order.sendToKitchen = normalized
  order.kitchenEnabled = normalized
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const addOrderPaymentService = async (tenantId, id, { method, amount, note, cashierId }) => {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw error('invalid_request', 'Invalid orderId', 400)
  }
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const payAmount = Number(amount)
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw error('invalid_amount', 'Invalid payment amount', 400)
  }
  const m = ['cash', 'card', 'transfer', 'other'].includes(method) ? method : 'cash'
  order.payments.push({ method: m, amount: payAmount, note: String(note || '') })
  const fin = computePaymentSummary(order)
  if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
  } else {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  }
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const deleteOrderPaymentService = async (tenantId, id, paymentId) => {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw error('invalid_request', 'Invalid orderId', 400)
  }
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  const payments = Array.isArray(order.payments) ? order.payments : []
  const idx = payments.findIndex(p => String(p?._id) === String(paymentId))
  if (idx === -1) throw error('not_found', 'Payment not found', 404)
  payments.splice(idx, 1)
  order.payments = payments

  const fin = computePaymentSummary(order)
  if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
  } else {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  }
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setOrderDiscountService = async (tenantId, id, discountPercent) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const pct = Number(discountPercent)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw error('invalid_discount', 'Invalid discount percent', 400)
  }
  order.discountPercent = pct
  const fin = computePaymentSummary(order)
  if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
  } else {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  }
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setOrderVeresiyeService = async (tenantId, branchId, actorUserId, id, { accountId, amount, note }) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (order.settlementType === 'veresiye') {
    const e = new Error('Order already settled')
    e.status = 409
    e.payload = { code: 'already_settled', message: 'Order already settled' }
    throw e
  }

  const finBefore = computePaymentSummary(order)
  if (finBefore.balanceDue <= 0.01) {
    throw error('nothing_to_settle', 'Nothing to settle', 400)
  }

  const settleAmount = amount !== undefined && amount !== null && Number(amount) > 0 ? Number(amount) : finBefore.balanceDue
  if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
    throw error('invalid_amount', 'Invalid amount', 400)
  }
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    throw error('invalid_request', 'Invalid accountId', 400)
  }

  const acc = await CustomerAccount.findOne({ _id: accountId, tenantId, branchId, isActive: true })
  if (!acc) throw error('not_found', 'Account not found', 404)

  const now = new Date()
  const verNote = String(note || '').trim()
  const txnSupported = isMongoTransactionsSupported()

  if (txnSupported) {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await CustomerAccount.updateOne(
          { _id: acc.id, tenantId, branchId },
          { $inc: { balance: settleAmount } },
          { session }
        )
        await AccountTransaction.create([
          {
            tenantId,
            branchId,
            accountId: acc.id,
            type: 'debit',
            amount: settleAmount,
            method: 'other',
            note: verNote,
            source: 'order_veresiye',
            orderId: order.id
          }
        ], { session })

        order.settlementType = 'veresiye'
        order.veresiyeAccountId = acc.id
        order.veresiyeAmount = settleAmount
        order.veresiyeNote = verNote
        order.veresiyeAt = now

        const finAfter = computePaymentSummary(order)
        if (finAfter.netTotal > 0 && finAfter.balanceDue <= 0.01) {
          order.paymentStatus = 'paid'
          order.paidAt = now
        } else {
          order.paymentStatus = 'unpaid'
          order.paidAt = null
        }

        await order.save({ session })
      })
    } finally {
      await session.endSession()
    }
  } else {
    await CustomerAccount.updateOne({ _id: acc.id, tenantId, branchId }, { $inc: { balance: settleAmount } })
    let tx = null
    try {
      tx = await AccountTransaction.create({
        tenantId,
        branchId,
        accountId: acc.id,
        type: 'debit',
        amount: settleAmount,
        method: 'other',
        note: verNote,
        source: 'order_veresiye',
        orderId: order.id
      })

      order.settlementType = 'veresiye'
      order.veresiyeAccountId = acc.id
      order.veresiyeAmount = settleAmount
      order.veresiyeNote = verNote
      order.veresiyeAt = now

      const finAfter = computePaymentSummary(order)
      if (finAfter.netTotal > 0 && finAfter.balanceDue <= 0.01) {
        order.paymentStatus = 'paid'
        order.paidAt = now
      } else {
        order.paymentStatus = 'unpaid'
        order.paidAt = null
      }

      await order.save()
    } catch (err) {
      try {
        if (tx) {
          await AccountTransaction.deleteOne({ _id: tx.id, tenantId, branchId })
        }
      } catch {}
      try {
        await CustomerAccount.updateOne({ _id: acc.id, tenantId, branchId }, { $inc: { balance: -settleAmount } })
      } catch {}
      throw err
    }
  }

  await (await import('./auditService.js')).log(tenantId, actorUserId, 'order_veresiye', 'Order', order.id, { accountId: acc.id, amount: settleAmount })
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const payOrderService = async (tenantId, id, paymentMethod, amount) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  
  if (!['open', 'sent', 'completed', 'paid'].includes(order.status)) {
    const e = new Error('Order not payable')
    e.status = 409
    e.payload = { code: 'order_not_payable', message: 'Order not payable', details: { status: order.status } }
    throw e
  }

  const before = computePaymentSummary(order)
  const payAmount = amount !== undefined && amount !== null ? Number(amount) : before.balanceDue

  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    if (before.balanceDue <= 0.01) {
      const e = new Error('Order already paid')
      e.status = 409
      e.payload = { code: 'order_already_paid', message: 'Order already paid' }
      throw e
    }
    const e = new Error('Invalid payment amount')
    e.status = 400
    e.payload = { code: 'invalid_amount', message: 'Invalid payment amount' }
    throw e
  }

  order.payments.push({
    amount: payAmount,
    method: paymentMethod || 'cash',
    note: ''
  })

  const after = computePaymentSummary(order)
  if (after.netTotal > 0 && after.balanceDue <= 0.01) {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
  } else {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  }

  await order.save()
  
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_pay', 'Order', order.id, { paymentMethod, amount: payAmount })
  
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const closeOrderService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const fin = computePaymentSummary(order)
  if (fin.netTotal > 0 && fin.balanceDue > 0.01) {
    throw error('invalid_state', 'Order not closable (Unpaid balance)', 400)
  }

  const nextStatus = order.status === 'cancelled' ? 'closed' : 'completed'
  const updated = await updateById(id, { status: nextStatus, closedAt: new Date() })
  if (updated.tableId) {
    await (await import('../repositories/tableRepository.js')).updateById(updated.tableId, { status: 'empty', activeOrderId: null })
  }
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_close', 'Order', updated.id, {})
  const fresh = await Order.findById(updated.id).lean()
  return { order: decorateOrder(fresh) }
}

export const reopenOrderService = async (tenantId, id) => {
  const txnSupported = isMongoTransactionsSupported()

  const baseOrder = await Order.findOne({ _id: id, tenantId })
  if (!baseOrder) throw error('order_not_found', 'Order not found', 404)
  if (!['closed', 'completed'].includes(baseOrder.status)) {
    const e = new Error('Order not closed')
    e.status = 409
    e.payload = { code: 'not_closed', message: 'Sipariş kapalı değil' }
    throw e
  }

  const apply = async (session) => {
    let q = Order.findOne({ _id: id, tenantId })
    if (session) q = q.session(session)
    const order = await q
    if (!order) throw error('order_not_found', 'Order not found', 404)
    if (!['closed', 'completed'].includes(order.status)) {
      const e = new Error('Order not closed')
      e.status = 409
      e.payload = { code: 'not_closed', message: 'Sipariş kapalı değil' }
      throw e
    }

    if (order.tableId) {
      const updatedTable = await Table.findOneAndUpdate(
        { _id: order.tableId, tenantId, isActive: true, $or: [{ activeOrderId: null }, { activeOrderId: order._id }] },
        { $set: { status: 'occupied', activeOrderId: order._id } },
        session ? { new: true, session } : { new: true }
      )
      if (!updatedTable) {
        const e = new Error('Table in use')
        e.status = 409
        e.payload = { code: 'table_in_use', message: 'Masada başka aktif sipariş var' }
        throw e
      }
    }

    order.status = 'sent'
    order.closedAt = null
    if (session) await order.save({ session })
    else await order.save()
    return order
  }

  if (!txnSupported) {
    const updated = await apply(undefined)
    const fresh = await Order.findById(updated._id).lean()
    return { success: true, order: decorateOrder(fresh) }
  }

  const session = await mongoose.startSession()
  try {
    let updated
    await session.withTransaction(async () => {
      updated = await apply(session)
    })
    const fresh = await Order.findById(updated._id).lean()
    return { success: true, order: decorateOrder(fresh) }
  } finally {
    await session.endSession().catch(() => {})
  }
}

export const listKitchenOrdersService = async (tenantId, branchFilter) => {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000)

  let branchId = null
  let branchIds = []
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    branchId = branchFilter.branchId || null
    branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
  } else {
    branchId = branchFilter || null
  }

  const base = {
    tenantId,
    status: { $in: ['open', 'sent'] },
    createdAt: { $gte: cutoff },
    kitchenEnabled: { $ne: false },
    sendToKitchen: { $ne: false }
  }

  let filter = {
    ...base,
    items: { $elemMatch: { status: 'sent' } }
  }
  filter = applyBranchFilter(filter, branchIds.length > 0 ? branchIds : (branchId ? [branchId] : []))

  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean()

  const creatorIdsToLookup = Array.from(new Set(
    (orders || [])
      .filter(o => !String(o?.createdByName || '').trim())
      .map(o => o?.createdByUserId || o?.createdBy)
      .filter(Boolean)
      .map(String)
  ))

  const userNameById = new Map()
  if (creatorIdsToLookup.length > 0) {
    const users = await User.find({ _id: { $in: creatorIdsToLookup } }).select('name').lean()
    for (const u of users || []) {
      userNameById.set(String(u?._id), String(u?.name || '').trim())
    }
  }

  const cleaned = orders
    .filter(o => !o.createdAt || o.createdAt >= cutoff)
    .map(o => {
      const baseCreatedAt = o.createdAt || new Date()
      const rawItems = Array.isArray(o.items) ? o.items : []
      const batchMeta = Array.isArray(o.kitchenBatches) ? o.kitchenBatches : []
      const batchMetaMap = new Map(batchMeta.map(b => [String(b?.batchId || ''), { servingType: b?.servingType ?? null, sentAt: b?.sentAt ?? null }]))
      for (const it of rawItems) {
        if (!it) continue
        if (it.status === 'sent' && !it.sentAt) {
          it.sentAt = baseCreatedAt
        }
        if (it.status === 'sent' && !it.kitchenSentAt) {
          it.kitchenSentAt = it.sentAt || baseCreatedAt
        }
      }

      const byBatch = new Map()
      for (const it of rawItems) {
        if (!it) continue
        if (it.status !== 'sent' && it.status !== 'completed' && it.status !== 'cancelled') continue
        const rawBatchId = it.kitchenBatchId ? String(it.kitchenBatchId) : ''
        const key = rawBatchId || '__legacy__'
        const meta = rawBatchId ? batchMetaMap.get(rawBatchId) : null
        const fallbackServing = ['tray', 'plate', 'package'].includes(o.servingType) ? o.servingType : 'tray'
        it.servingType = ['tray', 'plate', 'package'].includes(it.servingType) ? it.servingType : (meta?.servingType ?? fallbackServing)
        const entry = byBatch.get(key) || {
          batchId: rawBatchId || null,
          servingType: meta?.servingType ?? fallbackServing,
          batchSentAt: meta?.sentAt ?? null,
          sentAt: meta?.sentAt ?? null,
          items: [],
          hasActiveItems: false
        }
        entry.items.push(it)
        if (it.status === 'sent') entry.hasActiveItems = true
        const itSentAt = it.kitchenSentAt || it.sentAt || baseCreatedAt
        if (!entry.batchSentAt || new Date(itSentAt).getTime() < new Date(entry.batchSentAt).getTime()) {
          entry.batchSentAt = itSentAt
        }
        if (!entry.sentAt || new Date(itSentAt).getTime() < new Date(entry.sentAt).getTime()) {
          entry.sentAt = itSentAt
        }
        byBatch.set(key, entry)
      }

      const batches = Array.from(byBatch.values())
        .filter(b => b.hasActiveItems)
        .sort((a, b) => new Date(b.batchSentAt || 0).getTime() - new Date(a.batchSentAt || 0).getTime())

      return {
        id: String(o._id),
        tableId: o.tableId || null,
        orderNo: o.orderNo ?? null,
        orderDayKey: o.orderDayKey || '',
        status: o.status,
        note: o.note || '',
        totals: o.totals,
        createdAt: o.createdAt,
        saleType: o.saleType,
        servingType: o.servingType ?? null,
        createdByName: String(o.createdByName || userNameById.get(String(o.createdByUserId || o.createdBy)) || ''),
        customerName: o.customerName,
        deliveryStatus: o.deliveryStatus,
        batches
      }
    })
    .filter(o => o.status === 'open' || o.status === 'sent')
    .filter(o => Array.isArray(o.batches) && o.batches.length > 0)

  return cleaned
}

export const completeKitchenBatchByIdService = async (tenantId, orderId, batchId) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('invalid_state', 'Order not open or sent', 400)

  const target = String(batchId || '').trim()
  if (!target) throw error('invalid_request', 'Invalid batchId', 400)

  const items = Array.isArray(order.items) ? order.items : []
  const now = new Date()
  for (const it of items) {
    if (!it) continue
    if (it.status !== 'sent') continue
    if (String(it.kitchenBatchId || '') !== target) continue
    it.status = 'completed'
    if (!it.sentAt) it.sentAt = order.createdAt || now
    if (!it.kitchenSentAt) it.kitchenSentAt = it.sentAt
  }
  order.items = items
  if (order.currentKitchenBatchId && String(order.currentKitchenBatchId) === target) {
    order.currentKitchenBatchId = null
  }
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const completeKitchenBatchService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const currentBatchId = order.currentKitchenBatchId ? String(order.currentKitchenBatchId) : null
  if (currentBatchId) {
    return completeKitchenBatchByIdService(tenantId, id, currentBatchId)
  }

  if (!['open', 'sent'].includes(order.status)) throw error('invalid_state', 'Order not open or sent', 400)
  const items = Array.isArray(order.items) ? order.items : []
  const now = new Date()
  for (const it of items) {
    if (!it) continue
    if (it.status !== 'sent') continue
    it.status = 'completed'
    if (!it.sentAt) it.sentAt = order.createdAt || now
    if (!it.kitchenSentAt) it.kitchenSentAt = it.sentAt
  }
  order.items = items
  order.currentKitchenBatchId = null
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

const getErrText = (err) => {
  const parts = [
    err?.message,
    err?.cause?.message,
    err?.errmsg,
    err?.errorResponse?.errmsg,
    err?.errorResponse?.message,
    err?.response?.errmsg,
    err?.response?.message
  ].filter(Boolean)
  return parts.join(' | ')
}

const isTxnNotSupportedError = (err) => {
  const t = getErrText(err)
  return (
    t.includes('Transaction numbers are only allowed') ||
    t.includes('replica set member') ||
    t.includes('mongos') ||
    t.includes('Transaction support') ||
    t.includes('transactions are not supported')
  )
}

const buildTransferContext = async (tenantId, id, targetTableId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('order_not_transferable', 'Order not transferable', 400)
  if (!order.tableId) throw error('order_not_transferable', 'Order not transferable', 400)
  const sourceTable = await Table.findOne({ _id: order.tableId, tenantId, isActive: true })
  if (!sourceTable) throw error('invalid_table', 'Invalid source table', 400)
  const targetTable = await Table.findOne({ _id: targetTableId, tenantId, isActive: true })
  if (!targetTable) throw error('invalid_table', 'Invalid target table', 400)
  if (String(sourceTable.branchId) !== String(targetTable.branchId)) throw error('forbidden', 'Cross-branch transfer not allowed', 403)
  return { order, sourceTable, targetTable }
}

const transferOrderWithTransaction = async (tenantId, id, targetTableId) => {
  logger.info('[TRANSFER_TXN_ENTRY]', { orderId: id, targetTableId })
  const { order, sourceTable, targetTable } = await buildTransferContext(tenantId, id, targetTableId)

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const lockedTarget = await Table.findOneAndUpdate(
        { _id: targetTable.id, tenantId, isActive: true, activeOrderId: null },
        { $set: { activeOrderId: order.id, status: 'occupied' } },
        { new: true, session }
      )
      if (!lockedTarget) {
        const e = new Error('Target table in use')
        e.status = 409
        e.payload = { code: 'table_in_use', message: 'Target table in use' }
        throw e
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: order.id, tenantId, tableId: sourceTable.id, status: { $in: ['open', 'sent'] } },
        { $set: { tableId: targetTable.id } },
        { new: true, session }
      )
      if (!updatedOrder) {
        const e = new Error('Invalid transfer source')
        e.status = 409
        e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
        throw e
      }

      const clearedSource = await Table.findOneAndUpdate(
        { _id: sourceTable.id, tenantId, isActive: true, activeOrderId: order.id },
        { $set: { activeOrderId: null, status: 'empty' } },
        { new: true, session }
      )
      if (!clearedSource) {
        const e = new Error('Invalid transfer source')
        e.status = 409
        e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
        throw e
      }
    })
  } finally {
    await session.endSession()
  }

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_transfer', 'Order', order.id, { targetTableId })
  return { success: true, orderId: String(order.id) }
}

const transferOrderFallbackAtomic = async (tenantId, id, targetTableId) => {
  logger.info('[TRANSFER_FALLBACK_ENTRY]', { orderId: id, targetTableId })
  const { order, sourceTable, targetTable } = await buildTransferContext(tenantId, id, targetTableId)

  const updatedTarget = await Table.findOneAndUpdate(
    { _id: targetTable.id, tenantId, isActive: true, activeOrderId: null },
    { $set: { activeOrderId: order.id, status: 'occupied' } },
    { new: true }
  )
  if (!updatedTarget) {
    const e = new Error('Target table in use')
    e.status = 409
    e.payload = { code: 'table_in_use', message: 'Target table in use' }
    throw e
  }

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order.id, tenantId, tableId: sourceTable.id, status: { $in: ['open', 'sent'] } },
    { $set: { tableId: targetTable.id } },
    { new: true }
  )
  if (!updatedOrder) {
    await Table.findByIdAndUpdate(targetTable.id, { $set: { activeOrderId: null, status: 'empty' } }).catch(() => {})
    const e = new Error('Invalid transfer source')
    e.status = 409
    e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
    throw e
  }

  const updatedSource = await Table.findOneAndUpdate(
    { _id: sourceTable.id, tenantId, isActive: true, activeOrderId: order.id },
    { $set: { activeOrderId: null, status: 'empty' } },
    { new: true }
  )
  if (!updatedSource) {
    await Order.findByIdAndUpdate(order.id, { $set: { tableId: sourceTable.id } }).catch(() => {})
    await Table.findByIdAndUpdate(targetTable.id, { $set: { activeOrderId: null, status: 'empty' } }).catch(() => {})
    const e = new Error('Invalid transfer source')
    e.status = 409
    e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
    throw e
  }

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_transfer', 'Order', order.id, { targetTableId })
  return { success: true, orderId: String(order.id) }
}

export const transferOrderService = async (tenantId, id, targetTableId) => {
  const txnSupported = isMongoTransactionsSupported()
  logger.info('[TRANSFER_SERVICE_ENTRY]', {
    service: 'transferOrderService',
    orderId: id,
    targetTableId,
    txnSupported
  })

  if (!txnSupported) {
    logger.info('[TRANSFER_MODE]', {
      mode: 'fallback_force',
      reason: 'transactions_not_supported',
      orderId: id,
      targetTableId,
      tenantId
    })
    return await transferOrderFallbackAtomic(tenantId, id, targetTableId)
  }

  logger.info('[TRANSFER_MODE]', { mode: 'txn', orderId: id, targetTableId, tenantId })
  try {
    return await transferOrderWithTransaction(tenantId, id, targetTableId)
  } catch (err) {
    const txt = getErrText(err)
    if (isTxnNotSupportedError(err)) {
      logger.warn('[TRANSFER_TXN_UNSUPPORTED_FALLBACK]', {
        message: txt,
        orderId: id,
        targetTableId,
        tenantId
      })
      logger.info('[TRANSFER_MODE]', {
        mode: 'fallback_after_txn_error',
        orderId: id,
        targetTableId,
        tenantId
      })
      return await transferOrderFallbackAtomic(tenantId, id, targetTableId)
    }
    logger.error('[TRANSFER_TXN_ERROR]', {
      message: txt,
      orderId: id,
      targetTableId,
      tenantId
    })
    throw err
  }
}

const mergeItems = (targetItems, sourceItems) => {
  const map = new Map()
  for (const it of targetItems) {
    map.set(String(it.menuItemId), { ...it })
  }
  for (const it of sourceItems) {
    const key = String(it.menuItemId)
    if (map.has(key)) {
      const existing = map.get(key)
      const qty =
        toMoney(existing.qty ?? existing.quantity) +
        toMoney(it.qty ?? it.quantity)
      const price = toMoney(
        existing.priceSnapshot ??
        existing.price ??
        it.priceSnapshot ??
        it.price
      )
      const subtotal = toMoney(qty * price)
      map.set(key, { ...existing, qty, priceSnapshot: price, subtotal })
    } else {
      const qty = toMoney(it.qty ?? it.quantity)
      const price = toMoney(it.priceSnapshot ?? it.price)
      const subtotal = toMoney(qty * price)
      map.set(key, { ...it, qty, priceSnapshot: price, subtotal })
    }
  }
  return Array.from(map.values())
}

const buildMergedOrderData = (targetOrder, sourceOrders) => {
  const mergedItems = mergeItems(targetOrder.items, sourceOrders.flatMap(o => o.items))
  for (const it of mergedItems) {
    const qtyRaw = it?.qty ?? it?.quantity
    const priceRaw = it?.priceSnapshot ?? it?.price
    const subtotalRaw = it?.subtotal
    const qtyNum = Number(qtyRaw)
    const priceNum = Number(priceRaw)
    const subtotalNum = Number(subtotalRaw)
    const qtyBad = !Number.isFinite(qtyNum) || qtyNum < 0
    const priceBad = !Number.isFinite(priceNum) || priceNum < 0
    const subtotalBad = subtotalRaw !== undefined && subtotalRaw !== null && !Number.isFinite(subtotalNum)
    if (qtyBad || priceBad || subtotalBad) {
      logger.warn('[MERGE_ITEM_BAD_DATA]', {
        qty: qtyRaw,
        price: priceRaw,
        subtotal: subtotalRaw,
        qtyBad,
        priceBad,
        subtotalBad
      })
    }
  }
  const totals = computeTotals(mergedItems)
  const mergeSourceOrderIds = [
    ...(targetOrder.mergeSourceOrderIds || []),
    ...sourceOrders.map(o => o.id)
  ]
  return { mergedItems, totals, mergeSourceOrderIds }
}

const mergeOrdersWithTransaction = async (tenantId, targetOrder, sourceOrders, sourceTables) => {
  const { mergedItems, totals, mergeSourceOrderIds } = buildMergedOrderData(targetOrder, sourceOrders)
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const safeTotals = {
        ...totals,
        subtotal: Number.isFinite(Number(totals?.subtotal)) ? Number(totals.subtotal) : 0,
        grandTotal: Number.isFinite(Number(totals?.grandTotal)) ? Number(totals.grandTotal) : 0
      }
      if (!Number.isFinite(Number(totals?.grandTotal))) {
        logger.error('[MERGE_TOTALS_NAN]', {
          targetOrderId: targetOrder.id,
          grandTotal: totals?.grandTotal,
          subtotal: totals?.subtotal,
          sampleItems: mergedItems.slice(0, 3)
        })
      }
      await Order.findByIdAndUpdate(
        targetOrder.id,
        { items: mergedItems, totals: safeTotals, mergeSourceOrderIds },
        { new: true, session }
      )
      for (const o of sourceOrders) {
        await Order.findByIdAndUpdate(
          o.id,
          { status: 'merged', mergedIntoOrderId: targetOrder.id },
          { new: true, session }
        )
      }
      await Table.updateMany(
        { _id: { $in: sourceTables.map(t => t.id) } },
        { status: 'empty', activeOrderId: null },
        { session }
      )
    })
  } finally {
    await session.endSession()
  }
}

const mergeOrdersFallbackAtomic = async (tenantId, targetOrder, sourceOrders, sourceTables) => {
  const { mergedItems, totals, mergeSourceOrderIds } = buildMergedOrderData(targetOrder, sourceOrders)
  const safeTotals = {
    ...totals,
    subtotal: Number.isFinite(Number(totals?.subtotal)) ? Number(totals.subtotal) : 0,
    grandTotal: Number.isFinite(Number(totals?.grandTotal)) ? Number(totals.grandTotal) : 0
  }
  if (!Number.isFinite(Number(totals?.grandTotal))) {
    logger.error('[MERGE_TOTALS_NAN]', {
      targetOrderId: targetOrder.id,
      grandTotal: totals?.grandTotal,
      subtotal: totals?.subtotal,
      sampleItems: mergedItems.slice(0, 3)
    })
  }
  await Order.findByIdAndUpdate(
    targetOrder.id,
    { items: mergedItems, totals: safeTotals, mergeSourceOrderIds },
    { new: true }
  )
  for (const o of sourceOrders) {
    await Order.findByIdAndUpdate(
      o.id,
      { status: 'merged', mergedIntoOrderId: targetOrder.id },
      { new: true }
    )
  }
  await Table.updateMany(
    { _id: { $in: sourceTables.map(t => t.id) } },
    { status: 'empty', activeOrderId: null }
  )
}

export const mergeOrdersService = async (tenantId, targetTableId, sourceTableIds = []) => {
  if (!Array.isArray(sourceTableIds) || sourceTableIds.length === 0) throw error('invalid_request', 'No source tables', 400)
  const targetTable = await Table.findOne({ _id: targetTableId, tenantId, isActive: true })
  if (!targetTable || targetTable.status !== 'occupied' || !targetTable.activeOrderId) throw error('invalid_table', 'Invalid target table', 400)
  const targetOrder = await Order.findOne({ _id: targetTable.activeOrderId, tenantId })
  if (!targetOrder || !['open', 'sent'].includes(targetOrder.status)) throw error('order_not_mergeable', 'Order not mergeable', 400)

  const sourceTables = await Table.find({ _id: { $in: sourceTableIds }, tenantId, isActive: true })
  if (sourceTables.length !== sourceTableIds.length) throw error('invalid_table', 'Invalid source table', 400)
  const invalidSource = sourceTables.find(t => t.status !== 'occupied' || !t.activeOrderId)
  if (invalidSource) throw error('invalid_table', 'Invalid source table', 400)
  const crossBranch = sourceTables.find(t => String(t.branchId) !== String(targetTable.branchId))
  if (crossBranch) throw error('forbidden', 'Cross-branch merge not allowed', 403)

  const sourceOrders = await Order.find({ _id: { $in: sourceTables.map(t => t.activeOrderId) }, tenantId })
  const badOrder = sourceOrders.find(o => !['open', 'sent'].includes(o.status))
  if (badOrder) throw error('order_not_mergeable', 'Order not mergeable', 400)

  const txnSupported = isMongoTransactionsSupported()
  if (!txnSupported) {
    logger.info('[MERGE_MODE]', {
      mode: 'fallback_force',
      reason: 'transactions_not_supported',
      tenantId,
      targetTableId,
      targetOrderId: targetOrder.id,
      sourceTableIds
    })
    await mergeOrdersFallbackAtomic(tenantId, targetOrder, sourceOrders, sourceTables)
  } else {
    logger.info('[MERGE_MODE]', {
      mode: 'txn',
      tenantId,
      targetTableId,
      targetOrderId: targetOrder.id,
      sourceTableIds
    })
    await mergeOrdersWithTransaction(tenantId, targetOrder, sourceOrders, sourceTables)
  }

  await (await import('./auditService.js')).log(
    tenantId,
    targetOrder.createdBy,
    'order_merge',
    'Order',
    targetOrder.id,
    { sourceTableIds, targetTableId }
  )
  return { success: true }
}
