import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import Tenant from '../../../models/Tenant.js'
import CanteenBranch from '../models/CanteenBranch.js'
import CanteenCategory from '../models/CanteenCategory.js'
import CanteenProduct from '../models/CanteenProduct.js'
import CanteenQrOrder from '../models/CanteenQrOrder.js'
import * as customerRepo from '../repositories/canteenCustomerRepository.js'
import * as collectionRepo from '../repositories/canteenCustomerCollectionRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import { resolvePaymentMethodSelection } from '../../../services/paymentSettingsService.js'
import { createCustomer } from './canteenCustomerService.js'
import { createSale } from './canteenSalesService.js'

const ORDER_STATUSES = new Set(['new', 'preparing', 'ready', 'delivered', 'cancelled'])
const PAYMENT_STATUSES = new Set(['unpaid', 'paid', 'pending', 'cari'])
const PAYMENT_METHODS = new Set(['cash_at_counter', 'pay_on_delivery', 'cari', 'already_paid', 'none'])

const toNumber = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const roundMoney = (value) => Number(toNumber(value).toFixed(2))

const normalizeText = (value) => String(value || '').trim()

const defaultQrPaymentDetails = (paymentMethod) => {
  const method = PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : 'none'
  if (method === 'cash_at_counter') {
    return { paymentMethodLabel: 'Nakit', paymentMethodName: 'Nakit', paymentMethodBucket: 'cash', paymentMethodType: 'cash' }
  }
  if (method === 'pay_on_delivery') {
    return { paymentMethodLabel: 'Kapida odeme', paymentMethodName: 'Kapida odeme', paymentMethodBucket: 'other', paymentMethodType: 'other' }
  }
  if (method === 'cari') {
    return { paymentMethodLabel: 'Cari / Veresiye', paymentMethodName: 'Cari / Veresiye', paymentMethodBucket: 'account', paymentMethodType: 'credit' }
  }
  if (method === 'already_paid') {
    return { paymentMethodLabel: 'Onceden odendi', paymentMethodName: 'Onceden odendi', paymentMethodBucket: 'other', paymentMethodType: 'other' }
  }
  return { paymentMethodLabel: '', paymentMethodName: '', paymentMethodBucket: 'other', paymentMethodType: 'other' }
}

const normalizePhone = (phone) => {
  const raw = String(phone || '').trim()
  return raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
}

const collectionMethodLabel = (method) => {
  const key = String(method || '').trim().toLowerCase()
  if (key === 'cash') return 'Nakit'
  if (key === 'pos') return 'POS'
  if (key === 'bank') return 'Banka'
  return ''
}

const collectionMethodType = (method) => {
  const key = String(method || '').trim().toLowerCase()
  if (key === 'cash') return { paymentMethodBucket: 'cash', paymentMethodType: 'cash' }
  if (key === 'pos') return { paymentMethodBucket: 'card', paymentMethodType: 'card' }
  if (key === 'bank') return { paymentMethodBucket: 'bank', paymentMethodType: 'bank' }
  return { paymentMethodBucket: 'other', paymentMethodType: 'other' }
}

const extractOrderNumberFromCollectionNote = (note) => {
  const text = normalizeText(note)
  if (!text) return ''
  const match = /^QR siparisi\s+(.+?)(?:\s+tahsil edildi|\s+icin indirim mahsup edildi)$/i.exec(text)
  return String(match?.[1] || '').trim()
}

const mapLinkedCollection = (collection) => ({
  id: String(collection?._id || collection?.id || ''),
  method: String(collection?.method || ''),
  methodLabel: collectionMethodLabel(collection?.method) || String(collection?.method || ''),
  amount: Number(collection?.amount || 0),
  note: String(collection?.note || ''),
  createdAt: collection?.createdAt ? new Date(collection.createdAt).toISOString() : null,
})

