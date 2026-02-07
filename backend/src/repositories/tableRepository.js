import Table from '../models/Table.js'

export const listTables = async (tenantId, branchId) => {
  const filter = { tenantId, isActive: true }
  if (branchId) filter.branchId = branchId
  return Table.find(filter).sort({ name: 1 })
}

export const createTable = (data) => Table.create(data)

export const findByIdAndTenant = (id, tenantId) =>
  Table.findOne({ _id: id, tenantId })

export const confirmNameAvailable = async (tenantId, name, excludeId) => {
  const query = { tenantId, name: new RegExp(`^${name}$`, 'i'), isActive: true }
  if (excludeId) query._id = { $ne: excludeId }
  const exists = await Table.exists(query)
  return !exists
}

export const updateById = (id, update) =>
  Table.findByIdAndUpdate(id, update, { new: true })
