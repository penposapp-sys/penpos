import bcrypt from 'bcryptjs'
import { error } from '../utils/errors.js'
import { createTenant, listTenants, updateById as updateTenantById, findTenantById } from '../repositories/tenantRepository.js'
import { createBranch } from '../repositories/branchRepository.js'
import { createUser } from '../repositories/userRepository.js'
import { log as auditLog } from './auditService.js'
import { createPlan, listPlans, findPlanById, updatePlanById, deletePlanById } from '../repositories/planRepository.js'
import { pickDefaultPlan } from './planService.js'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Branch from '../models/Branch.js'
import Table from '../models/Table.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import Order from '../models/Order.js'
import PaymentSettings from '../models/PaymentSettings.js'
import PaymentRequest from '../models/PaymentRequest.js'
import Tenant from '../models/Tenant.js'

export const setPlatformUserPasswordService = async (userId, password, actorUserId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw error('invalid_request', 'Invalid user id', 400)
  }
  const nextPassword = String(password || '')
  if (nextPassword.length < 8) {
    throw error('validation_error', 'Password must be at least 8 characters', 400)
  }
  const u = await User.findById(userId)
  if (!u) throw error('not_found', 'User not found', 404)
  const passwordHash = await bcrypt.hash(nextPassword, 10)
  u.passwordHash = passwordHash
  u.isActive = true
  await u.save()
  await auditLog(u.tenantId || null, actorUserId || null, 'platform_user_password_reset', 'User', u.id, { role: u.role })
  return { success: true, id: u.id }
}

export const createTenantWithOwnerService = async ({ name, ownerName, ownerEmail, ownerPassword, systemType }) => {
  if (!name || !ownerName || !ownerEmail || !ownerPassword || !systemType) {
    throw error('validation_error', 'Missing required fields', 400)
  }
  if (systemType !== 'kermes' && systemType !== 'kantin') {
    throw error('validation_error', 'Invalid system type', 400)
  }
  let tenant
  try {
    tenant = await createTenant({ name, slug: name.toLowerCase().replace(/\s+/g, '-'), status: 'active', isActive: true, systemType })
  } catch (err) {
    if (err && err.code === 11000) {
      throw error('slug_in_use', 'Slug zaten kullanılıyor', 409)
    }
    throw err
  }
  const branch = await createBranch({ tenantId: tenant.id, name: 'Merkez Şube', address: '' })
  const passwordHash = await bcrypt.hash(ownerPassword, 10)
  const user = await createUser({
    tenantId: tenant.id,
    branchId: branch.id,
    name: ownerName,
    email: ownerEmail,
    passwordHash,
    role: 'tenant_admin',
    isActive: true,
    systemType // Inherit systemType from tenant implicitly or explicitly? User model has systemType.
  })
  // Ensure user has systemType set
  if (!user.systemType) {
      user.systemType = systemType
      await user.save()
  }
  try {
    const def = await pickDefaultPlan()
    if (def) {
      const now = new Date()
      const ends = def.trialDays && def.trialDays > 0 ? new Date(now.getTime() + def.trialDays * 24 * 60 * 60 * 1000) : null
      await updateTenantById(tenant.id, { planId: def.id, planStartedAt: now, planEndsAt: ends })
      await auditLog(tenant.id, user.id, 'tenant_plan_degisti', 'Tenant', tenant.id, { planId: def.id, planName: def.name })
    }
  } catch {}
  await auditLog(tenant.id, user.id, 'tenant_olusturuldu', 'Tenant', tenant.id, { name, systemType })
  await auditLog(tenant.id, user.id, 'tenant_admin_olusturuldu', 'User', user.id, { email: ownerEmail })
  return {
    tenant: { _id: tenant.id, name: tenant.name, isActive: tenant.isActive, createdAt: tenant.createdAt, systemType: tenant.systemType },
    owner: { _id: user.id, name: user.name, email: user.email, role: user.role }
  }
}

export const listPlatformTenantsService = async (system) => {
  const list = await listTenants()
  const items = []
  for (const t of list) {
    let planName = null
    let ownerEmail = null
    if (t.planId) {
      try {
        const p = await findPlanById(t.planId)
        planName = p?.name || null
      } catch {}
    }
    try {
      const owner = await User.findOne({ tenantId: t.id, role: 'tenant_admin' })
      ownerEmail = owner?.email || null
    } catch {}
    const item = {
      _id: t.id,
      name: t.name,
      isActive: t.isActive,
      createdAt: t.createdAt,
      planName,
      ownerEmail,
      systemType: t.systemType
    }
    items.push(item)
  }
  const normalized = String(system || '').trim().toLowerCase()
  if (normalized === 'kermes') return items.filter(i => i.systemType === 'kermes')
  if (normalized === 'canteen') return items.filter(i => i.systemType === 'kantin')
  if (normalized) throw error('invalid_request', 'Invalid system filter', 400)
  return items
}

