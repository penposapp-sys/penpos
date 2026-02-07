import CanteenCustomer from '../models/CanteenCustomer.js'

export const listByTenantAndBranch = (tenantId, branchId) =>
  CanteenCustomer.find({ tenantId, branchId, isActive: true }).sort({ createdAt: -1 })

export const listByTenant = (tenantId) =>
  CanteenCustomer.find({ tenantId, isActive: true }).sort({ createdAt: -1 })

export const searchByTenant = (tenantId, q, { limit = 50 } = {}) => {
  const term = String(q || '').trim().toLowerCase()
  if (!term) return CanteenCustomer.find({ tenantId, isActive: true }).sort({ createdAt: -1 }).limit(Number(limit || 50))
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  return CanteenCustomer.find({
    tenantId,
    isActive: true,
    $or: [
      { nameNormalized: { $regex: rx } },
      { phone: { $regex: rx } },
      { name: { $regex: rx } }
    ]
  }).sort({ createdAt: -1 }).limit(Number(limit || 50))
}

export const listByTenantAndBranches = (tenantId, branchIds) =>
  CanteenCustomer.find({ tenantId, branchId: { $in: branchIds }, isActive: true }).sort({ createdAt: -1 })

export const findByIdAndTenantAndBranches = (id, tenantId, branchIds) =>
  CanteenCustomer.findOne({ _id: id, tenantId, branchId: { $in: branchIds }, isActive: true })

export const findByIdAndScope = (id, tenantId, branchId) =>
  CanteenCustomer.findOne({ _id: id, tenantId, branchId, isActive: true })

export const findByIdAndTenant = (id, tenantId) =>
  CanteenCustomer.findOne({ _id: id, tenantId, isActive: true })

export const findByPhoneAndTenant = (tenantId, phone) =>
  CanteenCustomer.findOne({ tenantId, phone, isActive: true })

export const findByPhoneAndTenantExcludingId = (tenantId, phone, excludedId) =>
  CanteenCustomer.findOne({ tenantId, phone, isActive: true, _id: { $ne: excludedId } })

export const create = (data) => CanteenCustomer.create(data)

export const updateByIdAndTenant = (id, tenantId, update) =>
  CanteenCustomer.findOneAndUpdate({ _id: id, tenantId, isActive: true }, update, { new: true })

export const deleteByIdAndTenant = (id, tenantId) =>
  CanteenCustomer.findOneAndDelete({ _id: id, tenantId })
