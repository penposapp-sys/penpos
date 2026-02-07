import { error } from '../utils/errors.js'
import { findAllByTenant, createCategory, confirmNameAvailable, updateById, findByIdAndTenant, hasAnyItems } from '../repositories/categoryRepository.js'

export const listCategories = async (tenantId, query) => {
  const list = await findAllByTenant(tenantId, query)
  return list.map(c => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, isActive: c.isActive }))
}

export const createCategoryService = async (tenantId, dto) => {
  const ok = await confirmNameAvailable(tenantId, dto.name)
  if (!ok) throw error('name_in_use', 'Name already in use', 400)
  const c = await createCategory({ tenantId, name: dto.name, sortOrder: dto.sortOrder ?? 0 })
  return { id: c.id, name: c.name, sortOrder: c.sortOrder, isActive: c.isActive }
}

export const updateCategoryService = async (tenantId, id, dto) => {
  const c = await findByIdAndTenant(id, tenantId)
  if (!c) throw error('not_found', 'Category not found', 404)
  if (dto.name) {
    const ok = await confirmNameAvailable(tenantId, dto.name, c.id)
    if (!ok) throw error('name_in_use', 'Name already in use', 400)
  }
  const updated = await updateById(id, {
    name: dto.name ?? c.name,
    sortOrder: dto.sortOrder ?? c.sortOrder,
    isActive: dto.isActive ?? c.isActive
  })
  return { id: updated.id, name: updated.name, sortOrder: updated.sortOrder, isActive: updated.isActive }
}

export const deleteCategoryService = async (tenantId, actorUserId, id) => {
  const c = await findByIdAndTenant(id, tenantId)
  if (!c) throw error('not_found', 'Category not found', 404)
  const hasItems = await hasAnyItems(tenantId, id)
  if (hasItems) throw error('category_has_items', 'Category has items', 400)
  const updated = await updateById(id, { isActive: false })
  await (await import('./auditService.js')).log(tenantId, actorUserId, 'kategori_silindi', 'Category', updated.id, {})
  return { id: updated.id, isActive: updated.isActive }
}
