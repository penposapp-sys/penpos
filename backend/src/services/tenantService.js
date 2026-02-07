import { updateById as updateTenant } from '../repositories/tenantRepository.js'
import { findById as findUserById } from '../repositories/userRepository.js'
import { error } from '../utils/errors.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { findPlanById } from '../repositories/planRepository.js'
import { getPlanStatus, getPlanDaysLeft } from './planService.js'
import PaymentRequest from '../models/PaymentRequest.js'
import Branch from '../models/Branch.js'
import mongoose from 'mongoose'

const normalizeBranchIds = (input) => {
  const list = Array.isArray(input) ? input : []
  const ids = list.map(v => String(v || '').trim()).filter(Boolean)
  const invalid = ids.filter(v => !mongoose.Types.ObjectId.isValid(v))
  if (invalid.length > 0) {
    throw error('invalid_request', 'Invalid branch id', 400)
  }
  return ids
}

export const getContext = async (user) => {
  const u = await findUserById(user.id)
  if (!u) throw error('unauthorized', 'Unauthorized', 401)
  let tenant = null
  if (u.tenantId) {
    const t = await findTenantById(u.tenantId)
    if (t) {
      let plan = null
      if (t.planId) {
        const p = await findPlanById(t.planId)
        if (p) {
          plan = {
            _id: p.id,
            name: p.name,
            limits: p.limits,
            features: p.features,
            trialDays: p.trialDays,
            endsAt: t.planEndsAt || null,
            status: getPlanStatus(t),
            daysLeft: getPlanDaysLeft(t)
          }
        }
      }
      tenant = {
        _id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        allowedBranchIds: (t.allowedBranchIds || []).map(String),
        systemType: t.systemType || 'kermes',
        plan
      }
    }
  }
  let paymentPending = false
  if (u.tenantId) {
    try {
      paymentPending = !!(await PaymentRequest.exists({ tenantId: u.tenantId, status: 'pending' }))
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
  const base = {
    _id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    logoUrl: t.logoUrl || '',
    allowedBranchIds: (t.allowedBranchIds || []).map(String),
    systemType: t.systemType || 'kermes',
    settings: {
      qrMenuEnabled: Boolean(t?.settings?.qrMenuEnabled)
    }
  }

  if ((t.systemType || 'kermes') !== 'kantin') return base

  try {
    const { listByTenant } = await import('../modules/canteen/repositories/canteenBranchRepository.js')
    const { findTenantSettings } = await import('../modules/canteen/repositories/canteenSettingsRepository.js')
    const branches = await listByTenant(tenantId)
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
  const update = {}
  if (dto.qrMenuEnabled !== undefined) {
    update['settings.qrMenuEnabled'] = !!dto.qrMenuEnabled
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
    settings: {
      qrMenuEnabled: Boolean(t?.settings?.qrMenuEnabled)
    }
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