const attachCollectionsAndPaymentLabels = async (tenantId, orders = []) => {
  const list = Array.isArray(orders) ? orders : []
  const candidates = list.filter((order) => normalizeText(order?.orderNumber) && normalizeText(order?.cariId || order?.customerId))
  if (candidates.length === 0) return list.map((order) => ({ ...order, linkedCollections: [] }))

  const customerIds = Array.from(new Set(candidates.map((order) => String(order.cariId || order.customerId || '')).filter(Boolean)))
  const collections = await collectionRepo.listByCustomersAllBranches(tenantId, customerIds, { limit: Math.max(500, customerIds.length * 20) })
  const collectionsByOrderNumber = new Map()

  for (const collection of collections || []) {
    const orderNumber = extractOrderNumberFromCollectionNote(collection?.note)
    if (!orderNumber) continue
    const current = collectionsByOrderNumber.get(orderNumber) || []
    current.push(collection)
    collectionsByOrderNumber.set(orderNumber, current)
  }

  return list.map((order) => {
    const linkedCollections = (collectionsByOrderNumber.get(String(order?.orderNumber || '').trim()) || []).map(mapLinkedCollection)
    if (String(order?.paymentMethod || '') !== 'already_paid') {
      return { ...order, linkedCollections }
    }
    if (normalizeText(order?.paymentMethodLabel || order?.paymentMethodName)) {
      return { ...order, linkedCollections }
    }
    const linked = (collectionsByOrderNumber.get(String(order?.orderNumber || '').trim()) || [])
      .find((item) => String(item?.method || '').trim().toLowerCase() !== 'discount')
    if (!linked) return { ...order, linkedCollections }
    const label = collectionMethodLabel(linked?.method)
    if (!label) return { ...order, linkedCollections }
    return {
      ...order,
      linkedCollections,
      paymentMethodLabel: label,
      paymentMethodName: label,
      ...collectionMethodType(linked?.method),
    }
  })
}

const dayStamp = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

const generateOrderNumber = () => {
  const stamp = dayStamp()
  const serial = `${Date.now()}`.slice(-6)
  const random = `${Math.floor(Math.random() * 900) + 100}`
  return `QR-${stamp}-${serial}${random}`
}

const mapPaymentMeta = (paymentMethod, paymentStatus) => {
  const method = PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : 'none'
  if (PAYMENT_STATUSES.has(paymentStatus)) {
    return { paymentMethod: method, paymentStatus }
  }
  if (method === 'already_paid') return { paymentMethod: method, paymentStatus: 'paid' }
  if (method === 'cari') return { paymentMethod: method, paymentStatus: 'cari' }
  if (method === 'none') return { paymentMethod: method, paymentStatus: 'pending' }
  return { paymentMethod: method, paymentStatus: 'pending' }
}

const computeDiscountSummary = (subtotal, discountPercentInput) => {
  const safeSubtotal = roundMoney(subtotal)
  const rawPercent = toNumber(discountPercentInput)
  const discountPercent = Math.max(0, Math.min(100, roundMoney(rawPercent)))
  const discountTotal = roundMoney((safeSubtotal * discountPercent) / 100)
  const total = roundMoney(Math.max(0, safeSubtotal - discountTotal))
  return { subtotal: safeSubtotal, discountPercent, discountTotal, total }
}

const ensureTenant = async (tenantId) => {
  if (!mongoose.isValidObjectId(tenantId)) throw error('invalid_request', 'İşletme bilgisi geçersiz', 400)
  const tenant = await Tenant.findOne({ _id: tenantId, isActive: true, status: 'active', systemType: 'kantin' }).lean()
  if (!tenant) throw error('not_found', 'Kantin işletmesi bulunamadı', 404)
  return tenant
}

const ensureBranch = async (tenantId, branchId) => {
  if (!mongoose.isValidObjectId(branchId)) throw error('invalid_request', 'Şube bilgisi geçersiz', 400)
  const branch = await CanteenBranch.findOne({ _id: branchId, tenantId, isActive: true }).lean()
  if (!branch) throw error('not_found', 'Şube bulunamadı', 404)
  return branch
}

