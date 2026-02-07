import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import { findTenantSettings } from '../repositories/canteenSettingsRepository.js'
import { findAnyByIdAndTenant } from '../repositories/canteenBranchRepository.js'

export const canteenBranchGuard = async (req, res, next) => {
  const headerBranchId = req.headers['x-branch-id']
  const tokenBranchId = req.user?.branchId
  const branchId = String(headerBranchId || tokenBranchId || '').trim()
  if (!branchId) return next(error('missing_branch', 'Branch required', 403))
  if (!mongoose.isValidObjectId(branchId)) return next(error('missing_branch', 'Branch required', 403))
  const tenantId = req.user?.tenantId

  try {
    const st = await findTenantSettings(tenantId)
    const allowed = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
    if (allowed.length === 0) return next(error('branch_not_configured', 'Branches not configured', 403))
    if (!allowed.includes(String(branchId))) return next(error('branch_not_allowed', 'Branch not allowed', 403))
  } catch {
  }

  if (req.user?.role === 'staff') {
    const allowed = Array.isArray(req.user?.branchIds) ? req.user.branchIds.map(String) : []
    if (allowed.length > 0 && !allowed.includes(String(branchId))) {
      return next(error('forbidden_invalid_branch', 'Invalid branch', 403))
    }
  }

  const branch = await findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) return next(error('branch_not_found', 'Branch not found', 403))
  if (branch.isActive === false) return next(error('branch_inactive', 'Branch inactive', 403))
  req.canteenBranchId = branchId
  req.canteenBranch = { id: branch.id, name: branch.name }
  next()
}
