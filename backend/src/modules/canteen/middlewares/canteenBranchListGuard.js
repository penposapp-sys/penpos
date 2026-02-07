import { error } from '../../../utils/errors.js'
import { parseBranchIds, intersectAllowed, requireValidObjectIds } from '../../../utils/branchIds.js'
import { findTenantSettings } from '../repositories/canteenSettingsRepository.js'
import { listByTenant } from '../repositories/canteenBranchRepository.js'

export const canteenBranchListGuard = async (req, res, next) => {
  try {
    res.setHeader('x-branch-guard', 'canteenBranchListGuard_v1')
  } catch {
  }

  const tenantId = req.user?.tenantId
  if (!tenantId) return next(error('tenant_required', 'Tenant required', 403))

  const requestedIds = parseBranchIds(req.query?.branchId, req.query?.branchIds)
  const bad = requireValidObjectIds(requestedIds)
  if (bad.length > 0) return next(error('invalid_request', 'Invalid branch id', 400))

  const activeBranches = await listByTenant(tenantId)
  const activeIds = new Set((activeBranches || []).map(b => String(b.id || b._id)))
  const activeAll = Array.from(activeIds)

  const fromToken = Array.isArray(req.user?.allowedBranchIds)
    ? req.user.allowedBranchIds.map(String).filter(Boolean)
    : []
  const fromUser = Array.isArray(req.user?.branchIds)
    ? req.user.branchIds.map(String).filter(Boolean)
    : []

  let allowedIds = fromToken.length > 0 ? fromToken : fromUser
  if (req.user?.role === 'tenant_admin' && allowedIds.length === 0) {
    const st = await findTenantSettings(tenantId)
    const tenantAllowed = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
    allowedIds = tenantAllowed.length > 0 ? tenantAllowed : activeAll
  }

  allowedIds = allowedIds.filter(id => activeIds.has(String(id)))

  const { requested, finalIds } = intersectAllowed(requestedIds, allowedIds)
  const uniq = Array.from(new Set(finalIds.map(String))).filter(Boolean)
  if (requested.length > 0 && uniq.length === 0) return next(error('branch_not_allowed', 'Branch not allowed', 403))
  if (uniq.length === 0) return next(error('no_allowed_branches', 'No allowed branches', 403))

  req.canteenBranchIds = uniq
  req.branchIds = uniq
  next()
}
