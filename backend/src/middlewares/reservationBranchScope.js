import { error } from '../utils/errors.js'
import { getUserAccessibleBranchIds } from '../utils/branchVisibility.js'
import { parseBranchIds } from '../utils/branchIds.js'

export const reservationBranchScope = (req, _res, next) => {
  if (String(req.user?.role || '') !== 'staff') return next()

  const activeBranchId = String(req.user?.branchId || '').trim()
  const accessibleBranchIds = getUserAccessibleBranchIds(req.user)
  const scopedBranchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String) : []
  const requestedBranchIds = parseBranchIds(req.query?.branchId, req.query?.branchIds)
  const headerBranchId = String(req.headers?.['x-branch-id'] || '').trim()

  if (!activeBranchId
    || !accessibleBranchIds.includes(activeBranchId)
    || !scopedBranchIds.includes(activeBranchId)
    || requestedBranchIds.some((branchId) => branchId !== activeBranchId)
    || (headerBranchId && headerBranchId !== activeBranchId)) {
    return next(error('branch_not_allowed', 'Aktif şubenize erişim yetkiniz yok.', 403))
  }

  req.branchIds = [activeBranchId]
  next()
}
