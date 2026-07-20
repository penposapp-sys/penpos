import mongoose from 'mongoose'
import AccountTransaction from '../models/AccountTransaction.js'
import Order from '../models/Order.js'
import User from '../models/User.js'
import { applyBranchFilter } from '../utils/branchFilter.js'
import { error } from '../utils/errors.js'
import { computePaymentSummary } from '../utils/orderFinancial.js'
import { notifyCourierAssigned } from './pushNotificationService.js'

const PACKAGE_STATUS_LABELS = {
  yeni: 'Yeni Sipariş',
  hazirlaniyor: 'Hazırlanıyor',
  hazir: 'Hazır',
  kuryeye_atandi: 'Kuryeye Atandı',
  yola_cikti: 'Yola Çıktı',
  teslim_edildi: 'Teslim Edildi',
  iptal_edildi: 'İptal Edildi',
  musteriyi_bulamadi: 'Müşteriye Ulaşılamadı',
  adreste_yok: 'Adreste Yok',
  geri_dondu: 'Geri Döndü'
}

const PACKAGE_PAYMENT_STATUS_LABELS = {
  odeme_bekliyor: 'Ödeme Bekliyor',
  odeme_alindi: 'Ödeme Alındı',
  veresiye: 'Veresiye',
  online_odendi: 'Online Ödendi',
  iade_edildi: 'İade Edildi'
}

const MANAGER_PERMISSIONS = new Set([
  'package_assign_courier',
  'package_cancel',
  'courier_reports_view'
])

const COURIER_ALLOWED_STATUSES = new Set(['yola_cikti', 'teslim_edildi', 'musteriyi_bulamadi', 'adreste_yok', 'geri_dondu'])
const COURIER_ALLOWED_PAYMENT_STATUSES = new Set(['odeme_alindi', 'odeme_bekliyor'])
const ALL_PACKAGE_STATUSES = new Set(Object.keys(PACKAGE_STATUS_LABELS))
const ALL_PAYMENT_STATUSES = new Set(Object.keys(PACKAGE_PAYMENT_STATUS_LABELS))

const normalizeText = (value) => String(value || '').trim()
const normalizeSearch = (value) => normalizeText(value).toLocaleLowerCase('tr-TR')
const getUserActorId = (user) => String(user?.id || user?._id || '').trim()

const buildCourierMatch = (courierId) => {
  const raw = String(courierId || '').trim()
  if (!raw) return null
  const clauses = [{ courierId: raw }]
  if (mongoose.Types.ObjectId.isValid(raw)) {
    clauses.push({ courierId: new mongoose.Types.ObjectId(raw) })
  }
  return clauses.length === 1 ? clauses[0] : { $or: clauses }
}

const hasPermission = (user, permission) => {
  if (!user) return false
  if (user.role === 'tenant_admin' || user.role === 'superadmin') return true
  const perms = Array.isArray(user.permissions) ? user.permissions : []
  return perms.includes(permission)
}

const canManageAllPackageOrders = (user) => {
  if (!user) return false
  if (user.role === 'tenant_admin' || user.role === 'superadmin') return true
  const perms = Array.isArray(user.permissions) ? user.permissions : []
  return perms.some((permission) => MANAGER_PERMISSIONS.has(permission))
}

const canCollectPayment = (user) => {
  if (!user) return false
  if (user.role === 'tenant_admin' || user.role === 'superadmin') return true
  const perms = Array.isArray(user.permissions) ? user.permissions : []
  return perms.includes('take_payment')
}

const computeOrderCollectionTotal = async (tenantId, orderId, accountId = '') => {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) return 0
  const filter = {
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    orderId: new mongoose.Types.ObjectId(String(orderId)),
    source: 'collection',
    type: 'credit',
    isDeleted: { $ne: true }
  }
  if (accountId && mongoose.Types.ObjectId.isValid(String(accountId))) {
    filter.accountId = new mongoose.Types.ObjectId(String(accountId))
  }
  const rows = await AccountTransaction.aggregate([
    { $match: filter },
    { $group: { _id: null, sum: { $sum: '$amount' } } }
  ])
  return Number(rows?.[0]?.sum || 0) || 0
}

