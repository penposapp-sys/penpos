import User from '../models/User.js'

export const findAllByTenant = (tenantId) =>
  User.find({ tenantId, role: 'staff' }).sort({ createdAt: -1 })

export const createStaff = (data) => User.create({ ...data, role: 'staff', isActive: true })

export const findByIdAndTenant = (id, tenantId) =>
  User.findOne({ _id: id, tenantId, role: 'staff' })

export const confirmEmailAvailable = async (tenantId, email, excludeUserId) => {
  const query = { email }
  if (excludeUserId) query._id = { $ne: excludeUserId }
  const exists = await User.exists(query)
  return !exists
}

export const confirmUsernameAvailable = async (tenantId, username, excludeUserId) => {
  const query = { tenantId, username }
  if (excludeUserId) query._id = { $ne: excludeUserId }
  const exists = await User.exists(query)
  return !exists
}

export const updateById = (id, update) =>
  User.findByIdAndUpdate(id, update, { new: true })
