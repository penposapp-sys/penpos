import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { error } from '../../../utils/errors.js'
import * as customerRepo from '../repositories/canteenCustomerRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import * as collectionRepo from '../repositories/canteenCustomerCollectionRepository.js'
import CanteenQrOrder from '../models/CanteenQrOrder.js'

const normalizeName = (name) => String(name || '').trim()
const normalizeKey = (name) => normalizeName(name).toLowerCase()
const normalizePhone = (phone) => {
  const raw = String(phone || '').trim()
  if (!raw) return ''
  return raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
}
const MIN_PASSWORD_LENGTH = 6

const extractQrOrderNumberFromCollectionNote = (note) => {
  const text = String(note || '').trim()
  if (!text) return ''
  const match = /^QR siparisi\s+(.+?)(?:\s+tahsil edildi|\s+icin indirim mahsup edildi)$/i.exec(text)
  return String(match?.[1] || '').trim()
}

const syncQrOrderAfterCollectionChange = async (tenantId, customerId, note = '') => {
  const orderNumber = extractQrOrderNumberFromCollectionNote(note)
  if (!orderNumber) return

  const qrOrder = await CanteenQrOrder.findOne({
    tenantId,
    orderNumber,
    isDeleted: false,
    $or: [
      { customerId },
      { cariId: customerId }
    ]
  })
  if (!qrOrder) return

  const collections = await collectionRepo.listByCustomerAllBranches(tenantId, customerId, { limit: 500 })
  const linked = (Array.isArray(collections) ? collections : []).filter((item) => extractQrOrderNumberFromCollectionNote(item?.note) === orderNumber)
  const paidCollection = linked.find((item) => String(item?.method || '').trim().toLowerCase() !== 'discount')

  if (paidCollection) {
    const method = String(paidCollection?.method || '').trim().toLowerCase()
    qrOrder.paymentStatus = 'paid'
    qrOrder.paymentMethod = 'already_paid'
    if (method === 'cash') {
      qrOrder.paymentMethodLabel = 'Nakit'
      qrOrder.paymentMethodName = 'Nakit'
      qrOrder.paymentMethodBucket = 'cash'
      qrOrder.paymentMethodType = 'cash'
    } else if (method === 'pos') {
      qrOrder.paymentMethodLabel = 'POS'
      qrOrder.paymentMethodName = 'POS'
      qrOrder.paymentMethodBucket = 'card'
      qrOrder.paymentMethodType = 'card'
    } else if (method === 'bank') {
      qrOrder.paymentMethodLabel = 'Banka'
      qrOrder.paymentMethodName = 'Banka'
      qrOrder.paymentMethodBucket = 'bank'
      qrOrder.paymentMethodType = 'bank'
    }
    qrOrder.updatedAt = new Date()
    await qrOrder.save()
    return
  }

  if (qrOrder.isTransferredToCari === true || qrOrder.relatedSaleId) {
    qrOrder.paymentStatus = 'cari'
    qrOrder.paymentMethod = 'cari'
    qrOrder.paymentMethodLabel = 'Cari / Veresiye'
    qrOrder.paymentMethodName = 'Cari / Veresiye'
    qrOrder.paymentMethodBucket = 'account'
    qrOrder.paymentMethodType = 'credit'
  } else {
    qrOrder.paymentStatus = 'pending'
    qrOrder.paymentMethod = 'none'
    qrOrder.paymentMethodLabel = ''
    qrOrder.paymentMethodName = ''
    qrOrder.paymentMethodBucket = 'other'
    qrOrder.paymentMethodType = 'other'
  }
  qrOrder.updatedAt = new Date()
  await qrOrder.save()
}

const mapCustomerDto = (customer, balance = 0) => ({
  id: String(customer.id || customer._id),
  name: String(customer.name || ''),
  phone: String(customer.phone || ''),
  address: String(customer.address || ''),
  note: String(customer.note || ''),
  favoriteProductIds: Array.isArray(customer.favoriteProductIds) ? customer.favoriteProductIds.map((id) => String(id)) : [],
  balance: Number(balance || 0)
})

const computeBalanceForCustomer = async (tenantId, customerId) => {
  const sales = await saleRepo.listByTenantAndCustomer(tenantId, customerId, { limit: 10000 })
  const debt = (sales || []).reduce((sum, s) => sum + ((s.payment?.methodType === 'account' || s.payment?.method === 'account' || s.payment?.method === 'credit') ? Number(s.total || 0) : 0), 0)
  const paid = await collectionRepo.sumByCustomerAllBranches(tenantId, customerId)
  return Number(debt - paid)
}

