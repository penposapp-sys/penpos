import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as customerRepo from '../repositories/canteenCustomerRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import * as collectionRepo from '../repositories/canteenCustomerCollectionRepository.js'

const normalizeName = (name) => String(name || '').trim()
const normalizeKey = (name) => normalizeName(name).toLowerCase()
const normalizePhone = (phone) => {
  const raw = String(phone || '').trim()
  if (!raw) return ''
  return raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
}

const computeBalanceForCustomer = async (tenantId, customerId) => {
  const sales = await saleRepo.listByTenantAndCustomer(tenantId, customerId, { limit: 10000 })
  const debt = (sales || []).reduce((sum, s) => sum + (s.payment?.method === 'account' ? Number(s.total || 0) : 0), 0)
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
    if (s.payment?.method !== 'account') continue
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
  return (items || []).map(c => ({ id: c.id, name: c.name, phone: c.phone || '' }))
}

export const createCustomer = async (tenantId, actorUserId, input) => {
  const name = normalizeName(input?.name)
  const phone = normalizePhone(input?.phone)
  const note = String(input?.note || '').trim()
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
    note,
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
  return { id: c.id, name: c.name, phone: c.phone || '', address: c.address || '', note: c.note || '', balance }
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
    actorUserId
  })
  if (!updated) throw error('not_found', 'Cari bulunamadı', 404)
  const balance = await computeBalanceForCustomer(tenantId, updated.id)
  return { id: updated.id, name: updated.name, phone: updated.phone || '', address: updated.address || '', note: updated.note || '', balance }
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
  return (sales || []).map(s => ({
    orderId: String(s.id),
    total: Number(s.total || 0),
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    paymentMethod: s.payment?.method || null,
    branchId: s.branchId ? String(s.branchId) : null,
    items: Array.isArray(s.items)
      ? s.items.map(it => ({
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
  if (method !== 'cash' && method !== 'pos' && method !== 'bank') throw error('invalid_request', 'Invalid method', 400)
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