export const updateTenantStatusService = async (id, isActive, actorUserId) => {
  const updated = await updateTenantById(id, { isActive, status: isActive ? 'active' : 'inactive' })
  if (!updated) throw error('not_found', 'Tenant not found', 404)
  await auditLog(updated.id, actorUserId || null, isActive ? 'tenant_aktiflestirildi' : 'tenant_pasiflestirildi', 'Tenant', updated.id, {})
  return { _id: updated.id, isActive: updated.isActive }
}

export const createPlanService = async (dto, actorUserId) => {
  const systemTypeRaw = String(dto.systemType || '').trim().toLowerCase()
  const systemType = systemTypeRaw === 'kantin' || systemTypeRaw === 'kermes' ? systemTypeRaw : null
  if (!systemType) throw error('invalid_request', 'systemType zorunlu', 400)
  const data = {
    systemType,
    name: dto.name,
    price: Number(dto.price) || 0,
    limits: {
      products: dto.limits?.products ?? -1,
      tables: dto.limits?.tables ?? -1,
      staff: dto.limits?.staff ?? -1
    },
    features: {
      reports: !!(dto.features?.reports),
      kitchen: !!(dto.features?.kitchen)
    },
    trialDays: Number(dto.trialDays) || 0,
    isActive: dto.isActive !== undefined ? !!dto.isActive : true
  }
  const p = await createPlan(data)
  await auditLog(null, actorUserId || null, 'plan_olusturuldu', 'Plan', p.id, { name: p.name })
  return {
    _id: p.id,
    systemType: p.systemType || systemType,
    name: p.name,
    price: p.price,
    limits: p.limits,
    features: p.features,
    trialDays: p.trialDays,
    isActive: p.isActive
  }
}

export const listPlansService = async (systemTypeFilter) => {
  const normalized = String(systemTypeFilter || '').trim().toLowerCase()
  const list = await listPlans()
  return list.map(p => ({
    _id: p.id,
    systemType: p.systemType || 'kermes',
    name: p.name,
    price: p.price,
    limits: p.limits,
    features: p.features,
    trialDays: p.trialDays,
    isActive: p.isActive
  })).filter(p => {
    if (!normalized) return true
    if (normalized === 'canteen') return p.systemType === 'kantin'
    if (normalized === 'kermes' || normalized === 'kantin') return p.systemType === normalized
    throw error('invalid_request', 'Invalid systemType filter', 400)
  })
}

export const updatePlanService = async (id, dto, actorUserId) => {
  const update = {}
  if (dto.systemType !== undefined) {
    const st = String(dto.systemType || '').trim().toLowerCase()
    if (st !== 'kermes' && st !== 'kantin') throw error('invalid_request', 'Invalid systemType', 400)
    update.systemType = st
  }
  if (dto.name !== undefined) update.name = dto.name
  if (dto.price !== undefined) update.price = Number(dto.price) || 0
  if (dto.limits) {
    update.limits = {
      products: dto.limits.products ?? -1,
      tables: dto.limits.tables ?? -1,
      staff: dto.limits.staff ?? -1
    }
  }
  if (dto.features) {
    update.features = {
      reports: !!dto.features.reports,
      kitchen: !!dto.features.kitchen
    }
  }
  if (dto.trialDays !== undefined) update.trialDays = Number(dto.trialDays) || 0
  if (dto.isActive !== undefined) update.isActive = !!dto.isActive
  const p = await updatePlanById(id, update)
  if (!p) throw error('not_found', 'Plan not found', 404)
  await auditLog(null, actorUserId || null, 'plan_guncellendi', 'Plan', p.id, {})
  return {
    _id: p.id,
    systemType: p.systemType || 'kermes',
    name: p.name,
    price: p.price,
    limits: p.limits,
    features: p.features,
    trialDays: p.trialDays,
    isActive: p.isActive
  }
}

export const deletePlanService = async (id, actorUserId) => {
  const p = await deletePlanById(id)
  if (!p) throw error('not_found', 'Plan not found', 404)
  await auditLog(null, actorUserId || null, 'plan_silindi', 'Plan', id, {})
  return { ok: true }
}

