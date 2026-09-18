import { error } from '../utils/errors.js'
import { findPlanById, listPlans } from '../repositories/planRepository.js'
import { findTenantById, updateById as updateTenantById } from '../repositories/tenantRepository.js'
import { log as auditLog } from './auditService.js'
import Plan from '../models/Plan.js'
import { buildPlanTypeMatchQuery, buildTrialMatchQuery, isTrialPlan, normalizeSystemType, resolvePlanPackageType, resolveTenantPackageType, toLegacySystemType } from '../utils/systemType.js'

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

export const findTrialPlanForSystemType = async (systemType) => {
  const normalizedType = normalizeSystemType(systemType)
  if (!normalizedType) throw error('invalid_system_type', 'Invalid system type', 400)

  const plan = await Plan.findOne({
    $and: [
      { isActive: true },
      { $or: buildPlanTypeMatchQuery(normalizedType) },
      { $or: buildTrialMatchQuery() }
    ]
  })
    .setOptions({ strictQuery: false })
    .sort({ createdAt: 1 })

  if (!plan) {
    throw error('trial_plan_missing', 'Bu işletme tipi için 7 günlük deneme paketi bulunamadı.', 400)
  }

  return plan
}

export const getPlanStatus = (tenant) => {
  const now = new Date()
  const subscriptionStatus = String(tenant?.subscriptionStatus || '').trim().toLowerCase()
  const trialEndsAt = tenant?.trialEndsAt ? new Date(tenant.trialEndsAt) : null
  const planEndsAt = tenant?.planEndsAt ? new Date(tenant.planEndsAt) : null

  if (subscriptionStatus === 'trial') {
    if (!trialEndsAt) return 'expired'
    return trialEndsAt > now ? 'trial' : 'expired'
  }

  if (subscriptionStatus === 'active') {
    if (!planEndsAt) return 'active'
    return planEndsAt > now ? 'active' : 'expired'
  }

  if (subscriptionStatus === 'expired' || subscriptionStatus === 'inactive') {
    return subscriptionStatus
  }

  if (trialEndsAt) return trialEndsAt > now ? 'trial' : 'expired'
  if (planEndsAt) return planEndsAt > now ? 'active' : 'expired'
  return 'inactive'
}

export const getPlanDaysLeft = (tenant) => {
  const status = getPlanStatus(tenant)
  const endDate = status === 'trial'
    ? (tenant?.trialEndsAt ? new Date(tenant.trialEndsAt) : null)
    : (tenant?.planEndsAt ? new Date(tenant.planEndsAt) : null)
  if (!endDate) return null
  const now = new Date()
  const diffMs = endDate.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
  return Math.max(0, days)
}

export const hasActiveSubscription = (tenant) => {
  const status = getPlanStatus(tenant)
  return status === 'trial' || status === 'active'
}

export const ensureNotExpired = async (tenantId, actorUserId) => {
  const tenant = await findTenantById(tenantId)
  if (!hasActiveSubscription(tenant)) {
    await auditLog(tenantId, actorUserId || null, 'plan_expired_block', 'Tenant', tenantId, {})
    throw error('SUBSCRIPTION_EXPIRED', 'Paket süreniz doldu. Lütfen planınızı yükseltin.', 402)
  }
}

export const listActivePlans = async (systemTypeFilter, { includeTrials = false } = {}) => {
  const normalized = normalizeSystemType(systemTypeFilter) || String(systemTypeFilter || '').trim().toLowerCase()
  const plans = await listPlans()
  return plans.filter((plan) => {
    if (!plan.isActive) return false
    if (!includeTrials && isTrialPlan(plan)) return false
    const st = normalizeSystemType(plan.systemType || resolvePlanPackageType(plan), null)
    if (!normalized) return true
    if (normalized === 'restaurant' || normalized === 'canteen') return st === normalized || resolvePlanPackageType(plan) === normalized
    if (normalized === 'kermes' || normalized === 'kantin') return toLegacySystemType(st, st) === normalized
    throw error('invalid_request', 'Invalid systemType filter', 400)
  }).map((plan) => ({
    id: plan.id,
    systemType: normalizeSystemType(plan.systemType || resolvePlanPackageType(plan), 'restaurant'),
    packageType: resolvePlanPackageType(plan),
    name: plan.name,
    price: plan.price,
    limits: plan.limits,
    features: plan.features,
    trialDays: plan.trialDays,
    isTrial: plan.isTrial === true
  }))
}

export const ensurePlanMatchesTenant = (tenant, plan) => {
  const tenantPackageType = resolveTenantPackageType(tenant)
  const planPackageType = resolvePlanPackageType(plan)
  if (!tenantPackageType || !planPackageType || tenantPackageType !== planPackageType) {
    throw error('plan_system_mismatch', 'Bu işletme tipine ait olmayan paket atanamaz.', 400)
  }
  return { tenantPackageType, planPackageType }
}

export const assignPlanToTenant = async ({ tenantId, planId, actorUserId = null, source = 'manual' }) => {
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('tenant_not_found', 'İşletme bulunamadı', 404)

  const plan = await findPlanById(planId)
  if (!plan) throw error('plan_not_found', 'Paket bulunamadı', 404)

  ensurePlanMatchesTenant(tenant, plan)

  const now = new Date()
  const isTrial = isTrialPlan(plan)
  const trialDays = Math.max(1, Number(plan.trialDays || 7))
  const planDays = Math.max(1, Number(plan.durationDays || 30))
  const endsAt = new Date(now.getTime() + (isTrial ? trialDays : planDays) * 24 * 60 * 60 * 1000)

  const nextPatch = {
    planId: plan.id,
    subscriptionStatus: isTrial ? 'trial' : 'active',
    trialStartsAt: isTrial ? now : null,
    trialEndsAt: isTrial ? endsAt : null,
    planStartedAt: isTrial ? null : now,
    planEndsAt: isTrial ? null : endsAt
  }

  const updated = await updateTenantById(tenantId, nextPatch)
  await auditLog(tenantId, actorUserId, 'plan_assigned', 'Tenant', tenantId, {
    source,
    planId: plan.id,
    planName: plan.name,
    subscriptionStatus: nextPatch.subscriptionStatus,
    endsAt
  })
  return updated
}
