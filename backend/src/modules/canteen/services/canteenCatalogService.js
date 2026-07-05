import { error } from '../../../utils/errors.js'
import * as catRepo from '../repositories/canteenCategoryRepository.js'
import * as prodRepo from '../repositories/canteenProductRepository.js'
import * as movementRepo from '../repositories/canteenStockMovementRepository.js'
import {
  applyProductPriceToCurrentBatch,
  ensureProductBatches,
  rebuildProductBatchesFromAbsoluteStock,
  syncProductFromOpenBatch
} from './canteenProductBatchService.js'
import { deleteProductImageFile, replaceProductImageFile } from '../../../utils/productImageStorage.js'

const normalizeName = (name) => String(name || '').trim()
const normalizeKey = (name) => normalizeName(name).toLowerCase()
const normalizeBarcode = (barcode) => String(barcode || '').trim()
const normalizeText = (value) => String(value || '').trim()
const normalizeSortOrder = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100
const normalizeMinimumStock = (value, fallback = 5) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return Number(fallback || 0)
  return n
}

const computeSalePrice = (price, vatRate, vatIncluded) => {
  const basePrice = Number(price || 0)
  const rate = Number(vatRate || 0)
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0
  if (vatIncluded === false && Number.isFinite(rate) && rate > 0) {
    return roundMoney(basePrice * (1 + (rate / 100)))
  }
  return roundMoney(basePrice)
}

const mapProductDto = (product, categoryById = new Map()) => {
  const category = product?.categoryId ? categoryById.get(String(product.categoryId)) : null
  return {
    id: product.id,
    name: product.name,
    branchId: product.branchId ? String(product.branchId) : null,
    barcode: product.barcode || '',
    stockTrackingEnabled: product.stockTrackingEnabled === true,
    stockQty: Number(product.stockQty || 0),
    minimumStock: normalizeMinimumStock(product.minimumStock, 5),
    price: Number(product.price || 0),
    salePrice: computeSalePrice(product.price, product.vatRate, product.vatIncluded !== false),
    costPrice: Number(product.costPrice || 0),
    vatRate: Number(product.vatRate || 0),
    vatIncluded: product.vatIncluded !== false,
    categoryId: product.categoryId ? String(product.categoryId) : null,
    categoryName: category ? String(category?.name || '') : '',
    categoryImageUrl: category ? String(category?.imageUrl || '') : '',
    imageUrl: String(product.imageUrl || '')
  }
}

const mapCategoryDto = (category) => ({
  id: category.id,
  name: category.name,
  description: String(category.description || ''),
  imageUrl: String(category.imageUrl || ''),
  sortOrder: Number(category.sortOrder || 0),
  isActive: category.isActive !== false
})

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isDuplicateBarcodeError = (err) => {
  const code = Number(err?.code || 0)
  if (code !== 11000) return false
  const keyPattern = err?.keyPattern || {}
  const keyValue = err?.keyValue || {}
  return Object.prototype.hasOwnProperty.call(keyPattern, 'barcode') || Object.prototype.hasOwnProperty.call(keyValue, 'barcode')
}

const isDuplicateProductNameError = (err) => {
  const code = Number(err?.code || 0)
  if (code !== 11000) return false
  const keyPattern = err?.keyPattern || {}
  const keyValue = err?.keyValue || {}
  return (
    Object.prototype.hasOwnProperty.call(keyPattern, 'nameNormalized') ||
    Object.prototype.hasOwnProperty.call(keyValue, 'nameNormalized')
  )
}

const ensureCategoryInScope = async (tenantId, branchId, categoryId) => {
  if (!categoryId) return null
  const category = await catRepo.findByIdAndScope(categoryId, tenantId, branchId)
  if (!category) throw error('category_not_found', 'Kategori bulunamadi', 404)
  return category
}

export const listCategories = async (tenantId, branchId) => {
  const items = await catRepo.listByTenantAndBranch(tenantId, branchId)
  return items.map(mapCategoryDto)
}

