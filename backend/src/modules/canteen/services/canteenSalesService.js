import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as prodRepo from '../repositories/canteenProductRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import * as movementRepo from '../repositories/canteenStockMovementRepository.js'
import { findTenantPaymentSettings } from '../repositories/canteenSettingsRepository.js'
import { findByIdAndTenant as findCustomerById } from '../repositories/canteenCustomerRepository.js'
import { findAnyByIdAndTenant as findAnyBranchById } from '../repositories/canteenBranchRepository.js'
import { resolvePaymentMethodSelection } from '../../../services/paymentSettingsService.js'
import User from '../../../models/User.js'

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const toInt = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.floor(n)
}

const roundMoney = (value) => Number(toNumber(value).toFixed(2))

const normalizeSaleStatus = (sale = {}) => {
  const raw = String(sale?.status || '').trim().toLowerCase()
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled'
  if (raw === 'reopened' || raw === 'pending') return raw
  if (raw === 'completed' || raw === 'closed') return 'completed'
  if (sale?.isActive === false) return 'cancelled'
  return 'completed'
}

const saleNoFromId = (id) => {
  const raw = String(id || '').trim()
  if (!raw) return '-'
  return `#${raw.slice(-6).toUpperCase()}`
}

const saleItemCount = (sale = {}) =>
  Array.isArray(sale?.items) ? sale.items.reduce((sum, item) => sum + toInt(item?.qty), 0) : 0

const mapSaleRow = (sale = {}) => {
  const branch = sale?.branchId && typeof sale.branchId === 'object' ? sale.branchId : null
  const user = sale?.actorUserId && typeof sale.actorUserId === 'object' ? sale.actorUserId : null
  const payment = sale?.payment || {}
  const status = normalizeSaleStatus(sale)
  return {
    id: String(sale?._id || sale?.id || ''),
    saleNo: saleNoFromId(sale?._id || sale?.id || ''),
    branchId: branch?._id ? String(branch._id) : String(sale?.branchId || ''),
    branchName: String(branch?.name || sale?.branchName || 'Şube'),
    cashierId: user?._id ? String(user._id) : (sale?.actorUserId ? String(sale.actorUserId) : null),
    cashierName: String(user?.name || sale?.cashierName || sale?.actorUserName || sale?.actorUsername || 'Bilinmeyen Personel'),
    createdAt: sale?.createdAt || null,
    total: Number(sale?.total || 0),
    paymentType: String(payment?.methodName || payment?.method || payment?.methodType || '-'),
    paymentMethod: String(payment?.method || ''),
    paymentMethodType: String(payment?.methodType || ''),
    itemCount: saleItemCount(sale),
    status,
    note: String(sale?.note || ''),
    discountPercent: Number(sale?.discountPercent || 0),
    discountTotal: Number(sale?.discountTotal || 0),
    subTotal: Number(sale?.subTotal || 0),
    payment: {
      method: String(payment?.method || ''),
      methodName: String(payment?.methodName || ''),
      methodType: String(payment?.methodType || ''),
      amount: Number(payment?.amount || 0),
      note: String(payment?.note || '')
    },
    cancelledAt: sale?.cancelledAt || null,
    cancelledBy: sale?.cancelledBy ? String(sale.cancelledBy) : null,
    cancelReason: String(sale?.cancelReason || ''),
    reopenedAt: sale?.reopenedAt || null,
    reopenedBy: sale?.reopenedBy ? String(sale.reopenedBy) : null
  }
}

const mapSaleDetail = (sale = {}) => {
  const row = mapSaleRow(sale)
  return {
    ...row,
    customerId: sale?.customerId ? String(sale.customerId?._id || sale.customerId) : null,
    customerName: String(sale?.customerId?.name || sale?.customerName || ''),
    items: Array.isArray(sale?.items)
      ? sale.items.map((item) => ({
          productId: item?.productId ? String(item.productId) : null,
          name: String(item?.name || ''),
          qty: Number(item?.qty || 0),
          unitPrice: Number(item?.unitPrice || 0),
          lineTotal: Number(item?.lineTotal || 0),
          vatRate: Number(item?.vatRate || 0),
          note: String(item?.note || '')
        }))
      : [],
    payment: row.payment,
    details: {
      discountPercent: Number(sale?.discountPercent || 0),
      discountTotal: Number(sale?.discountTotal || 0),
      subTotal: Number(sale?.subTotal || 0),
      total: Number(sale?.total || 0)
    }
  }
}

