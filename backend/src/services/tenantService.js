import { updateById as updateTenant } from '../repositories/tenantRepository.js'
import { findById as findUserById } from '../repositories/userRepository.js'
import { error } from '../utils/errors.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { findPlanById } from '../repositories/planRepository.js'
import { getPlanStatus, getPlanDaysLeft, hasActiveSubscription } from './planService.js'
import PaymentRequest from '../models/PaymentRequest.js'
import MembershipRequest from '../models/MembershipRequest.js'
import Branch from '../models/Branch.js'
import mongoose from 'mongoose'
import { buildIncomingBusinessSettings, mergeBusinessSettings } from '../utils/businessSettings.js'
import { resolvePlanPackageType, resolveTenantPackageType } from '../utils/systemType.js'

const normalizeBranchIds = (input) => {
  const list = Array.isArray(input) ? input : []
  const ids = list.map(v => String(v || '').trim()).filter(Boolean)
  const invalid = ids.filter(v => !mongoose.Types.ObjectId.isValid(v))
  if (invalid.length > 0) {
    throw error('invalid_request', 'Invalid branch id', 400)
  }
  return ids
}

const buildPlanSummary = (tenant, planDoc, status) => {
  if (!planDoc) return null
  const tenantType = resolveTenantPackageType(tenant)
  const planType = resolvePlanPackageType(planDoc)
  if (!tenantType || !planType || tenantType !== planType) return null
  const isTrial = planDoc.isTrial === true
  const endsAt = isTrial ? (tenant?.trialEndsAt || tenant?.planEndsAt || null) : (tenant?.planEndsAt || null)
  return {
    id: planDoc.id,
    _id: planDoc.id,
    name: planDoc.name,
    systemType: planType,
    packageType: planDoc.packageType || planDoc.vertical || null,
    limits: planDoc.limits,
    features: planDoc.features,
    trialDays: planDoc.trialDays,
    isTrial,
    startsAt: tenant?.planStartedAt || tenant?.trialStartsAt || null,
    endsAt,
    status,
    daysLeft: getPlanDaysLeft(tenant)
  }
}

export const getContext = async (user) => {
  const u = await findUserById(user.id)
  if (!u) throw error('unauthorized', 'Unauthorized', 401)
  let tenant = null
  if (u.tenantId) {
    const t = await findTenantById(u.tenantId)
    if (t) {
      const subscriptionStatus = getPlanStatus(t)
      const isActiveSubscription = hasActiveSubscription(t)
      let linkedPlan = null
      if (t.planId) {
        const p = await findPlanById(t.planId)
        if (p) {
          linkedPlan = buildPlanSummary(t, p, subscriptionStatus)
        }
      }

      tenant = {
        _id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        allowedBranchIds: (t.allowedBranchIds || []).map(String),
        systemType: t.systemType || 'kermes',
        vertical: t.vertical || null,
        businessType: t.businessType || null,
        subscriptionStatus,
        currentPlan: isActiveSubscription ? linkedPlan : null,
        expiredPlan: !isActiveSubscription ? linkedPlan : null,
        plan: linkedPlan,
        canUpgrade: !isActiveSubscription
      }
    }
  }
  let paymentPending = false
  if (u.tenantId) {
    try {
      paymentPending = !!(await PaymentRequest.exists({ tenantId: u.tenantId, status: 'pending' }))
      if (!paymentPending) {
        paymentPending = !!(await MembershipRequest.exists({ tenantId: u.tenantId, status: 'pending' }))
      }
    } catch {}
  }
  return {
    tenant: tenant ? { ...tenant, paymentPending } : null,
    user: { _id: u.id, name: u.name, email: u.email, role: u.role }
  }
}

