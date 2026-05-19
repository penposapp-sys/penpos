import Branch from '../models/Branch.js'
import { notDeletedFilter } from '../utils/softDelete.js'

export const findAllByTenant = (tenantId) =>
  Branch.find(notDeletedFilter({ tenantId, isActive: true })).sort({ name: 1 })

export const findAllByTenantAny = (tenantId) =>
  Branch.find(notDeletedFilter({ tenantId })).sort({ name: 1 })

export const createBranch = (data) => Branch.create(data)

export const findByIdAndTenant = (id, tenantId) =>
  Branch.findOne({ _id: id, tenantId })

export const confirmNameAvailable = async (tenantId, name, excludeId) => {
  const query = notDeletedFilter({ tenantId, name: new RegExp(`^${name}$`, 'i'), isActive: true })
  if (excludeId) query._id = { $ne: excludeId }
  const exists = await Branch.exists(query)
  return !exists
}

export const updateById = (id, update) =>
  Branch.findByIdAndUpdate(id, update, { new: true })