export const listCustomerMovements = async (tenantId, customerId) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const c = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!c) throw error('not_found', 'Cari bulunamadı', 404)

  const sales = await saleRepo.listByTenantAndCustomer(tenantId, customerId, { limit: 500 })
  const collections = await collectionRepo.listByCustomerAllBranches(tenantId, customerId, { limit: 500 })

  const rows = []
  for (const s of (sales || [])) {
    if (!(s.payment?.methodType === 'account' || s.payment?.method === 'account' || s.payment?.method === 'credit')) continue
    rows.push({
      id: String(s.id),
      kind: 'sale',
      type: 'debit',
      amount: Number(s.total || 0),
      method: 'account',
      note: '',
      createdAt: s.createdAt,
      branchId: s.branchId ? String(s.branchId) : null,
      actorUserId: s.actorUserId ? String(s.actorUserId) : null,
      saleId: String(s.id),
      paymentId: null
    })
  }

  for (const p of (collections || [])) {
    rows.push({
      id: String(p.id),
      kind: 'payment',
      type: 'credit',
      amount: Number(p.amount || 0),
      method: p.method || null,
      note: p.note || '',
      createdAt: p.createdAt,
      branchId: p.branchId ? String(p.branchId) : null,
      actorUserId: p.actorUserId ? String(p.actorUserId) : null,
      saleId: null,
      paymentId: String(p.id)
    })
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const balance = await computeBalanceForCustomer(tenantId, customerId)
  return { balance, movements: rows }
}

export const deleteCustomerPayment = async (tenantId, actorUserId, customerId, paymentId, reason = '') => {
  if (!mongoose.isValidObjectId(customerId) || !mongoose.isValidObjectId(paymentId)) throw error('invalid_request', 'Invalid id', 400)
  const c = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!c) throw error('not_found', 'Cari bulunamadı', 404)

  const p = await collectionRepo.findByIdAndTenant(tenantId, paymentId)
  if (!p) throw error('not_found', 'Tahsilat bulunamadı', 404)
  if (String(p.customerId) !== String(customerId)) throw error('forbidden', 'Bu işlem için yetkiniz yok', 403)
  if (p.isDeleted === true) throw error('already_deleted', 'Bu tahsilat zaten silinmiş', 409)

  const deleteReason = String(reason || '').trim()
  await collectionRepo.softDeleteByIdAndTenant(tenantId, paymentId, {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: actorUserId,
    deleteReason,
    actorUserId
  })

  await syncQrOrderAfterCollectionChange(tenantId, customerId, p.note || '')

  const balance = await computeBalanceForCustomer(tenantId, customerId)
  return { success: true, id: String(paymentId), balance }
}

export const listCustomers = async (tenantId) => {
  const items = await customerRepo.listByTenant(tenantId)
  const out = []
  for (const c of items) {
    const balance = await computeBalanceForCustomer(tenantId, c.id)
    const lastSale = await saleRepo.listByTenantAndCustomer(tenantId, c.id, { limit: 1 })
    const last = Array.isArray(lastSale) && lastSale.length > 0 ? lastSale[0] : null
    out.push({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      balance,
      lastActionAt: last?.createdAt || c.createdAt
    })
  }
  return out
}

export const searchCustomers = async (tenantId, q, { limit = 50 } = {}) => {
  const items = await customerRepo.searchByTenant(tenantId, q, { limit })
  return (items || []).map((c) => ({ id: c.id, name: c.name, phone: c.phone || '' }))
}

export const createCustomer = async (tenantId, actorUserId, input) => {
  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)
  const note = String(input?.note || '').trim()
  const address = String(input?.address || '').trim()
  if (!name || name.length < 2) throw error('name_required', 'İsim zorunludur', 400)

  if (phone) {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length < 10) throw error('invalid_request', 'Telefon en az 10 karakter olmalı', 400)
  }

  if (phone) {
    const dup = await customerRepo.findByPhoneAndTenant(tenantId, phone)
    if (dup) throw error('duplicate_phone', 'Bu telefon zaten kayıtlı', 409)
  }

  const created = await customerRepo.create({
    tenantId,
    name,
    nameNormalized: normalizeKey(name),
    phone,
    address,
    note,
    favoriteProductIds: [],
    isActive: true,
    createdAt: new Date(),
    actorUserId
  })
  return { id: created.id, name: created.name, phone: created.phone || '', balance: 0 }
}

export const getCustomer = async (tenantId, customerId) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const c = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!c) throw error('not_found', 'Cari bulunamadı', 404)
  const balance = await computeBalanceForCustomer(tenantId, c.id)
  return mapCustomerDto(c, balance)
}

