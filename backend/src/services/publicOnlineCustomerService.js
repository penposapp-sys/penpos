import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import CustomerAccount from '../models/CustomerAccount.js'
import Order from '../models/Order.js'
import { error } from '../utils/errors.js'
import { computePaymentSummary } from '../utils/orderFinancial.js'

const MIN_PASSWORD_LENGTH = 6

const normalizeName = (value) => String(value || '').trim()
const normalizePhone = (value) => String(value || '').trim().replace(/\s+/g, '').replace(/[^0-9+]/g, '')
const normalizeLocation = (value) => String(value || '').trim()
const normalizeAddress = (value) => String(value || '').trim()
const getItemStatusLabel = (item = {}, order = {}) => {
  const itemStatus = String(item?.status || '').trim()
  const approvalStatus = String(order?.approvalStatus || '').trim()
  if (itemStatus === 'cancelled') return 'Iptal'
  if (itemStatus === 'completed') return 'Hazir'
  if (itemStatus === 'cooking') return 'Hazirlaniyor'
  if (itemStatus === 'sent') return 'Hazirlaniyor'
  if (approvalStatus === 'pending') return 'Onay Bekliyor'
  return 'Bekliyor'
}

const mapCustomer = (customer) => ({
  id: String(customer?._id || customer?.id || ''),
  name: normalizeName(customer?.name),
  phone: normalizePhone(customer?.phone),
  location: normalizeLocation(customer?.publicLocation),
  address: normalizeAddress(customer?.address),
  note: String(customer?.note || ''),
  balance: Number(customer?.balance || 0)
})

const validatePhone = (phone) => {
  if (!phone) throw error('phone_required', 'Telefon zorunludur', 400)
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length < 10) throw error('invalid_request', 'Telefon en az 10 karakter olmalidir', 400)
}

const validateName = (name) => {
  if (!name || name.length < 2) throw error('name_required', 'Ad soyad zorunludur', 400)
}

const findByPhone = async (tenantId, branchId, phone, excludeId = null) => {
  const filter = {
    tenantId,
    branchId,
    phone,
    isActive: true
  }
  if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) }
  }
  return CustomerAccount.findOne(filter)
}

const listCustomerOrders = async (tenantId, branchId, customerId) => {
  const orders = await Order.find({
    tenantId,
    branchId,
    saleType: 'delivery',
    orderChannel: 'online',
    publicCustomerAccountId: customerId
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  return orders.map((order) => ({
    id: String(order?._id || ''),
    orderNo: order?.orderNo ?? null,
    total: Number(computePaymentSummary(order).netTotal || 0),
    createdAt: order?.createdAt || null,
    status: String(order?.status || ''),
    paymentStatus: String(order?.paymentStatus || 'unpaid'),
    deliveryPaymentStatus: String(order?.deliveryPaymentStatus || 'unknown'),
    publicCustomerAccountId: String(order?.publicCustomerAccountId || ''),
    approvalStatus: String(order?.approvalStatus || 'none'),
    cancelRequestStatus: String(order?.cancelRequestStatus || 'none'),
    deliveryStatus: String(order?.deliveryStatus || ''),
    note: String(order?.note || ''),
    items: Array.isArray(order?.items)
      ? order.items
        .map((item) => ({
          id: String(item?._id || ''),
          menuItemId: String(item?.menuItemId || item?.productId || ''),
          name: String(item?.nameSnapshot || item?.productName || ''),
          quantity: Number(item?.qty || 0),
          totalPrice: Number(item?.subtotal || 0),
          note: String(item?.note || ''),
          weightGrams: Number(item?.weightGrams || 0) || 0,
          status: String(item?.status || ''),
          statusLabel: getItemStatusLabel(item, order),
          isCancelled: String(item?.status || '') === 'cancelled'
        }))
      : []
  }))
}

export const requestPublicOnlineOrderCancellation = async (tenantId, branchId, customerId, orderId) => {
  if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(orderId)) {
    throw error('invalid_request', 'Siparis bilgisi gecersiz', 400)
  }

  const order = await Order.findOne({
    _id: orderId,
    tenantId,
    branchId,
    saleType: 'delivery',
    orderChannel: 'online',
    publicCustomerAccountId: customerId
  })

  if (!order) throw error('not_found', 'Siparis bulunamadi', 404)
  if (String(order?.status || '') === 'cancelled' || ['cancelled', 'iptal_edildi'].includes(String(order?.deliveryStatus || ''))) {
    throw error('invalid_request', 'Siparis zaten iptal edilmis', 400)
  }
  if (String(order?.cancelRequestStatus || 'none') === 'pending') {
    throw error('invalid_request', 'Bu siparis icin zaten iptal talebi var', 400)
  }

  order.cancelRequestStatus = 'pending'
  order.cancelRequestedAt = new Date()
  order.cancelRequestedByName = 'Musteri'
  order.cancelRequestNote = 'Online musteriden iptal talebi geldi'
  order.deliveryEvents = [
    ...(Array.isArray(order.deliveryEvents) ? order.deliveryEvents : []),
    {
      type: 'online_cancel_requested',
      oldStatus: String(order?.deliveryStatus || ''),
      newStatus: String(order?.deliveryStatus || ''),
      userId: null,
      userName: 'Online',
      note: 'Musteri iptal talebi olusturdu',
      createdAt: new Date()
    }
  ]
  await order.save()

  return {
    order: {
      id: String(order._id),
      cancelRequestStatus: String(order.cancelRequestStatus || 'pending'),
      approvalStatus: String(order.approvalStatus || 'none'),
      deliveryStatus: String(order.deliveryStatus || '')
    }
  }
}

export const upsertPublicOnlineCustomerAccount = async (tenantId, branchId, input = {}) => {
  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)
  const location = normalizeLocation(input?.location)
  const address = normalizeAddress(input?.address)

  validateName(name)
  validatePhone(phone)

  const existing = await findByPhone(tenantId, branchId, phone)
  if (existing) {
    existing.name = name
    if (location) existing.publicLocation = location
    if (address) existing.address = address
    await existing.save()
    return { customer: mapCustomer(existing), isNew: false }
  }

  const created = await CustomerAccount.create({
    tenantId,
    branchId,
    name,
    phone,
    address,
    publicLocation: location,
    note: '',
    isActive: true,
    balance: 0
  })

  return { customer: mapCustomer(created), isNew: true }
}

