import { error } from '../utils/errors.js'
import { findAllByTenant, createItem, confirmNameAvailable, updateById, findByIdAndTenant, deleteByIdAndTenant } from '../repositories/menuItemRepository.js'
import { findByIdAndTenant as findCategoryByIdAndTenant } from '../repositories/categoryRepository.js'
import MenuItem from '../models/MenuItem.js'
import Branch from '../models/Branch.js'
import { getTenantPlan, ensureNotExpired } from './planService.js'
import { documentBranchIds, normalizeVisibilityPayload } from '../utils/branchVisibility.js'
import { deleteProductImageFile, replaceProductImageFile } from '../utils/productImageStorage.js'

const validateBranchIds = async (tenantId, branchIds) => {
  if (!Array.isArray(branchIds) || branchIds.length === 0) return []
  const found = await Branch.find({ tenantId, _id: { $in: branchIds }, isActive: true, isDeleted: { $ne: true }, status: { $ne: 'deleted' } }).select('_id').lean()
  const foundIds = new Set((found || []).map((branch) => String(branch._id)))
  const missing = branchIds.filter((id) => !foundIds.has(String(id)))
  if (missing.length > 0) throw error('invalid_branch', 'Invalid branch', 400)
  return branchIds
}

const asPlainObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

const buildNextSettings = (currentSettings, incomingSettings, context = {}) => {
  const current = asPlainObject(currentSettings)
  const incoming = asPlainObject(incomingSettings)
  const merged = {
    ...current,
    ...incoming
  }

  const currentHistory = Array.isArray(current.priceHistory) ? current.priceHistory : []
  const incomingHistory = Array.isArray(incoming.priceHistory) ? incoming.priceHistory : currentHistory
  let nextHistory = incomingHistory

  const previousPrice = Number(context.previousPrice)
  const nextPrice = Number(context.nextPrice)
  if (Number.isFinite(previousPrice) && Number.isFinite(nextPrice) && previousPrice !== nextPrice) {
    nextHistory = [
      {
        id: `price-${Date.now()}`,
        oldPrice: previousPrice,
        newPrice: nextPrice,
        changedAt: new Date().toISOString(),
        changedBy: context.actorUserId || '',
        changedByName: context.actorName || 'Bilinmeyen Kullanici'
      },
      ...incomingHistory
    ].slice(0, 100)
  }

  merged.priceHistory = nextHistory
  return merged
}

const toMenuItemDto = (item) => {
  const branchIds = documentBranchIds(item)
  return {
    id: item.id,
    sku: item.sku || '',
    categoryId: item.categoryId,
    name: item.name,
    price: item.price,
    barcode: item.barcode || '',
    vatRate: typeof item.vatRate === 'number' ? item.vatRate : 0,
    unit: item.unit || '',
    isWeightBased: !!item.isWeightBased,
    printLabelEnabled: item.printLabelEnabled === true,
    description: item.description,
    imageUrl: item.imageUrl,
    sortOrder: item.sortOrder,
    settings: asPlainObject(item.settings),
    branchIds,
    allBranches: branchIds.length === 0,
    isActive: item.isActive,
    active: item.active !== false,
    isDeleted: item.isDeleted === true,
    status: item.status || (item.isActive ? 'active' : 'inactive')
  }
}

export const listMenuItems = async (tenantId, query) => {
  const list = await findAllByTenant(tenantId, query)
  return list.map(toMenuItemDto)
}

export const getMenuItemService = async (tenantId, id) => {
  const item = await findByIdAndTenant(id, tenantId)
  if (!item || item.isDeleted === true || item.status === 'deleted') {
    throw error('not_found', 'Item not found', 404)
  }
  return toMenuItemDto(item)
}