export const createCategory = async (tenantId, branchId, input) => {
  const name = normalizeName(input?.name)
  if (!name) throw error('name_required', 'Kategori adi zorunludur', 400)
  const created = await catRepo.create({
    tenantId,
    branchId,
    name,
    nameNormalized: normalizeKey(name),
    description: normalizeText(input?.description),
    imageUrl: normalizeText(input?.imageUrl),
    sortOrder: normalizeSortOrder(input?.sortOrder),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  })
  return mapCategoryDto(created)
}

export const updateCategory = async (tenantId, branchId, id, input) => {
  const update = {}
  if (input?.name !== undefined) {
    const name = normalizeName(input?.name)
    if (!name) throw error('name_required', 'Kategori adi zorunludur', 400)
    update.name = name
    update.nameNormalized = normalizeKey(name)
  }
  if (input?.description !== undefined) update.description = normalizeText(input?.description)
  if (input?.imageUrl !== undefined) update.imageUrl = normalizeText(input?.imageUrl)
  if (input?.sortOrder !== undefined) update.sortOrder = normalizeSortOrder(input?.sortOrder)
  if (input?.isActive !== undefined) update.isActive = input?.isActive === true
  update.updatedAt = new Date()

  const updated = await catRepo.updateByIdAndScope(id, tenantId, branchId, update)
  if (!updated) throw error('not_found', 'Kategori bulunamadi', 404)
  return mapCategoryDto(updated)
}

export const removeCategory = async (tenantId, branchId, id) => {
  const current = await catRepo.findByIdAndScope(id, tenantId, branchId)
  if (!current) throw error('not_found', 'Kategori bulunamadi', 404)
  const deleted = await catRepo.softDeleteByIdAndScope(id, tenantId, branchId)
  if (!deleted) throw error('not_found', 'Kategori bulunamadi', 404)
  await deleteProductImageFile(current.imageUrl)
  return { success: true }
}

export const uploadCategoryImage = async (tenantId, branchId, id, file) => {
  const current = await catRepo.findByIdAndScope(id, tenantId, branchId)
  if (!current) throw error('not_found', 'Kategori bulunamadi', 404)

  const saved = await replaceProductImageFile(current.imageUrl, file)
  const updated = await catRepo.updateByIdAndScope(id, tenantId, branchId, { imageUrl: saved.imageUrl, updatedAt: new Date() })
  if (!updated) throw error('not_found', 'Kategori bulunamadi', 404)
  return mapCategoryDto(updated)
}

export const removeCategoryImage = async (tenantId, branchId, id) => {
  const current = await catRepo.findByIdAndScope(id, tenantId, branchId)
  if (!current) throw error('not_found', 'Kategori bulunamadi', 404)

  await deleteProductImageFile(current.imageUrl)
  const updated = await catRepo.updateByIdAndScope(id, tenantId, branchId, { imageUrl: '', updatedAt: new Date() })
  if (!updated) throw error('not_found', 'Kategori bulunamadi', 404)
  return mapCategoryDto(updated)
}

export const listProducts = async (tenantId, branchIds) => {
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const items = await prodRepo.listByTenantAndBranches(tenantId, ids)
  const categories = ids.length > 0 ? await catRepo.listByTenantAndBranches(tenantId, ids) : []
  const categoryById = new Map((categories || []).map((item) => [String(item.id || item._id), item]))
  const synced = await Promise.all((items || []).map(async (item) => {
    if (item?.stockTrackingEnabled !== true) return item
    await ensureProductBatches(item)
    return syncProductFromOpenBatch(tenantId, String(item.branchId || ''), item.id, item)
  }))
  return synced.map((p) => mapProductDto(p, categoryById))
}

