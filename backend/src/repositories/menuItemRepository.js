import MenuItem from '../models/MenuItem.js'
import { notDeletedFilter } from '../utils/softDelete.js'
import { buildBranchVisibilityFilter, normalizeObjectIdArray } from '../utils/branchVisibility.js'

export const findAllByTenant = async (tenantId, { categoryId, q, active, branchId, branchIds }) => {
  const filter = notDeletedFilter({ tenantId })
  if (categoryId) filter.categoryId = categoryId
  if (q) filter.name = { $regex: q, $options: 'i' }
  if (active === 'true') filter.isActive = true
  else if (active === 'false') filter.isActive = false
  const requestedBranchIds = normalizeObjectIdArray(branchIds !== undefined ? branchIds : (branchId ? [branchId] : []))
  const visibilityFilter = buildBranchVisibilityFilter(requestedBranchIds)
  if (Object.keys(visibilityFilter).length > 0) {
    filter.$and = [...(Array.isArray(filter.$and) ? filter.$and : []), visibilityFilter]
  }
  return MenuItem.find(filter).sort({ sortOrder: 1, name: 1 })
}

export const createItem = (data) => MenuItem.create(data)

export const findByIdAndTenant = (id, tenantId) => MenuItem.findOne({ _id: id, tenantId })

export const confirmNameAvailable = async (tenantId, categoryId, name, excludeId) => {
  const query = notDeletedFilter({ tenantId, categoryId, name: new RegExp(`^${name}$`, 'i') })
  if (excludeId) query._id = { $ne: excludeId }
  const exists = await MenuItem.exists(query)
  return !exists
}

export const updateById = (id, update) => MenuItem.findByIdAndUpdate(id, update, { new: true })

export const deleteByIdAndTenant = (id, tenantId) => MenuItem.deleteOne({ _id: id, tenantId })

export const countByCategoryId = (tenantId, categoryId) => MenuItem.countDocuments(notDeletedFilter({ tenantId, categoryId }))

export const deleteManyByCategoryId = (tenantId, categoryId) => MenuItem.deleteMany({ tenantId, categoryId })
