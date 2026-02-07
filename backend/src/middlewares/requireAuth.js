import { verifyToken } from '../utils/jwt.js'
import { error } from '../utils/errors.js'

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next(error('unauthorized', 'Unauthorized', 401))
  try {
    const payload = verifyToken(token)
    req.user = {
      id: payload.sub,
      name: payload.name || null,
      role: payload.role,
      tenantId: payload.tenantId || null,
      permissions: payload.permissions || [],
      branchId: payload.branchId || null,
      branchIds: Array.isArray(payload.branchIds) ? payload.branchIds : [],
      modules: Array.isArray(payload.modules) ? payload.modules : []
    }
    next()
  } catch {
    next(error('unauthorized', 'Unauthorized', 401))
  }
}