const toLegacyDeliveryStatus = (status) => {
  switch (status) {
    case 'yeni': return 'pending'
    case 'hazirlaniyor': return 'preparing'
    case 'hazir': return 'ready'
    case 'kuryeye_atandi': return 'ready'
    case 'yola_cikti': return 'ready'
    case 'teslim_edildi': return 'delivered'
    case 'iptal_edildi': return 'cancelled'
    case 'musteriyi_bulamadi': return 'cancelled'
    case 'adreste_yok': return 'cancelled'
    case 'geri_dondu': return 'cancelled'
    default: return ''
  }
}

const derivePreparationStatus = (order) => {
  const items = Array.isArray(order?.items) ? order.items.filter((item) => item?.status !== 'cancelled') : []
  if (items.length === 0) return 'new'

  const statuses = items.map((item) => normalizeText(item?.status))
  if (statuses.every((status) => status === 'completed')) return 'ready'
  if (statuses.some((status) => ['sent', 'cooking', 'completed', 'preparing'].includes(status))) return 'preparing'
  return 'new'
}

const normalizePackageStatus = (order) => {
  const direct = normalizeText(order?.deliveryStatus)
  const preparationStatus = derivePreparationStatus(order)
  const hasCourier = Boolean(order?.courierId)
  const paymentSettled = isPackagePaymentSettled(order)

  if (['kuryeye_atandi', 'yola_cikti', 'teslim_edildi', 'iptal_edildi', 'musteriyi_bulamadi', 'adreste_yok', 'geri_dondu'].includes(direct)) {
    if (direct === 'teslim_edildi' && !paymentSettled) return 'yola_cikti'
    return direct
  }
  if (direct === 'hazir') return hasCourier ? 'kuryeye_atandi' : 'hazir'
  if (direct === 'hazirlaniyor') return preparationStatus === 'ready' ? (hasCourier ? 'kuryeye_atandi' : 'hazir') : 'hazirlaniyor'
  if (direct === 'yeni') {
    if (preparationStatus === 'ready') return hasCourier ? 'kuryeye_atandi' : 'hazir'
    if (preparationStatus === 'preparing') return 'hazirlaniyor'
    return 'yeni'
  }
  if (ALL_PACKAGE_STATUSES.has(direct)) return direct
  switch (direct) {
    case 'pending': return 'yeni'
    case 'accepted': return 'yeni'
    case 'preparing': return preparationStatus === 'ready' ? (hasCourier ? 'kuryeye_atandi' : 'hazir') : 'hazirlaniyor'
    case 'ready': return hasCourier ? 'kuryeye_atandi' : 'hazir'
    case 'delivered': return paymentSettled ? 'teslim_edildi' : 'yola_cikti'
    case 'cancelled': return 'iptal_edildi'
    default:
      if (preparationStatus === 'ready') return hasCourier ? 'kuryeye_atandi' : 'hazir'
      if (preparationStatus === 'preparing') return 'hazirlaniyor'
      if (hasCourier) return 'kuryeye_atandi'
      return 'yeni'
  }
}

const normalizePackagePaymentStatus = (order) => {
  const direct = normalizeText(order?.deliveryPaymentStatus)
  if (ALL_PAYMENT_STATUSES.has(direct)) return direct
  if (direct === 'already_paid') return 'online_odendi'
  if (direct === 'pay_on_delivery') return String(order?.paymentStatus || '') === 'paid' ? 'odeme_alindi' : 'odeme_bekliyor'
  if (String(order?.settlementType || '') === 'veresiye') return 'veresiye'
  if (String(order?.paymentStatus || '') === 'paid') return 'odeme_alindi'
  return 'odeme_bekliyor'
}

const normalizeApprovalStatus = (order) => {
  const status = normalizeText(order?.approvalStatus)
  if (status === 'pending' || status === 'approved' || status === 'rejected') return status
  return 'none'
}

const ensurePackageOrder = (order) => {
  if (!order) throw error('not_found', 'Sipariş bulunamadı', 404)
  const saleType = normalizeText(order.saleType)
  const deliveryType = normalizeText(order.deliveryType)
  if (saleType !== 'delivery' && deliveryType !== 'package') {
    throw error('invalid_request', 'Bu sipariş paket sipariş değil', 400)
  }
}

