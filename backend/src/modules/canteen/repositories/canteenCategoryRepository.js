import CanteenCategory from '../models/CanteenCategory.js'

export const listByTenantAndBranch = (tenantId, branchId) =>
  CanteenCategory.find({ tenantId, branchId, isActive: true }).sort({ sortOrder: 1, name: 1, createdAt: -1 })

export const listByTenantAndBranches = (tenantId, branchIds) =>
  CanteenCategory.find({ tenantId, branchId: { $in: branchIds }, isActive: true }).sort({ sortOrder: 1, name: 1, createdAt: -1 })

export const findByIdAndScope = (id, tenantId, branchId) =>
  CanteenCategory.findOne({ _id: id, tenantId, branchId, isActive: true })

export const create = (data) => CanteenCategory.create(data)

export const updateByIdAndScope = (id, tenantId, branchId, update) =>
  CanteenCategory.findOneAndUpdate({ _id: id, tenantId, branchId }, update, { new: true })

export const softDeleteByIdAndScope = (id, tenantId, branchId) =>
  CanteenCategory.findOneAndUpdate({ _id: id, tenantId, branchId }, { isActive: false, updatedAt: new Date() }, { new: true })
