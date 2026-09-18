import bcrypt from 'bcryptjs'
import { error } from '../utils/errors.js'
import { createTenant, listTenants, findTenantById, updateById as updateTenantById } from '../repositories/tenantRepository.js'
import { findPlanById } from '../repositories/planRepository.js'
import { createUser } from '../repositories/userRepository.js'
import { getPlanStatus, getPlanDaysLeft } from './planService.js'
import { log as auditLog } from './auditService.js'

const buildPlanDto = async (tenant) => {
  const status = getPlanStatus(tenant)
  let planDoc = null
  if (tenant?.planId) {
    try {
      planDoc = await findPlanById(tenant.planId)
    } catch {}
  }
  return {
    status,
    name: planDoc?.name || '',
    isTrial: planDoc?.isTrial === true || status === 'trial',
    endsAt: tenant?.planEndsAt || tenant?.trialEndsAt || null,
    startsAt: tenant?.planStartedAt || tenant?.trialStartsAt || null,
    daysLeft: getPlanDaysLeft(tenant)
  }
}

export const createTenantService = async ({ name, slug }, actorUserId) => {
  if (!name || !slug) throw error('validation_error', 'name and slug required', 400)
  let tenant
  try {
    tenant = await createTenant({ name, slug })
  } catch (err) {
    if (err && err.code === 11000) {
      throw error('slug_in_use', 'Slug zaten kullanılıyor', 409)
    }
    throw err
  }
  return { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status }
}

export const listTenantsService = async () => {
  const tenants = await listTenants()
  const items = []
  for (const t of tenants) {
    items.push({
      id: t.id,
      name: t.name,
      slug: t.slug,
      isActive: t.isActive,
      status: t.status,
      createdAt: t.createdAt,
      plan: await buildPlanDto(t)
    })
  }
  return items
}

export const createTenantAdminService = async (tenantId, { name, email, password }) => {
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await createUser({
    tenantId: tenant.id,
    name,
    email,
    passwordHash,
    role: 'tenant_admin',
    isActive: true
  })
  return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId }
}

export const extendTrialService = async (tenantId, days, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const safeDays = Math.max(1, Number(days) || 0)
  const base = t.planEndsAt ? new Date(t.planEndsAt) : new Date()
  const newEnds = new Date(base.getTime() + safeDays * 24 * 60 * 60 * 1000)
  const updated = await updateTenantById(tenantId, { planEndsAt: newEnds, planStartedAt: t.planStartedAt || new Date() })
  await auditLog(updated.id, actorUserId || null, 'trial_uzatildi', 'Tenant', updated.id, { days: safeDays })
  return {
    id: updated.id,
    plan: await buildPlanDto(updated)
  }
}

export const endTrialService = async (tenantId, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const now = new Date()
  const updated = await updateTenantById(tenantId, { planEndsAt: now, planStartedAt: t.planStartedAt || new Date() })
  await auditLog(updated.id, actorUserId || null, 'trial_sonlandirildi', 'Tenant', updated.id, {})
  return {
    id: updated.id,
    plan: await buildPlanDto(updated)
  }
}

export const editTenantService = async (tenantId, { name }, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const update = {}
  if (name !== undefined) update.name = name
  const updated = await updateTenantById(tenantId, update)
  await auditLog(updated.id, actorUserId || null, 'uye_duzenlendi', 'Tenant', updated.id, { name: updated.name })
  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    status: updated.status,
    isActive: updated.isActive
  }
}

export const softDeleteTenantService = async (tenantId, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const updated = await updateTenantById(tenantId, { isActive: false, status: 'inactive' })
  await auditLog(updated.id, actorUserId || null, 'uye_silindi', 'Tenant', updated.id, {})
  return { id: updated.id, isActive: updated.isActive, status: updated.status }
}
