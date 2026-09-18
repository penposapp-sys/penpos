import User from '../models/User.js'
import { notDeletedFilter } from '../utils/softDelete.js'

export const findAllByTenant = (tenantId) =>
  User.find(notDeletedFilter({ tenantId, role: 'staff' })).sort({ createdAt: -1 })

export const createStaff = (data) => User.create({ ...data, role: 'staff', active: true, isActive: true, isDeleted: false, deletedAt: null, status: 'active' })

export const findByIdAndTenant = (id, tenantId) =>
  User.findOne({ _id: id, tenantId, role: 'staff' })

export const confirmEmailAvailable = async (tenantId, email, excludeUserId, systemType) => {
  const scopedSystemType = String(systemType || '').trim()
  const query = notDeletedFilter(scopedSystemType ? { email, systemType: scopedSystemType } : { tenantId, email })
  if (excludeUserId) query._id = { $ne: excludeUserId }
  const exists = await User.exists(query)
  return !exists
}

export const confirmUsernameAvailable = async (tenantId, username, excludeUserId) => {
  const query = notDeletedFilter({ tenantId, username })
  if (excludeUserId) query._id = { $ne: excludeUserId }
  const exists = await User.exists(query)
  return !exists
}

export const updateById = (id, update) =>
  User.findByIdAndUpdate(id, update, { new: true })
