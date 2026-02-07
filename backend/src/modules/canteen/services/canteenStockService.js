import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as logger from '../../../utils/logger.js'
import * as productRepo from '../repositories/canteenProductRepository.js'
import * as movementRepo from '../repositories/canteenStockMovementRepository.js'
import * as countRepo from '../repositories/canteenStockCountRepository.js'
import CanteenProduct from '../models/CanteenProduct.js'
import CanteenStockMovement from '../models/StockMovement.js'

const normalizeBarcode = (v) => String(v || '').trim()

const parseDate = (v) => {
  const s = String(v || '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export const createMovementByBarcode = async (tenantId, branchId, actorUserId, input) => {
  const type = String(input?.type || '').trim()
  if (!['in', 'out', 'waste', 'adjust'].includes(type)) throw error('validation_error', 'Geçersiz hareket tipi', 400)

  const productId = String(input?.productId || '').trim()
  const barcode = normalizeBarcode(input?.barcode)
  if (!productId && !barcode) throw error('validation_error', 'productId veya barcode zorunludur', 400)

  const qtyRaw = Number(input?.qty)
  if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) throw error('validation_error', 'Miktar zorunludur', 400)

  const note = String(input?.note || '').trim()
  const product = productId
    ? await productRepo.findByIdAndScope(productId, tenantId, branchId)
    : await productRepo.findByBarcodeAndScope(barcode, tenantId, branchId)
  if (!product) throw error('not_found', productId ? 'Ürün bulunamadı' : 'Barkod bulunamadı', 404)

  const effectiveBarcode = barcode || String(product?.barcode || '').trim() || ''

  let updated
  if (type === 'adjust') {
    updated = await productRepo.setStockQtyByIdAndScope(product.id, tenantId, branchId, qtyRaw)
  } else {
    const delta = type === 'in' ? qtyRaw : -qtyRaw
    updated = await productRepo.incStockQtyByIdAndScope(product.id, tenantId, branchId, delta)
  }
  if (!updated) throw error('not_found', 'Ürün bulunamadı', 404)

  const movement = await movementRepo.create({
    tenantId,
    branchId,
    productId: updated.id,
    productName: String(updated.name || ''),
    barcode: effectiveBarcode,
    type,
    qty: qtyRaw,
    note,
    createdBy: actorUserId || null,
    createdAt: new Date()
  })

  return {
    movement: {
      id: movement.id,
      type: movement.type,
      qty: Number(movement.qty || 0),
      barcode: movement.barcode || '',
      note: movement.note || '',
      createdAt: movement.createdAt
    },
    product: { id: updated.id, stockQty: Number(updated.stockQty || 0) }
  }
}

export const createMovement = createMovementByBarcode

export const listMovements = async (tenantId, branchId, query) => {
  const from = parseDate(query?.from)
  const to = parseDate(query?.to)
  const items = await movementRepo.listByTenantAndBranchInRange(tenantId, branchId, from, to, { limit: 200 })
  return (items || []).map(m => ({
    id: m.id,
    type: m.type,
    qty: Number(m.qty || 0),
    barcode: m.barcode || '',
    productName: String(m.productName || m.productId?.name || ''),
    productId: m.productId?._id ? String(m.productId._id) : (m.productId ? String(m.productId) : null),
    note: m.note || '',
    createdAt: m.createdAt,
    createdBy: m.createdBy ? String(m.createdBy) : null
  }))
}

export const startStockCount = async (tenantId, branchId, actorUserId) => {
  const created = await countRepo.createSession({
    tenantId,
    branchId,
    status: 'open',
    startedAt: new Date(),
    closedAt: null,
    createdBy: actorUserId || null
  })
  return { sessionId: created.id }
}

