import CanteenSale from '../models/CanteenSale.js'

export const create = (data) => CanteenSale.create(data)

const normalizeBranchIds = (branchIds) => Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []

export const findByIdAndScope = (id, tenantId, branchId) =>
  CanteenSale.findOne({ _id: id, tenantId, branchId, isActive: true, status: { $ne: 'cancelled' } })

export const findAnyByIdAndScope = (id, tenantId, branchId) =>
  CanteenSale.findOne({ _id: id, tenantId, branchId })

export const findAnyByIdAndTenant = (id, tenantId) =>
  CanteenSale.findOne({ _id: id, tenantId })

export const updateByIdAndScope = (id, tenantId, branchId, update = {}, options = {}) =>
  CanteenSale.findOneAndUpdate({ _id: id, tenantId, branchId }, update, { new: true, ...(options || {}) })

export const softDeleteByIdAndScope = (id, tenantId, branchId, update = {}) =>
  CanteenSale.findOneAndUpdate(
    { _id: id, tenantId, branchId },
    {
      $set: {
        isActive: false,
        status: 'cancelled',
        cancelledAt: new Date(),
        reopenedAt: null,
        reopenedBy: null,
        ...update
      }
    },
    { new: true }
  )

export const softDeleteByIdAndTenant = (id, tenantId, update = {}) =>
  CanteenSale.findOneAndUpdate(
    { _id: id, tenantId },
    {
      $set: {
        isActive: false,
        status: 'cancelled',
        cancelledAt: new Date(),
        reopenedAt: null,
        reopenedBy: null,
        ...update
      }
    },
    { new: true }
  )

export const reopenByIdAndScope = (id, tenantId, branchId, update = {}) =>
  CanteenSale.findOneAndUpdate(
    { _id: id, tenantId, branchId },
    {
      $set: {
        isActive: true,
        status: 'reopened',
        reopenedAt: new Date(),
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: '',
        ...update
      }
    },
    { new: true }
  )

export const listByTenantAndBranchIds = (tenantId, branchIds, { limit = 50, skip = 0, includeCancelled = false } = {}) => {
  const ids = normalizeBranchIds(branchIds)
  const q = { tenantId }
  if (ids.length > 0) q.branchId = { $in: ids }
  if (!includeCancelled) {
    q.$and = [
      { $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }] },
      { isActive: true }
    ]
  }
  return CanteenSale
    .find(q)
    .sort({ createdAt: -1, _id: -1 })
    .skip(Number(skip || 0))
    .limit(Number(limit || 50))
    .populate('branchId', 'name')
    .populate('actorUserId', 'name username')
    .lean()
}

export const countByTenantAndBranchIds = (tenantId, branchIds, { includeCancelled = false } = {}) => {
  const ids = normalizeBranchIds(branchIds)
  const q = { tenantId }
  if (ids.length > 0) q.branchId = { $in: ids }
  if (!includeCancelled) {
    q.$and = [
      { $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }] },
      { isActive: true }
    ]
  }
  return CanteenSale.countDocuments(q)
}

export const listByTenantAndBranchAndCustomer = (tenantId, branchId, customerId, { limit = 50 } = {}) =>
  CanteenSale.find({
    tenantId,
    branchId,
    customerId,
    isActive: true,
    $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }]
  }).sort({ createdAt: -1 }).limit(Number(limit || 50))

export const listByTenantAndCustomer = (tenantId, customerId, { limit = 50 } = {}) =>
  CanteenSale.find({
    tenantId,
    customerId,
    isActive: true,
    $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }]
  }).sort({ createdAt: -1 }).limit(Number(limit || 50))

export const listByTenantAndCustomerAndBranches = (tenantId, customerId, branchIds, { limit = 50 } = {}) => {
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const q = {
    tenantId,
    customerId,
    isActive: true,
    $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }]
  }
  if (ids.length > 0) q.branchId = { $in: ids }
  return CanteenSale.find(q).sort({ createdAt: -1 }).limit(Number(limit || 50))
}

export const listByTenantAndBranchInRange = (tenantId, branchId, from, to) =>
  CanteenSale.find({
    tenantId,
    branchId,
    isActive: true,
    $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }],
    createdAt: { $gte: from, $lt: to }
  })
