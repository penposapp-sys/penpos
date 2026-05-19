import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { error } from '../utils/errors.js'
import { log as auditLog } from './auditService.js'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeUsername = (username) => String(username || '').trim().toLowerCase()
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/

const toUserDto = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  username: u.username || null,
  role: u.role
})

export const getMe = async (userId) => {
  const user = await User.findById(userId).select({ name: 1, email: 1, username: 1, role: 1 }).lean()
  if (!user) throw error('unauthorized', 'Unauthorized', 401)
  return toUserDto(user)
}

const requireCurrentPasswordOk = async (user, currentPassword) => {
  const pw = String(currentPassword || '')
  if (!pw) throw error('current_password_required', 'Mevcut şifre zorunlu', 400)
  const hash = user.passwordHash || user.password
  if (!hash) throw error('invalid_credentials', 'Invalid credentials', 401)
  const ok = await bcrypt.compare(pw, hash)
  if (!ok) throw error('invalid_credentials', 'Invalid credentials', 401)
}

export const updateEmail = async (userId, email, currentPassword) => {
  const user = await User.findById(userId)
  if (!user) throw error('unauthorized', 'Unauthorized', 401)
  await requireCurrentPasswordOk(user, currentPassword)

  const normalized = normalizeEmail(email)
  if (!normalized) throw error('email_required', 'Email zorunludur', 400)

  const exists = await User.exists({
    email: normalized,
    systemType: user.systemType || null,
    _id: { $ne: user._id }
  })
  if (exists) throw error('duplicate_email', 'Bu e-posta zaten kayıtlı', 409)

  user.email = normalized
  await user.save()
  await auditLog(user.tenantId || null, user.id, 'me_email_update', 'User', user.id, { email: normalized }).catch(() => {})
  return toUserDto(user)
}

export const updatePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId)
  if (!user) throw error('unauthorized', 'Unauthorized', 401)
  await requireCurrentPasswordOk(user, currentPassword)

  const next = String(newPassword || '')
  if (!next || next.length < 8) throw error('password_policy', 'Şifre en az 8 karakter olmalıdır', 400)

  user.passwordHash = await bcrypt.hash(next, 10)
  await user.save()
  await auditLog(user.tenantId || null, user.id, 'me_password_update', 'User', user.id, {}).catch(() => {})
  return { success: true }
}

export const updateUsername = async (userId, username, currentPassword) => {
  const user = await User.findById(userId)
  if (!user) throw error('unauthorized', 'Unauthorized', 401)
  await requireCurrentPasswordOk(user, currentPassword)

  const normalized = normalizeUsername(username)
  if (!normalized) throw error('username_required', 'Kullanıcı adı zorunludur', 400)
  if (!USERNAME_RE.test(normalized)) throw error('invalid_username', 'Geçersiz kullanıcı adı', 400)

  const scopeTenantId = user.tenantId || null
  const exists = await User.exists({ tenantId: scopeTenantId, username: normalized, _id: { $ne: user._id } })
  if (exists) throw error('duplicate_username', 'Bu kullanıcı adı zaten kayıtlı', 409)

  user.username = normalized
  await user.save()
  await auditLog(user.tenantId || null, user.id, 'me_username_update', 'User', user.id, { username: normalized }).catch(() => {})
  return toUserDto(user)
}
