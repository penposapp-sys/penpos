import Table from '../models/Table.js'
import { applyBranchFilter } from '../utils/branchFilter.js'

export const listTables = async (tenantId, branchFilter) => {
  let filter = { tenantId, isActive: true }
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    const branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
    filter = applyBranchFilter(filter, branchIds.length > 0 ? branchIds : (branchFilter.branchId ? [branchFilter.branchId] : []))
  } else if (branchFilter) {
    filter.branchId = branchFilter
  }
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
