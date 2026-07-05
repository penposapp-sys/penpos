import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as logger from '../../../utils/logger.js'
import * as productRepo from '../repositories/canteenProductRepository.js'
import * as categoryRepo from '../repositories/canteenCategoryRepository.js'
import * as movementRepo from '../repositories/canteenStockMovementRepository.js'
import * as countRepo from '../repositories/canteenStockCountRepository.js'
import { addProductReceipt, consumeProductQtyFifo, ensureProductBatches, rebuildProductBatchesFromAbsoluteStock } from './canteenProductBatchService.js'
import { createProduct as createCatalogProduct, updateProduct as updateCatalogProduct } from './canteenCatalogService.js'
import CanteenProduct from '../models/CanteenProduct.js'
import CanteenStockMovement from '../models/StockMovement.js'

const normalizeBarcode = (v) => String(v || '').trim()
const normalizeText = (v) => String(v || '').trim()

const parseDate = (v) => {
  const s = String(v || '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d
}

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100

const buildStockMovementFinanceMeta = (product, type, qtyRaw, previousQty = null, nextQty = null, note = '') => {
  const unitCost = roundMoney(product?.costPrice || 0)
  const rawNote = String(note || '').trim().toLowerCase()
  let deltaQty = null
  let cashEffect = ''

  if (type === 'in') {
    deltaQty = Number(qtyRaw || 0)
    cashEffect = 'expense'
  } else if (type === 'adjust' && rawNote.startsWith('stock_count:') && Number.isFinite(previousQty) && Number.isFinite(nextQty)) {
    deltaQty = roundMoney(Number(nextQty || 0) - Number(previousQty || 0))
    if (deltaQty < -0.0001) cashEffect = 'expense'
    else if (deltaQty > 0.0001) cashEffect = 'income'
  }

  const amountBaseQty = type === 'adjust' ? Math.abs(Number(deltaQty || 0)) : Math.abs(Number(qtyRaw || 0))
  const totalAmount = roundMoney(unitCost * amountBaseQty)

  return {
    previousQty: Number.isFinite(previousQty) ? Number(previousQty) : null,
    deltaQty: Number.isFinite(deltaQty) ? Number(deltaQty) : null,
    unitCost,
    totalAmount,
    cashEffect
  }
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
  const previousQty = Number(product?.stockQty || 0)

  let updated
  if (type === 'adjust') {
    updated = await productRepo.setStockQtyByIdAndScope(product.id, tenantId, branchId, qtyRaw)
    if (updated?.stockTrackingEnabled === true) {
      await rebuildProductBatchesFromAbsoluteStock({ ...updated.toObject?.() || updated, id: updated.id, tenantId, branchId }, qtyRaw, note || 'Manuel stok düzeltmesi', actorUserId)
    }
  } else if (type === 'in') {
    const receipt = await addProductReceipt(tenantId, branchId, actorUserId, { ...product.toObject?.() || product, id: product.id, tenantId, branchId }, {
      qty: qtyRaw,
      salePrice: input?.salePrice ?? product?.price ?? 0,
      costPrice: input?.costPrice ?? product?.costPrice ?? 0,
      vatRate: input?.vatRate ?? product?.vatRate ?? 0,
      vatIncluded: input?.vatIncluded !== undefined ? input.vatIncluded !== false : product?.vatIncluded !== false,
      note
    })
    updated = receipt?.product
  } else {
    const delta = -qtyRaw
    updated = await productRepo.incStockQtyByIdAndScope(product.id, tenantId, branchId, delta)
    if (updated?.stockTrackingEnabled === true) {
      await ensureProductBatches({ ...product.toObject?.() || product, id: product.id, tenantId, branchId })
      await consumeProductQtyFifo(tenantId, branchId, { ...product.toObject?.() || product, id: product.id, tenantId, branchId }, qtyRaw)
    }
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
    ...buildStockMovementFinanceMeta(updated, type, qtyRaw, previousQty, Number(updated?.stockQty || 0), note),
    note,
    createdBy: actorUserId || null,
    createdAt: new Date()
  })

  return {
    movement: {
      id: movement.id,
      type: movement.type,
      qty: Number(movement.qty || 0),
      totalAmount: Number(movement.totalAmount || 0),
      cashEffect: String(movement.cashEffect || ''),
      barcode: movement.barcode || '',
      note: movement.note || '',
      createdAt: movement.createdAt
    },
    product: { id: updated.id, stockQty: Number(updated.stockQty || 0) }
  }
}

