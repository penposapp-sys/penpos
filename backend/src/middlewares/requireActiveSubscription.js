import { findTenantById } from '../repositories/tenantRepository.js'
import { hasActiveSubscription } from '../services/planService.js'

const EXPIRED_MESSAGE = 'Paket süreniz doldu. Lütfen planınızı yükseltin.'

export const requireActiveSubscription = async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id || req.user?.tenantId || req.user?.tenant?.id || null
    if (!tenantId) {
      return res.status(401).json({ code: 'tenant_missing', message: 'İşletme bulunamadı.' })
    }

    const tenant = req.tenant?.subscriptionStatus !== undefined
      ? req.tenant
      : await findTenantById(tenantId)

    if (!tenant) {
      return res.status(401).json({ code: 'tenant_missing', message: 'İşletme bulunamadı.' })
    }

    if (hasActiveSubscription(tenant)) return next()

    return res.status(402).json({
      code: 'SUBSCRIPTION_EXPIRED',
      message: EXPIRED_MESSAGE
    })
  } catch (err) {
    return next(err)
  }
}