export const createProduct = async (tenantId, branchId, input) => {
  const name = normalizeName(input?.name)
  if (!name) throw error('name_required', 'Urun adi zorunludur', 400)
  const barcode = normalizeBarcode(input?.barcode)
  if (!barcode) throw error('validation_error', 'Barkod zorunludur', 400)
  const rawPrice = input?.price
  if (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === '') {
    throw error('price_required', 'Satis fiyati zorunludur', 400)
  }
  const price = Number(input?.price || 0)
  if (!Number.isFinite(price) || price < 0) throw error('validation_error', 'Satis fiyati gecersiz', 400)
  const costPrice = Number(input?.costPrice || 0)
  const vatRate = Number(input?.vatRate || 0)
  const vatIncluded = input?.vatIncluded !== false
  const categoryId = input?.categoryId ? String(input.categoryId) : null
  if (categoryId) await ensureCategoryInScope(tenantId, branchId, categoryId)
  const stockTrackingEnabled = input?.stockTrackingEnabled === true
  const stockQtyRaw = input?.stockQty
  const stockQty = Number(stockQtyRaw || 0)
  const minimumStock = normalizeMinimumStock(input?.minimumStock, 5)
  try {
    const created = await prodRepo.create({
      tenantId,
      branchId,
      categoryId: categoryId || null,
      name,
      nameNormalized: normalizeKey(name),
      barcode,
      stockTrackingEnabled,
      stockQty: Number.isFinite(stockQty) ? stockQty : 0,
      minimumStock,
      price: Number.isFinite(price) ? price : 0,
      costPrice: Number.isFinite(costPrice) ? costPrice : 0,
      vatRate: Number.isFinite(vatRate) ? vatRate : 0,
      vatIncluded,
      imageUrl: '',
      isActive: true,
      createdAt: new Date()
    })
    if (created.stockTrackingEnabled === true && Number(created.stockQty || 0) > 0) {
      await rebuildProductBatchesFromAbsoluteStock({ ...created.toObject?.() || created, id: created.id, tenantId, branchId }, Number(created.stockQty || 0), 'Yeni ürün açılış stoğu', null)
    }
    return {
      id: created.id,
      name: created.name,
      barcode: created.barcode || '',
      stockTrackingEnabled: created.stockTrackingEnabled === true,
      stockQty: Number(created.stockQty || 0),
      minimumStock: normalizeMinimumStock(created.minimumStock, 5),
      price: Number(created.price || 0),
      salePrice: computeSalePrice(created.price, created.vatRate, created.vatIncluded !== false),
      costPrice: Number(created.costPrice || 0),
      vatRate: Number(created.vatRate || 0),
      vatIncluded: created.vatIncluded !== false,
      categoryId: created.categoryId ? String(created.categoryId) : null,
      imageUrl: String(created.imageUrl || '')
    }
  } catch (err) {
    if (isDuplicateBarcodeError(err)) throw error('duplicate_barcode', 'Bu barkod zaten kayitli', 409)
    if (isDuplicateProductNameError(err)) throw error('duplicate_product_name', 'Bu subede ayni isimde urun zaten kayitli', 409)
    throw err
  }
}

