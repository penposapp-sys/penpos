import { error } from '../../../utils/errors.js'

export const tenantUserGuard = (req, res, next) => {
  const role = req.user?.role || null
  const tenantId = req.user?.tenantId || null
  if (role === 'platform_admin' || role === 'superadmin') {
    return next(error('forbidden_not_tenant_user', 'Forbidden', 403))
  }
  if (!tenantId) {
    return next(error('forbidden_not_tenant_user', 'Forbidden', 403))
  }
  next()
}

