import { error } from '../utils/errors.js'
import { findAllByTenant, createItem, confirmNameAvailable, updateById, findByIdAndTenant } from '../repositories/menuItemRepository.js'
import { findByIdAndTenant as findCategoryByIdAndTenant } from '../repositories/categoryRepository.js'
import MenuItem from '../models/MenuItem.js'
import { getTenantPlan, ensureNotExpired } from './planService.js'

export const listMenuItems = async (tenantId, query) => {
  const list = await findAllByTenant(tenantId, query)
  return list.map(i => ({
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    price: i.price,
    isWeightBased: !!i.isWeightBased,
    printLabelEnabled: i.printLabelEnabled === true,
    description: i.description,
    imageUrl: i.imageUrl,
    sortOrder: i.sortOrder,
    isActive: i.isActive
  }))
}

export const createMenuItemService = async (tenantId, dto) => {
  await ensureNotExpired(tenantId, dto.actorUserId || null)
  const plan = await getTenantPlan(tenantId)
  if (plan && plan.limits && typeof plan.limits.products === 'number' && plan.limits.products !== -1) {
    const count = await MenuItem.countDocuments({ tenantId })
    if (count >= plan.limits.products) {
      throw error('plan_limit_exceeded', 'Ürün limiti aşıldı', 403)
    }
  }
  const cat = await findCategoryByIdAndTenant(dto.categoryId, tenantId)
  if (!cat) throw error('not_found', 'Category not found', 404)
  const ok = await confirmNameAvailable(tenantId, dto.categoryId, dto.name)
  if (!ok) throw error('name_in_use', 'Name already in use', 400)
  const i = await createItem({
    tenantId,
    categoryId: dto.categoryId,
    name: dto.name,
    price: dto.price,
    isWeightBased: !!dto.isWeightBased,
    printLabelEnabled: dto.printLabelEnabled === true,
    description: dto.description ?? '',
    imageUrl: dto.imageUrl ?? '',
    sortOrder: dto.sortOrder ?? 0
  })
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    price: i.price,
    isWeightBased: !!i.isWeightBased,
    printLabelEnabled: i.printLabelEnabled === true,
    description: i.description,
    imageUrl: i.imageUrl,
    sortOrder: i.sortOrder,
    isActive: i.isActive
  }
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
  const updated = await updateById(id, {
    categoryId: dto.categoryId ?? i.categoryId,
    name: dto.name ?? i.name,
    price: dto.price ?? i.price,
    isWeightBased: dto.isWeightBased ?? i.isWeightBased,
    printLabelEnabled: dto.printLabelEnabled ?? i.printLabelEnabled,
    description: dto.description ?? i.description,
    imageUrl: dto.imageUrl ?? i.imageUrl,
    sortOrder: dto.sortOrder ?? i.sortOrder,
    isActive: dto.isActive ?? i.isActive
  })
  return {
    id: updated.id,
    categoryId: updated.categoryId,
    name: updated.name,
    price: updated.price,
    isWeightBased: !!updated.isWeightBased,
    printLabelEnabled: updated.printLabelEnabled === true,
    description: updated.description,
    imageUrl: updated.imageUrl,
    sortOrder: updated.sortOrder,
    isActive: updated.isActive
  }
}

export const deleteMenuItemService = async (tenantId, actorUserId, id) => {
  const i = await findByIdAndTenant(id, tenantId)
  if (!i) throw error('not_found', 'Item not found', 404)
  const updated = await updateById(id, { isActive: false })
  await (await import('./auditService.js')).log(tenantId, actorUserId, 'urun_silindi', 'MenuItem', updated.id, {})
  return { id: updated.id, isActive: updated.isActive }
}