export const updateCustomer = async (tenantId, actorUserId, customerId, input) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)

  if (!name || name.length < 2) throw error('invalid_request', 'İsim zorunludur', 400)

  if (phone) {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length < 10) throw error('invalid_request', 'Telefon en az 10 karakter olmalı', 400)
    const dup = await customerRepo.findByPhoneAndTenantExcludingId(tenantId, phone, customerId)
    if (dup) throw error('duplicate_phone', 'Bu telefon zaten kayıtlı', 409)
  }

  const updated = await customerRepo.updateByIdAndTenant(customerId, tenantId, {
    name,
    nameNormalized: normalizeKey(name),
    phone,
    address: input?.address === undefined ? undefined : String(input.address || '').trim(),
    note: input?.note === undefined ? undefined : String(input.note || '').trim(),
    favoriteProductIds: input?.favoriteProductIds === undefined
      ? undefined
      : (Array.isArray(input.favoriteProductIds)
        ? input.favoriteProductIds.filter((id) => mongoose.isValidObjectId(String(id))).map(String)
        : []),
    actorUserId
  })
  if (!updated) throw error('not_found', 'Cari bulunamadı', 404)
  const balance = await computeBalanceForCustomer(tenantId, updated.id)
  return mapCustomerDto(updated, balance)
}

export const deleteCustomer = async (tenantId, actorUserId, customerId) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const c = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!c) throw error('not_found', 'Cari bulunamadı', 404)
  const balance = await computeBalanceForCustomer(tenantId, c.id)
  if (Number(balance) > 0.009) throw error('has_debt', 'Borcu olan cari silinemez', 409)

  const anySale = await saleRepo.listByTenantAndCustomer(tenantId, c.id, { limit: 1 })
  if (Array.isArray(anySale) && anySale.length > 0) throw error('has_transactions', 'Hareketi olan cari silinemez', 409)
  const anyCol = await collectionRepo.listByCustomerAllBranches(tenantId, c.id, { limit: 1 })
  if (Array.isArray(anyCol) && anyCol.length > 0) throw error('has_transactions', 'Hareketi olan cari silinemez', 409)

  const deleted = await customerRepo.deleteByIdAndTenant(c.id, tenantId)
  if (!deleted) throw error('not_found', 'Cari bulunamadı', 404)
  return { success: true, id: deleted.id, actorUserId }
}

export const listCustomerSales = async (tenantId, customerId, branchIds) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const c = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!c) throw error('not_found', 'Cari bulunamadı', 404)
  const sales = branchIds && Array.isArray(branchIds) && branchIds.length > 0
    ? await saleRepo.listByTenantAndCustomerAndBranches(tenantId, customerId, branchIds, { limit: 200 })
    : await saleRepo.listByTenantAndCustomer(tenantId, customerId, { limit: 200 })
  return (sales || []).map((s) => ({
    orderId: String(s.id),
    total: Number(s.total || 0),
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    paymentMethod: s.payment?.method || null,
    branchId: s.branchId ? String(s.branchId) : null,
    items: Array.isArray(s.items)
      ? s.items.map((it) => ({
          name: String(it?.name || ''),
          qty: Number(it?.qty || 0),
          price: Number(it?.unitPrice || 0),
          lineTotal: Number(it?.lineTotal || 0)
        }))
      : []
  }))
}

export const collect = async (tenantId, actorUserId, customerId, input) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const c = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!c) throw error('not_found', 'Cari bulunamadı', 404)
  const method = String(input?.method || '').trim()
  const amount = Number(input?.amount || 0)
  if (method !== 'cash' && method !== 'pos' && method !== 'bank' && method !== 'discount') throw error('invalid_request', 'Invalid method', 400)
  if (!Number.isFinite(amount) || amount <= 0) throw error('invalid_request', 'Invalid amount', 400)
  const note = String(input?.note || '').trim()
  const branchId = input?.branchId && mongoose.isValidObjectId(input.branchId) ? input.branchId : null
  const created = await collectionRepo.create({
    tenantId,
    branchId,
    customerId,
    method,
    amount,
    note,
    createdAt: new Date(),
    actorUserId,
    isActive: true
  })
  const balance = await computeBalanceForCustomer(tenantId, customerId)
  return { id: created.id, success: true, balance }
}

export const upsertPublicCustomerAccount = async (tenantId, input) => {
  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)
  const address = String(input?.address || '').trim()
  const location = String(input?.location || '').trim()

  if (!name || name.length < 2) throw error('name_required', 'Ad soyad zorunludur', 400)
  if (!phone) throw error('phone_required', 'Telefon zorunludur', 400)
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length < 10) throw error('invalid_request', 'Telefon en az 10 karakter olmalı', 400)

  const existing = await customerRepo.findByPhoneAndTenant(tenantId, phone)
  if (existing) {
    const updated = await customerRepo.updateByIdAndTenant(existing.id || existing._id, tenantId, {
      name,
      nameNormalized: normalizeKey(name),
      phone,
      address: address || existing.address || '',
      note: location || existing.note || ''
    })
    const balance = await computeBalanceForCustomer(tenantId, updated.id)
    return {
      customer: {
        ...mapCustomerDto(updated, balance),
        location: String(updated.note || '')
      },
      isNew: false
    }
  }

  const created = await customerRepo.create({
    tenantId,
    name,
    nameNormalized: normalizeKey(name),
    phone,
    address,
    note: location,
    favoriteProductIds: [],
    isActive: true,
    createdAt: new Date(),
    actorUserId: null
  })

  return {
    customer: {
      ...mapCustomerDto(created, 0),
      location: String(created.note || '')
    },
    isNew: true
  }
}

