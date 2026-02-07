import PrintProfile from '../models/PrintProfile.js'

export const listByTenantAndSystem = (tenantId, system) =>
  PrintProfile.find({ tenantId, system }).sort({ updatedAt: -1, createdAt: -1 })

export const findByIdAndScope = (id, tenantId, system) =>
  PrintProfile.findOne({ _id: id, tenantId, system })

export const findByCodeAndScope = (code, tenantId, system) =>
  PrintProfile.findOne({ code, tenantId, system })

export const create = (data) => PrintProfile.create(data)

export const updateByIdAndScope = (id, tenantId, system, update) =>
  PrintProfile.findOneAndUpdate({ _id: id, tenantId, system }, update, { new: true })