const buildOrderLines = async (tenantId, branchId, itemsInput) => {
  const items = Array.isArray(itemsInput) ? itemsInput : []
  if (items.length === 0) throw error('invalid_request', 'Sipariş ürünleri boş olamaz', 400)

  const requestedIds = Array.from(new Set(items.map((item) => String(item?.productId || '')).filter(Boolean)))
  if (requestedIds.length === 0) throw error('invalid_request', 'Sipariş ürünleri boş olamaz', 400)
  for (const id of requestedIds) {
    if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Ürün bilgisi geçersiz', 400)
  }

  const products = await CanteenProduct.find({
    tenantId,
    branchId,
    _id: { $in: requestedIds },
    isActive: true
  }).lean()
  if (products.length !== requestedIds.length) throw error('product_not_found', 'Siparişte geçersiz ürün var', 404)

  const categoryIds = Array.from(new Set(products.map((product) => String(product?.categoryId || '')).filter(Boolean)))
  const categories = categoryIds.length > 0
    ? await CanteenCategory.find({ tenantId, branchId, _id: { $in: categoryIds }, isActive: true }).lean()
    : []
  const categoryNameById = new Map((categories || []).map((category) => [String(category._id), String(category.name || '')]))
  const productById = new Map((products || []).map((product) => [String(product._id), product]))

  const lines = items.map((item) => {
    const productId = String(item?.productId || '')
    const product = productById.get(productId)
    if (!product) throw error('product_not_found', 'Siparişte geçersiz ürün var', 404)

    const quantity = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)))
    if (!quantity) throw error('invalid_request', 'Ürün adedi en az 1 olmalıdır', 400)

    const unitPrice = toNumber(product.price)
    const totalPrice = Number((unitPrice * quantity).toFixed(2))
    return {
      productId,
      productName: String(product.name || ''),
      categoryName: String(categoryNameById.get(String(product.categoryId || '')) || String(item?.categoryName || '') || ''),
      imageUrl: String(product.imageUrl || ''),
      quantity,
      unitPrice,
      totalPrice,
      note: normalizeText(item?.note)
    }
  })

  const subtotal = Number(lines.reduce((sum, item) => sum + toNumber(item.totalPrice), 0).toFixed(2))
  return { lines, subtotal, total: subtotal }
}

const normalizeDateStart = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

const normalizeDateEnd = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(23, 59, 59, 999)
  return date
}

const zeroOrderItems = (items) => (
  Array.isArray(items)
    ? items.map((item) => ({
        ...item,
        unitPrice: 0,
        totalPrice: 0
      }))
    : []
)

const formatOrder = (order, branchNameById = new Map()) => ({
  id: String(order._id),
  tenantId: String(order.tenantId),
  branchId: order.branchId ? String(order.branchId) : '',
  branchName: branchNameById.get(String(order.branchId || '')) || '',
  orderNumber: String(order.orderNumber || ''),
  customerName: String(order.customerName || ''),
  customerPhone: String(order.customerPhone || ''),
  customerEmail: String(order.customerEmail || ''),
  customerLocation: String(order.customerLocation || ''),
  customerAddress: String(order.customerAddress || ''),
  customerNote: String(order.customerNote || ''),
  items: Array.isArray(order.items)
    ? order.items.map((item) => ({
        productId: item.productId ? String(item.productId) : '',
        productName: String(item.productName || ''),
        categoryName: String(item.categoryName || ''),
        imageUrl: String(item.imageUrl || ''),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0),
        note: String(item.note || '')
      }))
    : [],
  subtotal: Number(order.subtotal || 0),
  discountPercent: Number(order.discountPercent || 0),
  discountTotal: Number(order.discountTotal || 0),
  total: Number(order.total || 0),
  paymentStatus: String(order.paymentStatus || 'pending'),
  paymentMethod: String(order.paymentMethod || 'none'),
  paymentMethodLabel: String(order.paymentMethodLabel || ''),
  paymentMethodName: String(order.paymentMethodName || ''),
  paymentMethodBucket: String(order.paymentMethodBucket || ''),
  paymentMethodType: String(order.paymentMethodType || ''),
  linkedCollections: Array.isArray(order.linkedCollections) ? order.linkedCollections : [],
  orderStatus: String(order.orderStatus || 'new'),
  isTransferredToCari: order.isTransferredToCari === true,
  customerId: order.customerId ? String(order.customerId) : '',
  cariId: order.cariId ? String(order.cariId) : '',
  relatedSaleId: order.relatedSaleId ? String(order.relatedSaleId) : '',
  createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
  updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : null
})