const getAddressSnapshot = (order) => {
  const deliveryAddress = order?.deliveryAddress && typeof order.deliveryAddress === 'object' ? order.deliveryAddress : {}
  return {
    fullName: normalizeText(deliveryAddress.fullName) || normalizeText(order?.customerName),
    phone: normalizeText(deliveryAddress.phone) || normalizeText(order?.customerPhone),
    addressText: normalizeText(deliveryAddress.addressText) || normalizeText(order?.customerAddress),
    district: normalizeText(deliveryAddress.district),
    neighborhood: normalizeText(deliveryAddress.neighborhood),
    note: normalizeText(deliveryAddress.note) || normalizeText(order?.deliveryNote),
    mapUrl: normalizeText(deliveryAddress.mapUrl),
    latitude: Number.isFinite(Number(deliveryAddress.latitude)) ? Number(deliveryAddress.latitude) : null,
    longitude: Number.isFinite(Number(deliveryAddress.longitude)) ? Number(deliveryAddress.longitude) : null
  }
}

const computeTotals = (order) => {
  const total = Number(order?.netTotal ?? order?.totals?.grandTotal ?? order?.totals?.netTotal ?? order?.totals?.total ?? order?.total ?? 0)
  return Number.isFinite(total) ? total : 0
}

const withCollectionEntries = (order) => {
  if (!order) return order
  const collectionEntries = Array.isArray(order?.collectionEntries)
    ? order.collectionEntries
    : (Array.isArray(order?.linkedCollections) ? order.linkedCollections : [])
  return { ...order, collectionEntries }
}

const isPackagePaymentSettled = (order) => {
  if (String(order?.paymentStatus || '').trim() === 'paid') return true
  const summary = computePaymentSummary(withCollectionEntries(order))
  return Number(summary?.balanceDue || 0) <= 0.01
}

const isDeliveredPendingPayment = (order) => {
  const direct = normalizeText(order?.deliveryStatus)
  if (direct !== 'teslim_edildi') return false
  return !isPackagePaymentSettled(order)
}

const mapOrder = (order) => {
  const status = normalizePackageStatus(order)
  const paymentStatus = normalizePackagePaymentStatus(order)
  const address = getAddressSnapshot(order)
  const paymentSummary = computePaymentSummary(withCollectionEntries(order))
  const deliveredPendingPayment = isDeliveredPendingPayment(order)
  const items = Array.isArray(order?.items) ? order.items : []
  const visibleItems = items.filter((item) => item?.status !== 'cancelled')
  const itemsSummary = visibleItems
    .slice(0, 3)
    .map((item) => {
      const qty = Math.max(1, Number(item?.qty || 1))
      const name = normalizeText(item?.nameSnapshot || item?.productName)
      return name ? `${qty}x ${name}` : ''
    })
    .filter(Boolean)
    .join(', ')
  return {
    id: String(order?._id || order?.id || ''),
    _id: String(order?._id || order?.id || ''),
    orderNo: order?.orderNo ?? null,
    orderDayKey: order?.orderDayKey || '',
    branchId: order?.branchId ? String(order.branchId) : null,
    branchName: normalizeText(order?.branchName),
    saleType: 'delivery',
    deliveryType: normalizeText(order?.deliveryType) || 'package',
    customerName: normalizeText(order?.customerName) || address.fullName,
    customerPhone: normalizeText(order?.customerPhone) || address.phone,
    customerAddress: normalizeText(order?.customerAddress) || address.addressText,
    deliveryAddress: address,
    deliveryNote: normalizeText(order?.deliveryNote),
    note: normalizeText(order?.note),
    courierId: order?.courierId ? String(order.courierId) : null,
    courierName: normalizeText(order?.courierName),
    courierAssignedAt: order?.courierAssignedAt || null,
    courierDepartedAt: order?.courierDepartedAt || null,
    deliveredAt: order?.deliveredAt || null,
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
    deliveryStatus: status,
    deliveryStatusLabel: deliveredPendingPayment ? 'Teslim Edildi - Odeme Bekliyor' : (PACKAGE_STATUS_LABELS[status] || status),
    deliveryCompletedPendingPayment: deliveredPendingPayment,
    orderChannel: normalizeText(order?.orderChannel) || 'manual',
    approvalStatus: normalizeApprovalStatus(order),
    cancelRequestStatus: normalizeText(order?.cancelRequestStatus) || 'none',
    preparationStatus: derivePreparationStatus(order),
    deliveryPaymentStatus: paymentStatus,
    deliveryPaymentStatusLabel: PACKAGE_PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus,
    paymentMethod: normalizeText(order?.paymentMethod),
    deliveryPaymentMethod: normalizeText(order?.deliveryPaymentMethod),
    deliveryPaymentMethodLabel: normalizeText(order?.deliveryPaymentMethodLabel),
    paymentStatus: normalizeText(order?.paymentStatus),
    status: normalizeText(order?.status),
    total: computeTotals(order),
    netTotal: computeTotals(order),
    paidTotal: Number(paymentSummary?.paidTotal || 0),
    balanceDue: Number(paymentSummary?.balanceDue || 0),
    payments: Array.isArray(order?.payments) ? order.payments : [],
    items,
    itemsSummary,
    itemCount: visibleItems.length,
    deliveryEvents: Array.isArray(order?.deliveryEvents) ? order.deliveryEvents : []
  }
}

