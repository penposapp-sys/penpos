import User from '../models/User.js'

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const findByEmail = (email) => {
  const normalized = String(email || '').trim()
  if (!normalized) return Promise.resolve(null)
  return User.findOne({ email: new RegExp(`^${escapeRegex(normalized)}$`, 'i') })
}

export const findByUsername = (username, extraFilter = {}) => {
  const normalized = String(username || '').trim()
  if (!normalized) return Promise.resolve(null)
  return User.findOne({ ...extraFilter, username: new RegExp(`^${escapeRegex(normalized)}$`, 'i') })
}
export const findById = (id) => User.findById(id)
export const createUser = (data) => User.create(data)
export const hasAnySuperadmin = () => User.exists({ role: 'superadmin' })
