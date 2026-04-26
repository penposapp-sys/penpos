import { error } from '../utils/errors.js'
import { createOrder, findByIdAndTenant, updateById } from '../repositories/orderRepository.js'
import { findByIdAndTenant as findMenuItem } from '../repositories/menuItemRepository.js'
import Order from '../models/Order.js'
import MenuItem from '../models/MenuItem.js'
import mongoose from 'mongoose'
import CustomerAccount from '../models/CustomerAccount.js'
import AccountTransaction from '../models/AccountTransaction.js'
import Table from '../models/Table.js'
import OrderCounter from '../models/OrderCounter.js'
import { isMongoTransactionsSupported } from '../config/db.js'
import * as logger from '../utils/logger.js'
import User from '../models/User.js'
import { applyBranchFilter } from '../utils/branchFilter.js'
import { computePaymentSummary } from '../utils/orderFinancial.js'
import { resolvePaymentMethodSelection } from './paymentSettingsService.js'

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

const splitQtyItemSnapshot = (item, overrides = {}) => {
  const base = typeof item?.toObject === 'function' ? item.toObject() : { ...item }
  return {
    ...base,
    ...overrides
  }
}

const normalizeLegacyItemStatuses = (order) => {
  if (!order || !Array.isArray(order.items)) return
  order.items = order.items.map(it => {
    const s = it.status
    const normalized = s === 'preparing' ? 'sent' : (s === 'ready' ? 'completed' : s)
    return { ...it, status: normalized }
  })
}

const normalizeServingType = (value) => {
  if (value === undefined || value === null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const simplified = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (simplified === 'tray' || simplified === 'plate' || simplified === 'package') return simplified
  if (simplified === 'tepside') return 'tray'
  if (simplified === 'tabakta') return 'plate'
  if (simplified === 'paket') return 'package'
  return null
}

const getDefaultServingTypeForOrder = (order) => {
  return String(order?.saleType || '').trim() === 'delivery' ? 'package' : 'plate'
}

const getEffectiveServingTypeForOrder = (order) => {
  const saleType = String(order?.saleType || '').trim()
  if (saleType === 'delivery') return 'package'
  return normalizeServingType(order?.servingType) || 'plate'
}

const buildLabelTopLine = async (order) => {
  const tableName = order?.tableId
    ? String((await Table.findById(order.tableId).select('name').lean())?.name || '')
    : ''
  const customerName = String(order?.customerName || '').trim()

  if (tableName) return tableName
  if (order?.saleType === 'delivery') return customerName ? `PAKET - ${customerName}` : 'PAKET'
  if (order?.saleType === 'walkin') return customerName || 'HIZLI'
  return 'SIPARIS'
}

const enqueueOrderItemLabels = async ({ tenantId, order, items, mode, batchId = null }) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (!order || safeItems.length === 0) return

  const { findByCodeAndScope } = await import('../repositories/printProfileRepository.js')
  const { createJob, resolveActiveStationForJob, resolveStationPrinterConfig } = await import('./printingService.js')

  const labelProfile = await findByCodeAndScope('label', tenantId, 'kermes')
  if (!labelProfile || labelProfile.isActive === false) return
  const options = labelProfile?.options && typeof labelProfile.options === 'object' ? labelProfile.options : {}
  const autoPrintOnOrder = options.autoPrintOnOrder === true
  const printOnReady = options.printOnReady === true

  if (mode === 'order_send' && !autoPrintOnOrder) {
    const activeStation = await resolveActiveStationForJob({ tenantId, system: 'kermes', jobType: 'label', jobMeta: { triggerMode: 'order_send' } })
    const hasStationLabelRule = Array.isArray(activeStation?.printers) && activeStation.printers.some((entry) => entry?.printerType === 'label' && entry?.isActive !== false && entry?.autoPrintOnOrder === true)
    if (!hasStationLabelRule) return
  }
  if (mode === 'item_ready' && !printOnReady) {
    const activeStation = await resolveActiveStationForJob({ tenantId, system: 'kermes', jobType: 'label', jobMeta: { triggerMode: 'item_ready' } })
    const hasStationLabelRule = Array.isArray(activeStation?.printers) && activeStation.printers.some((entry) => entry?.printerType === 'label' && entry?.isActive !== false && entry?.printOnReady === true)
    if (!hasStationLabelRule) return
  }

  const menuItemIds = safeItems
    .map((it) => String(it?.menuItemId || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))

  const labelEnabledDocs = menuItemIds.length > 0
    ? await MenuItem.find({ tenantId, _id: { $in: menuItemIds }, printLabelEnabled: true }).select('_id categoryId').lean()
    : []

  const labelEnabledMap = new Map((labelEnabledDocs || []).map((doc) => [String(doc?._id || ''), String(doc?.categoryId || '')]))
  const labelItems = safeItems.filter((it) => labelEnabledMap.has(String(it?.menuItemId || '')))
  if (labelItems.length === 0) return

  const top = await buildLabelTopLine(order)
  for (const it of labelItems) {
    const categoryId = labelEnabledMap.get(String(it?.menuItemId || '')) || ''
    const activeStation = await resolveActiveStationForJob({
      tenantId,
      system: 'kermes',
      jobType: 'label',
      jobMeta: { categoryId, triggerMode: mode }
    })
    const stationPrinter = activeStation
      ? resolveStationPrinterConfig({
          station: activeStation,
          jobType: 'label',
          jobMeta: { categoryId },
          triggerMode: mode
        })
      : null
    if (activeStation && !stationPrinter) continue
    const name = String(it?.nameSnapshot || '').trim() || '-'
    const qty = Math.max(1, Number(it?.qty || 1))
    const weightGrams = Math.max(0, Number(it?.weightGrams || 0))
    const isWeightBased = it?.isWeightBased === true || weightGrams > 0
    const amountLine = isWeightBased && weightGrams > 0 ? `${weightGrams} GR` : `${qty} ADET`
    const noteLine = String(it?.note || '').trim()
    const payload = `${top}\n${name}\n${amountLine}\n${noteLine ? `${noteLine}\n` : ''}`

    await createJob(tenantId, 'kermes', order.createdByUserId || order.createdBy, {
      type: 'label',
      profileId: String(labelProfile.id),
      payload: { type: 'raw', content: payload },
      meta: {
        orderId: String(order.id),
        tableId: order.tableId ? String(order.tableId) : null,
        kitchenBatchId: batchId ? String(batchId) : (it?.kitchenBatchId ? String(it.kitchenBatchId) : null),
        menuItemId: it?.menuItemId ? String(it.menuItemId) : null,
        categoryId: categoryId || null,
        itemId: it?._id ? String(it._id) : null,
        qty,
        triggerMode: mode
      }
    })
  }
}

