import { error } from '../utils/errors.js'
import { findAllByTenant, createCategory, confirmNameAvailable, updateById, findByIdAndTenant, countItemsByCategoryId, deleteByIdAndTenant } from '../repositories/categoryRepository.js'
import { deleteManyByCategoryId } from '../repositories/menuItemRepository.js'
import Branch from '../models/Branch.js'
import { documentBranchIds, normalizeVisibilityPayload } from '../utils/branchVisibility.js'

const validateBranchIds = async (tenantId, branchIds) => {
  if (!Array.isArray(branchIds) || branchIds.length === 0) return []
  const found = await Branch.find({ tenantId, _id: { $in: branchIds }, isActive: true, isDeleted: { $ne: true }, status: { $ne: 'deleted' } }).select('_id').lean()
  const foundIds = new Set((found || []).map((branch) => String(branch._id)))
  const missing = branchIds.filter((id) => !foundIds.has(String(id)))
  if (missing.length > 0) throw error('invalid_branch', 'Invalid branch', 400)
  return branchIds
}

const toCategoryDto = (category) => {
  const branchIds = documentBranchIds(category)
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    qrMenuVisible: category.qrMenuVisible !== false,
    branchIds,
    allBranches: branchIds.length === 0,
    isActive: category.isActive,
    active: category.active !== false,
    isDeleted: category.isDeleted === true,
    status: category.status || (category.isActive ? 'active' : 'inactive')
  }
}

export const listCategories = async (tenantId, query) => {
  const list = await findAllByTenant(tenantId, query)
  return list.map(toCategoryDto)
}

export const createCategoryService = async (tenantId, dto) => {
  const ok = await confirmNameAvailable(tenantId, dto.name)
  if (!ok) throw error('name_in_use', 'Name already in use', 400)
  const branchIds = await validateBranchIds(tenantId, normalizeVisibilityPayload(dto || {}))
  const c = await createCategory({
    tenantId,
    name: dto.name,
    sortOrder: dto.sortOrder ?? 0,
    qrMenuVisible: dto.qrMenuVisible !== false,
    branchIds
  })
  return toCategoryDto(c)
}

export const updateCategoryService = async (tenantId, id, dto) => {
  const c = await findByIdAndTenant(id, tenantId)
  if (!c) throw error('not_found', 'Category not found', 404)
  if (dto.name) {
    const ok = await confirmNameAvailable(tenantId, dto.name, c.id)
    if (!ok) throw error('name_in_use', 'Name already in use', 400)
  }
  const branchIds = dto.branchIds !== undefined || dto.allBranches === true
    ? await validateBranchIds(tenantId, normalizeVisibilityPayload(dto || {}))
    : documentBranchIds(c)
  const updated = await updateById(id, {
    name: dto.name ?? c.name,
    sortOrder: dto.sortOrder ?? c.sortOrder,
    qrMenuVisible: dto.qrMenuVisible ?? c.qrMenuVisible ?? true,
    branchIds,
    active: dto.isActive ?? dto.active ?? c.active ?? c.isActive,
    isActive: dto.isActive ?? c.isActive,
    isDeleted: c.isDeleted === true ? true : false,
    deletedAt: c.isDeleted === true ? (c.deletedAt || new Date()) : null,
    status: c.isDeleted === true ? 'deleted' : ((dto.isActive ?? c.isActive) ? 'active' : 'inactive')
  })
  return toCategoryDto(updated)
}

export const deleteCategoryService = async (tenantId, actorUserId, id) => {
  const c = await findByIdAndTenant(id, tenantId)
  if (!c) throw error('not_found', 'Category not found', 404)
  const deletedItemCount = await countItemsByCategoryId(tenantId, id)
  await deleteManyByCategoryId(tenantId, id)
  await deleteByIdAndTenant(id, tenantId)
  await (await import('./auditService.js')).log(tenantId, actorUserId, 'kategori_silindi', 'Category', c.id, {
    name: c.name || '',
    deletedItemCount
  })
  return { id: c.id, deleted: true, deletedItemCount }
}
