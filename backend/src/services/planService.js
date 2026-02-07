import { error } from '../utils/errors.js'
import { findPlanById, listPlans } from '../repositories/planRepository.js'
import { findTenantById, updateById as updateTenantById } from '../repositories/tenantRepository.js'
import { log as auditLog } from './auditService.js'

export const getTenantPlan = async (tenantId) => {
  const tenant = await findTenantById(tenantId)
  if (!tenant || !tenant.planId) return null
  const plan = await findPlanById(tenant.planId)
  return plan || null
}

export const ensureFeature = async (tenantId, featureKey) => {
  const plan = await getTenantPlan(tenantId)
  const enabled = !!(plan && plan.features && plan.features[featureKey])
  if (!enabled) throw error('feature_forbidden', 'Plan özelliği yok', 403)
}

export const pickDefaultPlan = async () => {
  const plans = await listPlans()
  if (!plans.length) return null
  const trial = plans.find(p => /trial/i.test(p.name))
  if (trial) return trial
  const basic = plans.find(p => /basic/i.test(p.name))
  if (basic) return basic
  return plans[0]
}

export const getPlanStatus = (tenant) => {
  if (!tenant?.planEndsAt) return 'active'
  const now = new Date()
  return now > tenant.planEndsAt ? 'expired' : 'active'
}

export const getPlanDaysLeft = (tenant) => {
  if (!tenant?.planEndsAt) return null
  const now = new Date()
  const diffMs = tenant.planEndsAt.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
  return Math.max(0, days)
}

export const ensureNotExpired = async (tenantId, actorUserId) => {
  const tenant = await findTenantById(tenantId)
  const status = getPlanStatus(tenant)
  if (status === 'expired') {
    await auditLog(tenantId, actorUserId || null, 'plan_expired_block', 'Tenant', tenantId, {})
    throw error('plan_expired', 'Paket süreniz doldu. Lütfen planınızı yükseltin.', 403)
  }
}

export const listActivePlans = async (systemTypeFilter) => {
  const normalized = String(systemTypeFilter || '').trim().toLowerCase()
  const plans = await listPlans()
  return plans.filter(p => {
    if (!p.isActive) return false
    const st = String(p.systemType || 'kermes')
    if (!normalized) return true
    if (normalized === 'canteen') return st === 'kantin'
    if (normalized === 'kermes' || normalized === 'kantin') return st === normalized
    throw error('invalid_request', 'Invalid systemType filter', 400)
  }).map(p => ({
    id: p.id,
    systemType: p.systemType || 'kermes',
    name: p.name,
    price: p.price,
    limits: p.limits,
    features: p.features,
    trialDays: p.trialDays
  }))
}