export const createMenuItemService = async (tenantId, dto) => {
  await ensureNotExpired(tenantId, dto.actorUserId || null)
  const plan = await getTenantPlan(tenantId)
  if (plan && plan.limits && typeof plan.limits.products === 'number' && plan.limits.products !== -1) {
    const count = await MenuItem.countDocuments({ tenantId, isDeleted: { $ne: true }, status: { $ne: 'deleted' } })
    if (count >= plan.limits.products) {
      throw error('plan_limit_exceeded', 'Ürün limiti aşıldı', 403)
    }
  }
  const cat = await findCategoryByIdAndTenant(dto.categoryId, tenantId)
  if (!cat) throw error('not_found', 'Category not found', 404)
  const ok = await confirmNameAvailable(tenantId, dto.categoryId, dto.name)
  if (!ok) throw error('name_in_use', 'Name already in use', 400)
  const branchIds = await validateBranchIds(tenantId, normalizeVisibilityPayload(dto || {}))
  const i = await createItem({
    tenantId,
    categoryId: dto.categoryId,
    sku: dto.sku ?? '',
    name: dto.name,
    price: dto.price,
    barcode: dto.barcode ?? '',
    vatRate: dto.vatRate ?? 0,
    unit: dto.unit ?? '',
    isWeightBased: !!dto.isWeightBased,
    printLabelEnabled: dto.printLabelEnabled === true,
    description: dto.description ?? '',
    imageUrl: '',
    settings: buildNextSettings({}, dto.settings, {
      previousPrice: null,
      nextPrice: dto.price,
      actorUserId: dto.actorUserId,
      actorName: dto.actorName
    }),
    sortOrder: dto.sortOrder ?? 0,
    branchIds
  })
  return toMenuItemDto(i)
}

export const updateMenuItemService = async (tenantId, id, dto) => {
  const i = await findByIdAndTenant(id, tenantId)
  if (!i) throw error('not_found', 'Item not found', 404)
  if (dto.categoryId) {
    const cat = await findCategoryByIdAndTenant(dto.categoryId, tenantId)
    if (!cat) throw error('not_found', 'Category not found', 404)
  }
  if (dto.name) {
    const catId = dto.categoryId ?? i.categoryId
    const ok = await confirmNameAvailable(tenantId, catId, dto.name, i.id)
    if (!ok) throw error('name_in_use', 'Name already in use', 400)
  }
  const branchIds = dto.branchIds !== undefined || dto.allBranches === true
    ? await validateBranchIds(tenantId, normalizeVisibilityPayload(dto || {}))
    : documentBranchIds(i)
  const updated = await updateById(id, {
    categoryId: dto.categoryId ?? i.categoryId,
    sku: dto.sku ?? i.sku ?? '',
    name: dto.name ?? i.name,
    price: dto.price ?? i.price,
    barcode: dto.barcode ?? i.barcode ?? '',
    vatRate: dto.vatRate ?? i.vatRate ?? 0,
    unit: dto.unit ?? i.unit ?? '',
    isWeightBased: dto.isWeightBased ?? i.isWeightBased,
    printLabelEnabled: dto.printLabelEnabled ?? i.printLabelEnabled,
    description: dto.description ?? i.description,
    imageUrl: i.imageUrl,
    settings: buildNextSettings(i.settings, dto.settings, {
      previousPrice: i.price,
      nextPrice: dto.price ?? i.price,
      actorUserId: dto.actorUserId,
      actorName: dto.actorName
    }),
    sortOrder: dto.sortOrder ?? i.sortOrder,
    branchIds,
    active: dto.isActive ?? dto.active ?? i.active ?? i.isActive,
    isActive: dto.isActive ?? i.isActive,
    isDeleted: i.isDeleted === true ? true : false,
    deletedAt: i.isDeleted === true ? (i.deletedAt || new Date()) : null,
    status: i.isDeleted === true ? 'deleted' : ((dto.isActive ?? i.isActive) ? 'active' : 'inactive')
  })
  return toMenuItemDto(updated)
}

export const deleteMenuItemService = async (tenantId, actorUserId, id) => {
  const i = await findByIdAndTenant(id, tenantId)
  if (!i) throw error('not_found', 'Item not found', 404)
  await deleteByIdAndTenant(id, tenantId)
  await deleteProductImageFile(i.imageUrl)
  await (await import('./auditService.js')).log(tenantId, actorUserId, 'urun_silindi', 'MenuItem', i.id, { name: i.name || '' })
  return { id: i.id, deleted: true }
}

export const uploadMenuItemImageService = async (tenantId, id, file) => {
  const item = await findByIdAndTenant(id, tenantId)
  if (!item || item.isDeleted === true || item.status === 'deleted') {
    throw error('not_found', 'Item not found', 404)
  }

  const saved = await replaceProductImageFile(item.imageUrl, file)
  const updated = await updateById(id, { imageUrl: saved.imageUrl })
  return toMenuItemDto(updated)
}

export const removeMenuItemImageService = async (tenantId, id) => {
  const item = await findByIdAndTenant(id, tenantId)
  if (!item || item.isDeleted === true || item.status === 'deleted') {
    throw error('not_found', 'Item not found', 404)
  }

  await deleteProductImageFile(item.imageUrl)
  const updated = await updateById(id, { imageUrl: '' })
  return toMenuItemDto(updated)
}
