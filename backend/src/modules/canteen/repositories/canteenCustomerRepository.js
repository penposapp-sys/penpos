import CanteenCustomer from '../models/CanteenCustomer.js'

const buildActiveFilter = (includeInactive = false) => (includeInactive ? {} : { isActive: true })

export const listByTenantAndBranch = (tenantId, branchId, { includeInactive = false } = {}) =>
  CanteenCustomer.find({ tenantId, branchId, ...buildActiveFilter(includeInactive) }).sort({ createdAt: -1 })

export const listByTenant = (tenantId, { includeInactive = false } = {}) =>
  CanteenCustomer.find({ tenantId, ...buildActiveFilter(includeInactive) }).sort({ createdAt: -1 })

export const searchByTenant = (tenantId, q, { limit = 50, includeInactive = false } = {}) => {
  const term = String(q || '').trim().toLowerCase()
  if (!term) return CanteenCustomer.find({ tenantId, ...buildActiveFilter(includeInactive) }).sort({ createdAt: -1 }).limit(Number(limit || 50))
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  return CanteenCustomer.find({
    tenantId,
    ...buildActiveFilter(includeInactive),
    $or: [
      { nameNormalized: { $regex: rx } },
      { phone: { $regex: rx } },
      { name: { $regex: rx } }
    ]
  }).sort({ createdAt: -1 }).limit(Number(limit || 50))
}

export const listByTenantAndBranches = (tenantId, branchIds, { includeInactive = false } = {}) =>
  CanteenCustomer.find({ tenantId, branchId: { $in: branchIds }, ...buildActiveFilter(includeInactive) }).sort({ createdAt: -1 })

export const findByIdAndTenantAndBranches = (id, tenantId, branchIds, { includeInactive = false } = {}) =>
  CanteenCustomer.findOne({ _id: id, tenantId, branchId: { $in: branchIds }, ...buildActiveFilter(includeInactive) })

export const findByIdAndScope = (id, tenantId, branchId, { includeInactive = false } = {}) =>
  CanteenCustomer.findOne({ _id: id, tenantId, branchId, ...buildActiveFilter(includeInactive) })

export const findByIdAndTenant = (id, tenantId, { includeInactive = false } = {}) =>
  CanteenCustomer.findOne({ _id: id, tenantId, ...buildActiveFilter(includeInactive) })

export const findByPhoneAndTenant = (tenantId, phone, { includeInactive = false } = {}) =>
  CanteenCustomer.findOne({ tenantId, phone, ...buildActiveFilter(includeInactive) })

export const findByPhoneAndTenantExcludingId = (tenantId, phone, excludedId, { includeInactive = false } = {}) =>
  CanteenCustomer.findOne({ tenantId, phone, ...buildActiveFilter(includeInactive), _id: { $ne: excludedId } })

export const create = (data) => CanteenCustomer.create(data)

export const updateByIdAndTenant = (id, tenantId, update) =>
  CanteenCustomer.findOneAndUpdate({ _id: id, tenantId, isActive: true }, update, { new: true })

export const softDeleteByIdAndTenant = (id, tenantId, actorUserId) =>
  CanteenCustomer.findOneAndUpdate(
    { _id: id, tenantId, isActive: true },
    { $set: { isActive: false, deletedAt: new Date(), deletedBy: actorUserId } },
    { new: true }
  )

export const listByIdsAndTenant = (tenantId, ids, { includeInactive = false } = {}) =>
  CanteenCustomer.find({ tenantId, _id: { $in: ids }, ...buildActiveFilter(includeInactive) })
