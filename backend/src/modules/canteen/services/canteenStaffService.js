import bcrypt from 'bcryptjs'
import { error } from '../../../utils/errors.js'
import * as repo from '../repositories/canteenStaffRepository.js'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeName = (name) => String(name || '').trim()
const normalizeUsername = (username) => {
  const s = String(username || '').trim().toLowerCase()
  return s ? s : null
}
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/

export const listStaff = async (tenantId, options = {}) => {
  const items = await repo.listCanteenStaff(tenantId, options)
  return items.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username || null,
    isActive: !!u.isActive,
    permissions: u.permissions || [],
    branchId: u.branchId ? String(u.branchId) : null,
    branchIds: Array.isArray(u.branchIds) ? u.branchIds.map(String) : []
  }))
}

export const createStaff = async (tenantId, actorUserId, input) => {
  const name = normalizeName(input?.name)
  const email = normalizeEmail(input?.email)
  const username = normalizeUsername(input?.username)
  const password = String(input?.password || '')
  const permissions = Array.isArray(input?.permissions) ? input.permissions.filter(Boolean) : []
  const branchIds = Array.isArray(input?.branchIds) ? input.branchIds.map(String).filter(Boolean) : []
  if (!name) throw error('name_required', 'İsim zorunludur', 400)
  if (!email) throw error('email_required', 'Email zorunludur', 400)
  if (username && !USERNAME_RE.test(username)) throw error('invalid_username', 'Geçersiz kullanıcı adı', 400)
  if (!password || password.length < 4) throw error('password_required', 'Şifre zorunludur', 400)
  const passwordHash = await bcrypt.hash(password, 10)
  const created = await repo.createCanteenStaff({
    tenantId,
    branchId: branchIds.length === 1 ? branchIds[0] : null,
    branchIds,
    systemType: 'kantin',
    name,
    email,
    username: username || undefined,
    passwordHash,
    role: 'staff',
    isActive: true,
    permissions,
    createdAt: new Date(),
    actorUserId
  })
  return { id: created.id, name: created.name, email: created.email, username: created.username || null, isActive: !!created.isActive, permissions: created.permissions || [] }
}

export const updateStaff = async (tenantId, actorUserId, staffId, input) => {
  const update = {}
  if (input?.name !== undefined) {
    const name = normalizeName(input?.name)
    if (!name) throw error('name_required', 'İsim zorunludur', 400)
    update.name = name
  }
  if (input?.email !== undefined) {
    const email = normalizeEmail(input?.email)
    if (!email) throw error('email_required', 'Email zorunludur', 400)
    update.email = email
  }
  if (input?.username !== undefined) {
    const username = normalizeUsername(input?.username)
    if (username && !USERNAME_RE.test(username)) throw error('invalid_username', 'Geçersiz kullanıcı adı', 400)
    update.username = username || undefined
  }
  if (input?.password !== undefined) {
    const password = String(input?.password || '')
    if (!password || password.length < 4) throw error('password_required', 'Şifre zorunludur', 400)
    update.passwordHash = await bcrypt.hash(password, 10)
  }
  if (input?.permissions !== undefined) {
    update.permissions = Array.isArray(input?.permissions) ? input.permissions.filter(Boolean) : []
  }
  if (input?.branchIds !== undefined) {
    const nextBranchIds = Array.isArray(input?.branchIds) ? input.branchIds.map(String).filter(Boolean) : []
    update.branchIds = nextBranchIds
    update.branchId = nextBranchIds.length === 1 ? nextBranchIds[0] : null
  }
  if (input?.isActive !== undefined) {
    update.isActive = !!input.isActive
  }
  const updated = await repo.updateCanteenStaffById(tenantId, staffId, { ...update, actorUserId })
  if (!updated) throw error('not_found', 'Personel bulunamadı', 404)
  return { id: updated.id, name: updated.name, email: updated.email, username: updated.username || null, isActive: !!updated.isActive, permissions: updated.permissions || [] }
}

export const removeStaff = async (tenantId, actorUserId, staffId) => {
  const updated = await repo.disableCanteenStaffById(tenantId, staffId)
  if (!updated) throw error('not_found', 'Personel bulunamadı', 404)
  return { success: true, id: updated.id, actorUserId }
}