export const scanStockCount = async (tenantId, branchId, actorUserId, sessionId, input) => {
  if (!mongoose.isValidObjectId(sessionId)) throw error('invalid_request', 'Invalid session id', 400)
  const session = await countRepo.findSessionByIdAndScope(sessionId, tenantId, branchId)
  if (!session) throw error('not_found', 'Sayım bulunamadı', 404)
  if (session.status !== 'open') throw error('invalid_request', 'Sayım kapalı', 409)

  const productId = String(input?.productId || '').trim()
  const barcode = normalizeBarcode(input?.barcode)
  if (!productId && !barcode) throw error('validation_error', 'productId veya barcode zorunludur', 400)

  const qtyRaw = input?.qty === undefined || input?.qty === null || input?.qty === '' ? 1 : Number(input?.qty)
  if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) throw error('validation_error', 'Miktar geçersiz', 400)

  const product = productId
    ? await productRepo.findByIdAndScope(productId, tenantId, branchId)
    : await productRepo.findByBarcodeAndScope(barcode, tenantId, branchId)
  if (!product) throw error('not_found', productId ? 'Ürün bulunamadı' : 'Barkod bulunamadı', 404)

  const effectiveBarcode = barcode || String(product?.barcode || '').trim() || ''

  const item = await countRepo.upsertCountItem({
    tenantId,
    branchId,
    sessionId: String(session.id),
    productId: String(product.id),
    barcode: effectiveBarcode,
    qty: qtyRaw,
    currentStockAtStart: Number(product.stockQty || 0),
    productSnapshot: { name: product.name, barcode: product.barcode || '', stockQtyAtStart: Number(product.stockQty || 0) }
  })

  return {
    item: { itemId: String(item?._id || item?.id || ''), productId: String(item?.productId || ''), barcode: item.barcode || '', countedQty: Number(item.countedQty || 0) },
    product: { name: product.name, stockQty: Number(product.stockQty || 0) }
  }
}

export const finishStockCount = async (tenantId, branchId, actorUserId, sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) throw error('invalid_request', 'Invalid session id', 400)
  const session = await countRepo.findSessionByIdAndScope(sessionId, tenantId, branchId)
  if (!session) throw error('not_found', 'Sayım bulunamadı', 404)
  if (session.status === 'closed') throw error('invalid_request', 'Sayım kapalı', 409)
  if (session.status !== 'finished') {
    await countRepo.closeSessionByIdAndScope(session.id, tenantId, branchId, { status: 'finished', finishedAt: new Date() })
  }
  return await getStockCountSummary(tenantId, branchId, session.id)
}

export const updateStockCountItem = async (tenantId, branchId, actorUserId, sessionId, itemId, input) => {
  if (!mongoose.isValidObjectId(sessionId)) throw error('invalid_request', 'Invalid session id', 400)
  if (!mongoose.isValidObjectId(itemId)) throw error('invalid_request', 'Invalid item id', 400)
  const session = await countRepo.findSessionByIdAndScope(sessionId, tenantId, branchId)
  if (!session) throw error('not_found', 'Sayım bulunamadı', 404)
  if (session.status === 'closed') throw error('invalid_request', 'Sayım kapalı', 409)
  const qty = Number(input?.countedQty)
  if (!Number.isFinite(qty) || qty < 0) throw error('validation_error', 'countedQty geçersiz', 400)

  const updated = await countRepo.updateItemCountedQtyByIdAndScope({ tenantId, branchId, sessionId: String(session.id), itemId, countedQty: qty })
  if (!updated) throw error('not_found', 'Satır bulunamadı', 404)
  return {
    item: {
      itemId: String(updated._id || updated.id || ''),
      productId: String(updated.productId || ''),
      barcode: String(updated.barcode || ''),
      countedQty: Number(updated.countedQty || 0)
    }
  }
}

export const getStockCountSummary = async (tenantId, branchId, sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) throw error('invalid_request', 'Invalid session id', 400)
  const session = await countRepo.findSessionByIdAndScope(sessionId, tenantId, branchId)
  if (!session) throw error('not_found', 'Sayım bulunamadı', 404)
  const items = await countRepo.listItemsBySession(tenantId, branchId, session.id).lean()

  const byProductId = new Map()
  for (const it of items || []) {
    byProductId.set(String(it.productId), it)
  }

  const products = await productRepo.listByTenantAndBranch(tenantId, branchId)
  const productNameById = new Map((products || []).map(p => [String(p.id), String(p.name || '')]))
  const extra = []
  const missing = []
  const same = []

  for (const p of products || []) {
    const it = byProductId.get(String(p.id))
    const startQty = it ? Number(it.currentStockAtStart || 0) : Number(p.stockQty || 0)
    const countedQty = it ? Number(it.countedQty || 0) : 0
    const diff = countedQty - startQty
    const row = {
      productId: String(p.id),
      name: p.name,
      barcode: p.barcode || '',
      currentStockAtStart: startQty,
      countedQty,
      diff
    }
    if (diff > 0.0001) extra.push(row)
    else if (diff < -0.0001) missing.push(row)
    else same.push(row)
  }

  const scannedItems = (items || []).map(it => ({
    itemId: String(it._id || it.id || ''),
    productId: String(it.productId || ''),
    barcode: String(it.barcode || ''),
    productName: String(productNameById.get(String(it.productId)) || it?.productSnapshot?.name || ''),
    countedQty: Number(it.countedQty || 0)
  }))

  return { session: { id: String(session.id), status: String(session.status || 'open') }, items: scannedItems, extra, missing, same }
}

