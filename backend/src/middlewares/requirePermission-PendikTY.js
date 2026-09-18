import { error } from '../utils/errors.js'
import { log as auditLog } from '../services/auditService.js'
import { PERMISSION_ALIASES } from '../constants/permissions.js'

const normalizePermissions = (perms) => {
  const list = Array.isArray(perms) ? perms : []
  const set = new Set()
  for (const p of list) {
    if (!p) continue
    set.add(p)
    const aliased = PERMISSION_ALIASES[p]
    if (Array.isArray(aliased)) {
      for (const a of aliased) if (a) set.add(a)
    } else if (aliased) {
      set.add(aliased)
    }
  }
  return Array.from(set)
}

export const requirePermission = (perms, options = {}) => {
  const requiredInput = Array.isArray(perms) ? perms : [perms]
  const mode = options.mode === 'any' ? 'any' : 'all'
  const required = normalizePermissions(requiredInput)
  return (req, res, next) => {
    const role = req.user.role
    if (role === 'tenant_admin' || role === 'superadmin') return next()
    const userPerms = normalizePermissions(req.user.permissions)
    const ok = mode === 'any'
      ? required.some(p => userPerms.includes(p))
      : required.every(p => userPerms.includes(p))
    if (!ok) {
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.log('[PERMISSION_DENY]', {
            path: req.originalUrl,
            requiredPermissions: required,
            userRole: role,
            userPermissions: userPerms
          })
        } catch {}
      }
      try {
        const tenantId = req.user.tenantId || null
        const actorUserId = req.user.id
        auditLog(tenantId, actorUserId, 'yetkisiz_islem_engellendi', 'User', actorUserId, { route: req.path, requiredPermissions: required, userPermissions: userPerms })
      } catch {}
      return next(error('forbidden', 'Bu işlem için yetkiniz yok', 403))
    }
    next()
  }
}

export const requireAnyPermission = (perms) => requirePermission(perms, { mode: 'any' })
