import PrintPrinter from '../models/PrintPrinter.js'

export const listByTenantAndSystem = (tenantId, system) =>
  PrintPrinter.find({ tenantId, system }).sort({ updatedAt: -1, createdAt: -1 })

export const findByIdAndScope = (id, tenantId, system) =>
  PrintPrinter.findOne({ _id: id, tenantId, system })

export const findByNameAndScope = (name, tenantId, system) =>
  PrintPrinter.findOne({ name, tenantId, system })

export const create = (data) => PrintPrinter.create(data)

export const updateByIdAndScope = (id, tenantId, system, update) =>
  PrintPrinter.findOneAndUpdate({ _id: id, tenantId, system }, update, { new: true })
