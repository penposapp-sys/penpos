import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import { findTenantSettings } from '../repositories/canteenSettingsRepository.js'
import { findAnyByIdAndTenant, listByTenant } from '../repositories/canteenBranchRepository.js'

export const canteenBranchHeaderGuard = async (req, res, next) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) return next(error('tenant_required', 'Tenant required', 403))

  const branchId = String(req.headers?.['x-branch-id'] || '').trim()
  if (!branchId) return next(error('missing_branch', 'Branch required', 400))
  if (!mongoose.isValidObjectId(branchId)) return next(error('invalid_request', 'Invalid branch id', 400))

  const fromToken = Array.isArray(req.user?.allowedBranchIds)
    ? req.user.allowedBranchIds.map(String).filter(Boolean)
    : []
  const fromUser = req.user?.role === 'staff' && Array.isArray(req.user?.branchIds)
    ? req.user.branchIds.map(String).filter(Boolean)
    : []

  let allowedIds = fromToken.length > 0 ? fromToken : fromUser
  if (req.user?.role === 'tenant_admin' && allowedIds.length === 0) {
    const st = await findTenantSettings(tenantId)
    allowedIds = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
    if (allowedIds.length === 0) {
      const active = await listByTenant(tenantId)
      allowedIds = (active || []).map(b => String(b.id || b._id)).filter(Boolean)
    }
  }

  if (allowedIds.length > 0 && !allowedIds.includes(String(branchId))) {
    return next(error('branch_not_allowed', 'Branch not allowed', 403))
  }

  const branch = await findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) return next(error('branch_not_found', 'Branch not found', 404))
  if (branch.isActive === false) return next(error('branch_inactive', 'Branch inactive', 403))

  req.branchId = String(branchId)
  req.canteenBranchId = String(branchId)
  req.canteenBranch = { id: String(branch.id), name: branch.name }
  next()
}
