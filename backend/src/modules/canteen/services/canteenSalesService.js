import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as prodRepo from '../repositories/canteenProductRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import * as movementRepo from '../repositories/canteenStockMovementRepository.js'
import * as batchRepo from '../repositories/canteenProductBatchRepository.js'
import { findTenantPaymentSettings } from '../repositories/canteenSettingsRepository.js'
import { findByIdAndTenant as findCustomerById } from '../repositories/canteenCustomerRepository.js'
import { findAnyByIdAndTenant as findAnyBranchById } from '../repositories/canteenBranchRepository.js'
import { resolvePaymentMethodSelection } from '../../../services/paymentSettingsService.js'
import { consumeProductQtyFifo, ensureProductBatches, syncProductFromOpenBatch } from './canteenProductBatchService.js'
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
const resolveSaleUnitPrice = (product = {}) => {
  const basePrice = toNumber(product?.price)
  const vatRate = toNumber(product?.vatRate)
  if (product?.vatIncluded === false && vatRate > 0) {
    return roundMoney(basePrice * (1 + (vatRate / 100)))
  }
  return roundMoney(basePrice)
}

const splitSaleLineBySegments = (product, qty, segments = []) => {
  if (!Array.isArray(segments) || segments.length === 0) {
    const unitPrice = resolveSaleUnitPrice(product)
    return [{
      productId: product.id,
      name: product.name,
      qty,
      unitPrice,
      lineTotal: roundMoney(unitPrice * qty),
      vatRate: toNumber(product.vatRate),
      vatIncluded: product.vatIncluded !== false,
      batchId: null,
      batchSourcePrice: roundMoney(product?.price || 0)
    }]
  }

  return segments
    .filter((segment) => Number(segment?.qty || 0) > 0)
    .map((segment) => ({
      productId: product.id,
      name: product.name,
      qty: Number(segment.qty || 0),
      unitPrice: roundMoney(segment.unitPrice || 0),
      lineTotal: roundMoney(Number(segment.qty || 0) * Number(segment.unitPrice || 0)),
      vatRate: toNumber(segment.vatRate ?? product.vatRate),
      vatIncluded: segment.vatIncluded !== false,
      batchId: segment.batchId || null,
      batchSourcePrice: roundMoney(segment.salePrice || product?.price || 0)
    }))
}

const previewSaleSegments = async (tenantId, branchId, product, qty) => {
  if (product?.stockTrackingEnabled !== true) return splitSaleLineBySegments(product, qty)
  await ensureProductBatches(product)
  const openBatches = await batchRepo.listOpenByProductId(tenantId, branchId, product.id)
  let needed = Number(qty || 0)
  const segments = []
  for (const batch of openBatches) {
    if (needed <= 0) break
    const remaining = Number(batch?.remainingQty || 0)
    if (remaining <= 0) continue
    const take = Math.min(remaining, needed)
    const vatRate = toNumber(batch?.vatRate ?? product?.vatRate)
    const vatIncluded = batch?.vatIncluded !== false
    const basePrice = toNumber(batch?.salePrice ?? product?.price)
    const unitPrice = vatIncluded === false && vatRate > 0
      ? roundMoney(basePrice * (1 + (vatRate / 100)))
      : roundMoney(basePrice)
    segments.push({
      batchId: String(batch._id || ''),
      qty: take,
      unitPrice,
      salePrice: basePrice,
      vatRate,
      vatIncluded
    })
    needed -= take
  }
  if (needed > 0.0001) throw error('insufficient_stock', 'Stok yetersiz', 409)
  return splitSaleLineBySegments(product, qty, segments)
}