export const createPublicQrOrder = async (input) => {
  const tenantId = String(input?.tenantId || '').trim()
  const branchId = String(input?.branchId || '').trim()
  let customerName = normalizeText(input?.customerName)
  let customerPhone = normalizePhone(input?.customerPhone)
  const customerEmail = normalizeText(input?.customerEmail)
  let customerLocation = normalizeText(input?.customerLocation)
  let customerAddress = normalizeText(input?.customerAddress)
  const customerNote = normalizeText(input?.customerNote)
  const requestedTotal = toNumber(input?.total)
  const requestedSubtotal = toNumber(input?.subtotal)
  const customerId = String(input?.customerId || '').trim()

  let linkedCustomer = null
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Müşteri bilgisi geçersiz', 400)
    linkedCustomer = await customerRepo.findByIdAndTenant(customerId, tenantId)
    if (!linkedCustomer) throw error('not_found', 'Müşteri hesabı bulunamadı', 404)
    customerName = String(linkedCustomer.name || customerName || '').trim()
    customerPhone = normalizePhone(linkedCustomer.phone || customerPhone)
    customerAddress = String(linkedCustomer.address || customerAddress || '').trim()
    customerLocation = normalizeText(input?.customerLocation || linkedCustomer.note || customerLocation)
  }

  if (!customerName) throw error('customer_name_required', 'Ad soyad zorunludur', 400)
  if (!customerPhone) throw error('customer_phone_required', 'Telefon zorunludur', 400)
  if (!customerLocation) throw error('customer_location_required', 'Teslimat / lokasyon bilgisi zorunludur', 400)

  await ensureTenant(tenantId)
  await ensureBranch(tenantId, branchId)

  const { paymentMethod, paymentStatus } = mapPaymentMeta(
    normalizeText(input?.paymentMethod),
    normalizeText(input?.paymentStatus)
  )
  const paymentDetails = defaultQrPaymentDetails(paymentMethod)
  const { lines, subtotal, total } = await buildOrderLines(tenantId, branchId, input?.items)
  let relatedSaleId = null
  let isTransferredToCari = false

  if (requestedSubtotal > 0 && Math.abs(requestedSubtotal - subtotal) > 0.009) {
    throw error('invalid_total', 'Ara toplam doğrulanamadı', 400)
  }
  if (requestedTotal > 0 && Math.abs(requestedTotal - total) > 0.009) {
    throw error('invalid_total', 'Toplam tutar doğrulanamadı', 400)
  }

  if (linkedCustomer && paymentStatus === 'cari') {
    const sale = await createSale(tenantId, branchId, null, {
      items: lines.map((item) => ({
        productId: String(item.productId || ''),
        qty: Number(item.quantity || 0)
      })),
      channel: 'qr',
      note: `QR siparisi ${customerName} / ${customerPhone} icin otomatik cariye islendi`,
      payment: {
        method: 'account',
        amount: total,
        note: customerNote || '',
        customerId: String(linkedCustomer._id || linkedCustomer.id || '')
      }
    })
    relatedSaleId = sale?.id ? String(sale.id) : null
    isTransferredToCari = true
  }

  const financials = computeDiscountSummary(requestedSubtotal || subtotal, 0)

  const created = await CanteenQrOrder.create({
    tenantId,
    branchId,
    orderNumber: generateOrderNumber(),
    customerName,
    customerPhone,
    customerEmail,
    customerLocation,
    customerAddress,
    customerNote,
    items: lines,
    subtotal: financials.subtotal,
    discountPercent: financials.discountPercent,
    discountTotal: financials.discountTotal,
    total: financials.total,
    paymentStatus,
    paymentMethod,
    paymentMethodLabel: paymentDetails.paymentMethodLabel,
    paymentMethodName: paymentDetails.paymentMethodName,
    paymentMethodBucket: paymentDetails.paymentMethodBucket,
    paymentMethodType: paymentDetails.paymentMethodType,
    orderStatus: 'new',
    isTransferredToCari,
    customerId: linkedCustomer?._id || null,
    cariId: linkedCustomer?._id || null,
    relatedSaleId,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    actorUserId: null
  })

  return formatOrder(created.toObject())
}

