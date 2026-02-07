import Tenant from '../models/Tenant.js'

export const createTenant = (data) => Tenant.create(data)
export const findTenantById = (id) => Tenant.findById(id)
export const listTenants = () => Tenant.find({}).sort({ createdAt: -1 })
export const findActiveById = (id) => Tenant.findOne({ _id: id, status: 'active' })
export const updateById = (tenantId, update) =>
  Tenant.findByIdAndUpdate(tenantId, update, { new: true })
