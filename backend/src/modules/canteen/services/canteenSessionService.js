import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import { signToken } from '../../../utils/jwt.js'
import { findTenantSettings, upsertTenantSettings } from '../repositories/canteenSettingsRepository.js'
import { findAnyByIdAndTenant, findByIdAndTenant, listByTenant } from '../repositories/canteenBranchRepository.js'

const normalizeId = (v) => {
  const s = String(v || '').trim()
  return s || null
}

const resolveBranchPolicy = async (tenantId) => {
  const st = await findTenantSettings(tenantId)
  const activeBranches = await listByTenant(tenantId)
  const activeIds = new Set((activeBranches || []).map(b => String(b.id || b._id)))

  const storedAllowed = Array.isArray(st?.canteenAllowedBranchIds)
    ? st.canteenAllowedBranchIds.map(String).filter(Boolean)
    : []
  const allowedBranchIds = storedAllowed.length > 0
    ? storedAllowed.filter(id => activeIds.has(String(id)))
    : []

  const storedDefault = st?.canteenDefaultBranchId
    ? String(st.canteenDefaultBranchId)
    : (st?.defaultBranchId ? String(st.defaultBranchId) : null)

  const defaultBranchId = storedDefault && allowedBranchIds.includes(storedDefault)
    ? storedDefault
    : null

  return { allowedBranchIds, defaultBranchId }
}

export const resolveActiveBranch = async (user) => {
  const tenantId = user?.tenantId
  if (!tenantId) throw error('tenant_required', 'Tenant required', 403)

  const policy = await resolveBranchPolicy(tenantId)

  const tokenBranchId = normalizeId(user?.branchId)
  if (tokenBranchId && mongoose.isValidObjectId(tokenBranchId)) {
    const allowedEmpty = !Array.isArray(policy.allowedBranchIds) || policy.allowedBranchIds.length === 0
    if (allowedEmpty || policy.allowedBranchIds.includes(String(tokenBranchId))) {
      const b = await findByIdAndTenant(tokenBranchId, tenantId)
      if (b) return { id: String(b.id), name: b.name }
    }
  }

  if (user?.role === 'staff') {
    const allowed = Array.isArray(user?.branchIds) ? user.branchIds.map(String).filter(Boolean) : []
    const candidates = allowed.filter(id => policy.allowedBranchIds.includes(String(id)))
    if (candidates.length >= 1 && mongoose.isValidObjectId(candidates[0])) {
      const b = await findByIdAndTenant(candidates[0], tenantId)
      if (b) return { id: String(b.id), name: b.name }
    }
    return null
  }

  if (user?.role === 'tenant_admin') {
    if (Array.isArray(policy.allowedBranchIds) && policy.allowedBranchIds.length === 1) {
      const only = policy.allowedBranchIds[0]
      if (mongoose.isValidObjectId(only)) {
        const b = await findByIdAndTenant(only, tenantId)
        if (b) return { id: String(b.id), name: b.name }
      }
    }
    return null
  }
  return null
}

export const getSession = async (user) => {
  const policy = await resolveBranchPolicy(user?.tenantId)
  const staffAllowed = user?.role === 'staff'
    ? (Array.isArray(user?.branchIds) ? user.branchIds.map(String).filter(Boolean) : [])
    : null
  let allowedBranchIds = staffAllowed
    ? policy.allowedBranchIds.filter(id => staffAllowed.includes(String(id)))
    : policy.allowedBranchIds

  const tokenBranchId = normalizeId(user?.branchId)
  const activeBranch = await resolveActiveBranch(user)
  const activeBranchId = normalizeId(activeBranch?.id) || (tokenBranchId && mongoose.isValidObjectId(tokenBranchId) ? tokenBranchId : null)

  if (activeBranchId && mongoose.isValidObjectId(activeBranchId)) {
    const ensured = await findByIdAndTenant(activeBranchId, user?.tenantId)
    if (ensured) {
      if (!Array.isArray(allowedBranchIds) || allowedBranchIds.length === 0) {
        allowedBranchIds = [String(activeBranchId)]
      } else if (!allowedBranchIds.includes(String(activeBranchId))) {
        allowedBranchIds = Array.from(new Set([...allowedBranchIds, String(activeBranchId)]))
      }

      if (!Array.isArray(policy.allowedBranchIds) || policy.allowedBranchIds.length === 0 || !policy.allowedBranchIds.includes(String(activeBranchId))) {
        try {
          await upsertTenantSettings(user?.tenantId, {
            canteenAllowedBranchIds: Array.from(new Set([...(policy.allowedBranchIds || []), String(activeBranchId)])),
            canteenDefaultBranchId: String(activeBranchId),
            defaultBranchId: String(activeBranchId)
          })
        } catch {
        }
      }
    }
  }

  const branches = allowedBranchIds.length > 0 ? await listByTenant(user?.tenantId) : []
  const allowedBranches = (branches || [])
    .filter(b => allowedBranchIds.includes(String(b.id || b._id)))
    .map(b => ({ id: String(b.id || b._id), name: b.name, isActive: b.isActive !== false }))
  return {
    activeBranch,
    branchId: activeBranch?.id || null,
    allowedBranchIds: allowedBranchIds || [],
    allowedBranches,
    defaultBranchId: policy.defaultBranchId || null
  }
}

export const setActiveBranch = async (user, input) => {
  const tenantId = user?.tenantId
  if (!tenantId) throw error('tenant_required', 'Tenant required', 403)

  const policy = await resolveBranchPolicy(tenantId)
  const branchId = normalizeId(input?.branchId)
  if (!branchId || !mongoose.isValidObjectId(branchId)) throw error('invalid_request', 'Invalid branch id', 400)

  if (user?.role === 'staff') {
    const staffAllowed = Array.isArray(user?.branchIds) ? user.branchIds.map(String).filter(Boolean) : []
    if (staffAllowed.length > 0 && !staffAllowed.includes(String(branchId))) {
      throw error('branch_not_allowed', 'Branch not allowed', 403)
    }
  }

  if (!policy.allowedBranchIds.includes(String(branchId))) {
    throw error('branch_not_allowed', 'Branch not allowed', 403)
  }

  const branch = await findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) throw error('branch_not_found', 'Branch not found', 404)
  if (branch.isActive === false) throw error('branch_inactive', 'Branch inactive', 400)

  const nextToken = signToken({
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    permissions: user.permissions || [],
    systemType: 'kantin',
    branchId: String(branchId),
    branchIds: user.role === 'staff' ? (Array.isArray(user.branchIds) ? user.branchIds.map(String) : []) : undefined,
    allowedBranchIds: Array.isArray(policy.allowedBranchIds) && policy.allowedBranchIds.length <= 20 ? policy.allowedBranchIds : undefined
  })

  if (user?.role === 'tenant_admin') {
    await upsertTenantSettings(tenantId, { defaultBranchId: String(branchId), canteenDefaultBranchId: String(branchId) })
  }

  return { token: nextToken, activeBranch: { id: String(branch.id), name: branch.name } }
}