export const listPublicQrOrdersByCustomer = async (tenantId, customerId) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Müşteri bilgisi geçersiz', 400)
  const orders = await CanteenQrOrder.find({
    tenantId,
    customerId,
    isDeleted: false
  }).sort({ createdAt: -1 }).lean()

  const branchNameById = new Map()
  const branchIds = Array.from(new Set((orders || []).map((order) => String(order.branchId || '')).filter(Boolean)))
  if (branchIds.length > 0) {
    const branches = await CanteenBranch.find({ tenantId, _id: { $in: branchIds } }).lean()
    for (const branch of branches || []) branchNameById.set(String(branch._id), String(branch.name || ''))
  }

  return attachCollectionsAndPaymentLabels(tenantId, (orders || []).map((order) => formatOrder(order, branchNameById)))
}

export const listQrOrders = async (tenantId, branchIds, filters = {}) => {
  const allowedBranchIds = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const query = {
    tenantId,
    isDeleted: false
  }
  if (allowedBranchIds.length > 0) query.branchId = { $in: allowedBranchIds }

  const status = normalizeText(filters?.status)
  if (status && ORDER_STATUSES.has(status)) query.orderStatus = status

  const paymentStatus = normalizeText(filters?.paymentStatus)
  if (paymentStatus && PAYMENT_STATUSES.has(paymentStatus)) query.paymentStatus = paymentStatus

  const dateStart = normalizeDateStart(filters?.dateStart)
  const dateEnd = normalizeDateEnd(filters?.dateEnd)
  if (dateStart || dateEnd) {
    query.createdAt = {}
    if (dateStart) query.createdAt.$gte = dateStart
    if (dateEnd) query.createdAt.$lte = dateEnd
  }

  const search = normalizeText(filters?.search)
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.$or = [
      { customerName: { $regex: escaped, $options: 'i' } },
      { customerPhone: { $regex: escaped, $options: 'i' } },
      { customerLocation: { $regex: escaped, $options: 'i' } },
      { orderNumber: { $regex: escaped, $options: 'i' } }
    ]
  }

  const orders = await CanteenQrOrder.find(query).sort({ createdAt: -1 }).lean()
  const branchNameById = new Map()
  const branchIdList = Array.from(new Set((orders || []).map((order) => String(order.branchId || '')).filter(Boolean)))
  if (branchIdList.length > 0) {
    const branches = await CanteenBranch.find({ tenantId, _id: { $in: branchIdList } }).lean()
    for (const branch of branches || []) {
      branchNameById.set(String(branch._id), String(branch.name || ''))
    }
  }

  const priority = { new: 0, preparing: 1, ready: 2, delivered: 3, cancelled: 4 }
  return attachCollectionsAndPaymentLabels(tenantId, (orders || [])
    .map((order) => formatOrder(order, branchNameById))
    .sort((left, right) => {
      const diff = (priority[left.orderStatus] ?? 99) - (priority[right.orderStatus] ?? 99)
      if (diff !== 0) return diff
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    }))
}

const findOrderInScope = async (tenantId, branchId, orderId) => {
  if (!mongoose.isValidObjectId(orderId)) throw error('invalid_request', 'Sipariş bilgisi geçersiz', 400)
  const query = { _id: orderId, tenantId, isDeleted: false }
  if (branchId) query.branchId = branchId
  const orderDoc = await CanteenQrOrder.findOne(query)
  if (!orderDoc) throw error('not_found', 'QR siparişi bulunamadı', 404)
  return orderDoc
}

