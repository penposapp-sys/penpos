import User from '../../../models/User.js'

export const listCanteenStaff = (tenantId, options = {}) => {
  const includeInactive = !!options.includeInactive
  const filter = includeInactive
    ? { tenantId, role: 'staff', systemType: 'kantin' }
    : { tenantId, role: 'staff', systemType: 'kantin', isActive: true }
  return User.find(filter).sort({ createdAt: -1 })
}

export const findCanteenStaffById = (tenantId, staffId) =>
  User.findOne({ _id: staffId, tenantId, role: 'staff', systemType: 'kantin' })

export const createCanteenStaff = (data) => User.create(data)

export const updateCanteenStaffById = (tenantId, staffId, update) =>
  User.findOneAndUpdate({ _id: staffId, tenantId, role: 'staff', systemType: 'kantin' }, update, { new: true })

export const disableCanteenStaffById = (tenantId, staffId) =>
  User.findOneAndUpdate({ _id: staffId, tenantId, role: 'staff', systemType: 'kantin' }, { isActive: false }, { new: true })