export const updateProduct = async (tenantId, branchId, id, input, actorUserId = null) => {
  const current = await prodRepo.findByIdAndScope(id, tenantId, branchId)
  if (!current) throw error('not_found', 'Urun bulunamadi', 404)

  const update = {}
  if (input?.name !== undefined) {
    const name = normalizeName(input?.name)
    if (!name) throw error('name_required', 'Urun adi zorunludur', 400)
    update.name = name
    update.nameNormalized = normalizeKey(name)
  }
  if (input?.barcode !== undefined) {
    const barcode = normalizeBarcode(input?.barcode)
    if (!barcode) throw error('validation_error', 'Barkod zorunludur', 400)
    update.barcode = barcode
  }
  if (input?.stockTrackingEnabled !== undefined) update.stockTrackingEnabled = input?.stockTrackingEnabled === true
  if (input?.stockQty !== undefined) {
    const stockQty = Number(input?.stockQty || 0)
    update.stockQty = Number.isFinite(stockQty) ? stockQty : 0
  }
  if (input?.minimumStock !== undefined) {
    update.minimumStock = normalizeMinimumStock(input?.minimumStock, 5)
  }
  if (input?.price !== undefined) {
    const price = Number(input?.price || 0)
    update.price = Number.isFinite(price) ? price : 0
  }
  if (input?.costPrice !== undefined) {
    const costPrice = Number(input?.costPrice || 0)
    update.costPrice = Number.isFinite(costPrice) ? costPrice : 0
  }
  if (input?.vatRate !== undefined) {
    const vatRate = Number(input?.vatRate || 0)
    update.vatRate = Number.isFinite(vatRate) ? vatRate : 0
  }
  if (input?.vatIncluded !== undefined) {
    update.vatIncluded = input?.vatIncluded !== false
  }
  if (input?.categoryId !== undefined) {
    update.categoryId = input?.categoryId ? String(input.categoryId) : null
    if (update.categoryId) await ensureCategoryInScope(tenantId, branchId, update.categoryId)
  }
  try {
    const updated = await prodRepo.updateByIdAndScope(id, tenantId, branchId, update)
    if (!updated) throw error('not_found', 'Urun bulunamadi', 404)

    if (updated.stockTrackingEnabled === true) {
      if (update.stockQty !== undefined) {
        await rebuildProductBatchesFromAbsoluteStock(updated, Number(updated.stockQty || 0), 'Ürün düzenleme ekranından stok güncellendi', actorUserId)
      } else {
        await ensureProductBatches(updated)
        await applyProductPriceToCurrentBatch(tenantId, branchId, updated.id, {
          price: update.price,
          costPrice: update.costPrice,
          vatRate: update.vatRate,
          vatIncluded: update.vatIncluded
        })
        await syncProductFromOpenBatch(tenantId, branchId, updated.id, updated)
      }
    }

    const previousStockQty = Number(current?.stockQty || 0)
    const nextStockQty = Number(updated?.stockQty || 0)
    const stockChanged = previousStockQty !== nextStockQty
    if (stockChanged) {
      const deltaQty = nextStockQty - previousStockQty
      const unitCost = roundMoney(updated?.costPrice || 0)
      const absDeltaQty = Math.abs(deltaQty)
      const totalAmount = roundMoney(unitCost * absDeltaQty)
      let cashEffect = ''
      if (deltaQty < 0) cashEffect = 'expense'
      else if (deltaQty > 0) cashEffect = 'income'

      await movementRepo.create({
        tenantId,
        branchId,
        productId: updated.id,
        productName: String(updated.name || ''),
        barcode: String(updated.barcode || ''),
        type: 'adjust',
        qty: nextStockQty,
        previousQty: previousStockQty,
        deltaQty,
        unitCost,
        totalAmount,
        cashEffect,
        note: 'Ürün düzenleme ekranından stok güncellendi',
        createdBy: actorUserId || null,
        createdAt: new Date()
      })
    }

    return {
      id: updated.id,
      name: updated.name,
      barcode: updated.barcode || '',
      stockTrackingEnabled: updated.stockTrackingEnabled === true,
      stockQty: Number(updated.stockQty || 0),
      minimumStock: normalizeMinimumStock(updated.minimumStock, 5),
      price: Number(updated.price || 0),
      salePrice: computeSalePrice(updated.price, updated.vatRate, updated.vatIncluded !== false),
      costPrice: Number(updated.costPrice || 0),
      vatRate: Number(updated.vatRate || 0),
      vatIncluded: updated.vatIncluded !== false,
      categoryId: updated.categoryId ? String(updated.categoryId) : null,
      imageUrl: String(updated.imageUrl || '')
    }
  } catch (err) {
    if (isDuplicateBarcodeError(err)) throw error('duplicate_barcode', 'Bu barkod zaten kayitli', 409)
    if (isDuplicateProductNameError(err)) throw error('duplicate_product_name', 'Bu subede ayni isimde urun zaten kayitli', 409)
    throw err
  }
}

export const getProductByBarcode = async (tenantId, branchId, barcodeRaw) => {
  const barcode = normalizeBarcode(barcodeRaw)
  if (!barcode) throw error('validation_error', 'Barkod zorunludur', 400)
  const p = await prodRepo.findByBarcodeAndScope(barcode, tenantId, branchId)
  if (!p) throw error('not_found', 'Barkod bulunamadi', 404)
  if (p.stockTrackingEnabled === true) {
    await ensureProductBatches(p)
    await syncProductFromOpenBatch(tenantId, branchId, p.id, p)
  }
  const fresh = await prodRepo.findByIdAndScope(p.id, tenantId, branchId)
  return {
    id: fresh.id,
    name: fresh.name,
    barcode: fresh.barcode || '',
    stockTrackingEnabled: fresh.stockTrackingEnabled === true,
    price: Number(fresh.price || 0),
    salePrice: computeSalePrice(fresh.price, fresh.vatRate, fresh.vatIncluded !== false),
    vatRate: Number(fresh.vatRate || 0),
    vatIncluded: fresh.vatIncluded !== false,
    stockQty: Number(fresh.stockQty || 0),
    minimumStock: normalizeMinimumStock(fresh.minimumStock, 5),
    costPrice: Number(fresh.costPrice || 0)
  }
}

