import { error } from '../../../utils/errors.js'
import * as catRepo from '../repositories/canteenCategoryRepository.js'
import * as prodRepo from '../repositories/canteenProductRepository.js'
import { deleteProductImageFile, replaceProductImageFile } from '../../../utils/productImageStorage.js'

const normalizeName = (name) => String(name || '').trim()
const normalizeKey = (name) => normalizeName(name).toLowerCase()
const normalizeBarcode = (barcode) => String(barcode || '').trim()
const normalizeText = (value) => String(value || '').trim()
const normalizeSortOrder = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
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
  return items.map((p) => ({
    id: p.id,
    name: p.name,
    branchId: p.branchId ? String(p.branchId) : null,
    barcode: p.barcode || '',
    stockTrackingEnabled: p.stockTrackingEnabled === true,
    stockQty: Number(p.stockQty || 0),
    price: Number(p.price || 0),
    costPrice: Number(p.costPrice || 0),
    vatRate: Number(p.vatRate || 0),
    categoryId: p.categoryId ? String(p.categoryId) : null,
    categoryName: p.categoryId ? String(categoryById.get(String(p.categoryId))?.name || '') : '',
    categoryImageUrl: p.categoryId ? String(categoryById.get(String(p.categoryId))?.imageUrl || '') : '',
    imageUrl: String(p.imageUrl || '')
  }))
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
  const categoryId = input?.categoryId ? String(input.categoryId) : null
  if (categoryId) await ensureCategoryInScope(tenantId, branchId, categoryId)
  const stockTrackingEnabled = input?.stockTrackingEnabled === true
  const stockQtyRaw = input?.stockQty
  const stockQty = Number(stockQtyRaw || 0)
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
      price: Number.isFinite(price) ? price : 0,
      costPrice: Number.isFinite(costPrice) ? costPrice : 0,
      vatRate: Number.isFinite(vatRate) ? vatRate : 0,
      imageUrl: '',
      isActive: true,
      createdAt: new Date()
    })
    return {
      id: created.id,
      name: created.name,
      barcode: created.barcode || '',
      stockTrackingEnabled: created.stockTrackingEnabled === true,
      stockQty: Number(created.stockQty || 0),
      price: Number(created.price || 0),
      costPrice: Number(created.costPrice || 0),
      vatRate: Number(created.vatRate || 0),
      categoryId: created.categoryId ? String(created.categoryId) : null,
      imageUrl: String(created.imageUrl || '')
    }
  } catch (err) {
    if (isDuplicateBarcodeError(err)) throw error('duplicate_barcode', 'Bu barkod zaten kayitli', 409)
    if (isDuplicateProductNameError(err)) throw error('duplicate_product_name', 'Bu subede ayni isimde urun zaten kayitli', 409)
    throw err
  }
}

export const updateProduct = async (tenantId, branchId, id, input) => {
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
  if (input?.categoryId !== undefined) {
    update.categoryId = input?.categoryId ? String(input.categoryId) : null
    if (update.categoryId) await ensureCategoryInScope(tenantId, branchId, update.categoryId)
  }
  try {
    const updated = await prodRepo.updateByIdAndScope(id, tenantId, branchId, update)
    if (!updated) throw error('not_found', 'Urun bulunamadi', 404)
    return {
      id: updated.id,
      name: updated.name,
      barcode: updated.barcode || '',
      stockTrackingEnabled: updated.stockTrackingEnabled === true,
      stockQty: Number(updated.stockQty || 0),
      price: Number(updated.price || 0),
      costPrice: Number(updated.costPrice || 0),
      vatRate: Number(updated.vatRate || 0),
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
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode || '',
    stockTrackingEnabled: p.stockTrackingEnabled === true,
    price: Number(p.price || 0),
    vatRate: Number(p.vatRate || 0),
    stockQty: Number(p.stockQty || 0)
  }
}

export const searchProducts = async (tenantId, branchId, input) => {
  const q = normalizeName(input?.q)
  const limit = Number(input?.limit || 20)
  if (q.length < 2) throw error('validation_error', 'En az 2 karakter yaz', 400)
  const items = await prodRepo.searchByNameAndScope(tenantId, branchId, escapeRegex(q), limit)
  return items.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode || '',
    price: Number(p.price || 0),
    stockQty: Number(p.stockQty || 0)
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
    price: Number(updated.price || 0),
    costPrice: Number(updated.costPrice || 0),
    vatRate: Number(updated.vatRate || 0),
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
    price: Number(updated.price || 0),
    costPrice: Number(updated.costPrice || 0),
    vatRate: Number(updated.vatRate || 0),
    categoryId: updated.categoryId ? String(updated.categoryId) : null,
    imageUrl: String(updated.imageUrl || '')
  }
}