const cancelQrOrderFinancials = async (order) => {
  const relatedSaleId = String(order?.relatedSaleId || '').trim()
  if (relatedSaleId && mongoose.isValidObjectId(relatedSaleId)) {
    await saleRepo.softDeleteByIdAndScope(relatedSaleId, order.tenantId, order.branchId)
  }

  order.items = zeroOrderItems(order.items)
  order.subtotal = 0
  order.total = 0
  order.isTransferredToCari = false
  order.relatedSaleId = null
  order.paymentStatus = 'unpaid'
  order.paymentMethod = 'none'
  order.paymentMethodLabel = ''
  order.paymentMethodName = ''
  order.paymentMethodBucket = 'other'
  order.paymentMethodType = 'other'
}

export const updateQrOrderStatus = async (tenantId, branchId, actorUserId, orderId, nextStatus) => {
  const status = normalizeText(nextStatus)
  if (!ORDER_STATUSES.has(status)) throw error('invalid_request', 'Sipariş durumu geçersiz', 400)
  const order = await findOrderInScope(tenantId, branchId, orderId)
  if (status === 'cancelled') {
    await cancelQrOrderFinancials(order)
  }
  order.orderStatus = status
  order.actorUserId = actorUserId || null
  order.updatedAt = new Date()
  await order.save()
  return formatOrder(order.toObject())
}

export const updateQrOrderPayment = async (tenantId, branchId, actorUserId, orderId, input) => {
  const status = normalizeText(input?.paymentStatus)
  if (!PAYMENT_STATUSES.has(status)) throw error('invalid_request', 'Ödeme durumu geçersiz', 400)

  const requestedMethod = normalizeText(input?.paymentMethod)
  let method = PAYMENT_METHODS.has(requestedMethod)
    ? requestedMethod
    : (status === 'paid' ? 'already_paid' : status === 'cari' ? 'cari' : 'none')
  let paymentDetails = defaultQrPaymentDetails(method)

  if (status === 'paid' && requestedMethod && !PAYMENT_METHODS.has(requestedMethod)) {
    const resolvedMethod = await resolvePaymentMethodSelection(tenantId, branchId, requestedMethod)
    method = 'already_paid'
    paymentDetails = {
      paymentMethodLabel: String(resolvedMethod?.methodLabel || resolvedMethod?.methodName || '').trim(),
      paymentMethodName: String(resolvedMethod?.methodName || resolvedMethod?.methodLabel || '').trim(),
      paymentMethodBucket: String(resolvedMethod?.methodBucket || 'other').trim() || 'other',
      paymentMethodType: String(resolvedMethod?.methodType || 'other').trim() || 'other',
    }
  } else if (status === 'cari') {
    method = 'cari'
    paymentDetails = defaultQrPaymentDetails('cari')
  } else if (status !== 'paid') {
    paymentDetails = defaultQrPaymentDetails(method)
  }

  const order = await findOrderInScope(tenantId, branchId, orderId)
  if (String(order.orderStatus || '') === 'cancelled') {
    throw error('invalid_request', 'Iptal edilen siparisin odeme durumu guncellenemez', 409)
  }
  const previousDiscountTotal = roundMoney(order.discountTotal || 0)
  const financials = computeDiscountSummary(order.subtotal, input?.discountPercent ?? order.discountPercent ?? 0)
  order.discountPercent = financials.discountPercent
  order.discountTotal = financials.discountTotal
  order.total = financials.total
  const discountDelta = roundMoney(financials.discountTotal - previousDiscountTotal)
  if (status === 'paid' && discountDelta > 0.009 && (order.isTransferredToCari === true || String(order.paymentStatus || '') === 'cari')) {
    const customerId = order.cariId || order.customerId || null
    if (customerId && mongoose.isValidObjectId(customerId)) {
      await collectionRepo.create({
        tenantId,
        branchId,
        customerId,
        method: 'discount',
        amount: discountDelta,
        note: `QR siparisi ${order.orderNumber || ''} icin indirim mahsup edildi`,
        createdAt: new Date(),
        actorUserId,
        isActive: true
      })
    }
  }
  order.paymentStatus = status
  order.paymentMethod = method
  order.paymentMethodLabel = paymentDetails.paymentMethodLabel
  order.paymentMethodName = paymentDetails.paymentMethodName
  order.paymentMethodBucket = paymentDetails.paymentMethodBucket
  order.paymentMethodType = paymentDetails.paymentMethodType
  order.actorUserId = actorUserId || null
  order.updatedAt = new Date()
  await order.save()
  return formatOrder(order.toObject())
}

