import PrintStation from '../models/PrintStation.js'

export const listByTenantAndSystem = (tenantId, system) =>
  PrintStation.find({ tenantId, system }).sort({ isActive: -1, updatedAt: -1, createdAt: -1 })

export const findByIdAndScope = (id, tenantId, system) =>
  PrintStation.findOne({ _id: id, tenantId, system })

export const findByNameAndScope = (name, tenantId, system) =>
  PrintStation.findOne({ name, tenantId, system })

export const findActiveByTenantAndSystem = (tenantId, system) =>
  PrintStation.findOne({ tenantId, system, isActive: true })

export const listActiveByTenantAndSystem = (tenantId, system) =>
  PrintStation.find({ tenantId, system, isActive: true }).sort({ updatedAt: -1, createdAt: -1 })

export const create = (data) => PrintStation.create(data)

export const updateByIdAndScope = (id, tenantId, system, update) =>
  PrintStation.findOneAndUpdate({ _id: id, tenantId, system }, update, { new: true })

export const deleteByIdAndScope = (id, tenantId, system) =>
  PrintStation.deleteOne({ _id: id, tenantId, system })
