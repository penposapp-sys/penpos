import { error } from '../utils/errors.js'
import { findActiveById } from '../repositories/tenantRepository.js'
import { log as auditLog } from '../services/auditService.js'
import * as logger from '../utils/logger.js'

export const tenantGuard = async (req, res, next) => {
  const { role, tenantId } = req.user || {}
  if (role !== 'superadmin') {
    if (!tenantId) {
      try {
        const actorUserId = req.user.id
        await auditLog(null, actorUserId, 'login_red_silinmis_tenant', 'User', actorUserId, { route: req.path })
      } catch {}
      try {
        logger.warn('MISSING_TENANT', { userId: req.user?.id || null, route: req.path })
      } catch {}
      return res.status(403).json({ status: 403, code: 'missing_tenant', message: 'Tenant required' })
    }
    const tenant = await findActiveById(tenantId)
    if (!tenant) {
      try {
        const actorUserId = req.user.id
        await auditLog(tenantId, actorUserId, 'login_red_pasif_tenant', 'User', actorUserId, { route: req.path })
      } catch {}
      return next(error('tenant_inactive', 'Tenant inactive or not found', 403))
    }
    req.tenant = { id: tenant.id, name: tenant.name, slug: tenant.slug }
  }
  next()
}