export const registerPublicOnlineCustomerAccount = async (tenantId, branchId, input = {}) => {
  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)
  const location = normalizeLocation(input?.location)
  const address = normalizeAddress(input?.address)
  const password = String(input?.password || '')
  const passwordRepeat = String(input?.passwordRepeat || '')

  validateName(name)
  validatePhone(phone)
  if (!password) throw error('password_required', 'Sifre zorunludur', 400)
  if (password.length < MIN_PASSWORD_LENGTH) throw error('password_too_short', `Sifre en az ${MIN_PASSWORD_LENGTH} karakter olmalidir`, 400)
  if (password !== passwordRepeat) throw error('password_mismatch', 'Sifreler ayni degil', 400)

  const duplicate = await findByPhone(tenantId, branchId, phone)
  if (duplicate) {
    throw error('duplicate_phone', 'Bu telefon numarasiyla kayitli hesap var, mevcut hesaptan giris yapin', 409)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const created = await CustomerAccount.create({
    tenantId,
    branchId,
    name,
    phone,
    address,
    publicLocation: location,
    passwordHash,
    note: '',
    isActive: true,
    balance: 0
  })

  return { customer: mapCustomer(created) }
}

export const loginPublicOnlineCustomerAccount = async (tenantId, branchId, input = {}) => {
  const phone = normalizePhone(input?.phone)
  const password = String(input?.password || '')

  validatePhone(phone)
  if (!password) throw error('password_required', 'Sifre zorunludur', 400)

  const customer = await findByPhone(tenantId, branchId, phone)
  if (!customer) throw error('invalid_credentials', 'Telefon numarasi veya sifre hatali', 401)
  if (!String(customer.passwordHash || '').trim()) {
    throw error('password_not_set', 'Bu hesap icin sifre bulunamadi', 409)
  }

  const ok = await bcrypt.compare(password, String(customer.passwordHash || ''))
  if (!ok) throw error('invalid_credentials', 'Telefon numarasi veya sifre hatali', 401)

  return { customer: mapCustomer(customer) }
}

export const getPublicOnlineCustomerProfile = async (tenantId, branchId, customerId) => {
  if (!mongoose.Types.ObjectId.isValid(customerId)) throw error('not_found', 'Musteri hesabi bulunamadi', 404)

  const customer = await CustomerAccount.findOne({
    _id: customerId,
    tenantId,
    branchId,
    isActive: true
  }).lean()

  if (!customer) throw error('not_found', 'Musteri hesabi bulunamadi', 404)

  const orders = await listCustomerOrders(tenantId, branchId, customer._id)
  return {
    customer: mapCustomer(customer),
    orders
  }
}

export const updatePublicOnlineCustomerProfile = async (tenantId, branchId, customerId, input = {}) => {
  if (!mongoose.Types.ObjectId.isValid(customerId)) throw error('not_found', 'Musteri hesabi bulunamadi', 404)

  const customer = await CustomerAccount.findOne({
    _id: customerId,
    tenantId,
    branchId,
    isActive: true
  })
  if (!customer) throw error('not_found', 'Musteri hesabi bulunamadi', 404)

  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)
  const location = normalizeLocation(input?.location)
  const address = normalizeAddress(input?.address)

  validateName(name)
  validatePhone(phone)

  const duplicate = await findByPhone(tenantId, branchId, phone, customerId)
  if (duplicate) throw error('duplicate_phone', 'Bu telefon zaten kayitli', 409)

  customer.name = name
  customer.phone = phone
  customer.publicLocation = location
  customer.address = address
  await customer.save()

  return { customer: mapCustomer(customer) }
}
