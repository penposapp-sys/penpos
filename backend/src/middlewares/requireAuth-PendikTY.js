import { verifyToken } from '../utils/jwt.js'
import { error } from '../utils/errors.js'
import User from '../models/User.js'
import { getUserAccessibleBranchIds } from '../utils/branchVisibility.js'

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next(error('unauthorized', 'Unauthorized', 401))
  try {
    const payload = verifyToken(token)
    const user = await User.findById(payload.sub).select('name role tenantId permissions branchId branchIds accessibleBranchIds active isActive isDeleted status')
    if (!user || user.isDeleted === true || user.isActive === false || user.active === false || String(user.status || '') === 'deleted') {
      return next(error('unauthorized', 'Unauthorized', 401))
    }

    const accessibleBranchIds = getUserAccessibleBranchIds(user)
    const resolvedBranchId = user.branchId ? String(user.branchId) : (accessibleBranchIds.length === 1 ? accessibleBranchIds[0] : null)

    req.user = {
      id: String(user._id || payload.sub),
      name: user.name || payload.name || null,
      role: user.role || payload.role,
      tenantId: user.tenantId ? String(user.tenantId) : (payload.tenantId || null),
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      branchId: resolvedBranchId,
      branchIds: accessibleBranchIds,
      modules: Array.isArray(payload.modules) ? payload.modules : []
    }
    next()
  } catch {
    next(error('unauthorized', 'Unauthorized', 401))
  }
}
