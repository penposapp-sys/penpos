import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import { findTenantSettings } from '../repositories/canteenSettingsRepository.js'
import { findAnyByIdAndTenant } from '../repositories/canteenBranchRepository.js'

export const canteenBranchParamGuard = async (req, res, next) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) return next(error('tenant_required', 'Tenant required', 403))

  const raw = req.body?.branchId ?? req.query?.branchId ?? req.headers['x-branch-id']
  const branchId = String(raw || '').trim()
  if (!branchId) return next(error('missing_branch', 'Branch required', 403))
  if (!mongoose.isValidObjectId(branchId)) return next(error('invalid_request', 'Invalid branch id', 400))

  const st = await findTenantSettings(tenantId)
  const tenantAllowed = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
  if (tenantAllowed.length === 0) return next(error('no_allowed_branches', 'No allowed branches', 403))
  if (!tenantAllowed.includes(String(branchId))) return next(error('branch_not_allowed', 'Branch not allowed', 403))

  if (req.user?.role === 'staff') {
    const staffAllowed = Array.isArray(req.user?.branchIds) ? req.user.branchIds.map(String).filter(Boolean) : []
    if (staffAllowed.length > 0 && !staffAllowed.includes(String(branchId))) {
      return next(error('branch_not_allowed', 'Branch not allowed', 403))
    }
  }

  const branch = await findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) return next(error('branch_not_found', 'Branch not found', 404))
  if (branch.isActive === false) return next(error('branch_inactive', 'Branch inactive', 403))

  req.canteenBranchId = String(branchId)
  req.canteenBranch = { id: String(branch.id), name: branch.name }
  next()
}

