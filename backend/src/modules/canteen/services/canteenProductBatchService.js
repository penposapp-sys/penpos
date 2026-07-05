import { error } from '../../../utils/errors.js'
import * as productRepo from '../repositories/canteenProductRepository.js'
import * as batchRepo from '../repositories/canteenProductBatchRepository.js'

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100
const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : Number(fallback || 0)
}

const resolveBatchSalePrice = (batch = {}, fallbackProduct = {}) => {
  const price = toNumber(batch?.salePrice, fallbackProduct?.price)
  const vatRate = toNumber(batch?.vatRate, fallbackProduct?.vatRate)
  const vatIncluded = batch?.vatIncluded !== false && fallbackProduct?.vatIncluded !== false
  if (vatIncluded === false && vatRate > 0) return roundMoney(price * (1 + (vatRate / 100)))
  return roundMoney(price)
}

const normalizeRemainingQty = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export const ensureProductBatches = async (product) => {
  if (!product?.id || product?.stockTrackingEnabled !== true) return []
  const tenantId = String(product.tenantId || '')
  const branchId = String(product.branchId || '')
  const productId = String(product.id || product._id || '')
  const stockQty = normalizeRemainingQty(product?.stockQty)
  let batches = await batchRepo.listByProductId(tenantId, branchId, productId)
  const totalRemaining = batches.reduce((sum, batch) => sum + normalizeRemainingQty(batch?.remainingQty), 0)

  if (stockQty > 0 && totalRemaining <= 0.0001) {
    await batchRepo.create({
      tenantId,
      branchId,
      productId,
      productName: String(product?.name || ''),
      barcode: String(product?.barcode || ''),
      receivedQty: stockQty,
      remainingQty: stockQty,
      salePrice: roundMoney(product?.price || 0),
      costPrice: roundMoney(product?.costPrice || 0),
      vatRate: toNumber(product?.vatRate, 0),
      vatIncluded: product?.vatIncluded !== false,
      source: 'legacy_migration',
      note: 'Mevcut stoktan otomatik parti oluşturuldu',
      createdBy: null,
      receivedAt: product?.createdAt || new Date(),
      createdAt: new Date()
    })
    batches = await batchRepo.listByProductId(tenantId, branchId, productId)
  } else if (stockQty > totalRemaining + 0.0001) {
    const diff = roundMoney(stockQty - totalRemaining)
    await batchRepo.create({
      tenantId,
      branchId,
      productId,
      productName: String(product?.name || ''),
      barcode: String(product?.barcode || ''),
      receivedQty: diff,
      remainingQty: diff,
      salePrice: roundMoney(product?.price || 0),
      costPrice: roundMoney(product?.costPrice || 0),
      vatRate: toNumber(product?.vatRate, 0),
      vatIncluded: product?.vatIncluded !== false,
      source: 'stock_sync',
      note: 'Stok senkronu için ek parti oluşturuldu',
      createdBy: null,
      receivedAt: new Date(),
      createdAt: new Date()
    })
    batches = await batchRepo.listByProductId(tenantId, branchId, productId)
  }

  return batches
}

export const syncProductFromOpenBatch = async (tenantId, branchId, productId, fallbackProduct = null) => {
  const firstOpen = await batchRepo.findFirstOpenByProductId(tenantId, branchId, productId)
  if (!firstOpen) return fallbackProduct

  const update = {
    price: roundMoney(firstOpen.salePrice || 0),
    costPrice: roundMoney(firstOpen.costPrice || 0),
    vatRate: toNumber(firstOpen.vatRate, fallbackProduct?.vatRate || 0),
    vatIncluded: firstOpen.vatIncluded !== false
  }
  const updated = await productRepo.updateByIdAndScope(productId, tenantId, branchId, update)
  return updated || fallbackProduct
}

export const rebuildProductBatchesFromAbsoluteStock = async (product, nextQty, note = '', actorUserId = null) => {
  if (!product?.id || product?.stockTrackingEnabled !== true) return
  const tenantId = String(product.tenantId || '')
  const branchId = String(product.branchId || '')
  const productId = String(product.id || product._id || '')
  const normalizedQty = normalizeRemainingQty(nextQty)
  await batchRepo.deleteManyByProductId(tenantId, branchId, productId)
  if (normalizedQty <= 0.0001) return
  await batchRepo.create({
    tenantId,
    branchId,
    productId,
    productName: String(product?.name || ''),
    barcode: String(product?.barcode || ''),
    receivedQty: normalizedQty,
    remainingQty: normalizedQty,
    salePrice: roundMoney(product?.price || 0),
    costPrice: roundMoney(product?.costPrice || 0),
    vatRate: toNumber(product?.vatRate, 0),
    vatIncluded: product?.vatIncluded !== false,
    source: 'absolute_sync',
    note: String(note || '').trim() || 'Stok mutlak olarak güncellendi',
    createdBy: actorUserId || null,
    receivedAt: new Date(),
    createdAt: new Date()
  })
}