export const registerPublicCustomerAccount = async (tenantId, input) => {
  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)
  const password = String(input?.password || '')
  const passwordRepeat = String(input?.passwordRepeat || '')
  const address = String(input?.address || '').trim()
  const location = String(input?.location || '').trim()

  if (!name || name.length < 2) throw error('name_required', 'Ad soyad zorunludur', 400)
  if (!phone) throw error('phone_required', 'Telefon zorunludur', 400)
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length < 10) throw error('invalid_request', 'Telefon en az 10 karakter olmalı', 400)
  if (!password) throw error('password_required', 'Şifre zorunludur', 400)
  if (password.length < MIN_PASSWORD_LENGTH) throw error('password_too_short', `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`, 400)
  if (password !== passwordRepeat) throw error('password_mismatch', 'Şifreler aynı değil', 400)

  const existing = await customerRepo.findByPhoneAndTenant(tenantId, phone)
  if (existing) throw error('duplicate_phone', 'Bu telefon numarasıyla kayıtlı hesap var, mevcut hesaptan giriş yapın', 409)

  const passwordHash = await bcrypt.hash(password, 10)
  const created = await customerRepo.create({
    tenantId,
    name,
    nameNormalized: normalizeKey(name),
    phone,
    address,
    note: location,
    passwordHash,
    favoriteProductIds: [],
    isActive: true,
    createdAt: new Date(),
    actorUserId: null
  })

  return {
    customer: {
      ...mapCustomerDto(created, 0),
      location: String(created.note || '')
    }
  }
}

export const loginPublicCustomerAccount = async (tenantId, input) => {
  const phone = normalizePhone(input?.phone)
  const password = String(input?.password || '')

  if (!phone) throw error('phone_required', 'Telefon zorunludur', 400)
  if (!password) throw error('password_required', 'Şifre zorunludur', 400)

  const customer = await customerRepo.findByPhoneAndTenant(tenantId, phone)
  if (!customer) throw error('invalid_credentials', 'Telefon numarası veya şifre hatalı', 401)
  if (!String(customer.passwordHash || '').trim()) {
    throw error('password_not_set', 'Bu hesap için şifre bulunamadı. Lütfen yeni hesap oluşturun veya işletme ile iletişime geçin', 409)
  }

  const ok = await bcrypt.compare(password, String(customer.passwordHash || ''))
  if (!ok) throw error('invalid_credentials', 'Telefon numarası veya şifre hatalı', 401)

  const balance = await computeBalanceForCustomer(tenantId, customer.id || customer._id)
  return {
    customer: {
      ...mapCustomerDto(customer, balance),
      location: String(customer.note || '')
    }
  }
}

export const updatePublicCustomerAccount = async (tenantId, customerId, input) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Musteri hesabi bulunamadi', 404)

  const existing = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!existing) throw error('not_found', 'Musteri hesabi bulunamadi', 404)

  const updated = await updateCustomer(tenantId, null, customerId, {
    name: input?.name,
    phone: input?.phone,
    address: input?.address,
    note: input?.location,
    favoriteProductIds: existing.favoriteProductIds
  })

  return {
    customer: {
      ...updated,
      location: String(updated.note || '')
    }
  }
}

export const getCustomerFavoriteProductIds = async (tenantId, customerId) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const customer = await customerRepo.findByIdAndTenant(customerId, tenantId)
  if (!customer) throw error('not_found', 'Cari bulunamadı', 404)
  return Array.isArray(customer.favoriteProductIds) ? customer.favoriteProductIds.map((id) => String(id)) : []
}

export const updateCustomerFavoriteProductIds = async (tenantId, customerId, favoriteProductIds) => {
  if (!mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Invalid id', 400)
  const normalizedIds = Array.isArray(favoriteProductIds)
    ? favoriteProductIds.filter((id) => mongoose.isValidObjectId(String(id))).map(String)
    : []
  const updated = await customerRepo.updateByIdAndTenant(customerId, tenantId, {
    favoriteProductIds: normalizedIds
  })
  if (!updated) throw error('not_found', 'Cari bulunamadı', 404)
  return normalizedIds
}