export const assignTenantPlanService = async (tenantId, dto, actorUserId) => {
  if (!mongoose.isValidObjectId(tenantId)) throw error('validation_error', 'Invalid tenant id', 400)
  if (!mongoose.isValidObjectId(dto.planId)) throw error('validation_error', 'Invalid plan id', 400)
  const plan = await findPlanById(dto.planId)
  if (!plan) throw error('not_found', 'Plan not found', 404)
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  const planSystem = String(plan.systemType || 'kermes')
  const tenantSystem = String(tenant.systemType || 'kermes')
  if (planSystem !== tenantSystem) throw error('plan_system_mismatch', 'Plan sistem tipi uyumsuz', 409)
  let startsAt = new Date()
  if (dto.startsAt) {
    if (typeof dto.startsAt === 'string') {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(dto.startsAt)
      const dmy = /^\d{2}\/\d{2}\/\d{4}$/.test(dto.startsAt)
      if (iso) {
        startsAt = new Date(`${dto.startsAt}T00:00:00.000Z`)
      } else if (dmy) {
        const [dd, mm, yyyy] = dto.startsAt.split('/')
        startsAt = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`)
      } else {
        const d = new Date(dto.startsAt)
        startsAt = isNaN(d.getTime()) ? new Date() : d
      }
    } else {
      const d = new Date(dto.startsAt)
      startsAt = isNaN(d.getTime()) ? new Date() : d
    }
  }
  const endsAt = plan.trialDays && plan.trialDays > 0 ? new Date(startsAt.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null
  const updated = await updateTenantById(tenantId, { planId: plan.id, planStartedAt: startsAt, planEndsAt: endsAt, status: 'active' })
  await auditLog(tenantId, actorUserId, 'tenant_plan_degisti', 'Tenant', tenantId, { planId: plan.id, planName: plan.name })
  return { success: true, planId: plan.id, planName: plan.name, planEndsAt: endsAt }
}

export const trialExtendService = async (tenantId, days, actorUserId) => {
  const t = await (await import('../repositories/tenantRepository.js')).findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const base = t.planEndsAt || new Date()
  const extended = new Date(base.getTime() + Math.max(1, Number(days) || 0) * 24 * 60 * 60 * 1000)
  await updateTenantById(tenantId, { planEndsAt: extended })
  await auditLog(tenantId, actorUserId, 'trial_uzatildi', 'Tenant', tenantId, { days })
  return { success: true, planEndsAt: extended }
}

export const trialEndService = async (tenantId, actorUserId) => {
  const now = new Date()
  const updated = await updateTenantById(tenantId, { planEndsAt: now })
  if (!updated) throw error('not_found', 'Tenant not found', 404)
  await auditLog(tenantId, actorUserId, 'trial_sonlandirildi', 'Tenant', tenantId, {})
  return { success: true, planEndsAt: now }
}

export const editTenantService = async (tenantId, dto, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const update = {}
  if (dto.name !== undefined) update.name = dto.name
  const updated = await updateTenantById(tenantId, update)
  if (dto.email !== undefined) {
    const owner = await User.findOne({ tenantId: tenantId, role: 'tenant_admin' })
    if (owner) {
      const taken = await User.exists({ email: dto.email, _id: { $ne: owner.id } })
      if (taken) throw error('email_taken', 'Bu e-posta zaten kullanılıyor', 400)
      await User.findByIdAndUpdate(owner.id, { email: dto.email }, { new: true })
    }
  }
  await auditLog(updated.id, actorUserId || null, 'uye_duzenlendi', 'Tenant', updated.id, { name: updated.name })
  const owner = await User.findOne({ tenantId: tenantId, role: 'tenant_admin' })
  return { id: updated.id, name: updated.name, slug: updated.slug, status: updated.status, isActive: updated.isActive, ownerEmail: owner?.email || null }
}

export const softDeleteTenantService = async (tenantId, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const updated = await updateTenantById(tenantId, { isActive: false, status: 'inactive' })
  await auditLog(updated.id, actorUserId || null, 'uye_silindi', 'Tenant', updated.id, {})
  return { id: updated.id, isActive: updated.isActive, status: updated.status }
}

export const hardDeleteTenantService = async (tenantId, actorUserId) => {
  let session
  try {
    session = await mongoose.startSession()
    session.startTransaction()
    await User.deleteMany({ tenantId }, { session })
    await Branch.deleteMany({ tenantId }, { session })
    await Table.deleteMany({ tenantId }, { session })
    await Category.deleteMany({ tenantId }, { session })
    await MenuItem.deleteMany({ tenantId }, { session })
    await Order.deleteMany({ tenantId }, { session })
    await PaymentSettings.deleteMany({ tenantId }, { session })
    await PaymentRequest.deleteMany({ tenantId }, { session })
    await Tenant.deleteOne({ _id: tenantId }, { session })
    await session.commitTransaction()
    await auditLog(tenantId, actorUserId || null, 'uye_tamamen_silindi', 'Tenant', tenantId, {})
    return { success: true }
  } catch (e) {
    try {
      if (session) await session.abortTransaction().catch(() => {})
    } catch {}
    try {
      await User.deleteMany({ tenantId })
      await Branch.deleteMany({ tenantId })
      await Table.deleteMany({ tenantId })
      await Category.deleteMany({ tenantId })
      await MenuItem.deleteMany({ tenantId })
      await Order.deleteMany({ tenantId })
      await PaymentSettings.deleteMany({ tenantId })
      await PaymentRequest.deleteMany({ tenantId })
      await Tenant.deleteOne({ _id: tenantId })
      await auditLog(tenantId, actorUserId || null, 'uye_tamamen_silindi', 'Tenant', tenantId, {})
      return { success: true }
    } catch (err2) {
      throw error('internal_error', err2.message || e.message || 'Internal error', 500)
    } finally {
      if (session) session.endSession()
    }
  } finally {
    if (session) session.endSession()
  }
}