export const createSale = async (tenantId, branchId, actorUserId, input) => {
  const items = Array.isArray(input?.items) ? input.items : []
  if (items.length === 0) throw error('invalid_request', 'Items required', 400)

  const reqIds = items.map(it => String(it?.productId || '')).filter(Boolean)
  const uniq = Array.from(new Set(reqIds))
  if (uniq.length === 0) throw error('invalid_request', 'Items required', 400)
  for (const id of uniq) {
    if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Invalid product id', 400)
  }

  const products = await prodRepo.listByIdsAndScope(uniq, tenantId, branchId)
  const map = new Map(products.map(p => [String(p.id), p]))
  if (products.length !== uniq.length) {
    const any = await prodRepo.listByIdsAndTenant(uniq, tenantId)
    const anyMap = new Map((any || []).map(p => [String(p.id), p]))
    for (const pid of uniq) {
      if (map.has(String(pid))) continue
      const p = anyMap.get(String(pid))
      if (p && String(p.branchId) !== String(branchId)) {
        throw error('product_branch_mismatch', 'Ürün şubesi uyuşmuyor', 400)
      }
    }
  }

  const lines = []
  for (const it of items) {
    const pid = String(it?.productId || '')
    const qty = toInt(it?.qty)
    if (!pid || qty <= 0) continue
    const p = map.get(pid)
    if (!p) throw error('product_not_found', 'Ürün bulunamadı', 404)
    const unitPrice = toNumber(p.price)
    const lineTotal = unitPrice * qty
    lines.push({
      productId: p.id,
      name: p.name,
      qty,
      unitPrice,
      lineTotal,
      vatRate: toNumber(p.vatRate)
    })
  }
  if (lines.length === 0) throw error('invalid_request', 'Items required', 400)

  const subTotal = lines.reduce((sum, l) => sum + toNumber(l.lineTotal), 0)
  const discountPercentRaw = toNumber(input?.discountPercent)
  if (!Number.isFinite(discountPercentRaw) || discountPercentRaw < 0 || discountPercentRaw > 100) {
    throw error('invalid_discount', 'Geçersiz indirim oranı', 400)
  }
  const discountPercent = roundMoney(discountPercentRaw)
  const discountTotal = roundMoney((subTotal * discountPercent) / 100)
  const total = roundMoney(Math.max(0, subTotal - discountTotal))

  const requestedMethod = String(input?.payment?.method || '').trim()
  const note = String(input?.payment?.note || '').trim()
  const paymentAmount = toNumber(input?.payment?.amount)
  const saleNote = String(input?.note || '').trim()
  const customerId = input?.payment?.customerId ? String(input.payment.customerId) : null

  if (!requestedMethod) {
    throw error('invalid_request', 'Invalid payment method', 400)
  }
  if (!Number.isFinite(paymentAmount) || Math.abs(paymentAmount - total) > 0.009) {
    throw error('invalid_request', 'Invalid payment amount', 400)
  }

  const resolvedPayment = await resolvePaymentMethodSelection(tenantId, branchId, requestedMethod)
  const method = String(resolvedPayment.methodId || '').trim()
  const methodName = String(resolvedPayment.methodName || '').trim()
  const rawMethodType = String(resolvedPayment.methodType || '').trim()
  const methodType = rawMethodType === 'credit' ? 'account' : rawMethodType
  if (!method || !methodName || !methodType) {
    throw error('invalid_request', 'Invalid payment method', 400)
  }

  const paySettings = await findTenantPaymentSettings(tenantId)
  const cashEnabled = paySettings ? !!paySettings.cashEnabled : true
  const posEnabled = paySettings ? (paySettings.posEnabled === undefined ? !!paySettings.cardEnabled : !!paySettings.posEnabled) : true
  const bankEnabled = paySettings ? (paySettings.bankEnabled === undefined ? !!paySettings.ibanEnabled : !!paySettings.bankEnabled) : false
  const accountEnabled = paySettings ? (paySettings.accountEnabled === undefined ? true : !!paySettings.accountEnabled) : true

  if (methodType === 'cash' && !cashEnabled) throw error('payment_disabled', 'Cash disabled', 400)
  if (methodType === 'card' && !posEnabled) throw error('payment_disabled', 'POS disabled', 400)
  if (methodType === 'bank' && !bankEnabled) throw error('payment_disabled', 'Bank disabled', 400)
  if (methodType === 'account' && !accountEnabled) throw error('payment_disabled', 'Account disabled', 400)

  let resolvedCustomerId = null
  if (methodType === 'account') {
    if (!customerId || !mongoose.isValidObjectId(customerId)) throw error('invalid_request', 'Customer required', 400)
    const c = await findCustomerById(customerId, tenantId)
    if (!c) throw error('not_found', 'Cari bulunamadı', 404)
    resolvedCustomerId = c.id
  }

  const byProductId = new Map()
  for (const l of lines) {
    const pid = String(l.productId)
    byProductId.set(pid, (byProductId.get(pid) || 0) + toInt(l.qty))
  }

  const updates = []
  const movements = []
  for (const [pid, qty] of byProductId.entries()) {
    const p = map.get(String(pid))
    if (!p || p.stockTrackingEnabled !== true) continue
    if (qty <= 0) continue
    const updated = await prodRepo.decStockQtyByIdAndScopeIfEnough(pid, tenantId, branchId, qty)
    if (!updated) {
      for (const u of updates) {
        await prodRepo.incStockQtyByIdAndScope(u.productId, tenantId, branchId, u.decQty)
      }
      throw error('insufficient_stock', 'Stok yetersiz', 409)
    }
    updates.push({ productId: String(pid), stockQty: Number(updated.stockQty || 0), decQty: qty })
    movements.push({
      tenantId,
      branchId,
      productId: updated.id,
      productName: String(updated.name || p.name || ''),
      barcode: String(updated.barcode || p.barcode || ''),
      type: 'out',
      qty,
      note: '',
      createdBy: actorUserId || null,
      createdAt: new Date()
    })
  }

  const saleId = new mongoose.Types.ObjectId()
  const channel = String(input?.channel || '').trim().toLowerCase() === 'qr' ? 'qr' : 'cashier'
  let created
  try {
    created = await saleRepo.create({
      _id: saleId,
      tenantId,
      branchId,
      customerId: resolvedCustomerId,
      items: lines,
      subTotal,
      discountPercent,
      discountTotal,
      total,
      channel,
      payment: { method, methodName, methodType, amount: total, note },
      note: saleNote,
      isActive: true,
      status: 'completed',
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: '',
      reopenedAt: null,
      reopenedBy: null,
      createdAt: new Date(),
      actorUserId
    })
  } catch (err) {
    for (const u of updates) {
      await prodRepo.incStockQtyByIdAndScope(u.productId, tenantId, branchId, u.decQty)
    }
    throw err
  }

  for (const m of movements) {
    m.note = `sale:${String(created.id)}`
  }

  for (const m of movements) {
    await movementRepo.create(m)
  }

  return {
    id: created.id,
    subTotal: Number(created.subTotal || 0),
    discountPercent: Number(created.discountPercent || 0),
    discountTotal: Number(created.discountTotal || 0),
    total: Number(created.total || 0),
    createdAt: created.createdAt,
    payment: created.payment,
    customerId: created.customerId ? String(created.customerId) : null,
    stockUpdates: updates.map(u => ({ productId: u.productId, stockQty: Number(u.stockQty || 0) }))
  }
}

