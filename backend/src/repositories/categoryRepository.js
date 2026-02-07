import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'

export const findAllByTenant = async (tenantId, { q, active }) => {
  const filter = { tenantId }
  if (q) filter.name = { $regex: q, $options: 'i' }
  if (active === 'true') filter.isActive = true
  else if (active === 'false') filter.isActive = false
  return Category.find(filter).sort({ sortOrder: 1, name: 1 })
}

export const createCategory = (data) => Category.create(data)

export const findByIdAndTenant = (id, tenantId) => Category.findOne({ _id: id, tenantId })

export const confirmNameAvailable = async (tenantId, name, excludeId) => {
  const query = { tenantId, name: new RegExp(`^${name}$`, 'i') }
  if (excludeId) query._id = { $ne: excludeId }
  const exists = await Category.exists(query)
  return !exists
}

export const updateById = (id, update) => Category.findByIdAndUpdate(id, update, { new: true })

export const hasAnyItems = async (tenantId, categoryId) => {
  const count = await MenuItem.countDocuments({ tenantId, categoryId })
  return count > 0
}