const normalizeKitchenItemIds = (itemIds = []) => Array.isArray(itemIds)
  ? itemIds.map((id) => String(id || '').trim()).filter((id) => mongoose.Types.ObjectId.isValid(id))
  : []

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

    const fin = computePaymentSummary(order)
    const canClose = fin.netTotal <= 0 || fin.balanceDue <= 0.01
    if (canClose) {
      updates.status = order.status === 'cancelled' ? 'closed' : 'completed'
      updates.closedAt = order.closedAt || now
      updates.paymentStatus = 'paid'
      updates.paidAt = order.paidAt || now
    }
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
  if (order.cancelAlertActive === true) {
    order.cancelAlertActive = false
    await order.save()
  }
  const rawCollections = await AccountTransaction.find({
    tenantId,
    orderId: order._id,
    source: 'collection',
    type: 'credit',
    isDeleted: { $ne: true }
  }).sort({ createdAt: -1 }).lean()

  const accountIds = Array.from(new Set((rawCollections || []).map(t => String(t?.accountId || '')).filter(Boolean)))
  const accounts = accountIds.length > 0
    ? await CustomerAccount.find({ tenantId, _id: { $in: accountIds } }).select('_id name').lean()
    : []
  const accountNameById = new Map((accounts || []).map(a => [String(a?._id), String(a?.name || '').trim()]))

  const linkedCollections = (rawCollections || []).map((t) => ({
    id: String(t?._id),
    amount: Number(t?.amount) || 0,
    method: String(t?.method || 'other'),
    methodLabel: String(t?.methodLabel || t?.method || ''),
    methodBucket: String(t?.methodBucket || ''),
    note: String(t?.note || ''),
    accountId: String(t?.accountId || ''),
    accountName: accountNameById.get(String(t?.accountId || '')) || '',
    createdAt: t?.createdAt || null,
    source: 'collection'
  }))

  const obj = decorateOrder({
    ...(typeof order.toObject === 'function' ? order.toObject({ virtuals: true }) : { ...order }),
    collectionEntries: linkedCollections
  })
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
    servingType: getEffectiveServingTypeForOrder(obj),
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
    veresiyeEntries: obj.veresiyeEntries || [],
    linkedCollections,
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