export const createMovement = createMovementByBarcode

export const createReceipt = async (tenantId, branchId, actorUserId, input) => {
  const productId = String(input?.productId || '').trim()
  const barcode = normalizeBarcode(input?.barcode)
  const name = normalizeText(input?.name)
  const categoryName = normalizeText(input?.categoryName)
  const minimumStockRaw = input?.minimumStock
  const minimumStock = Number(minimumStockRaw)
  if (!barcode) throw error('validation_error', 'Barkod zorunludur', 400)
  if (!name) throw error('validation_error', 'Urun adi zorunludur', 400)

  const qty = Number(input?.qty)
  if (!Number.isFinite(qty) || qty <= 0) throw error('validation_error', 'Miktar zorunludur', 400)

  const resolvedCategories = await categoryRepo.listByTenantAndBranch(tenantId, branchId)
  const normalizedCategoryName = categoryName.toLocaleLowerCase('tr-TR')
  let resolvedCategory = (resolvedCategories || []).find((item) => (
    String(item?.name || '').trim().toLocaleLowerCase('tr-TR') === normalizedCategoryName
  )) || null

  if (!resolvedCategory && categoryName) {
    resolvedCategory = await categoryRepo.create({
      tenantId,
      branchId,
      name: categoryName,
      nameNormalized: normalizedCategoryName,
      description: '',
      imageUrl: '',
      sortOrder: Number(resolvedCategories?.length || 0),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  let product = productId
    ? await productRepo.findByIdAndScope(productId, tenantId, branchId)
    : await productRepo.findByBarcodeAndScope(barcode, tenantId, branchId)

  if (!product) {
    const created = await createCatalogProduct(tenantId, branchId, {
      barcode,
      name,
      categoryId: resolvedCategory?.id ? String(resolvedCategory.id) : (resolvedCategory?._id ? String(resolvedCategory._id) : null),
      price: Number(input?.salePrice || 0),
      costPrice: Number(input?.costPrice || 0),
      vatRate: Number(input?.vatRate || 0),
      vatIncluded: input?.vatIncluded !== false,
      stockTrackingEnabled: true,
      stockQty: 0,
      minimumStock: Number.isFinite(minimumStock) ? minimumStock : 5
    })
    product = await productRepo.findByIdAndScope(String(created?.id || ''), tenantId, branchId)
  } else {
    const patch = {
      name,
      barcode,
      categoryId: resolvedCategory?.id ? String(resolvedCategory.id) : (resolvedCategory?._id ? String(resolvedCategory._id) : null),
      minimumStock: Number.isFinite(minimumStock) ? minimumStock : Number(product?.minimumStock || 5)
    }
    await updateCatalogProduct(tenantId, branchId, String(product.id || product._id || ''), patch, actorUserId)
    product = await productRepo.findByIdAndScope(String(product.id || product._id || ''), tenantId, branchId)
  }

  if (!product) throw error('not_found', 'Urun bulunamadi', 404)

  const previousQty = Number(product?.stockQty || 0)
  const receipt = await addProductReceipt(tenantId, branchId, actorUserId, { ...product.toObject?.() || product, id: product.id, tenantId, branchId }, {
    ...input,
    barcode,
    name,
    categoryId: resolvedCategory?.id ? String(resolvedCategory.id) : (resolvedCategory?._id ? String(resolvedCategory._id) : null),
    minimumStock: Number.isFinite(minimumStock) ? minimumStock : Number(product?.minimumStock || 5)
  })
  const updated = receipt?.product
  if (!updated) throw error('not_found', 'Urun bulunamadi', 404)

  const movement = await movementRepo.create({
    tenantId,
    branchId,
    productId: updated.id,
    productName: String(updated.name || ''),
    barcode: String(updated.barcode || product?.barcode || ''),
    type: 'in',
    qty,
    ...buildStockMovementFinanceMeta({
      ...updated,
      costPrice: Number(input?.costPrice ?? updated?.costPrice ?? product?.costPrice ?? 0)
    }, 'in', qty, previousQty, Number(updated?.stockQty || 0), String(input?.note || '').trim()),
    note: receipt?.batch?.id ? `purchase_batch:${String(receipt.batch.id)}` : String(input?.note || '').trim(),
    createdBy: actorUserId || null,
    createdAt: new Date()
  })

  return {
    movement: {
      id: movement.id,
      type: movement.type,
      qty: Number(movement.qty || 0),
      totalAmount: Number(movement.totalAmount || 0),
      cashEffect: String(movement.cashEffect || ''),
      barcode: movement.barcode || '',
      note: movement.note || '',
      createdAt: movement.createdAt
    },
    batch: receipt?.batch
      ? {
          id: String(receipt.batch.id || receipt.batch._id || ''),
          receivedQty: Number(receipt.batch.receivedQty || 0),
          remainingQty: Number(receipt.batch.remainingQty || 0),
          salePrice: Number(receipt.batch.salePrice || 0),
          costPrice: Number(receipt.batch.costPrice || 0)
        }
      : null,
    product: { id: updated.id, stockQty: Number(updated.stockQty || 0), price: Number(updated.price || 0), costPrice: Number(updated.costPrice || 0) }
  }
}

export const listMovements = async (tenantId, branchId, query) => {
  const from = parseDate(query?.from)
  const to = parseDate(query?.to)
  const items = await movementRepo.listByTenantAndBranchInRange(tenantId, branchId, from, to, { limit: 200 })
  return (items || []).map(m => ({
    id: m.id,
    type: m.type,
    qty: Number(m.qty || 0),
    previousQty: m.previousQty === null || m.previousQty === undefined ? null : Number(m.previousQty || 0),
    deltaQty: m.deltaQty === null || m.deltaQty === undefined ? null : Number(m.deltaQty || 0),
    unitCost: Number(m.unitCost || 0),
    totalAmount: Number(m.totalAmount || 0),
    cashEffect: String(m.cashEffect || ''),
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

export const cancelStockCount = async (tenantId, branchId, actorUserId, sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) throw error('invalid_request', 'Invalid session id', 400)
  const session = await countRepo.findSessionByIdAndScope(sessionId, tenantId, branchId)
  if (!session) throw error('not_found', 'SayÄ±m bulunamadÄ±', 404)
  if (session.status === 'closed') throw error('invalid_request', 'SayÄ±m zaten kapatÄ±ldÄ±', 409)
  await countRepo.closeSessionByIdAndScope(session.id, tenantId, branchId, {
    status: 'closed',
    closedAt: new Date()
  })
  return { cancelled: true, sessionId: String(session.id) }
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
          const financeMeta = buildStockMovementFinanceMeta(
            { costPrice: Number((products || []).find((product) => String(product.id) === String(t.productId))?.costPrice || 0) },
            'adjust',
            t.to,
            Number(t.from || 0),
            Number(t.to || 0),
            note
          )
          await CanteenProduct.updateOne({ _id: t.productId, tenantId, branchId, isActive: true }, { $set: { stockQty: t.to } }, { session: txSession })
          await CanteenStockMovement.create([{
            tenantId,
            branchId,
            productId: t.productId,
            productName: String(t.productName || ''),
            barcode: String(t.barcode || ''),
            type: 'adjust',
            qty: t.to,
            ...financeMeta,
            note,
            createdBy: actorUserId || null,
            createdAt: new Date()
          }], { session: txSession })
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
      const financeMeta = buildStockMovementFinanceMeta(
        { costPrice: Number((products || []).find((product) => String(product.id) === String(t.productId))?.costPrice || 0) },
        'adjust',
        t.to,
        Number(t.from || 0),
        Number(t.to || 0),
        note
      )
      await CanteenProduct.updateOne({ _id: t.productId, tenantId, branchId, isActive: true }, { $set: { stockQty: t.to } })
      await movementRepo.create({
        tenantId,
        branchId,
        productId: t.productId,
        productName: String(t.productName || ''),
        barcode: String(t.barcode || ''),
        type: 'adjust',
        qty: t.to,
        ...financeMeta,
        note,
        createdBy: actorUserId || null,
        createdAt: new Date()
      })
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

  for (const t of targets) {
    const product = (products || []).find((item) => String(item.id) === String(t.productId))
    if (product?.stockTrackingEnabled !== true) continue
    await rebuildProductBatchesFromAbsoluteStock({
      ...product,
      id: String(product.id),
      tenantId,
      branchId,
      stockQty: t.to
    }, t.to, 'Sayım stoğa uygulandı', actorUserId)
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
