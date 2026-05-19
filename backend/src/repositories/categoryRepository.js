import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import { notDeletedFilter } from '../utils/softDelete.js'
import { buildBranchVisibilityFilter, normalizeObjectIdArray } from '../utils/branchVisibility.js'

export const findAllByTenant = async (tenantId, { q, active, branchId, branchIds }) => {
  const filter = notDeletedFilter({ tenantId })
  if (q) filter.name = { $regex: q, $options: 'i' }
  if (active === 'true') filter.isActive = true
  else if (active === 'false') filter.isActive = false
  const requestedBranchIds = normalizeObjectIdArray(branchIds !== undefined ? branchIds : (branchId ? [branchId] : []))
  const visibilityFilter = buildBranchVisibilityFilter(requestedBranchIds)
  if (Object.keys(visibilityFilter).length > 0) {
    filter.$and = [...(Array.isArray(filter.$and) ? filter.$and : []), visibilityFilter]
  }
  return Category.find(filter).sort({ sortOrder: 1, name: 1 })
}

export const createCategory = (data) => Category.create(data)

export const findByIdAndTenant = (id, tenantId) => Category.findOne({ _id: id, tenantId })

export const confirmNameAvailable = async (tenantId, name, excludeId) => {
  const query = notDeletedFilter({ tenantId, name: new RegExp(`^${name}$`, 'i') })
  if (excludeId) query._id = { $ne: excludeId }
  const exists = await Category.exists(query)
  return !exists
}

export const updateById = (id, update) => Category.findByIdAndUpdate(id, update, { new: true })

export const hasAnyItems = async (tenantId, categoryId) => {
  const count = await MenuItem.countDocuments(notDeletedFilter({ tenantId, categoryId }))
  return count > 0
}

export const countItemsByCategoryId = (tenantId, categoryId) => MenuItem.countDocuments(notDeletedFilter({ tenantId, categoryId }))

export const deleteByIdAndTenant = (id, tenantId) => Category.deleteOne({ _id: id, tenantId })