export const transferQrOrderToCari = async (tenantId, branchId, actorUserId, orderId, input = {}) => {
  const order = await findOrderInScope(tenantId, branchId, orderId)
  if (order.isTransferredToCari === true) throw error('already_transferred', 'Bu sipariş zaten cariye işlendi', 409)
  if (String(order.paymentStatus) === 'paid') throw error('already_paid', 'Ödenmiş sipariş cariye işlenemez', 409)

  if (String(order.orderStatus || '') === 'cancelled') throw error('already_cancelled', 'Iptal edilen siparis cariye islenemez', 409)
  const phone = normalizePhone(order.customerPhone)
  let customer = phone ? await customerRepo.findByPhoneAndTenant(tenantId, phone) : null
  if (!customer) {
    if (input?.createCustomerIfMissing !== true) {
      throw error('customer_not_found_for_transfer', 'Bu telefonla kayıtlı cari bulunamadı', 409)
    }
    const createdCustomer = await createCustomer(tenantId, actorUserId, {
      name: order.customerName,
      phone,
      note: [order.customerLocation, order.customerAddress, order.customerNote].filter(Boolean).join(' | ')
    })
    customer = await customerRepo.findByIdAndTenant(createdCustomer.id, tenantId)
  }
  if (!customer) throw error('not_found', 'Cari oluşturulamadı', 409)

  const financials = computeDiscountSummary(order.subtotal, input?.discountPercent ?? order.discountPercent ?? 0)
  const sale = await createSale(tenantId, String(order.branchId), actorUserId, {
    items: (order.items || []).map((item) => ({
      productId: String(item.productId || ''),
      qty: Number(item.quantity || 0)
    })),
    channel: 'qr',
    note: `QR siparisi ${order.orderNumber} cariye islendi`,
    discountPercent: financials.discountPercent,
    payment: {
      method: 'account',
      amount: financials.total,
      note: order.customerNote || '',
      customerId: String(customer.id || customer._id || '')
    }
  })

  order.discountPercent = financials.discountPercent
  order.discountTotal = financials.discountTotal
  order.total = financials.total
  order.isTransferredToCari = true
  order.customerId = customer._id || customer.id
  order.cariId = customer._id || customer.id
  order.relatedSaleId = sale.id
  order.paymentStatus = 'cari'
  order.paymentMethod = 'cari'
  order.paymentMethodLabel = 'Cari / Veresiye'
  order.paymentMethodName = 'Cari / Veresiye'
  order.paymentMethodBucket = 'account'
  order.paymentMethodType = 'credit'
  order.actorUserId = actorUserId || null
  order.updatedAt = new Date()
  await order.save()

  return {
    order: formatOrder(order.toObject()),
    customer: {
      id: String(customer._id || customer.id),
      name: String(customer.name || ''),
      phone: String(customer.phone || '')
    },
    sale
  }
}

export const deleteQrOrder = async (tenantId, branchId, actorUserId, orderId) => {
  const order = await findOrderInScope(tenantId, branchId, orderId)
  order.isDeleted = true
  order.deletedAt = new Date()
  order.actorUserId = actorUserId || null
  order.updatedAt = new Date()
  await order.save()
  return { success: true, id: String(order._id) }
}