export const addProductReceipt = async (tenantId, branchId, actorUserId, product, input = {}) => {
  if (!product?.id) throw error('not_found', 'Urun bulunamadi', 404)
  const qty = toNumber(input?.qty, 0)
  if (!Number.isFinite(qty) || qty <= 0) throw error('validation_error', 'Miktar zorunludur', 400)

  const salePrice = roundMoney(input?.salePrice ?? product?.price ?? 0)
  const costPrice = roundMoney(input?.costPrice ?? product?.costPrice ?? 0)
  const vatRate = toNumber(input?.vatRate, product?.vatRate || 0)
  const vatIncluded = input?.vatIncluded !== undefined ? input.vatIncluded !== false : product?.vatIncluded !== false
  const note = String(input?.note || '').trim()
  const salePriceMode = String(input?.salePriceMode || 'new_batch_after_old_stock').trim() || 'new_batch_after_old_stock'

  if (product.stockTrackingEnabled === true) {
    await ensureProductBatches(product)
  }

  const previousQty = toNumber(product?.stockQty, 0)
  const hadOpenStock = previousQty > 0.0001
  const updatedProduct = await productRepo.incStockQtyByIdAndScope(product.id, tenantId, branchId, qty)
  if (!updatedProduct) throw error('not_found', 'Urun bulunamadi', 404)

  let batch = null
  if (updatedProduct.stockTrackingEnabled === true) {
    batch = await batchRepo.create({
      tenantId,
      branchId,
      productId: updatedProduct.id,
      productName: String(updatedProduct.name || ''),
      barcode: String(updatedProduct.barcode || ''),
      receivedQty: qty,
      remainingQty: qty,
      salePrice,
      costPrice,
      vatRate,
      vatIncluded,
      source: 'receipt',
      note,
      createdBy: actorUserId || null,
      receivedAt: new Date(),
      createdAt: new Date()
    })
  }

  let syncedProduct = updatedProduct
  if (!hadOpenStock) {
    syncedProduct = await productRepo.updateByIdAndScope(updatedProduct.id, tenantId, branchId, {
      price: salePrice,
      costPrice,
      vatRate,
      vatIncluded
    }) || updatedProduct
  } else if (salePriceMode === 'apply_to_all_stock') {
    if (updatedProduct.stockTrackingEnabled === true) {
      await batchRepo.updateOpenByProductId(tenantId, branchId, updatedProduct.id, {
        $set: {
          salePrice,
          vatRate,
          vatIncluded
        }
      })
    }
    syncedProduct = await productRepo.updateByIdAndScope(updatedProduct.id, tenantId, branchId, {
      price: salePrice
    }) || updatedProduct
  } else if (updatedProduct.stockTrackingEnabled === true) {
    syncedProduct = await syncProductFromOpenBatch(tenantId, branchId, updatedProduct.id, updatedProduct)
  }

  return { product: syncedProduct, batch }
}

export const consumeProductQtyFifo = async (tenantId, branchId, product, qty) => {
  const requestedQty = toNumber(qty, 0)
  if (!product?.id || product?.stockTrackingEnabled !== true || requestedQty <= 0) {
    return { segments: [], nextProduct: product }
  }

  await ensureProductBatches(product)
  const openBatches = await batchRepo.listOpenByProductId(tenantId, branchId, product.id)
  const totalRemaining = openBatches.reduce((sum, batch) => sum + normalizeRemainingQty(batch?.remainingQty), 0)
  if (totalRemaining + 0.0001 < requestedQty) {
    throw error('insufficient_stock', 'Stok yetersiz', 409)
  }

  const touched = []
  const segments = []
  let needed = requestedQty

  try {
    for (const batch of openBatches) {
      if (needed <= 0.0001) break
      const batchRemaining = normalizeRemainingQty(batch?.remainingQty)
      if (batchRemaining <= 0.0001) continue
      const take = Math.min(batchRemaining, needed)
      const nextRemaining = roundMoney(batchRemaining - take)
      await batchRepo.setRemainingQtyById(batch._id, nextRemaining)
      touched.push({ id: String(batch._id), previous: batchRemaining })
      const unitPrice = resolveBatchSalePrice(batch, product)
      segments.push({
        batchId: String(batch._id),
        qty: take,
        unitPrice,
        lineTotal: roundMoney(unitPrice * take),
        costPrice: roundMoney(batch?.costPrice || 0),
        salePrice: roundMoney(batch?.salePrice || 0),
        vatRate: toNumber(batch?.vatRate, product?.vatRate || 0),
        vatIncluded: batch?.vatIncluded !== false
      })
      needed = roundMoney(needed - take)
    }
  } catch (err) {
    for (const item of touched.reverse()) {
      await batchRepo.setRemainingQtyById(item.id, item.previous)
    }
    throw err
  }

  const nextProduct = await syncProductFromOpenBatch(tenantId, branchId, product.id, product)
  return { segments, nextProduct }
}

export const applyProductPriceToCurrentBatch = async (tenantId, branchId, productId, update = {}) => {
  const firstOpen = await batchRepo.findFirstOpenByProductId(tenantId, branchId, productId)
  if (!firstOpen) return null
  const patch = {}
  if (update?.price !== undefined) patch.salePrice = roundMoney(update.price)
  if (update?.costPrice !== undefined) patch.costPrice = roundMoney(update.costPrice)
  if (update?.vatRate !== undefined) patch.vatRate = toNumber(update.vatRate, 0)
  if (update?.vatIncluded !== undefined) patch.vatIncluded = update.vatIncluded !== false
  if (Object.keys(patch).length === 0) return firstOpen
  return batchRepo.updateById(firstOpen._id, { $set: patch })
}