export const applyStockCount = async (tenantId, branchId, actorUserId, sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) throw error('invalid_request', 'Invalid session id', 400)
  const session = await countRepo.findSessionByIdAndScope(sessionId, tenantId, branchId)
  if (!session) throw error('not_found', 'Sayım bulunamadı', 404)
  if (session.status === 'closed') throw error('invalid_request', 'Sayım kapalı', 409)

  const countItems = await countRepo.listItemsBySession(tenantId, branchId, session.id)
  const byProductId = new Map()
  for (const it of countItems || []) {
    byProductId.set(String(it.productId), it)
  }

  const products = await productRepo.listByTenantAndBranch(tenantId, branchId)
  const targets = []
  for (const p of products || []) {
    const it = byProductId.get(String(p.id))
    const startQty = it ? Number(it.currentStockAtStart || 0) : Number(p.stockQty || 0)
    const countedQty = it ? Number(it.countedQty || 0) : 0
    if (Math.abs(countedQty - startQty) <= 0.0001) continue
    targets.push({ productId: String(p.id), productName: String(p.name || ''), barcode: it?.barcode || p.barcode || '', from: startQty, to: countedQty })
  }

  const note = `stock_count:${String(session.id)}`
  const applied = []

  const tryTransaction = async () => {
    const txSession = await mongoose.startSession()
    try {
      await txSession.withTransaction(async () => {
        for (const t of targets) {
          await CanteenProduct.updateOne({ _id: t.productId, tenantId, branchId, isActive: true }, { $set: { stockQty: t.to } }, { session: txSession })
          await CanteenStockMovement.create([{ tenantId, branchId, productId: t.productId, productName: String(t.productName || ''), barcode: String(t.barcode || ''), type: 'adjust', qty: t.to, note, createdBy: actorUserId || null, createdAt: new Date() }], { session: txSession })
          applied.push({ productId: t.productId, from: t.from, to: t.to })
        }
        await countRepo.closeSessionByIdAndScope(session.id, tenantId, branchId, { status: 'closed', closedAt: new Date() }, { session: txSession })
      })
      return true
    } finally {
      try { await txSession.endSession() } catch {}
    }
  }

  const tryFallback = async () => {
    for (const t of targets) {
      await CanteenProduct.updateOne({ _id: t.productId, tenantId, branchId, isActive: true }, { $set: { stockQty: t.to } })
      await movementRepo.create({ tenantId, branchId, productId: t.productId, productName: String(t.productName || ''), barcode: String(t.barcode || ''), type: 'adjust', qty: t.to, note, createdBy: actorUserId || null, createdAt: new Date() })
      applied.push({ productId: t.productId, from: t.from, to: t.to })
    }
    await countRepo.closeSessionByIdAndScope(session.id, tenantId, branchId, { status: 'closed', closedAt: new Date() })
  }

  try {
    try {
      await tryTransaction()
    } catch (err) {
      const msg = String(err?.message || '')
      const isReplicaErr = msg.toLowerCase().includes('replica') || msg.toLowerCase().includes('transaction')
      if (!isReplicaErr) throw err
      applied.length = 0
      await tryFallback()
    }
  } catch (err) {
    logger.error('[CANTEEN_STOCK_COUNT_APPLY_ERR]', { sessionId: String(session.id), tenantId: String(tenantId), branchId: String(branchId), message: String(err?.message || err) })
    throw error('internal_error', 'Internal server error', 500)
  }

  return { appliedCount: applied.length, applied }
}

