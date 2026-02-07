import CanteenSale from '../models/CanteenSale.js'

export const create = (data) => CanteenSale.create(data)

export const findByIdAndScope = (id, tenantId, branchId) =>
  CanteenSale.findOne({ _id: id, tenantId, branchId, isActive: true })

export const softDeleteByIdAndScope = (id, tenantId, branchId) =>
  CanteenSale.findOneAndUpdate({ _id: id, tenantId, branchId }, { isActive: false }, { new: true })

export const listByTenantAndBranchAndCustomer = (tenantId, branchId, customerId, { limit = 50 } = {}) =>
  CanteenSale.find({ tenantId, branchId, customerId, isActive: true }).sort({ createdAt: -1 }).limit(Number(limit || 50))

export const listByTenantAndCustomer = (tenantId, customerId, { limit = 50 } = {}) =>
  CanteenSale.find({ tenantId, customerId, isActive: true }).sort({ createdAt: -1 }).limit(Number(limit || 50))

export const listByTenantAndCustomerAndBranches = (tenantId, customerId, branchIds, { limit = 50 } = {}) => {
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const q = { tenantId, customerId, isActive: true }
  if (ids.length > 0) q.branchId = { $in: ids }
  return CanteenSale.find(q).sort({ createdAt: -1 }).limit(Number(limit || 50))
}

export const listByTenantAndBranchInRange = (tenantId, branchId, from, to) =>
  CanteenSale.find({ tenantId, branchId, isActive: true, createdAt: { $gte: from, $lt: to } })