const previewProductAfterSale = async (tenantId, branchId, product, qty) => {
  if (product?.stockTrackingEnabled !== true) {
    const unitPrice = resolveSaleUnitPrice(product)
    return {
      segments: splitSaleLineBySegments(product, qty),
      nextStockQty: Math.max(0, Number(product?.stockQty || 0) - Number(qty || 0)),
      nextSalePrice: unitPrice,
      nextBasePrice: roundMoney(product?.price || 0)
    }
  }

  await ensureProductBatches(product)
  const openBatches = await batchRepo.listOpenByProductId(tenantId, branchId, product.id)
  let needed = Number(qty || 0)
  const segments = []
  const simulated = openBatches.map((batch) => ({
    id: String(batch?._id || ''),
    remainingQty: Number(batch?.remainingQty || 0),
    salePrice: Number(batch?.salePrice ?? product?.price ?? 0),
    vatRate: Number(batch?.vatRate ?? product?.vatRate ?? 0),
    vatIncluded: batch?.vatIncluded !== false
  }))

  for (const batch of simulated) {
    if (needed <= 0) break
    if (batch.remainingQty <= 0) continue
    const take = Math.min(batch.remainingQty, needed)
    const unitPrice = batch.vatIncluded === false && Number(batch.vatRate || 0) > 0
      ? roundMoney(Number(batch.salePrice || 0) * (1 + (Number(batch.vatRate || 0) / 100)))
      : roundMoney(batch.salePrice || 0)
    segments.push({
      batchId: batch.id,
      qty: take,
      unitPrice,
      salePrice: roundMoney(batch.salePrice || 0),
      vatRate: Number(batch.vatRate || 0),
      vatIncluded: batch.vatIncluded !== false
    })
    batch.remainingQty = roundMoney(batch.remainingQty - take)
    needed = roundMoney(needed - take)
  }

  if (needed > 0.0001) throw error('insufficient_stock', 'Stok yetersiz', 409)

  const nextOpen = simulated.find((batch) => Number(batch.remainingQty || 0) > 0.0001)
  const nextBasePrice = nextOpen ? roundMoney(nextOpen.salePrice || 0) : roundMoney(product?.price || 0)
  const nextSalePrice = nextOpen
    ? (nextOpen.vatIncluded === false && Number(nextOpen.vatRate || 0) > 0
        ? roundMoney(Number(nextOpen.salePrice || 0) * (1 + (Number(nextOpen.vatRate || 0) / 100)))
        : roundMoney(nextOpen.salePrice || 0))
    : resolveSaleUnitPrice(product)

  return {
    segments: splitSaleLineBySegments(product, qty, segments),
    nextStockQty: Math.max(0, Number(product?.stockQty || 0) - Number(qty || 0)),
    nextSalePrice,
    nextBasePrice
  }
}

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
    branchName: String(branch?.name || sale?.branchName || 'Sube'),
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
          vatIncluded: item?.vatIncluded !== false,
          batchId: item?.batchId ? String(item.batchId) : null,
          batchSourcePrice: Number(item?.batchSourcePrice || 0),
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
        throw error('product_branch_mismatch', 'Urun subesi uyusmuyor', 400)
      }
    }
  }

  const byProductId = new Map()
  const lines = []
  for (const it of items) {
    const pid = String(it?.productId || '')
    const qty = toInt(it?.qty)
    if (!pid || qty <= 0) continue
    let p = map.get(pid)
    if (!p) throw error('product_not_found', 'Urun bulunamadi', 404)

    if (p.stockTrackingEnabled === true) {
      await ensureProductBatches(p)
      await syncProductFromOpenBatch(tenantId, branchId, p.id, p)
      const fresh = await prodRepo.findByIdAndScope(p.id, tenantId, branchId)
      if (fresh) {
        p = fresh
        map.set(pid, fresh)
      }
    }

    byProductId.set(pid, (byProductId.get(pid) || 0) + qty)

    lines.push(...await previewSaleSegments(tenantId, branchId, p, qty))
  }
  if (lines.length === 0) throw error('invalid_request', 'Items required', 400)

  const subTotal = lines.reduce((sum, l) => sum + toNumber(l.lineTotal), 0)
  const discountPercentRaw = toNumber(input?.discountPercent)
  if (!Number.isFinite(discountPercentRaw) || discountPercentRaw < 0 || discountPercentRaw > 100) {
    throw error('invalid_discount', 'Gecersiz indirim orani', 400)
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
    if (!c) throw error('not_found', 'Cari bulunamadi', 404)
    resolvedCustomerId = c.id
  }

  const updates = []
  const batchRollback = new Map()
  const movements = []
  for (const [pid, qty] of byProductId.entries()) {
    const p = map.get(String(pid))
    if (!p || p.stockTrackingEnabled !== true) continue
    if (qty <= 0) continue
    if (!batchRollback.has(String(pid))) {
      const snapshot = await batchRepo.listByProductId(tenantId, branchId, pid)
      batchRollback.set(String(pid), snapshot.map((batch) => ({ id: String(batch._id || batch.id || ''), remainingQty: Number(batch?.remainingQty || 0) })))
    }
    const updated = await prodRepo.decStockQtyByIdAndScopeIfEnough(pid, tenantId, branchId, qty)
    if (!updated) throw error('insufficient_stock', 'Stok yetersiz', 409)
    try {
      await consumeProductQtyFifo(tenantId, branchId, { ...p.toObject?.() || p, id: p.id, tenantId, branchId }, qty)
    } catch (err) {
      await prodRepo.incStockQtyByIdAndScope(pid, tenantId, branchId, qty)
      throw err
    }
    const nextSnapshot = await prodRepo.findByIdAndScope(pid, tenantId, branchId)
    updates.push({ productId: String(pid), stockQty: Number(nextSnapshot?.stockQty ?? updated?.stockQty ?? 0), decQty: qty })
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
    for (const [pid, snapshot] of batchRollback.entries()) {
      for (const item of snapshot || []) {
        if (!item?.id) continue
        await batchRepo.setRemainingQtyById(item.id, item.remainingQty)
      }
      await syncProductFromOpenBatch(tenantId, branchId, pid)
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

export const previewSale = async (tenantId, branchId, input) => {
  const items = Array.isArray(input?.items) ? input.items : []
  if (items.length === 0) return { items: [], total: 0, subTotal: 0, stockPreview: [] }

  const reqIds = items.map((it) => String(it?.productId || '')).filter(Boolean)
  const uniq = Array.from(new Set(reqIds))
  if (uniq.length === 0) return { items: [], total: 0, subTotal: 0, stockPreview: [] }

  const products = await prodRepo.listByIdsAndScope(uniq, tenantId, branchId)
  const map = new Map(products.map((p) => [String(p.id), p]))
  const previewLines = []
  const stockPreview = []

  for (const it of items) {
    const pid = String(it?.productId || '')
    const qty = toInt(it?.qty)
    if (!pid || qty <= 0) continue
    let product = map.get(pid)
    if (!product) throw error('product_not_found', 'Urun bulunamadi', 404)
    if (product.stockTrackingEnabled === true) {
      await ensureProductBatches(product)
      await syncProductFromOpenBatch(tenantId, branchId, product.id, product)
      const fresh = await prodRepo.findByIdAndScope(product.id, tenantId, branchId)
      if (fresh) {
        product = fresh
        map.set(pid, fresh)
      }
    }

    const preview = await previewProductAfterSale(tenantId, branchId, product, qty)
    previewLines.push(...preview.segments)
    stockPreview.push({
      productId: String(product.id),
      stockQty: Number(preview.nextStockQty || 0),
      nextSalePrice: Number(preview.nextSalePrice || 0),
      nextBasePrice: Number(preview.nextBasePrice || 0)
    })
  }

  const subTotal = roundMoney(previewLines.reduce((sum, line) => sum + Number(line?.lineTotal || 0), 0))
  return {
    items: previewLines,
    subTotal,
    total: subTotal,
    stockPreview
  }
}

export const deleteSale = async (tenantId, actorUserId, saleId) => {
  if (!mongoose.isValidObjectId(saleId)) throw error('invalid_request', 'Invalid id', 400)
  const sale = await saleRepo.findAnyByIdAndTenant(saleId, tenantId)
  if (!sale) throw error('not_found', 'Satis bulunamadi', 404)
  if (normalizeSaleStatus(sale) === 'cancelled') return { success: true, id: String(sale.id || sale._id || ''), actorUserId }

  const branchId = String(sale?.branchId || '')
  const items = Array.isArray(sale?.items) ? sale.items : []
  const qtyByProduct = new Map()
  const touchedProducts = new Set()
  for (const item of items) {
    const productId = String(item?.productId || '')
    const qty = Number(item?.qty || 0)
    if (!productId || qty <= 0) continue
    qtyByProduct.set(productId, Number(qtyByProduct.get(productId) || 0) + qty)
    touchedProducts.add(productId)
    if (item?.batchId) {
      const batch = await batchRepo.updateById(String(item.batchId), { $inc: { remainingQty: qty } })
      if (batch?.productId) touchedProducts.add(String(batch.productId))
    }
  }
  for (const [productId, qty] of qtyByProduct.entries()) {
    await prodRepo.incStockQtyByIdAndScope(productId, tenantId, branchId, qty)
    const product = await prodRepo.findByIdAndScope(productId, tenantId, branchId)
    await movementRepo.create({
      tenantId,
      branchId,
      productId,
      productName: String(product?.name || ''),
      barcode: String(product?.barcode || ''),
      type: 'in',
      qty,
      note: `sale_cancel:${String(saleId)}`,
      createdBy: actorUserId || null,
      createdAt: new Date()
    })
  }
  for (const productId of touchedProducts) {
    await syncProductFromOpenBatch(tenantId, branchId, productId)
  }

  const deleted = await saleRepo.softDeleteByIdAndTenant(saleId, tenantId, {
    cancelledBy: actorUserId || null,
    cancelReason: 'user_cancelled'
  })
  if (!deleted) throw error('not_found', 'Satis bulunamadi', 404)
  return { success: true, id: deleted.id, actorUserId }
}

export const reopenSale = async (tenantId, branchId, actorUserId, saleId) => {
  if (!mongoose.isValidObjectId(saleId)) throw error('invalid_request', 'Invalid id', 400)
  const reopened = await saleRepo.reopenByIdAndScope(saleId, tenantId, branchId, {
    reopenedBy: actorUserId || null
  })
  if (!reopened) throw error('not_found', 'Satis bulunamadi', 404)
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
  if (!s) throw error('not_found', 'Satis bulunamadi', 404)
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