export const listStockCounts = async (tenantId, branchId, query = {}) => {
  const limitRaw = Number(query?.limit || 20)
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20))
  const pageRaw = Number(query?.page || 1)
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1)
  const skip = (page - 1) * limit

  const from = query?.from ? parseDate(query.from) : null
  const to = query?.to ? parseDate(query.to) : null

  const sessions = await countRepo.listSessionsByScope(tenantId, branchId, { limit, skip, from, to })
  const ids = sessions.map(s => s?._id).filter(Boolean)
  const stats = await countRepo.getSessionStatsByIds(tenantId, branchId, ids)
  const statById = new Map(stats.map(x => [String(x._id), { lineCount: Number(x.lineCount || 0), totalDiff: Number(x.totalDiff || 0) }]))

  return (sessions || []).map(s => {
    const sid = String(s?._id || '')
    const st = statById.get(sid) || { lineCount: 0, totalDiff: 0 }
    const createdAt = s.startedAt || s.finishedAt || s.closedAt || null
    return {
      id: sid,
      createdAt,
      createdBy: s.createdBy ? { id: String(s.createdBy._id || ''), name: String(s.createdBy.name || '') } : null,
      lineCount: st.lineCount,
      totalDiff: st.totalDiff,
      status: s.status === 'closed' ? 'completed' : (s.status === 'open' ? 'open' : 'finished')
    }
  })
}

export const getStockCountDetail = async (tenantId, branchId, sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) throw error('invalid_request', 'Invalid session id', 400)
  const session = await countRepo.findSessionByIdAndScopeLean(sessionId, tenantId, branchId)
  if (!session) throw error('not_found', 'Sayım bulunamadı', 404)
  const items = await countRepo.listItemsBySession(tenantId, branchId, session._id)

  const computeStockQtyBefore = async (productId, at) => {
    const atDate = at ? new Date(at) : null
    if (!atDate || Number.isNaN(atDate.getTime())) return null
    const lastAdjust = await CanteenStockMovement
      .findOne({ tenantId, branchId, productId, type: 'adjust', createdAt: { $lt: atDate } })
      .sort({ createdAt: -1 })
      .select('qty createdAt')
      .lean()
    if (!lastAdjust) return null

    const deltas = await CanteenStockMovement
      .find({
        tenantId,
        branchId,
        productId,
        createdAt: { $gt: lastAdjust.createdAt, $lt: atDate },
        type: { $in: ['in', 'out', 'waste'] }
      })
      .select('type qty')
      .lean()

    let qty = Number(lastAdjust.qty || 0)
    for (const d of deltas || []) {
      const t = String(d?.type || '').toLowerCase()
      const q = Number(d?.qty || 0)
      if (!Number.isFinite(q) || q === 0) continue
      if (t === 'in') qty += q
      else if (t === 'out' || t === 'waste') qty -= q
    }
    return qty
  }

  const lines = (items || []).map(it => {
    const name = String(it?.productSnapshot?.name || '')
    const barcode = String(it?.barcode || it?.productSnapshot?.barcode || '')
    const systemQty = Number(it?.currentStockAtStart || 0)
    const countedQty = Number(it?.countedQty || 0)
    return {
      productId: String(it?.productId || ''),
      name,
      barcode,
      systemQty,
      countedQty,
      diff: Number(countedQty - systemQty)
    }
  })

  if (lines.length === 0) {
    const note = `stock_count:${String(session._id)}`
    const moves = await CanteenStockMovement
      .find({ tenantId, branchId, note, type: 'adjust' })
      .sort({ createdAt: 1 })
      .lean()
    if (!Array.isArray(moves) || moves.length === 0) {
      throw error('stock_count_not_found', 'Bu sayımın satır kaydı bulunamadı', 404)
    }
    const fallback = []
    for (const m of moves) {
      const countedQty = Number(m?.qty || 0)
      const systemQty = await computeStockQtyBefore(m?.productId, m?.createdAt)
      const diff = systemQty === null ? null : Number(countedQty - systemQty)
      fallback.push({
        productId: String(m?.productId || ''),
        name: String(m?.productName || ''),
        barcode: String(m?.barcode || ''),
        systemQty,
        countedQty,
        diff
      })
    }
    lines.push(...fallback)
  }

  return {
    count: {
      id: String(session._id),
      createdAt: session.startedAt || null,
      createdBy: session.createdBy ? { id: String(session.createdBy._id || ''), name: String(session.createdBy.name || '') } : null,
      status: session.status === 'closed' ? 'completed' : (session.status === 'open' ? 'open' : 'finished')
    },
    lines
  }
}