export const deleteSale = async (tenantId, actorUserId, saleId) => {
  if (!mongoose.isValidObjectId(saleId)) throw error('invalid_request', 'Invalid id', 400)
  const deleted = await saleRepo.softDeleteByIdAndTenant(saleId, tenantId, {
    cancelledBy: actorUserId || null,
    cancelReason: 'user_cancelled'
  })
  if (!deleted) throw error('not_found', 'Satış bulunamadı', 404)
  return { success: true, id: deleted.id, actorUserId }
}

export const reopenSale = async (tenantId, branchId, actorUserId, saleId) => {
  if (!mongoose.isValidObjectId(saleId)) throw error('invalid_request', 'Invalid id', 400)
  const reopened = await saleRepo.reopenByIdAndScope(saleId, tenantId, branchId, {
    reopenedBy: actorUserId || null
  })
  if (!reopened) throw error('not_found', 'Satış bulunamadı', 404)
  return { success: true, id: reopened.id, actorUserId, status: normalizeSaleStatus(reopened) }
}

export const listSales = async (tenantId, branchIds, query = {}) => {
  const limitRaw = Number(query?.limit || 20)
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20))
  const pageRaw = Number(query?.page || 1)
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1)
  const skip = (page - 1) * limit
  const keyword = String(query?.q || '').trim().toLowerCase()
  const includeCancelled = String(query?.status || '').trim().toLowerCase() === 'cancelled'
  const items = await saleRepo.listByTenantAndBranchIds(tenantId, branchIds, { limit, skip, includeCancelled })
  const total = await saleRepo.countByTenantAndBranchIds(tenantId, branchIds, { includeCancelled })
  const rows = (items || [])
    .map(mapSaleRow)
    .filter((row) => {
      if (!keyword) return true
      const hay = [
        row.saleNo,
        row.branchName,
        row.cashierName,
        row.paymentType,
        row.status,
        row.note
      ].join(' ').toLowerCase()
      return hay.includes(keyword)
    })
  return {
    items: rows,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(Number(total || 0) / Number(limit || 1)))
  }
}

export const getSale = async (tenantId, branchId, saleId) => {
  if (!mongoose.isValidObjectId(saleId)) throw error('invalid_request', 'Invalid id', 400)
  const s = await saleRepo.findAnyByIdAndScope(saleId, tenantId, branchId)
  if (!s) throw error('not_found', 'Satış bulunamadı', 404)
  const [branch, cashier, customer] = await Promise.all([
    s?.branchId ? findAnyBranchById(s.branchId, tenantId) : Promise.resolve(null),
    s?.actorUserId ? User.findById(s.actorUserId).select('name username').lean() : Promise.resolve(null),
    s?.customerId ? findCustomerById(s.customerId, tenantId, { includeInactive: true }) : Promise.resolve(null)
  ])
  return mapSaleDetail({
    ...(typeof s.toObject === 'function' ? s.toObject() : s),
    branchId: branch || s.branchId,
    actorUserId: cashier || s.actorUserId,
    customerId: customer || s.customerId,
    customerName: String(customer?.name || '')
  })
}