export const addItemService = async (tenantId, id, menuItemId, input = 1) => {
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

  const rawQuantity = typeof input === 'object' && input !== null ? input.quantity : input
  const qty = Math.max(1, Number(rawQuantity) || 1)
  const item = await findMenuItem(menuItemId, tenantId)
  if (!item || !item.isActive) throw error('not_found', 'Menu item not found', 404)
  const price = typeof item.price === 'number' ? item.price : 0
  const isWeightBased = !!item.isWeightBased
  const rawWeightGrams = typeof input === 'object' && input !== null ? input.weightGrams : null
  const weightGrams = rawWeightGrams === undefined || rawWeightGrams === null || rawWeightGrams === ''
    ? null
    : Number(rawWeightGrams)

  if (isWeightBased) {
    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
      throw error('invalid_weight', 'Gram bilgisi gerekli', 400)
    }
  }

  const incomingNote = ''
  const existingOpen = isWeightBased
    ? null
    : order.items.find(it =>
      String(it.menuItemId) === String(menuItemId) &&
      it.status === 'open' &&
      String(it.note || '') === String(incomingNote)
    )

  const wasCompleted = order.status === 'completed'
  if (existingOpen) {
    existingOpen.qty += qty
    existingOpen.subtotal = existingOpen.qty * (existingOpen.priceSnapshot || 0)
  } else {
    const lineSubtotal = isWeightBased
      ? toMoney((toMoney(weightGrams) / 1000) * price)
      : toMoney(qty * price)
    // const now = new Date() // Not needed for open item
    const newItem = {
      menuItemId: item.id,
      nameSnapshot: item.name || 'Unknown',
      priceSnapshot: price,
      qty: isWeightBased ? 1 : qty,
      subtotal: lineSubtotal,
      isWeightBased,
      weightGrams: isWeightBased ? Math.round(weightGrams) : null,
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
  if (!['sent', 'cooking'].includes(it.status)) {
    const e = new Error('Item not in sent/cooking state')
    e.status = 400
    e.payload = { code: 'invalid_state', message: 'Item not in sent/cooking state', details: { currentStatus: it.status, allowed: ['sent', 'cooking'] } }
    throw e
  }

  let readyItem = it
  if ((Number(it.qty) || 0) > 1 && !it.isWeightBased) {
    const unitPrice = toMoney(it.priceSnapshot || 0)
    it.qty = Math.max(1, (Number(it.qty) || 0) - 1)
    it.subtotal = toMoney(it.qty * unitPrice)

    const completedClone = splitQtyItemSnapshot(it, {
      _id: new mongoose.Types.ObjectId(),
      qty: 1,
      subtotal: unitPrice,
      status: 'completed'
    })
    order.items.push(completedClone)
    readyItem = order.items[order.items.length - 1]
  } else {
    it.status = 'completed'
  }
  readyItem.status = 'completed'
  normalizeLegacyItemStatuses(order)
  await order.save()

  try {
    await enqueueOrderItemLabels({
      tenantId,
      order,
      items: [{
        _id: readyItem._id,
        menuItemId: readyItem.menuItemId,
        nameSnapshot: readyItem.nameSnapshot,
        qty: readyItem.qty,
        kitchenBatchId: readyItem.kitchenBatchId,
        isWeightBased: readyItem.isWeightBased,
        weightGrams: readyItem.weightGrams
      }],
      mode: 'item_ready',
      batchId: readyItem.kitchenBatchId || null
    })
  } catch {
  }

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const completeKitchenItemGroupService = async (tenantId, orderId, itemIds = []) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const ids = normalizeKitchenItemIds(itemIds)
  if (ids.length === 0) throw error('invalid_request', 'Invalid item ids', 400)

  const readyItems = []
  const now = new Date()
  for (const itemId of ids) {
    const it = order.items.id(itemId)
    if (!it) continue
    if (!['sent', 'cooking'].includes(it.status)) continue
    it.status = 'completed'
    if (!it.sentAt) it.sentAt = order.createdAt || now
    if (!it.kitchenSentAt) it.kitchenSentAt = it.sentAt
    readyItems.push(it)
  }

  if (readyItems.length === 0) {
    throw error('invalid_state', 'No sent/cooking items found for completion', 400)
  }

  normalizeLegacyItemStatuses(order)
  await order.save()

  try {
    const first = readyItems[0]
    const groupedLabelItem = {
      _id: first?._id,
      menuItemId: first?.menuItemId,
      nameSnapshot: first?.nameSnapshot,
      qty: readyItems.reduce((sum, item) => sum + Math.max(1, Number(item?.qty || 1)), 0),
      kitchenBatchId: first?.kitchenBatchId || null,
      isWeightBased: first?.isWeightBased === true,
      weightGrams: Math.max(0, readyItems.reduce((sum, item) => sum + (Number(item?.weightGrams || 0) || 0), 0)),
      note: String(first?.note || '')
    }

    await enqueueOrderItemLabels({
      tenantId,
      order,
      items: [groupedLabelItem],
      mode: 'item_ready',
      batchId: first?.kitchenBatchId || null
    })
  } catch {
  }

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
  it.cancelledAt = new Date()
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
    if (!['sent', 'cooking', 'completed'].includes(item.status)) {
      const e = new Error('Item not in cancellable status')
      e.status = 400
      e.payload = { error: 'invalid_state', message: 'Item not sent/cooking/completed', details: { currentStatus: item.status, allowed: ['sent', 'cooking', 'completed'] } }
      throw e
    }
    const cancelAt = new Date()
    if ((Number(item.qty) || 0) > 1 && !item.isWeightBased) {
      const unitPrice = toMoney(item.priceSnapshot || 0)
      item.qty = Math.max(1, (Number(item.qty) || 0) - 1)
      item.subtotal = toMoney(item.qty * unitPrice)

      const cancelledClone = splitQtyItemSnapshot(item, {
        _id: new mongoose.Types.ObjectId(),
        qty: 1,
        subtotal: unitPrice,
        status: 'cancelled',
        cancelledAt: cancelAt,
        note: reason || item.note || ''
      })
      order.items.push(cancelledClone)
    } else {
      item.status = 'cancelled'
      item.cancelledAt = cancelAt
      if (reason) item.note = reason
    }
    if (order.tableId) {
      order.cancelAlertActive = true
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

export const cancelKitchenItemGroupService = async ({ orderId, itemIds = [], reason, user }) => {
  const order = await findByIdAndTenant(orderId, user.tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  const ids = normalizeKitchenItemIds(itemIds)
  if (ids.length === 0) throw error('invalid_request', 'Invalid item ids', 400)

  let changed = 0
  const cancelAt = new Date()
  for (const itemId of ids) {
    const item = order.items.id(itemId)
    if (!item) continue
    if (!['sent', 'cooking', 'completed'].includes(item.status)) continue
    item.status = 'cancelled'
    item.cancelledAt = cancelAt
    if (reason) item.note = reason
    changed += 1
  }

  if (changed === 0) {
    throw error('invalid_state', 'No cancellable items found', 400)
  }

  if (order.tableId) {
    order.cancelAlertActive = true
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
  return { order: decorateOrder(freshOrder) }
}

export const setItemCookingByItemIdService = async (tenantId, id, itemId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const it = order.items.id(itemId)
  if (!it) throw error('not_found', 'Item not found', 404)
  if (it.status === 'cancelled') throw error('invalid_state', 'Item cancelled', 409)
  if (it.status === 'completed') throw error('invalid_state', 'Item completed', 409)
  if (it.status !== 'sent') {
    throw error('invalid_state', 'Item not sent', 400)
  }

  it.status = 'cooking'
  normalizeLegacyItemStatuses(order)
  await order.save()

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setKitchenItemGroupCookingService = async (tenantId, orderId, itemIds = []) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const ids = normalizeKitchenItemIds(itemIds)
  if (ids.length === 0) throw error('invalid_request', 'Invalid item ids', 400)

  let changed = 0
  for (const itemId of ids) {
    const it = order.items.id(itemId)
    if (!it) continue
    if (!['sent', 'cooking'].includes(it.status)) continue
    it.status = 'cooking'
    changed += 1
  }

  if (changed === 0) throw error('invalid_state', 'No sent items found for cooking', 400)

  normalizeLegacyItemStatuses(order)
  await order.save()

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
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
  const key = String(menuItemId)
  let idx = order.items.findIndex(it => String(it?._id || '') === key || String(it?.id || '') === key)
  if (idx === -1) {
    idx = order.items.findIndex(it => String(it.menuItemId) === key)
  }
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

export const setItemWeightByItemIdService = async (tenantId, id, itemId, weightGramsInput) => {
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
  if (!it.isWeightBased) {
    const e = new Error('Item is not weight based')
    e.status = 400
    e.payload = { error: 'invalid_weight_item', message: 'Item is not weight based' }
    throw e
  }

  const weightGrams = Math.round(Number(weightGramsInput) || 0)
  if (weightGrams <= 0) {
    const idx = order.items.findIndex(x => String(x?._id) === String(itemId))
    if (idx === -1) throw error('item_not_found', 'Item not found', 404)
    order.items.splice(idx, 1)
  } else {
    it.weightGrams = weightGrams
    it.qty = 1
    it.subtotal = toMoney((toMoney(weightGrams) / 1000) * (it.priceSnapshot || 0))
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
  const nextNote = String(note || '')
  if ((Number(it.qty) || 0) > 1 && !it.isWeightBased && String(it.note || '') !== nextNote) {
    const unitPrice = toMoney(it.priceSnapshot || 0)
    it.qty = Math.max(1, (Number(it.qty) || 0) - 1)
    it.subtotal = toMoney(it.qty * unitPrice)

    const notedClone = splitQtyItemSnapshot(it, {
      _id: new mongoose.Types.ObjectId(),
      qty: 1,
      subtotal: unitPrice,
      note: nextNote
    })
    order.items.push(notedClone)
  } else {
    it.note = nextNote
  }
  order.totals = computeTotals(order.items)
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

  const incomingServingType = servingType !== undefined ? normalizeServingType(servingType) : undefined
  if (incomingServingType !== undefined) {
    if (incomingServingType === null) {
      // no-op
    } else if (!['tray', 'plate', 'package'].includes(incomingServingType)) {
      throw error('invalid_request', 'Invalid servingType', 400)
    } else {
      order.servingType = incomingServingType
      order.servingTypeUpdatedAt = now
    }
  }

  const baseServingType = getEffectiveServingTypeForOrder(order)
  const itemServingType = (incomingServingType !== undefined && incomingServingType !== null)
    ? incomingServingType
    : baseServingType
  if (!Array.isArray(order.kitchenBatches)) order.kitchenBatches = []
  if (!order.kitchenBatches.some(b => String(b?.batchId || '') === batchId)) {
    order.kitchenBatches.push({ batchId, servingType: baseServingType, sentAt: now })
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
      it.servingType = ['tray', 'plate', 'package'].includes(itemServingType) ? itemServingType : baseServingType
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.debug('[SERVINGTYPE_DEBUG]', { orderId: String(order.id), itemId: String(it._id || ''), incoming: incomingServingType ?? null, saved: it.servingType, saleType: order.saleType })
        } catch {}
      }
      itemsToLabel.push({
        menuItemId: it.menuItemId,
        nameSnapshot: it.nameSnapshot,
        qty: it.qty,
        isWeightBased: it.isWeightBased,
        weightGrams: it.weightGrams
      })
    }
  }
  order.currentKitchenBatchId = batchId
  order.status = 'sent'
  await order.save()

  try {
    if (order.kitchenEnabled !== false && order.sendToKitchen !== false && itemsToLabel.length > 0) {
      await enqueueOrderItemLabels({ tenantId, order, items: itemsToLabel, mode: 'order_send', batchId })
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
  const resolvedMethod = await resolvePaymentMethodSelection(tenantId, order.branchId, method)
  order.payments.push({
    method: resolvedMethod.method,
    methodLabel: resolvedMethod.methodLabel,
    methodBucket: resolvedMethod.methodBucket,
    amount: payAmount,
    note: String(note || '')
  })
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
    const e = new Error('Order closed')
    e.status = 409
    e.payload = { error: 'conflict', code: 'order_closed', message: 'Sipariş kapalı' }
    throw e
  }

  const finBefore = computePaymentSummary(order)
  if (finBefore.balanceDue <= 0.01) {
    const e = new Error('Remaining is zero')
    e.status = 409
    e.payload = { error: 'conflict', code: 'remaining_zero', message: 'Kalan tutar 0, veresiye yapılamaz.' }
    throw e
  }

  const hasBodyAmount = amount !== undefined && amount !== null && String(amount).trim() !== ''
  const settleAmount = hasBodyAmount ? Number(amount) : finBefore.balanceDue
  if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
    const e = new Error('Invalid amount')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_amount', message: 'Geçersiz tutar' }
    throw e
  }
  if (settleAmount - finBefore.balanceDue > 0.01) {
    const e = new Error('Amount exceeds remaining')
    e.status = 409
    e.payload = { error: 'conflict', code: 'amount_exceeds_remaining', message: 'Girilen tutar kalan tutardan büyük.' }
    throw e
  }
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    const e = new Error('Invalid account')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_account', message: 'Cari seçimi geçersiz.' }
    throw e
  }

  const acc = await CustomerAccount.findOne({ _id: accountId, tenantId, isActive: true })
  if (!acc) {
    const e = new Error('Invalid account')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_account', message: 'Cari bulunamadı veya pasif.' }
    throw e
  }

  const now = new Date()
  const verNote = String(note || '').trim()
  const txnSupported = isMongoTransactionsSupported()

  if (txnSupported) {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await CustomerAccount.updateOne(
          { _id: acc.id, tenantId },
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

        const entries = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
        if (entries.length === 0 && order.settlementType === 'veresiye' && Number(order.veresiyeAmount || 0) > 0) {
          const legacyAccId = order.veresiyeAccountId || acc.id
          entries.push({
            accountId: legacyAccId,
            accountName: String(acc?.name || '').trim(),
            amount: Number(order.veresiyeAmount || 0),
            note: String(order.veresiyeNote || '').trim(),
            createdBy: actorUserId,
            createdAt: order.veresiyeAt || now
          })
        }
        entries.push({ accountId: acc.id, accountName: String(acc?.name || '').trim(), amount: settleAmount, note: verNote, createdBy: actorUserId, createdAt: now })
        order.veresiyeEntries = entries
        order.veresiyeAmount = entries.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0)
        order.settlementType = order.veresiyeAmount > 0 ? 'veresiye' : 'none'
        order.veresiyeAccountId = acc.id
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
    await CustomerAccount.updateOne({ _id: acc.id, tenantId }, { $inc: { balance: settleAmount } })
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

      const entries = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
      if (entries.length === 0 && order.settlementType === 'veresiye' && Number(order.veresiyeAmount || 0) > 0) {
        const legacyAccId = order.veresiyeAccountId || acc.id
        entries.push({
          accountId: legacyAccId,
          accountName: String(acc?.name || '').trim(),
          amount: Number(order.veresiyeAmount || 0),
          note: String(order.veresiyeNote || '').trim(),
          createdBy: actorUserId,
          createdAt: order.veresiyeAt || now
        })
      }
      entries.push({ accountId: acc.id, accountName: String(acc?.name || '').trim(), amount: settleAmount, note: verNote, createdBy: actorUserId, createdAt: now })
      order.veresiyeEntries = entries
      order.veresiyeAmount = entries.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0)
      order.settlementType = order.veresiyeAmount > 0 ? 'veresiye' : 'none'
      order.veresiyeAccountId = acc.id
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
        await CustomerAccount.updateOne({ _id: acc.id, tenantId }, { $inc: { balance: -settleAmount } })
      } catch {}
      throw err
    }
  }

  await (await import('./auditService.js')).log(tenantId, actorUserId, 'order_veresiye', 'Order', order.id, { accountId: acc.id, amount: settleAmount })
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const deleteOrderVeresiyeEntryService = async (tenantId, branchId, actorUserId, orderId, entryId) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order closed')
    e.status = 409
    e.payload = { error: 'conflict', code: 'order_closed', message: 'Sipariş kapalı' }
    throw e
  }

  const entries = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
  const idx = entries.findIndex(e => String(e?._id) === String(entryId))
  if (idx === -1) throw error('not_found', 'Veresiye entry not found', 404)

  const removed = entries[idx]
  const amount = Number(removed?.amount) || 0
  const accountId = removed?.accountId
  if (!accountId || !mongoose.Types.ObjectId.isValid(String(accountId)) || amount <= 0) {
    throw error('invalid_request', 'Invalid veresiye entry', 400)
  }

  const acc = await CustomerAccount.findOne({ _id: accountId, tenantId, isActive: true })
  if (!acc) {
    const e = new Error('Invalid account')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_account', message: 'Cari bulunamadı veya pasif.' }
    throw e
  }

  const now = new Date()
  const txnSupported = isMongoTransactionsSupported()
  const applyOrderUpdate = async (session) => {
    const list = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
    const i = list.findIndex(e => String(e?._id) === String(entryId))
    if (i === -1) throw error('not_found', 'Veresiye entry not found', 404)
    list.splice(i, 1)
    order.veresiyeEntries = list
    order.veresiyeAmount = list.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0)
    order.settlementType = order.veresiyeAmount > 0 ? 'veresiye' : 'none'
    if (order.veresiyeAmount <= 0) {
      order.veresiyeAccountId = null
      order.veresiyeNote = ''
      order.veresiyeAt = null
    }
    const finAfter = computePaymentSummary(order)
    if (finAfter.netTotal > 0 && finAfter.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || now
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
    if (session) await order.save({ session })
    else await order.save()
  }

  if (txnSupported) {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await CustomerAccount.updateOne(
          { _id: acc.id, tenantId },
          { $inc: { balance: -amount } },
          { session }
        )
        await AccountTransaction.create([
          {
            tenantId,
            branchId,
            accountId: acc.id,
            type: 'credit',
            amount,
            method: 'other',
            note: `Veresiye silindi${removed?.note ? `: ${String(removed.note).trim()}` : ''}`,
            source: 'order_veresiye_delete',
            orderId: order.id
          }
        ], { session })
        await applyOrderUpdate(session)
      })
    } finally {
      await session.endSession().catch(() => {})
    }
  } else {
    await CustomerAccount.updateOne({ _id: acc.id, tenantId }, { $inc: { balance: -amount } })
    await AccountTransaction.create({
      tenantId,
      branchId,
      accountId: acc.id,
      type: 'credit',
      amount,
      method: 'other',
      note: `Veresiye silindi${removed?.note ? `: ${String(removed.note).trim()}` : ''}`,
      source: 'order_veresiye_delete',
      orderId: order.id
    })
    await applyOrderUpdate(undefined)
  }

  await (await import('./auditService.js')).log(tenantId, actorUserId, 'order_veresiye_delete', 'Order', order.id, { entryId: String(entryId), amount })
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const deleteOrderCollectionTransactionService = async (tenantId, orderId, txId) => {
  if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
    throw error('invalid_request', 'Invalid orderId', 400)
  }
  if (!mongoose.Types.ObjectId.isValid(String(txId))) {
    throw error('invalid_request', 'Invalid transaction id', 400)
  }

  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'conflict', code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  const branchId = order.branchId
  if (!branchId) throw error('invalid_request', 'Order branch required', 400)

  const computeAccountBalance = async (accountId, session) => {
    const cursor = AccountTransaction.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          accountId: new mongoose.Types.ObjectId(accountId),
          isDeleted: { $ne: true }
        }
      },
      { $group: { _id: '$type', sum: { $sum: '$amount' } } }
    ])
    if (session) cursor.session(session)
    const rows = await cursor
    const debit = rows.find(r => r._id === 'debit')?.sum || 0
    const credit = rows.find(r => r._id === 'credit')?.sum || 0
    return toMoney(debit) - toMoney(credit)
  }

  const runFallback = async () => {
    const tx = await AccountTransaction.findOne({ _id: txId, tenantId })
    if (!tx) throw error('not_found', 'Transaction not found', 404)
    if (tx.isDeleted) throw error('already_deleted', 'Transaction already deleted', 409)
    if (!(tx.source === 'collection' && tx.type === 'credit')) {
      throw error('invalid_request', 'Only collection transactions can be deleted', 409)
    }
    if (String(tx.orderId || '') !== String(order._id)) {
      throw error('payment_locked', 'Bu tahsilat bu siparişe bağlı değil', 409)
    }

    const deletedTx = await AccountTransaction.findOneAndUpdate(
      { _id: txId, tenantId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    )
    if (!deletedTx) throw error('already_deleted', 'Transaction already deleted', 409)

    const nextBalance = await computeAccountBalance(tx.accountId)
    const acc = await CustomerAccount.findOneAndUpdate(
      { _id: tx.accountId, tenantId },
      { $set: { balance: nextBalance } },
      { new: true }
    )
    if (!acc) throw error('account_not_found_after_delete', 'Account not found', 409)

    const dto = await getOrderService(tenantId, orderId)
    return { success: true, order: dto, txId: deletedTx.id, accountId: acc.id }
  }

  const supported = isMongoTransactionsSupported()
  if (!supported) return runFallback()

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const tx = await AccountTransaction.findOne({ _id: txId, tenantId }).session(session)
      if (!tx) throw error('not_found', 'Transaction not found', 404)
      if (tx.isDeleted) throw error('already_deleted', 'Transaction already deleted', 409)
      if (!(tx.source === 'collection' && tx.type === 'credit')) {
        throw error('invalid_request', 'Only collection transactions can be deleted', 409)
      }
      if (String(tx.orderId || '') !== String(order._id)) {
        throw error('payment_locked', 'Bu tahsilat bu siparişe bağlı değil', 409)
      }

      const acc = await CustomerAccount.findOne({ _id: tx.accountId, tenantId }).session(session)
      if (!acc) throw error('not_found', 'Account not found', 404)

      tx.isDeleted = true
      tx.deletedAt = new Date()
      await tx.save({ session })

      acc.balance = await computeAccountBalance(tx.accountId, session)
      await acc.save({ session })
    })
  } catch (err) {
    const msg = String(err?.message || '')
    if (msg.includes('Transaction numbers are only allowed')) {
      return runFallback()
    }
    throw err
  } finally {
    await session.endSession().catch(() => {})
  }

  const dto = await getOrderService(tenantId, orderId)
  return { success: true, order: dto, txId: String(txId) }
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

  const resolvedMethod = await resolvePaymentMethodSelection(tenantId, order.branchId, paymentMethod)
  order.payments.push({
    amount: payAmount,
    method: resolvedMethod.method,
    methodLabel: resolvedMethod.methodLabel,
    methodBucket: resolvedMethod.methodBucket,
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
    items: { $elemMatch: { status: { $in: ['sent', 'cooking'] } } }
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
        if ((it.status === 'sent' || it.status === 'cooking') && !it.sentAt) {
          it.sentAt = baseCreatedAt
        }
        if ((it.status === 'sent' || it.status === 'cooking') && !it.kitchenSentAt) {
          it.kitchenSentAt = it.sentAt || baseCreatedAt
        }
      }

      const byBatch = new Map()
      for (const it of rawItems) {
        if (!it) continue
        if (it.status !== 'sent' && it.status !== 'cooking' && it.status !== 'completed' && it.status !== 'cancelled') continue
        const rawBatchId = it.kitchenBatchId ? String(it.kitchenBatchId) : ''
        const key = rawBatchId || '__legacy__'
        const meta = rawBatchId ? batchMetaMap.get(rawBatchId) : null
        const orderServing = getEffectiveServingTypeForOrder(o)
        const fallbackServing = meta?.servingType ? (normalizeServingType(meta.servingType) || orderServing) : orderServing
        it.servingType = normalizeServingType(it.servingType) || fallbackServing
        const entry = byBatch.get(key) || {
          batchId: rawBatchId || null,
          servingType: normalizeServingType(meta?.servingType) || fallbackServing,
          batchSentAt: meta?.sentAt ?? null,
          sentAt: meta?.sentAt ?? null,
          items: [],
          hasActiveItems: false
        }
        entry.items.push(it)
        if (it.status === 'sent' || it.status === 'cooking') entry.hasActiveItems = true
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
        servingType: getEffectiveServingTypeForOrder(o),
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
    if (!['sent', 'cooking'].includes(it.status)) continue
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

const normalizeMergedItem = (item) => {
  const qty = toMoney(item?.qty ?? item?.quantity)
  const price = toMoney(item?.priceSnapshot ?? item?.price)
  const subtotal = toMoney(qty * price)
  return {
    ...item,
    qty,
    priceSnapshot: price,
    subtotal
  }
}

const mergeItems = (targetItems, sourceItems) => {
  const targetList = Array.isArray(targetItems) ? targetItems : []
  const sourceList = Array.isArray(sourceItems) ? sourceItems : []
  return [...targetList, ...sourceList].map(normalizeMergedItem)
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
