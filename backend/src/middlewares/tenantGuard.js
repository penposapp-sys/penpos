import { error } from '../utils/errors.js'
import { findActiveById } from '../repositories/tenantRepository.js'
import { log as auditLog } from '../services/auditService.js'
import * as logger from '../utils/logger.js'
import { Types } from 'mongoose'

const normalizeObjectId = (val) => {
  if (!val) return null
  const s = String(val).trim()
  try {
    if (Types.ObjectId.isValid(s)) return new Types.ObjectId(s).toString()
  } catch {}
  return null
}

const buildTenantReq = (tenant) => ({
  id: tenant.id,
  _id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  systemType: tenant.systemType || null,
  vertical: tenant.vertical || null,
  businessType: tenant.businessType || null,
  planId: tenant.planId || null,
  packageId: tenant.packageId || null,
  planEndsAt: tenant.planEndsAt || null,
  trialStartsAt: tenant.trialStartsAt || null,
  trialEndsAt: tenant.trialEndsAt || null,
  subscriptionStatus: tenant.subscriptionStatus || 'inactive'
})

export const tenantGuard = async (req, res, next) => {
  const { role, tenantId, regionSystemType, accessibleTenantIds } = req.user || {}
  const isRegionAdmin = role === 'anaokulu_region_admin' || regionSystemType === 'anaokulu'
  const isPlatformUser = role === 'superadmin' || role === 'platform_admin'

  if (isPlatformUser) {
    const overrideRaw = req.query?.tenantId || req.headers['x-tenant-id'] || req.body?.tenantId
    const overrideId = normalizeObjectId(overrideRaw)
    if (overrideId) {
      const tenant = await findActiveById(overrideId)
      if (tenant) {
        req.tenant = buildTenantReq(tenant)
        req.user = { ...(req.user || {}), tenantId: overrideId }
      }
    }
    return next()
  }

  if (isRegionAdmin) {
    const overrideRaw = req.query?.tenantId || req.headers['x-tenant-id'] || req.body?.tenantId
    let overrideId = normalizeObjectId(overrideRaw)
    const allowedIds = Array.isArray(accessibleTenantIds) ? accessibleTenantIds.map(normalizeObjectId).filter(Boolean) : []

    // If requested tenant is not in allowed list, fallback to first allowed tenant
    if ((!overrideId || !allowedIds.includes(overrideId)) && allowedIds.length > 0) {
      overrideId = allowedIds[0]
    }

    if (!overrideId) {
      req.tenant = null
      return next()
    }

    // Try finding active tenant with overrideId
    let tenant = await findActiveById(overrideId)
    // If not active/found, attempt fallback to other accessible tenants
    if (!tenant && allowedIds.length > 0) {
      for (const altId of allowedIds) {
        if (altId !== overrideId) {
          tenant = await findActiveById(altId)
          if (tenant) {
            overrideId = altId
            break
          }
        }
      }
    }

    if (!tenant) {
      // If none of the accessible schools are active, allow request with req.tenant = null
      req.tenant = null
      return next()
    }

    req.tenant = buildTenantReq(tenant)
    req.user = { ...(req.user || {}), tenantId: overrideId }
    return next()
  }

  if (!tenantId) {
    try {
      const actorUserId = req.user?.id
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
      const actorUserId = req.user?.id
      await auditLog(tenantId, actorUserId, 'login_red_pasif_tenant', 'User', actorUserId, { route: req.path })
    } catch {}
    return next(error('tenant_inactive', 'Tenant inactive or not found', 403))
  }

  req.tenant = buildTenantReq(tenant)
  next()
}