export const searchProducts = async (tenantId, branchId, input) => {
  const q = normalizeName(input?.q)
  const limit = Number(input?.limit || 20)
  if (q.length < 2) throw error('validation_error', 'En az 2 karakter yaz', 400)
  const items = await prodRepo.searchByNameAndScope(tenantId, branchId, escapeRegex(q), limit)
  const synced = await Promise.all((items || []).map(async (item) => {
    if (item?.stockTrackingEnabled !== true) return item
    await ensureProductBatches(item)
    return syncProductFromOpenBatch(tenantId, branchId, item.id, item)
  }))
  return synced.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode || '',
    price: Number(p.price || 0),
    salePrice: computeSalePrice(p.price, p.vatRate, p.vatIncluded !== false),
    stockQty: Number(p.stockQty || 0),
    minimumStock: normalizeMinimumStock(p.minimumStock, 5)
  }))
}

export const removeProduct = async (tenantId, branchId, id) => {
  const current = await prodRepo.findByIdAndScope(id, tenantId, branchId)
  if (!current) throw error('not_found', 'Urun bulunamadi', 404)
  const deleted = await prodRepo.softDeleteByIdAndScope(id, tenantId, branchId)
  if (!deleted) throw error('not_found', 'Urun bulunamadi', 404)
  await deleteProductImageFile(current.imageUrl)
  return { success: true }
}

export const uploadProductImage = async (tenantId, branchId, id, file) => {
  const current = await prodRepo.findByIdAndScope(id, tenantId, branchId)
  if (!current) throw error('not_found', 'Urun bulunamadi', 404)

  const saved = await replaceProductImageFile(current.imageUrl, file)
  const updated = await prodRepo.updateByIdAndScope(id, tenantId, branchId, { imageUrl: saved.imageUrl })
  if (!updated) throw error('not_found', 'Urun bulunamadi', 404)

  return {
    id: updated.id,
    name: updated.name,
    barcode: updated.barcode || '',
    stockTrackingEnabled: updated.stockTrackingEnabled === true,
    stockQty: Number(updated.stockQty || 0),
    minimumStock: normalizeMinimumStock(updated.minimumStock, 5),
    price: Number(updated.price || 0),
    salePrice: computeSalePrice(updated.price, updated.vatRate, updated.vatIncluded !== false),
    costPrice: Number(updated.costPrice || 0),
    vatRate: Number(updated.vatRate || 0),
    vatIncluded: updated.vatIncluded !== false,
    categoryId: updated.categoryId ? String(updated.categoryId) : null,
    imageUrl: String(updated.imageUrl || '')
  }
}

export const removeProductImage = async (tenantId, branchId, id) => {
  const current = await prodRepo.findByIdAndScope(id, tenantId, branchId)
  if (!current) throw error('not_found', 'Urun bulunamadi', 404)

  await deleteProductImageFile(current.imageUrl)
  const updated = await prodRepo.updateByIdAndScope(id, tenantId, branchId, { imageUrl: '' })
  if (!updated) throw error('not_found', 'Urun bulunamadi', 404)

  return {
    id: updated.id,
    name: updated.name,
    barcode: updated.barcode || '',
    stockTrackingEnabled: updated.stockTrackingEnabled === true,
    stockQty: Number(updated.stockQty || 0),
    minimumStock: normalizeMinimumStock(updated.minimumStock, 5),
    price: Number(updated.price || 0),
    salePrice: computeSalePrice(updated.price, updated.vatRate, updated.vatIncluded !== false),
    costPrice: Number(updated.costPrice || 0),
    vatRate: Number(updated.vatRate || 0),
    vatIncluded: updated.vatIncluded !== false,
    categoryId: updated.categoryId ? String(updated.categoryId) : null,
    imageUrl: String(updated.imageUrl || '')
  }
}
