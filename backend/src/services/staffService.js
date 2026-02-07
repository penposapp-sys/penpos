import bcrypt from 'bcryptjs'
import { error } from '../utils/errors.js'
import { findAllByTenant, createStaff, findByIdAndTenant, confirmEmailAvailable, confirmUsernameAvailable, updateById } from '../repositories/staffRepository.js'
import { findByIdAndTenant as findBranchByIdAndTenant } from '../repositories/branchRepository.js'
import User from '../models/User.js'
import { getTenantPlan, ensureNotExpired } from './planService.js'
import { PERMISSION_ALIASES } from '../constants/permissions.js'

const canonicalizePermissions = (perms) => {
  const list = Array.isArray(perms) ? perms : []
  const set = new Set()
  for (const p of list) {
    if (!p) continue
    set.add(PERMISSION_ALIASES[p] || p)
  }
  return Array.from(set)
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeUsername = (username) => {
  const s = String(username || '').trim().toLowerCase()
  return s ? s : null
}
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/

export const listStaff = async (tenantId) => {
  const staff = await findAllByTenant(tenantId)
  return staff.map(s => ({ id: s.id, name: s.name, email: s.email, username: s.username || null, isActive: s.isActive, permissions: s.permissions || [], systemType: s.systemType, branchId: s.branchId || null, branchIds: Array.isArray(s.branchIds) ? s.branchIds.map(String) : [] }))
}

export const createStaffService = async (tenantId, dto) => {
  await ensureNotExpired(tenantId, dto.actorUserId || null)
  const plan = await getTenantPlan(tenantId)
  if (plan && plan.limits && typeof plan.limits.staff === 'number' && plan.limits.staff !== -1) {
    const count = await User.countDocuments({ tenantId, role: 'staff', isActive: true })
    if (count >= plan.limits.staff) {
      await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'plan_limit_asildi', 'Tenant', tenantId, { type: 'staff', limit: plan.limits.staff })
      throw error('plan_limit_exceeded', 'Personel limiti aşıldı', 403)
    }
  }
  const email = normalizeEmail(dto.email)
  const ok = await confirmEmailAvailable(tenantId, email)
  if (!ok) throw error('duplicate_email', 'Bu e-posta zaten kayıtlı', 409)

  const username = normalizeUsername(dto.username)
  if (username && !USERNAME_RE.test(username)) throw error('invalid_username', 'Geçersiz kullanıcı adı', 400)
  if (username) {
    const okU = await confirmUsernameAvailable(tenantId, username)
    if (!okU) throw error('duplicate_username', 'Bu kullanıcı adı zaten kayıtlı', 409)
  }

  const passwordHash = await bcrypt.hash(dto.password, 10)
  let branchId = null
  if (dto.branchId) {
    const b = await findBranchByIdAndTenant(dto.branchId, tenantId)
    if (!b || !b.isActive) throw error('not_found', 'Branch not found', 404)
    branchId = b.id
  }
  const s = await createStaff({
    tenantId,
    branchId,
    branchIds: branchId ? [branchId] : [],
    name: dto.name,
    email,
    username: username || undefined,
    passwordHash,
    permissions: canonicalizePermissions(dto.permissions),
    systemType: dto.systemType
  })
  await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'staff_create', 'User', s.id, { email: s.email, systemType: s.systemType })
  return { id: s.id, name: s.name, email: s.email, username: s.username || null, isActive: s.isActive, permissions: s.permissions || [], systemType: s.systemType, branchId: s.branchId || null }
}

export const updateStaff = async (tenantId, staffId, dto) => {
  const staff = await findByIdAndTenant(staffId, tenantId)
  if (!staff) throw error('not_found', 'Staff not found', 404)
  if (dto.email) {
    const email = normalizeEmail(dto.email)
    const ok = await confirmEmailAvailable(tenantId, email, staff.id)
    if (!ok) throw error('duplicate_email', 'Bu e-posta zaten kayıtlı', 409)
    dto.email = email
  }
  if (dto.username !== undefined) {
    const username = normalizeUsername(dto.username)
    if (username && !USERNAME_RE.test(username)) throw error('invalid_username', 'Geçersiz kullanıcı adı', 400)
    if (username) {
      const okU = await confirmUsernameAvailable(tenantId, username, staff.id)
      if (!okU) throw error('duplicate_username', 'Bu kullanıcı adı zaten kayıtlı', 409)
    }
    dto.username = username
  }
  const updated = await updateById(staffId, {
    name: dto.name ?? staff.name,
    email: dto.email ?? staff.email,
    username: dto.username ?? staff.username,
    isActive: dto.isActive ?? staff.isActive,
    permissions: Array.isArray(dto.permissions) ? canonicalizePermissions(dto.permissions) : staff.permissions,
    systemType: dto.systemType ?? staff.systemType
  })
  await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'staff_update', 'User', updated.id, {})
  const oldPerms = Array.isArray(staff.permissions) ? staff.permissions : []
  const newPerms = Array.isArray(updated.permissions) ? updated.permissions : []
  const changed = oldPerms.length !== newPerms.length || oldPerms.some(p => !newPerms.includes(p)) || newPerms.some(p => !oldPerms.includes(p))
  if (changed) {
    await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'permission_guncelleme', 'User', updated.id, { from: oldPerms, to: newPerms })
  }
  return { id: updated.id, name: updated.name, email: updated.email, username: updated.username || null, isActive: updated.isActive, permissions: updated.permissions || [], systemType: updated.systemType, branchId: updated.branchId || null }
}

export const resetStaffPassword = async (tenantId, staffId, password) => {
  const staff = await findByIdAndTenant(staffId, tenantId)
  if (!staff) throw error('not_found', 'Staff not found', 404)
  const passwordHash = await bcrypt.hash(password, 10)
  await updateById(staffId, { passwordHash })
  await (await import('./auditService.js')).log(tenantId, staffId, 'staff_password_reset', 'User', staffId, {})
  return { ok: true }
}

export const deleteOrDisableStaff = async (tenantId, staffId, actorUserId) => {
  const staff = await findByIdAndTenant(staffId, tenantId)
  if (!staff) throw error('not_found', 'Staff not found', 404)
  if (String(staffId) === String(actorUserId)) throw error('cannot_delete_self', 'Cannot delete self', 400)
  const updated = await updateById(staffId, { isActive: false })
  await (await import('./auditService.js')).log(tenantId, actorUserId || staffId, 'staff_deactivate', 'User', updated.id, {})
  return { id: updated.id, isActive: updated.isActive }
}
