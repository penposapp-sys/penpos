import { findTenantById } from '../repositories/tenantRepository.js'
import { findAllByTenant as listActiveBranchesByTenant } from '../repositories/branchRepository.js'
import { parseBranchIds, requireValidObjectIds, intersectAllowed } from '../utils/branchIds.js'
import { getUserAccessibleBranchIds } from '../utils/branchVisibility.js'

export const branchListGuard = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('[BRANCH_LIST_GUARD_HIT]', req.method, req.originalUrl)
      } catch {}
    }
    try {
      res.setHeader('x-branch-guard', 'branchListGuard_v3')
    } catch {}
    const role = req.user?.role
    const tenantId = req.user?.tenantId
    const requested = parseBranchIds(req.query?.branchId, req.query?.branchIds)
    const bad = requireValidObjectIds(requested)
    if (bad.length > 0) {
      return res.status(400).json({ status: 400, code: 'invalid_request', message: 'Invalid branch id' })
    }
    let tenantAllowed = []
    try {
      const t = await findTenantById(tenantId)
      tenantAllowed = Array.isArray(t?.allowedBranchIds) ? t.allowedBranchIds.map(String) : []
    } catch {}
    let staffAllowed = null
    if (role === 'staff') {
      const explicitStaffAllowed = getUserAccessibleBranchIds(req.user)
      staffAllowed = explicitStaffAllowed.length > 0 ? explicitStaffAllowed.map(String) : null
    }
    const effectiveAllowed = staffAllowed
      ? tenantAllowed.filter(id => staffAllowed.includes(String(id)))
      : tenantAllowed

    const { finalIds } = intersectAllowed(requested, effectiveAllowed)
    let activeIds = []
    try {
      const activeBranches = await listActiveBranchesByTenant(tenantId)
      activeIds = (activeBranches || []).map(b => String(b._id))
    } catch {}

    const validIds = finalIds.filter(id => activeIds.includes(String(id)))

    if (requested.length > 0 && validIds.length === 0) {
      return res.status(403).json({ status: 403, code: 'branch_not_allowed', message: 'Bu şubeye erişim yetkin yok' })
    }
    if (validIds.length === 0) {
      return res.status(403).json({
        status: 403,
        code: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }
    req.branchIds = validIds.map(String)
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('[BRANCH_LIST_GUARD]', {
          route: req.originalUrl,
          role: req.user?.role || null,
          branchIds: req.branchIds
        })
      } catch {}
    }
    next()
  } catch (err) {
    next(err)
  }
}
