import CanteenBranch from '../models/CanteenBranch.js'

export const listByTenant = (tenantId) =>
  CanteenBranch.find({ tenantId, isActive: true }).sort({ createdAt: -1 })

export const listAllByTenant = (tenantId) =>
  CanteenBranch.find({ tenantId }).sort({ createdAt: -1 })

export const listActiveByIdsAndTenant = (ids, tenantId) =>
  CanteenBranch.find({ tenantId, isActive: true, _id: { $in: ids } })

export const findByIdAndTenant = (id, tenantId) =>
  CanteenBranch.findOne({ _id: id, tenantId, isActive: true })

export const findAnyByIdAndTenant = (id, tenantId) =>
  CanteenBranch.findOne({ _id: id, tenantId })

export const findAnyByPublicSlug = (publicSlug) =>
  CanteenBranch.findOne({ publicSlug: String(publicSlug || '').trim() })

export const create = (data) => CanteenBranch.create(data)

export const updateByIdAndTenant = (id, tenantId, update) =>
  CanteenBranch.findOneAndUpdate({ _id: id, tenantId }, update, { new: true })

export const softDeleteByIdAndTenant = (id, tenantId) =>
  CanteenBranch.findOneAndUpdate({ _id: id, tenantId }, { isActive: false }, { new: true })
