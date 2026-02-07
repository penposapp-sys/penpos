import { error } from '../../../utils/errors.js'
import * as catRepo from '../repositories/canteenCategoryRepository.js'
import * as prodRepo from '../repositories/canteenProductRepository.js'

const normalizeName = (name) => String(name || '').trim()
const normalizeKey = (name) => normalizeName(name).toLowerCase()
const normalizeBarcode = (barcode) => String(barcode || '').trim()

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isDuplicateBarcodeError = (err) => {
  const code = Number(err?.code || 0)
  if (code !== 11000) return false
  const keyPattern = err?.keyPattern || {}
  const keyValue = err?.keyValue || {}
  return Object.prototype.hasOwnProperty.call(keyPattern, 'barcode') || Object.prototype.hasOwnProperty.call(keyValue, 'barcode')
}

export const listCategories = async (tenantId, branchId) => {
  const items = await catRepo.listByTenantAndBranch(tenantId, branchId)
  return items.map(c => ({ id: c.id, name: c.name }))
}

export const createCategory = async (tenantId, branchId, input) => {
  const name = normalizeName(input?.name)
  if (!name) throw error('name_required', 'Kategori adı zorunludur', 400)
  const created = await catRepo.create({
    tenantId,
    branchId,
    name,
    nameNormalized: normalizeKey(name),
    isActive: true,
    createdAt: new Date()
  })
  return { id: created.id, name: created.name }
}

export const updateCategory = async (tenantId, branchId, id, input) => {
  const update = {}
  if (input?.name !== undefined) {
    const name = normalizeName(input?.name)
    if (!name) throw error('name_required', 'Kategori adı zorunludur', 400)
    update.name = name
    update.nameNormalized = normalizeKey(name)
  }
  const updated = await catRepo.updateByIdAndScope(id, tenantId, branchId, update)
  if (!updated) throw error('not_found', 'Kategori bulunamadı', 404)
  return { id: updated.id, name: updated.name }
}

export const removeCategory = async (tenantId, branchId, id) => {
  const deleted = await catRepo.softDeleteByIdAndScope(id, tenantId, branchId)
  if (!deleted) throw error('not_found', 'Kategori bulunamadı', 404)
  return { success: true }
}

export const listProducts = async (tenantId, branchIds) => {
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const items = await prodRepo.listByTenantAndBranches(tenantId, ids)
  return items.map(p => ({
    id: p.id,
    name: p.name,
    branchId: p.branchId ? String(p.branchId) : null,
    barcode: p.barcode || '',
    stockTrackingEnabled: p.stockTrackingEnabled === true,
    stockQty: Number(p.stockQty || 0),
    price: Number(p.price || 0),
    costPrice: Number(p.costPrice || 0),
    vatRate: Number(p.vatRate || 0),
    categoryId: p.categoryId ? String(p.categoryId) : null
  }))
}

export const createProduct = async (tenantId, branchId, input) => {
  const name = normalizeName(input?.name)
  if (!name) throw error('name_required', 'Ürün adı zorunludur', 400)
  const barcode = normalizeBarcode(input?.barcode)
  if (!barcode) throw error('validation_error', 'Barkod zorunludur', 400)
  const price = Number(input?.price || 0)
  const costPrice = Number(input?.costPrice || 0)
  const vatRate = Number(input?.vatRate || 0)
  const categoryId = input?.categoryId ? String(input.categoryId) : null
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
      categoryId: created.categoryId ? String(created.categoryId) : null
    }
  } catch (err) {
    if (isDuplicateBarcodeError(err)) throw error('duplicate_barcode', 'Bu barkod zaten kayıtlı', 409)
    throw err
  }
}

export const updateProduct = async (tenantId, branchId, id, input) => {
  const update = {}
  if (input?.name !== undefined) {
    const name = normalizeName(input?.name)
    if (!name) throw error('name_required', 'Ürün adı zorunludur', 400)
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
  if (input?.categoryId !== undefined) update.categoryId = input?.categoryId ? String(input.categoryId) : null
  try {
    const updated = await prodRepo.updateByIdAndScope(id, tenantId, branchId, update)
    if (!updated) throw error('not_found', 'Ürün bulunamadı', 404)
    return {
      id: updated.id,
      name: updated.name,
      barcode: updated.barcode || '',
      stockTrackingEnabled: updated.stockTrackingEnabled === true,
      stockQty: Number(updated.stockQty || 0),
      price: Number(updated.price || 0),
      costPrice: Number(updated.costPrice || 0),
      vatRate: Number(updated.vatRate || 0),
      categoryId: updated.categoryId ? String(updated.categoryId) : null
    }
  } catch (err) {
    if (isDuplicateBarcodeError(err)) throw error('duplicate_barcode', 'Bu barkod zaten kayıtlı', 409)
    throw err
  }
}

export const getProductByBarcode = async (tenantId, branchId, barcodeRaw) => {
  const barcode = normalizeBarcode(barcodeRaw)
  if (!barcode) throw error('validation_error', 'Barkod zorunludur', 400)
  const p = await prodRepo.findByBarcodeAndScope(barcode, tenantId, branchId)
  if (!p) throw error('not_found', 'Barkod bulunamadı', 404)
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
  return items.map(p => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode || '',
    price: Number(p.price || 0),
    stockQty: Number(p.stockQty || 0)
  }))
}

export const removeProduct = async (tenantId, branchId, id) => {
  const deleted = await prodRepo.softDeleteByIdAndScope(id, tenantId, branchId)
  if (!deleted) throw error('not_found', 'Ürün bulunamadı', 404)
  return { success: true }
}
