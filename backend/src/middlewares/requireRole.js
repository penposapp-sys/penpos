import { error } from '../utils/errors.js'
import { log as auditLog } from '../services/auditService.js'

export const requireRole = (roles) => (req, res, next) => {
  if (!req.user) return next(error('unauthorized', 'Unauthorized', 401))
  if (!roles.includes(req.user.role)) {
    try {
      const tenantId = req.user.tenantId || null
      const actorUserId = req.user.id
      auditLog(tenantId, actorUserId, 'yetkisiz_erisim_denendi', 'User', actorUserId, { route: req.path, requiredRoles: roles, userRole: req.user.role })
    } catch {}
    return next(error('forbidden', 'Bu işlem için yetkiniz yok', 403))
  }
  next()
}
