import mongoose from 'mongoose'
import DeliveryCustomer from '../models/DeliveryCustomer.js'
import Order from '../models/Order.js'
import { error } from '../utils/errors.js'

export const normalizePhoneDigits = (value) => String(value || '').replace(/\D+/g, '').trim()

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const mapCustomer = (doc) => ({
  id: String(doc?._id || doc?.id || ''),
  name: String(doc?.name || ''),
  phone: String(doc?.phone || ''),
  phoneDigits: String(doc?.phoneDigits || ''),
  address: String(doc?.address || ''),
  note: String(doc?.note || ''),
  lastOrderAt: doc?.lastOrderAt || null,
  createdAt: doc?.createdAt || null,
  updatedAt: doc?.updatedAt || null
})

export const upsertDeliveryCustomerProfile = async (tenantId, {
  customerId,
  branchId,
  name,
  phone,
  address,
  note,
  lastOrderAt
} = {}) => {
  const safeName = String(name || '').trim().slice(0, 80)
  if (!safeName) return null
  const safePhone = String(phone || '').trim().slice(0, 30)
  const phoneDigits = normalizePhoneDigits(safePhone)
  const safeAddress = String(address || '').trim().slice(0, 500)
  const safeNote = String(note || '').trim().slice(0, 300)
  const nextLastOrderAt = lastOrderAt ? new Date(lastOrderAt) : new Date()

  let doc = null
  const rawCustomerId = String(customerId || '').trim()
  if (rawCustomerId && mongoose.isValidObjectId(rawCustomerId)) {
    doc = await DeliveryCustomer.findOne({ _id: rawCustomerId, tenantId })
  }
  if (!doc && phoneDigits) {
    doc = await DeliveryCustomer.findOne({ tenantId, phoneDigits }).sort({ updatedAt: -1 })
  }
  if (!doc) {
    doc = await DeliveryCustomer.findOne({ tenantId, name: safeName }).sort({ updatedAt: -1 })
  }
  if (!doc) {
    doc = new DeliveryCustomer({ tenantId })
  }

  doc.branchId = branchId && mongoose.isValidObjectId(String(branchId)) ? new mongoose.Types.ObjectId(String(branchId)) : (doc.branchId || null)
  doc.name = safeName
  doc.phone = safePhone
  doc.phoneDigits = phoneDigits
  doc.address = safeAddress
  doc.note = safeNote
  doc.lastOrderAt = nextLastOrderAt
  await doc.save()
  return doc
}

export const searchDeliveryCustomersService = async (tenantId, query, limit = 8) => {
  const raw = String(query || '').trim()
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8))
  const digits = normalizePhoneDigits(raw)
  const filter = { tenantId }

  if (raw) {
    const parts = []
    if (digits) {
      parts.push({ phoneDigits: { $regex: escapeRegex(digits), $options: 'i' } })
    }
    parts.push({ name: { $regex: escapeRegex(raw), $options: 'i' } })
    filter.$or = parts
  }

  const docs = await DeliveryCustomer.find(filter)
    .sort({ lastOrderAt: -1, updatedAt: -1 })
    .limit(safeLimit)
    .lean()

  return {
    customers: docs.map(mapCustomer)
  }
}

export const listDeliveryCustomersService = async (tenantId, { query = '', page = 1, limit = 20 } = {}) => {
  const raw = String(query || '').trim()
  const digits = normalizePhoneDigits(raw)
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
  const safePage = Math.max(1, Number(page) || 1)
  const skip = (safePage - 1) * safeLimit
  const filter = { tenantId }

  if (raw) {
    const parts = []
    if (digits) parts.push({ phoneDigits: { $regex: escapeRegex(digits), $options: 'i' } })
    parts.push({ name: { $regex: escapeRegex(raw), $options: 'i' } })
    parts.push({ address: { $regex: escapeRegex(raw), $options: 'i' } })
    filter.$or = parts
  }

  const [docs, total] = await Promise.all([
    DeliveryCustomer.find(filter).sort({ lastOrderAt: -1, updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    DeliveryCustomer.countDocuments(filter)
  ])

  const customerIds = docs.map((doc) => String(doc._id))
  const orderStats = customerIds.length > 0
    ? await Order.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(String(tenantId)),
          saleType: 'delivery',
          deliveryCustomerId: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)) }
        }
      },
      {
        $group: {
          _id: '$deliveryCustomerId',
          orderCount: { $sum: 1 },
          lastOrderAt: { $max: '$createdAt' }
        }
      }
    ])
    : []

  const statsById = new Map(orderStats.map((row) => [String(row._id), row]))
  return {
    customers: docs.map((doc) => {
      const stats = statsById.get(String(doc._id))
      return {
        ...mapCustomer(doc),
        orderCount: Number(stats?.orderCount || 0),
        lastOrderAt: stats?.lastOrderAt || doc.lastOrderAt || null
      }
    }),
    total,
    page: safePage,
    limit: safeLimit
  }
}

export const getDeliveryCustomerDetailService = async (tenantId, id, { orderLimit = 20 } = {}) => {
  if (!mongoose.isValidObjectId(String(id || ''))) throw error('invalid_request', 'Invalid customer id', 400)
  const doc = await DeliveryCustomer.findOne({ _id: id, tenantId }).lean()
  if (!doc) throw error('not_found', 'Delivery customer not found', 404)

  const orders = await Order.find({
    tenantId,
    saleType: 'delivery',
    deliveryCustomerId: new mongoose.Types.ObjectId(String(id))
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(100, Number(orderLimit) || 20)))
    .select('_id orderNo createdAt deliveryStatus paymentStatus customerName customerPhone customerAddress deliveryNote totals')
    .lean()

  return {
    customer: mapCustomer(doc),
    orders: (orders || []).map((order) => ({
      id: String(order._id),
      orderNo: order.orderNo ?? null,
      createdAt: order.createdAt || null,
      deliveryStatus: String(order.deliveryStatus || ''),
      paymentStatus: String(order.paymentStatus || ''),
      customerName: String(order.customerName || ''),
      customerPhone: String(order.customerPhone || ''),
      customerAddress: String(order.customerAddress || ''),
      deliveryNote: String(order.deliveryNote || ''),
      total: Number(order?.totals?.grandTotal || order?.totals?.netTotal || 0)
    }))
  }
}
