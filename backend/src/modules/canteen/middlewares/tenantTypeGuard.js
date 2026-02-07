import { error } from '../../../utils/errors.js'
import { findActiveById } from '../../../repositories/tenantRepository.js'

export const tenantTypeGuard = (expectedSystemType) => async (req, res, next) => {
  const tenantId = req.user?.tenantId || null
  if (!tenantId) return next(error('forbidden_not_tenant_user', 'Forbidden', 403))
  const tenant = await findActiveById(tenantId)
  if (!tenant) return next(error('tenant_inactive', 'Tenant inactive or not found', 403))
  const systemType = tenant.systemType || null
  req.tenant = { ...(req.tenant || {}), id: tenant.id, name: tenant.name, slug: tenant.slug, systemType }
  if (systemType !== expectedSystemType) {
    return next(error('wrong_tenant_type', 'Wrong tenant type', 403))
  }
  next()
}