const attachCollectionEntries = async (tenantId, orders = []) => {
  const list = Array.isArray(orders) ? orders.filter(Boolean) : []
  const orderIds = list
    .map((order) => String(order?._id || order?.id || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
  if (orderIds.length === 0) return list

  const rows = await AccountTransaction.find({
    tenantId,
    orderId: { $in: orderIds.map((id) => new mongoose.Types.ObjectId(id)) },
    source: 'collection',
    type: 'credit',
    isDeleted: { $ne: true }
  })
    .select('_id orderId amount method methodId methodLabel methodName methodBucket methodType note createdAt')
    .lean()

  const byOrderId = new Map()
  for (const row of rows) {
    const key = String(row?.orderId || '').trim()
    if (!key) continue
    const current = byOrderId.get(key) || []
    current.push({
      id: String(row?._id || ''),
      amount: Number(row?.amount || 0) || 0,
      method: String(row?.method || 'other'),
      methodId: String(row?.methodId || ''),
      methodLabel: String(row?.methodLabel || row?.method || ''),
      methodName: String(row?.methodName || ''),
      methodBucket: String(row?.methodBucket || ''),
      methodType: String(row?.methodType || ''),
      note: String(row?.note || ''),
      createdAt: row?.createdAt || null,
      source: 'collection'
    })
    byOrderId.set(key, current)
  }

  return list.map((order) => ({
    ...order,
    collectionEntries: byOrderId.get(String(order?._id || order?.id || '').trim()) || []
  }))
}

const buildSearchPredicate = (search) => {
  const q = normalizeSearch(search)
  if (!q) return null
  return (order) => {
    const address = getAddressSnapshot(order)
    const haystack = [
      order?.customerName,
      order?.customerPhone,
      order?.customerAddress,
      address.addressText,
      address.neighborhood,
      address.district,
      order?.courierName,
      order?.orderNo
    ].map(normalizeSearch).join(' ')
    return haystack.includes(q)
  }
}

const appendDeliveryEvent = (order, payload) => {
  const list = Array.isArray(order.deliveryEvents) ? order.deliveryEvents : []
  order.deliveryEvents = [
    ...list,
    {
      type: payload.type || 'status_change',
      oldStatus: payload.oldStatus || '',
      newStatus: payload.newStatus || '',
      userId: payload.userId || null,
      userName: payload.userName || '',
      note: payload.note || '',
      createdAt: new Date()
    }
  ]
}

const assertPackageOrderAccess = (user, order, { allowManager = true } = {}) => {
  ensurePackageOrder(order)
  if (allowManager && canManageAllPackageOrders(user)) return
  if (String(order?.courierId || '') !== getUserActorId(user)) {
    throw error('forbidden', 'Bu siparişe erişim yetkiniz yok', 403)
  }
}

export const listPackageOrdersService = async (tenantId, user, branchIds = [], filters = {}) => {
  const canManageAll = canManageAllPackageOrders(user)
  let query = {
    tenantId,
    saleType: 'delivery',
    $or: [
      { deliveryType: 'package' },
      { deliveryType: null },
      { deliveryType: { $exists: false } }
    ]
  }
  if (canManageAll) {
    query = applyBranchFilter(query, branchIds)
  }
  if (!canManageAll) {
    const actorId = getUserActorId(user)
    if (!mongoose.Types.ObjectId.isValid(actorId)) throw error('forbidden', 'Kurye kullanıcı bilgisi geçersiz', 403)
    const courierMatch = buildCourierMatch(actorId)
    query = { $and: [query, courierMatch] }
  }
  if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
    if (canManageAll) {
      query.branchId = new mongoose.Types.ObjectId(String(filters.branchId))
    }
  }
  if (filters.courierId && mongoose.Types.ObjectId.isValid(filters.courierId)) {
    if (!canManageAll && String(filters.courierId) !== getUserActorId(user)) {
      throw error('forbidden', 'Başka kuryenin siparişlerini göremezsiniz', 403)
    }
    const courierMatch = buildCourierMatch(String(filters.courierId))
    query = { $and: [query, courierMatch] }
  }
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00.000`)
    const end = new Date(`${filters.date}T23:59:59.999`)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      query.createdAt = { $gte: start, $lte: end }
    }
  }

  const rawOrders = await Order.find(query).sort({ createdAt: -1 }).lean()
  const orders = await attachCollectionEntries(tenantId, rawOrders)
  const searchPredicate = buildSearchPredicate(filters.search)
  const filtered = orders
    .filter((order) => {
      if (normalizeApprovalStatus(order) === 'pending') return false
      const deliveryStatus = normalizePackageStatus(order)
      const paymentStatus = normalizePackagePaymentStatus(order)
      if (!filters.status && ['iptal_edildi', 'musteriyi_bulamadi', 'adreste_yok', 'geri_dondu'].includes(deliveryStatus)) return false
      if (filters.status && filters.status !== deliveryStatus) return false
      if (filters.paymentStatus && filters.paymentStatus !== paymentStatus) return false
      if (searchPredicate && !searchPredicate(order)) return false
      return true
    })
    .map(mapOrder)

  return { orders: filtered, total: filtered.length }
}

export const countPendingOnlineOrdersService = async (tenantId, branchIds = []) => {
  let query = {
    tenantId,
    saleType: 'delivery',
    deliveryType: 'package',
    orderChannel: 'online',
    approvalStatus: 'pending',
    status: { $nin: ['cancelled', 'closed'] }
  }
  query = applyBranchFilter(query, branchIds)
  const count = await Order.countDocuments(query)
  return { count }
}

export const listCouriersService = async (tenantId) => {
  const users = await User.find({
    tenantId,
    role: 'staff',
    isDeleted: { $ne: true },
    isActive: true,
    permissions: { $in: ['package_courier_page_view', 'package_orders_view', 'package_status_update'] }
  }).select('_id name branchId branchIds accessibleBranchIds permissions').sort({ name: 1 }).lean()

  return users.map((user) => ({
    id: String(user._id),
    _id: String(user._id),
    name: normalizeText(user.name),
    branchId: user?.branchId ? String(user.branchId) : null,
    branchIds: Array.isArray(user?.accessibleBranchIds) ? user.accessibleBranchIds.map(String) : (Array.isArray(user?.branchIds) ? user.branchIds.map(String) : []),
    permissions: Array.isArray(user?.permissions) ? user.permissions : []
  }))
}

export const getPackageOrderDetailService = async (tenantId, user, orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw error('invalid_request', 'Geçersiz sipariş id', 400)
  const order = await Order.findOne({ _id: orderId, tenantId }).lean()
  assertPackageOrderAccess(user, order)

  const { getOrderService } = await import('./orderService.js')
  const detail = await getOrderService(tenantId, orderId)
  const [orderWithCollections] = await attachCollectionEntries(tenantId, [order])
  const mapped = mapOrder(orderWithCollections)

  return {
    order: {
      ...detail,
      ...mapped,
      total: Number(detail?.total ?? mapped.total ?? 0),
      netTotal: Number(detail?.netTotal ?? mapped.netTotal ?? 0),
      paidTotal: Number(detail?.paidTotal ?? mapped.paidTotal ?? 0),
      balanceDue: Number(detail?.balanceDue ?? mapped.balanceDue ?? 0)
    }
  }
}

export const collectPackageOrderPaymentService = async (tenantId, user, orderId, payload = {}) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw error('invalid_request', 'Geçersiz sipariş id', 400)
  if (!canCollectPayment(user)) throw error('forbidden', 'Ödeme alma yetkiniz yok', 403)
  const order = await Order.findOne({ _id: orderId, tenantId })
  assertPackageOrderAccess(user, order)

  const previousPaymentStatus = normalizePackagePaymentStatus(order)
  const { addOrderPaymentService } = await import('./orderService.js')
  await addOrderPaymentService(tenantId, orderId, {
    method: payload?.method,
    amount: payload?.amount,
    note: payload?.note,
    cashierId: user?.id || user?._id || null,
    entryDate: payload?.entryDate
  })

  const refreshed = await Order.findOne({ _id: orderId, tenantId })
  refreshed.deliveryType = 'package'
  refreshed.deliveryPaymentStatus = String(refreshed?.paymentStatus || '') === 'paid' ? 'odeme_alindi' : 'odeme_bekliyor'
  if (String(refreshed?.paymentStatus || '') === 'paid' && refreshed.deliveredAt) {
    refreshed.deliveryStatus = 'teslim_edildi'
    refreshed.status = refreshed.status === 'cancelled' ? refreshed.status : 'completed'
  }
  appendDeliveryEvent(refreshed, {
    type: 'payment_collected',
    oldStatus: previousPaymentStatus,
    newStatus: normalizePackagePaymentStatus(refreshed),
    userId: getUserActorId(user),
    userName: user.name,
    note: normalizeText(payload?.note)
  })
  await refreshed.save()
  return getPackageOrderDetailService(tenantId, user, orderId)
}

export const assignCourierService = async (tenantId, user, orderId, courierId) => {
  if (!hasPermission(user, 'package_assign_courier') && !canManageAllPackageOrders(user)) {
    throw error('forbidden', 'Kurye atama yetkiniz yok', 403)
  }
  if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(courierId)) {
    throw error('invalid_request', 'Geçersiz id', 400)
  }
  const [order, courier] = await Promise.all([
    Order.findOne({ _id: orderId, tenantId }),
    User.findOne({ _id: courierId, tenantId, isDeleted: { $ne: true }, isActive: true }).lean()
  ])
  ensurePackageOrder(order)
  if (!courier) throw error('not_found', 'Kurye bulunamadı', 404)
  if (normalizeText(order?.orderChannel) === 'online' && normalizeApprovalStatus(order) !== 'approved') {
    throw error('invalid_request', 'Onaylanmayan online siparise kurye atanamaz', 400)
  }

  const oldStatus = normalizePackageStatus(order)
  order.deliveryType = 'package'
  order.courierId = courier._id
  order.courierName = normalizeText(courier.name)
  order.courierAssignedAt = new Date()
  order.deliveryStatus = 'kuryeye_atandi'
  appendDeliveryEvent(order, {
    type: order.courierName ? 'courier_changed' : 'courier_assigned',
    oldStatus,
    newStatus: 'kuryeye_atandi',
    userId: user.id,
    userName: user.name,
    note: normalizeText(courier.name)
  })
  await order.save()
  try {
    await notifyCourierAssigned({ courierUserId: courier._id, order })
  } catch {
  }
  return { order: mapOrder(order) }
}

export const approveOnlinePackageOrderService = async (tenantId, user, orderId) => {
  if (!canManageAllPackageOrders(user)) {
    throw error('forbidden', 'Online siparis onaylama yetkiniz yok', 403)
  }
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw error('invalid_request', 'Geçersiz sipariş id', 400)

  const order = await Order.findOne({ _id: orderId, tenantId })
  ensurePackageOrder(order)

  if (normalizeText(order?.orderChannel) !== 'online') {
    throw error('invalid_request', 'Bu siparis online siparis degil', 400)
  }
  if (normalizeApprovalStatus(order) !== 'pending') {
    throw error('invalid_request', 'Siparis zaten onaylanmis veya islenmis', 400)
  }

  order.approvalStatus = 'approved'
  order.deliveryStatus = 'accepted'
  appendDeliveryEvent(order, {
    type: 'online_order_approved',
    oldStatus: 'pending',
    newStatus: 'approved',
    userId: getUserActorId(user),
    userName: user.name
  })
  await order.save()

  const { sendOrderService } = await import('./orderService.js')
  const result = await sendOrderService(tenantId, String(order._id), { servingType: 'package', kitchenEnabled: true })
  return { order: mapOrder(result?.order || order) }
}

export const approveOnlineCancelRequestService = async (tenantId, user, orderId) => {
  if (!canManageAllPackageOrders(user)) {
    throw error('forbidden', 'Online siparis iptal onayi yetkiniz yok', 403)
  }
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw error('invalid_request', 'Gecersiz siparis id', 400)

  const order = await Order.findOne({ _id: orderId, tenantId })
  ensurePackageOrder(order)

  if (normalizeText(order?.orderChannel) !== 'online') {
    throw error('invalid_request', 'Bu siparis online siparis degil', 400)
  }
  if (normalizeText(order?.cancelRequestStatus) !== 'pending') {
    throw error('invalid_request', 'Bekleyen iptal talebi yok', 400)
  }

  const oldStatus = String(order?.deliveryStatus || '')
  order.cancelRequestStatus = 'approved'
  order.deliveryStatus = 'iptal_edildi'
  order.status = 'cancelled'
  order.approvalStatus = order.approvalStatus === 'pending' ? 'rejected' : order.approvalStatus
  order.closedAt = order.closedAt || new Date()
  ;(Array.isArray(order.items) ? order.items : []).forEach((item) => {
    if (!['completed', 'cancelled'].includes(String(item?.status || ''))) item.status = 'cancelled'
    item.cancelReason = String(item?.cancelReason || '') || 'Online iptal talebi onaylandi'
    item.cancelledAt = item?.cancelledAt || new Date()
  })
  appendDeliveryEvent(order, {
    type: 'online_cancel_approved',
    oldStatus,
    newStatus: 'iptal_edildi',
    userId: getUserActorId(user),
    userName: user.name,
    note: 'Online iptal talebi onaylandi'
  })
  await order.save()
  return { order: mapOrder(order) }
}

export const updatePackageOrderStatusService = async (tenantId, user, orderId, deliveryStatus, note = '') => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw error('invalid_request', 'Geçersiz sipariş id', 400)
  const order = await Order.findOne({ _id: orderId, tenantId })
  assertPackageOrderAccess(user, order)
  if (normalizeText(order?.orderChannel) === 'online' && normalizeApprovalStatus(order) !== 'approved') {
    throw error('invalid_request', 'Onaylanmayan online siparisin durumu degistirilemez', 400)
  }

  const nextStatus = normalizeText(deliveryStatus)
  if (!ALL_PACKAGE_STATUSES.has(nextStatus)) throw error('invalid_request', 'Geçersiz teslimat durumu', 400)

  const canManageAll = canManageAllPackageOrders(user)
  if (!canManageAll && !COURIER_ALLOWED_STATUSES.has(nextStatus)) {
    throw error('forbidden', 'Bu teslimat durumunu güncelleyemezsiniz', 403)
  }
  if (!canManageAll && String(order.courierId || '') !== getUserActorId(user)) {
    throw error('forbidden', 'Sadece kendi siparişinizi güncelleyebilirsiniz', 403)
  }

  const oldStatus = normalizePackageStatus(order)
  order.deliveryType = 'package'
  if (nextStatus === 'yola_cikti' && !order.courierDepartedAt) order.courierDepartedAt = new Date()
  if (nextStatus === 'teslim_edildi') {
    const now = new Date()
    order.deliveredAt = order.deliveredAt || now
    order.deliveryAt = order.deliveryAt || now
    if (String(order?.paymentStatus || '') === 'paid') {
      order.deliveryStatus = 'teslim_edildi'
      order.status = order.status === 'cancelled' ? order.status : 'completed'
    } else {
      order.deliveryStatus = 'yola_cikti'
    }
  } else {
    order.deliveryStatus = nextStatus
  }
  if (nextStatus === 'iptal_edildi') {
    order.status = 'cancelled'
  }
  appendDeliveryEvent(order, {
    type: 'status_change',
    oldStatus,
    newStatus: nextStatus,
    userId: getUserActorId(user),
    userName: user.name,
    note: normalizeText(note)
  })
  await order.save()
  return { order: mapOrder(order) }
}

export const updatePackageOrderPaymentStatusService = async (tenantId, user, orderId, deliveryPaymentStatus) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw error('invalid_request', 'Geçersiz sipariş id', 400)
  const order = await Order.findOne({ _id: orderId, tenantId })
  assertPackageOrderAccess(user, order)

  const nextStatus = normalizeText(deliveryPaymentStatus)
  if (!ALL_PAYMENT_STATUSES.has(nextStatus)) throw error('invalid_request', 'Geçersiz ödeme durumu', 400)

  const canManageAll = canManageAllPackageOrders(user)
  if (!canManageAll && !COURIER_ALLOWED_PAYMENT_STATUSES.has(nextStatus)) {
    throw error('forbidden', 'Bu ödeme durumunu güncelleyemezsiniz', 403)
  }
  if (!canManageAll && String(order.courierId || '') !== getUserActorId(user)) {
    throw error('forbidden', 'Sadece kendi siparişinizi güncelleyebilirsiniz', 403)
  }

  const previousPaymentStatus = normalizePackagePaymentStatus(order)
  order.deliveryType = 'package'
  order.deliveryPaymentStatus = nextStatus
  if (nextStatus === 'odeme_alindi' || nextStatus === 'online_odendi') {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
    if (order.deliveredAt) {
      order.deliveryStatus = 'teslim_edildi'
      order.status = order.status === 'cancelled' ? order.status : 'completed'
    }
  } else if (nextStatus === 'odeme_bekliyor') {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  } else if (nextStatus === 'veresiye') {
    order.settlementType = 'veresiye'
  }
  appendDeliveryEvent(order, {
    type: 'payment_status_change',
    oldStatus: previousPaymentStatus,
    newStatus: nextStatus,
    userId: getUserActorId(user),
    userName: user.name
  })
  await order.save()
  return { order: mapOrder(order) }
}

export const getCourierReportService = async (tenantId, branchIds = [], filters = {}) => {
  let query = {
    tenantId,
    saleType: 'delivery',
    courierId: { $ne: null }
  }
  query = applyBranchFilter(query, branchIds)
  if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
    query.branchId = new mongoose.Types.ObjectId(String(filters.branchId))
  }
  if (filters.courierId && mongoose.Types.ObjectId.isValid(filters.courierId)) {
    query.courierId = new mongoose.Types.ObjectId(String(filters.courierId))
  }
  if (filters.startDate || filters.endDate) {
    query.createdAt = {}
    if (filters.startDate) query.createdAt.$gte = new Date(`${filters.startDate}T00:00:00.000`)
    if (filters.endDate) query.createdAt.$lte = new Date(`${filters.endDate}T23:59:59.999`)
  }

  const orders = await Order.find(query).sort({ createdAt: -1 }).lean()
  const grouped = new Map()

  for (const rawOrder of orders) {
    const order = mapOrder(rawOrder)
    const courierId = order.courierId || 'unknown'
    const current = grouped.get(courierId) || {
      courierId: order.courierId,
      courierName: order.courierName || 'Atanmamış',
      deliveredOrderCount: 0,
      assignedOrderCount: 0,
      returnedOrderCount: 0,
      cancelledOrderCount: 0,
      totalPackageAmount: 0,
      collectedCashAmount: 0,
      collectedCardAmount: 0,
      receivableAmount: 0,
      averageDeliveryMinutes: 0,
      orders: [],
      _deliveryMinutes: []
    }

    current.assignedOrderCount += 1
    current.totalPackageAmount += order.total
    if (order.deliveryStatus === 'teslim_edildi') current.deliveredOrderCount += 1
    if (order.deliveryStatus === 'geri_dondu' || order.deliveryStatus === 'musteriyi_bulamadi' || order.deliveryStatus === 'adreste_yok') current.returnedOrderCount += 1
    if (order.deliveryStatus === 'iptal_edildi') current.cancelledOrderCount += 1
    if (order.deliveryPaymentStatus === 'odeme_bekliyor' || order.deliveryPaymentStatus === 'veresiye') current.receivableAmount += Math.max(0, Number(order.balanceDue || 0))
    if (order.deliveryPaymentStatus === 'odeme_alindi') {
      if (String(order.paymentMethod || order.deliveryPaymentMethod || '').toLowerCase().includes('card') || String(order.paymentMethod || order.deliveryPaymentMethod || '').toLowerCase().includes('kart')) current.collectedCardAmount += Number(order.paidTotal || order.total || 0)
      else current.collectedCashAmount += Number(order.paidTotal || order.total || 0)
    }

    if (order.courierDepartedAt && order.deliveredAt) {
      const minutes = Math.max(0, Math.round((new Date(order.deliveredAt).getTime() - new Date(order.courierDepartedAt).getTime()) / 60000))
      current._deliveryMinutes.push(minutes)
    }

    current.orders.push(order)
    grouped.set(courierId, current)
  }

  return {
    rows: Array.from(grouped.values()).map((row) => ({
      courierId: row.courierId,
      courierName: row.courierName,
      deliveredOrderCount: row.deliveredOrderCount,
      assignedOrderCount: row.assignedOrderCount,
      returnedOrderCount: row.returnedOrderCount,
      cancelledOrderCount: row.cancelledOrderCount,
      totalPackageAmount: row.totalPackageAmount,
      collectedCashAmount: row.collectedCashAmount,
      collectedCardAmount: row.collectedCardAmount,
      receivableAmount: row.receivableAmount,
      averageDeliveryMinutes: row._deliveryMinutes.length > 0
        ? Math.round(row._deliveryMinutes.reduce((sum, value) => sum + value, 0) / row._deliveryMinutes.length)
        : 0,
      orders: row.orders
    }))
  }
}
