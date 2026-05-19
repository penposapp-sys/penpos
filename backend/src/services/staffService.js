import bcrypt from 'bcryptjs'
import { error } from '../utils/errors.js'
import { findAllByTenant, createStaff, findByIdAndTenant, confirmEmailAvailable, confirmUsernameAvailable, updateById } from '../repositories/staffRepository.js'
import { findByIdAndTenant as findBranchByIdAndTenant } from '../repositories/branchRepository.js'
import User from '../models/User.js'
import { getTenantPlan, ensureNotExpired } from './planService.js'
import { PERMISSION_ALIASES, PERMISSIONS } from '../constants/permissions.js'
import { buildSoftDeleteUpdate } from '../utils/softDelete.js'
import { getUserAccessibleBranchIds, normalizeObjectIdArray } from '../utils/branchVisibility.js'

const canonicalizePermissions = (perms) => {
  const list = Array.isArray(perms) ? perms : []
  const set = new Set()
  const canonicalValues = new Set(Object.values(PERMISSIONS))
  for (const p of list) {
    if (!p) continue
    if (canonicalValues.has(p)) {
      set.add(p)
      continue
    }
    const mapped = PERMISSION_ALIASES[p]
    if (Array.isArray(mapped)) set.add(mapped[0] || p)
    else set.add(mapped || p)
  }
  return Array.from(set)
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeUsername = (username) => {
  const s = String(username || '').trim().toLowerCase()
  return s ? s : null
}
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/

const normalizeAccessibleBranchIds = async (tenantId, dto, currentStaff = null) => {
  const explicit = dto?.accessibleBranchIds !== undefined
    ? dto.accessibleBranchIds
    : (dto?.branchIds !== undefined ? dto.branchIds : undefined)

  const fallbackCurrent = currentStaff
    ? getUserAccessibleBranchIds(currentStaff)
    : []

  const normalized = explicit !== undefined
    ? normalizeObjectIdArray(explicit)
    : (dto?.branchId ? normalizeObjectIdArray([dto.branchId]) : fallbackCurrent)

  if (normalized.length === 0) return []

  const validBranchIds = []
  for (const branchId of normalized) {
    const branch = await findBranchByIdAndTenant(branchId, tenantId)
    if (!branch || !branch.isActive) throw error('not_found', 'Branch not found', 404)
    validBranchIds.push(String(branch.id))
  }
  return Array.from(new Set(validBranchIds))
}

const toStaffDto = (staff) => {
  const accessibleBranchIds = getUserAccessibleBranchIds(staff)
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    username: staff.username || null,
    isActive: staff.isActive,
    active: staff.active !== false,
    isDeleted: staff.isDeleted === true,
    status: staff.status || 'active',
    permissions: staff.permissions || [],
    systemType: staff.systemType,
    branchId: staff.branchId || null,
    branchIds: Array.isArray(staff.branchIds) ? staff.branchIds.map(String) : accessibleBranchIds,
    accessibleBranchIds
  }
}

export const listStaff = async (tenantId) => {
  const staff = await findAllByTenant(tenantId)
  return staff.map(toStaffDto)
}

export const createStaffService = async (tenantId, dto) => {
  await ensureNotExpired(tenantId, dto.actorUserId || null)
  const plan = await getTenantPlan(tenantId)
  if (plan && plan.limits && typeof plan.limits.staff === 'number' && plan.limits.staff !== -1) {
    const count = await User.countDocuments({ tenantId, role: 'staff', isActive: true, isDeleted: { $ne: true }, status: { $ne: 'deleted' } })
    if (count >= plan.limits.staff) {
      await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'plan_limit_asildi', 'Tenant', tenantId, { type: 'staff', limit: plan.limits.staff })
      throw error('plan_limit_exceeded', 'Personel limiti aşıldı', 403)
    }
  }
  const email = normalizeEmail(dto.email)
  const ok = await confirmEmailAvailable(tenantId, email, null, dto.systemType)
  if (!ok) throw error('duplicate_email', 'Bu e-posta zaten kayıtlı', 409)

  const username = normalizeUsername(dto.username)
  if (username && !USERNAME_RE.test(username)) throw error('invalid_username', 'Geçersiz kullanıcı adı', 400)
  if (username) {
    const okU = await confirmUsernameAvailable(tenantId, username)
    if (!okU) throw error('duplicate_username', 'Bu kullanıcı adı zaten kayıtlı', 409)
  }

  const passwordHash = await bcrypt.hash(dto.password, 10)
  const accessibleBranchIds = await normalizeAccessibleBranchIds(tenantId, dto)
  const branchId = accessibleBranchIds.length === 1 ? accessibleBranchIds[0] : null
  const staff = await createStaff({
    tenantId,
    branchId,
    branchIds: accessibleBranchIds,
    accessibleBranchIds,
    name: dto.name,
    email,
    username: username || undefined,
    passwordHash,
    permissions: canonicalizePermissions(dto.permissions),
    systemType: dto.systemType
  })
  await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'staff_create', 'User', staff.id, { email: staff.email, systemType: staff.systemType })
  return toStaffDto(staff)
}

export const updateStaff = async (tenantId, staffId, dto) => {
  const staff = await findByIdAndTenant(staffId, tenantId)
  if (!staff) throw error('not_found', 'Staff not found', 404)
  if (dto.email) {
    const email = normalizeEmail(dto.email)
    const ok = await confirmEmailAvailable(tenantId, email, staff.id, dto.systemType ?? staff.systemType)
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

  const accessibleBranchIds = await normalizeAccessibleBranchIds(tenantId, dto, staff)
  const branchId = accessibleBranchIds.length === 1 ? accessibleBranchIds[0] : null
  const updated = await updateById(staffId, {
    name: dto.name ?? staff.name,
    email: dto.email ?? staff.email,
    username: dto.username ?? staff.username,
    branchId,
    branchIds: accessibleBranchIds,
    accessibleBranchIds,
    active: dto.isActive ?? dto.active ?? staff.active ?? staff.isActive,
    isActive: dto.isActive ?? staff.isActive,
    isDeleted: staff.isDeleted === true ? true : false,
    deletedAt: staff.isDeleted === true ? (staff.deletedAt || new Date()) : null,
    status: staff.isDeleted === true ? 'deleted' : ((dto.isActive ?? staff.isActive) ? 'active' : 'inactive'),
    permissions: Array.isArray(dto.permissions) ? canonicalizePermissions(dto.permissions) : staff.permissions,
    systemType: dto.systemType ?? staff.systemType
  })
  await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'staff_update', 'User', updated.id, {})
  const oldPerms = Array.isArray(staff.permissions) ? staff.permissions : []
  const newPerms = Array.isArray(updated.permissions) ? updated.permissions : []
  const changed = oldPerms.length !== newPerms.length || oldPerms.some((perm) => !newPerms.includes(perm)) || newPerms.some((perm) => !oldPerms.includes(perm))
  if (changed) {
    await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'permission_guncelleme', 'User', updated.id, { from: oldPerms, to: newPerms })
  }
  return toStaffDto(updated)
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
  const updated = await updateById(staffId, buildSoftDeleteUpdate())
  await (await import('./auditService.js')).log(tenantId, actorUserId || staffId, 'staff_delete_soft', 'User', updated.id, {})
  return { id: updated.id, isActive: updated.isActive, active: updated.active !== false, isDeleted: updated.isDeleted === true, status: updated.status || 'deleted' }
}
