import MenuItem from '../models/MenuItem.js'

export const findAllByTenant = async (tenantId, { categoryId, q, active }) => {
  const filter = { tenantId }
  if (categoryId) filter.categoryId = categoryId
  if (q) filter.name = { $regex: q, $options: 'i' }
  if (active === 'true') filter.isActive = true
  else if (active === 'false') filter.isActive = false
  return MenuItem.find(filter).sort({ sortOrder: 1, name: 1 })
}

export const createItem = (data) => MenuItem.create(data)

export const findByIdAndTenant = (id, tenantId) => MenuItem.findOne({ _id: id, tenantId })

export const confirmNameAvailable = async (tenantId, categoryId, name, excludeId) => {
  const query = { tenantId, categoryId, name: new RegExp(`^${name}$`, 'i') }
  if (excludeId) query._id = { $ne: excludeId }
  const exists = await MenuItem.exists(query)
  return !exists
}

export const updateById = (id, update) => MenuItem.findByIdAndUpdate(id, update, { new: true })