export const getProfile = async (tenantId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const activeBranches = await Branch.find({ tenantId, isDeleted: { $ne: true }, status: { $ne: 'deleted' }, isActive: true }).select('_id').lean()
  const fallbackBranchIds = activeBranches.map((branch) => String(branch._id))
  const mergedSettings = mergeBusinessSettings({
    ...(t?.settings || {}),
    logo: {
      ...(t?.settings?.logo || {}),
      url: t?.settings?.logo?.url || t?.logoUrl || '',
    },
  }, { activeBranchIds: fallbackBranchIds })
  const allowedBranchIds = Array.isArray(mergedSettings?.authorizedBranches?.branchIds) && mergedSettings.authorizedBranches.branchIds.length > 0
    ? mergedSettings.authorizedBranches.branchIds.map(String)
    : (t.allowedBranchIds || []).map(String)
  const base = {
    _id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    logoUrl: t.logoUrl || '',
    allowedBranchIds,
    systemType: t.systemType || 'kermes',
    settings: mergedSettings
  }

  if ((t.systemType || 'kermes') !== 'kantin') return base

  try {
    const { listByTenant } = await import('../modules/canteen/repositories/canteenBranchRepository.js')
    const { findTenantSettings } = await import('../modules/canteen/repositories/canteenSettingsRepository.js')
    const { ensureBranchPublicSlugs } = await import('../modules/canteen/services/canteenBranchService.js')
    const branches = await ensureBranchPublicSlugs(tenantId, t.name, await listByTenant(tenantId))
    const activeIds = new Set((branches || []).map(b => String(b.id || b._id)))
    const st = await findTenantSettings(tenantId)
    const canteenAllowedBranchIds = Array.isArray(st?.canteenAllowedBranchIds)
      ? st.canteenAllowedBranchIds.map(String).filter(Boolean).filter(id => activeIds.has(String(id)))
      : []
    return {
      ...base,
      branches: (branches || []).map(b => ({
        id: String(b.id || b._id),
        name: b.name,
        publicSlug: String(b.publicSlug || ''),
        description: b.description || '',
        isActive: b.isActive !== false
      })),
      canteenAllowedBranchIds
    }
  } catch {
    return { ...base, branches: [], canteenAllowedBranchIds: [] }
  }
}

export const updateSettings = async (tenantId, dto) => {
  const currentTenant = await findTenantById(tenantId)
  if (!currentTenant) throw error('not_found', 'Tenant not found', 404)
  const incoming = buildIncomingBusinessSettings(dto)
  const activeBranches = await Branch.find({ tenantId, isDeleted: { $ne: true }, status: { $ne: 'deleted' }, isActive: true }).select('_id').lean()
  const fallbackBranchIds = activeBranches.map((branch) => String(branch._id))
  const mergedSettings = mergeBusinessSettings({
    ...(currentTenant?.settings || {}),
    ...incoming,
    logo: {
      ...(currentTenant?.settings?.logo || {}),
      url: currentTenant?.settings?.logo?.url || currentTenant?.logoUrl || '',
    },
  }, { activeBranchIds: fallbackBranchIds })
  const update = {
    settings: mergedSettings,
    allowedBranchIds: Array.isArray(mergedSettings?.authorizedBranches?.branchIds)
      ? mergedSettings.authorizedBranches.branchIds
      : currentTenant.allowedBranchIds,
  }
  const t = await updateTenant(tenantId, update)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'tenant_settings_update', 'Tenant', t.id, { keys: Object.keys(update) })
  return {
    _id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    logoUrl: t.logoUrl || '',
    allowedBranchIds: (t.allowedBranchIds || []).map(String),
    settings: mergeBusinessSettings(t?.settings || {})
  }
}

export const updateProfile = async (tenantId, dto) => {
  const update = {}
  if (dto.name !== undefined) update.name = dto.name
  if (dto.description !== undefined) update.description = dto.description
  if (dto.allowedBranchIds !== undefined) {
    const ids = normalizeBranchIds(dto.allowedBranchIds)
    if (ids.length > 0) {
      const found = await Branch.find({ tenantId, _id: { $in: ids } }).select('_id').lean()
      const foundSet = new Set((found || []).map(b => String(b._id)))
      const missing = ids.filter(id => !foundSet.has(String(id)))
      if (missing.length > 0) {
        throw error('invalid_branch', 'Invalid branch', 400)
      }
    }
    update.allowedBranchIds = ids
    update['settings.authorizedBranches.branchIds'] = ids
  }
  const t = await updateTenant(tenantId, update)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  await (await import('./auditService.js')).log(tenantId, dto.actorUserId || tenantId, 'tenant_profile_update', 'Tenant', t.id, {})
  return {
    _id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    logoUrl: t.logoUrl || '',
    allowedBranchIds: (t.allowedBranchIds || []).map(String)
  }
}
