import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { error } from '../utils/errors.js'
import { listTenants, updateById as updateTenantById, findTenantById } from '../repositories/tenantRepository.js'
import { log as auditLog } from './auditService.js'
import { createPlan, listPlans, findPlanById, updatePlanById, deletePlanById } from '../repositories/planRepository.js'
import { ensurePlanMatchesTenant, findTrialPlanForSystemType } from './planService.js'
import User from '../models/User.js'
import Branch from '../models/Branch.js'
import Table from '../models/Table.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import Order from '../models/Order.js'
import PaymentSettings from '../models/PaymentSettings.js'
import PaymentRequest from '../models/PaymentRequest.js'
import Tenant from '../models/Tenant.js'
import CanteenBranch from '../modules/canteen/models/CanteenBranch.js'
import CanteenTenantSettings from '../modules/canteen/models/CanteenTenantSettings.js'
import { getPlanStatus, hasActiveSubscription } from './planService.js'
import { normalizeSystemType, resolvePlanPackageType, resolveTenantPackageType, toLegacySystemType } from '../utils/systemType.js'

const slugifyTenantName = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  return normalized || 'isletme'
}

const generateUniqueTenantSlug = async (name, packageType) => {
  const base = `${slugifyTenantName(name)}-${packageType === 'canteen' ? 'kantin' : 'restoran'}`
  let slug = base
  let counter = 2
  while (await Tenant.exists({ slug })) {
    slug = `${base}-${counter}`
    counter += 1
  }
  return slug
}

const normalizeBranchName = (value) => {
  const normalized = String(value || '').trim()
  return normalized || 'Merkez Sube'
}

const normalizeCanteenBranchKey = (value) =>
  normalizeBranchName(value).toLocaleLowerCase('tr-TR')

export const setPlatformUserPasswordService = async (userId, password, actorUserId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw error('invalid_request', 'Invalid user id', 400)
  const nextPassword = String(password || '')
  if (nextPassword.length < 8) throw error('validation_error', 'Password must be at least 8 characters', 400)
  const u = await User.findById(userId)
  if (!u) throw error('not_found', 'User not found', 404)
  const passwordHash = await bcrypt.hash(nextPassword, 10)
  u.passwordHash = passwordHash
  u.isActive = true
  await u.save()
  await auditLog(u.tenantId || null, actorUserId || null, 'platform_user_password_reset', 'User', u.id, { role: u.role })
  return { success: true, id: u.id }
}

export const createTenantWithOwnerService = async ({ name, ownerName, ownerEmail, ownerPassword, ownerPhone, systemType, description }) => {
  if (!name || !ownerName || !ownerEmail || !ownerPassword || !ownerPhone || !systemType) {
    throw error('validation_error', 'Missing required fields', 400)
  }
  if (String(ownerPassword || '').length < 6) {
    throw error('validation_error', 'Password must be at least 6 characters', 400)
  }

  const packageType = normalizeSystemType(systemType)
  const legacySystemType = toLegacySystemType(packageType)
  if (!packageType || !legacySystemType) {
    throw error('validation_error', 'Invalid system type', 400)
  }

  const normalizedOwnerEmail = String(ownerEmail || '').trim().toLowerCase()
  const existingUser = await User.findOne({ email: normalizedOwnerEmail, systemType: legacySystemType }).select('_id').lean()
  if (existingUser) {
    throw error('email_in_use', 'Bu e-posta ile bu sistem tipi için zaten üyelik var.', 409)
  }

  const trialPlan = await findTrialPlanForSystemType(packageType)
  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const slug = await generateUniqueTenantSlug(name, packageType)
  const branchName = normalizeBranchName(name)

  let session
  try {
    session = await mongoose.startSession()
    session.startTransaction()

    const tenant = new Tenant({
      name,
      slug,
      description: String(description || '').trim(),
      phone: String(ownerPhone || '').trim(),
      status: 'active',
      isActive: true,
      systemType: legacySystemType,
      vertical: packageType,
      businessType: packageType,
      planId: trialPlan._id,
      packageId: trialPlan._id,
      planStartedAt: now,
      planEndsAt: trialEndsAt,
      trialStartsAt: now,
      trialEndsAt,
      subscriptionStatus: 'trial'
    })
    await tenant.save({ session })

    let initialBranchId = null
    if (legacySystemType === 'kantin') {
      const canteenBranch = new CanteenBranch({
        tenantId: tenant._id,
        name: branchName,
        nameNormalized: normalizeCanteenBranchKey(branchName),
        description: '',
        isActive: true,
        createdAt: now
      })
      await canteenBranch.save({ session })

      initialBranchId = canteenBranch._id

      const canteenSettings = new CanteenTenantSettings({
        tenantId: tenant._id,
        defaultBranchId: canteenBranch._id,
        canteenAllowedBranchIds: [canteenBranch._id],
        canteenDefaultBranchId: canteenBranch._id,
        updatedAt: now
      })
      await canteenSettings.save({ session })
    } else {
      const branch = new Branch({ tenantId: tenant._id, name: branchName, address: '' })
      await branch.save({ session })
      initialBranchId = branch._id
      tenant.allowedBranchIds = [branch._id]
      await tenant.save({ session })
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 10)
    const user = new User({
      tenantId: tenant._id,
      branchId: initialBranchId,
      branchIds: initialBranchId ? [initialBranchId] : [],
      accessibleBranchIds: initialBranchId ? [initialBranchId] : [],
      name: ownerName,
      email: normalizedOwnerEmail,
      phone: String(ownerPhone || '').trim(),
      passwordHash,
      role: 'tenant_admin',
      isActive: true,
      systemType: legacySystemType
    })
    await user.save({ session })

    tenant.ownerUserId = user._id
    await tenant.save({ session })

    await session.commitTransaction()

    await auditLog(tenant.id, user.id, 'tenant_plan_degisti', 'Tenant', tenant.id, { planId: trialPlan.id, planName: trialPlan.name })
    await auditLog(tenant.id, user.id, 'tenant_olusturuldu', 'Tenant', tenant.id, { name, systemType: legacySystemType, vertical: packageType })
    await auditLog(tenant.id, user.id, 'tenant_admin_olusturuldu', 'User', user.id, { email: normalizedOwnerEmail, phone: ownerPhone })

    return {
      tenant: {
        _id: tenant.id,
        name: tenant.name,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        systemType: tenant.systemType,
        vertical: tenant.vertical,
        businessType: tenant.businessType,
        packageId: tenant.packageId,
        trialStartsAt: tenant.trialStartsAt,
        trialEndsAt: tenant.trialEndsAt,
        subscriptionStatus: tenant.subscriptionStatus,
        phone: tenant.phone || String(ownerPhone || '').trim()
      },
      owner: { _id: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role }
    }
  } catch (err) {
    try {
      if (session) await session.abortTransaction()
    } catch {}
    if (err && err.code === 11000) {
      if (String(err?.message || '').toLowerCase().includes('email')) throw error('email_in_use', 'E-posta zaten kullaniliyor', 409)
      throw error('slug_in_use', 'Slug zaten kullaniliyor', 409)
    }
    throw err
  } finally {
    if (session) session.endSession()
  }
}

export const listPlatformTenantsService = async (system) => {
  const list = await listTenants()
  const items = []
  for (const t of list) {
    let planName = null
    let planId = ''
    let hasMatchingPlan = false
    let ownerEmail = null
    let ownerPhone = null
    const tenantType = resolveTenantPackageType(t, normalizeSystemType(t.systemType, 'restaurant'))
    if (t.planId) {
      try {
        const p = await findPlanById(t.planId)
        const planType = resolvePlanPackageType(p, null)
        if (p && tenantType && planType && tenantType === planType) {
          planName = p?.name || null
          planId = String(p.id || p._id || '')
          hasMatchingPlan = true
        }
      } catch {}
    }
    try {
      const owner = await User.findOne({ tenantId: t.id, role: 'tenant_admin' })
      ownerEmail = owner?.email || null
      ownerPhone = owner?.phone || null
    } catch {}
    const planStatus = getPlanStatus(t)
    const isActivePlan = hasActiveSubscription(t)
    items.push({
      _id: t.id,
      name: t.name,
      isActive: t.isActive,
      createdAt: t.createdAt,
      planName: isActivePlan ? planName : null,
      packageName: isActivePlan ? planName : null,
      expiredPlanName: !isActivePlan ? planName : null,
      ownerEmail,
      ownerPhone,
      phone: t.phone || ownerPhone || '',
      systemType: t.systemType,
      vertical: t.vertical || normalizeSystemType(t.systemType, 'restaurant'),
      subscriptionStatus: t.subscriptionStatus || 'inactive',
      planStatus: hasMatchingPlan ? planStatus : 'inactive',
      planStartedAt: t.planStartedAt || t.trialStartsAt || null,
      planEndsAt: t.planEndsAt || t.trialEndsAt || null,
      currentPlanId: isActivePlan && hasMatchingPlan ? planId : '',
      currentPlanName: isActivePlan ? planName : null,
      packageStatus: hasMatchingPlan ? (isActivePlan ? 'active' : (planName ? 'expired' : 'none')) : 'none'
    })
  }
  const normalized = String(system || '').trim().toLowerCase()
  if (normalized === 'kermes') return items.filter((i) => i.systemType === 'kermes')
  if (normalized === 'canteen') return items.filter((i) => i.systemType === 'kantin')
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
  const systemType = normalizeSystemType(systemTypeRaw)
  if (!systemType) throw error('invalid_request', 'systemType zorunlu', 400)
  const data = {
    systemType,
    packageType: systemType,
    vertical: systemType,
    name: dto.name,
    price: Number(dto.price) || 0,
    limits: { products: dto.limits?.products ?? -1, tables: dto.limits?.tables ?? -1, staff: dto.limits?.staff ?? -1 },
    features: { reports: !!dto.features?.reports, kitchen: !!dto.features?.kitchen },
    trialDays: Number(dto.trialDays) || 0,
    isTrial: dto.isTrial !== undefined ? !!dto.isTrial : false,
    isActive: dto.isActive !== undefined ? !!dto.isActive : true
  }
  const p = await createPlan(data)
  await auditLog(null, actorUserId || null, 'plan_olusturuldu', 'Plan', p.id, { name: p.name })
  return { _id: p.id, systemType: normalizeSystemType(p.systemType, systemType), packageType: resolvePlanPackageType(p), vertical: resolvePlanPackageType(p), type: resolvePlanPackageType(p), name: p.name, price: p.price, limits: p.limits, features: p.features, trialDays: p.trialDays, isTrial: p.isTrial === true, isActive: p.isActive }
}

export const listPlansService = async (systemTypeFilter) => {
  const normalized = normalizeSystemType(systemTypeFilter) || String(systemTypeFilter || '').trim().toLowerCase()
  const list = await listPlans()
  return list.map((p) => ({
    _id: p.id,
    systemType: normalizeSystemType(p.systemType || resolvePlanPackageType(p), 'restaurant'),
    packageType: resolvePlanPackageType(p, 'restaurant'),
    vertical: resolvePlanPackageType(p, 'restaurant'),
    type: resolvePlanPackageType(p, 'restaurant'),
    name: p.name,
    price: p.price,
    limits: p.limits,
    features: p.features,
    trialDays: p.trialDays,
    isTrial: p.isTrial === true,
    isActive: p.isActive
  })).filter((p) => {
    if (!normalized) return true
    if (normalized === 'restaurant' || normalized === 'canteen') return resolvePlanPackageType(p, p.systemType) === normalized
    if (normalized === 'kermes' || normalized === 'kantin') return toLegacySystemType(p.systemType, p.systemType) === normalized
    throw error('invalid_request', 'Invalid systemType filter', 400)
  })
}

export const listPlansForTenantService = async (tenantId, systemTypeOverride = null) => {
  if (!mongoose.isValidObjectId(tenantId)) throw error('validation_error', 'Invalid tenant id', 400)
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant bulunamadı', 404)
  const tenantType = resolveTenantPackageType(tenant)
  if (!tenantType) throw error('invalid_request', 'Tenant tipi belirlenemedi', 400)
  const requestedType = normalizeSystemType(systemTypeOverride)
  if (requestedType && requestedType !== tenantType) return []
  return listPlansService(requestedType || tenantType)
}

export const updatePlanService = async (id, dto, actorUserId) => {
  const update = {}
  if (dto.systemType !== undefined) {
    const st = normalizeSystemType(dto.systemType)
    if (!st) throw error('invalid_request', 'Invalid systemType', 400)
    update.systemType = st
    update.packageType = st
    update.vertical = st
  }
  if (dto.packageType !== undefined || dto.vertical !== undefined) {
    const packageType = normalizeSystemType(dto.packageType || dto.vertical)
    if (!packageType) throw error('invalid_request', 'Invalid packageType', 400)
    update.packageType = packageType
    update.vertical = packageType
  }
  if (dto.name !== undefined) update.name = dto.name
  if (dto.price !== undefined) update.price = Number(dto.price) || 0
  if (dto.limits) update.limits = { products: dto.limits.products ?? -1, tables: dto.limits.tables ?? -1, staff: dto.limits.staff ?? -1 }
  if (dto.features) update.features = { reports: !!dto.features.reports, kitchen: !!dto.features.kitchen }
  if (dto.trialDays !== undefined) update.trialDays = Number(dto.trialDays) || 0
  if (dto.isTrial !== undefined) update.isTrial = !!dto.isTrial
  if (dto.isActive !== undefined) update.isActive = !!dto.isActive
  const p = await updatePlanById(id, update)
  if (!p) throw error('not_found', 'Plan not found', 404)
  await auditLog(null, actorUserId || null, 'plan_guncellendi', 'Plan', p.id, {})
  return { _id: p.id, systemType: normalizeSystemType(p.systemType, 'restaurant'), packageType: resolvePlanPackageType(p), vertical: resolvePlanPackageType(p), type: resolvePlanPackageType(p), name: p.name, price: p.price, limits: p.limits, features: p.features, trialDays: p.trialDays, isTrial: p.isTrial === true, isActive: p.isActive }
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
  if (!plan.isActive) throw error('plan_inactive', 'Plan aktif degil', 400)
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  ensurePlanMatchesTenant(tenant, plan)
  let startsAt = new Date()
  if (dto.startsAt) {
    if (typeof dto.startsAt === 'string') {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(dto.startsAt)
      const dmy = /^\d{2}\/\d{2}\/\d{4}$/.test(dto.startsAt)
      if (iso) startsAt = new Date(`${dto.startsAt}T00:00:00.000Z`)
      else if (dmy) {
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
  await updateTenantById(tenantId, {
    planId: plan.id,
    packageId: plan.id,
    planStartedAt: startsAt,
    planEndsAt: endsAt,
    trialStartsAt: plan.isTrial ? startsAt : null,
    trialEndsAt: plan.isTrial ? endsAt : null,
    subscriptionStatus: plan.isTrial ? 'trial' : 'active',
    status: 'active'
  })
  await auditLog(tenantId, actorUserId, 'tenant_plan_degisti', 'Tenant', tenantId, { planId: plan.id, planName: plan.name })
  return { success: true, planId: plan.id, planName: plan.name, planEndsAt: endsAt }
}

export const trialExtendService = async (tenantId, days, actorUserId) => {
  const t = await (await import('../repositories/tenantRepository.js')).findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const base = t.planEndsAt || t.trialEndsAt || new Date()
  const extended = new Date(base.getTime() + Math.max(1, Number(days) || 0) * 24 * 60 * 60 * 1000)
  await updateTenantById(tenantId, { planEndsAt: extended, trialEndsAt: extended, subscriptionStatus: 'trial' })
  await auditLog(tenantId, actorUserId, 'trial_uzatildi', 'Tenant', tenantId, { days })
  return { success: true, planEndsAt: extended }
}

export const trialEndService = async (tenantId, actorUserId) => {
  const now = new Date()
  const updated = await updateTenantById(tenantId, { planEndsAt: now, trialEndsAt: now, subscriptionStatus: 'expired' })
  if (!updated) throw error('not_found', 'Tenant not found', 404)
  await auditLog(tenantId, actorUserId, 'trial_sonlandirildi', 'Tenant', tenantId, {})
  return { success: true, planEndsAt: now }
}

export const editTenantService = async (tenantId, dto, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const update = {}
  if (dto.name !== undefined) update.name = dto.name
  if (dto.phone !== undefined) update.phone = String(dto.phone || '').trim()
  const updated = await updateTenantById(tenantId, update)
  if (dto.email !== undefined || dto.phone !== undefined) {
    const owner = await User.findOne({ tenantId, role: 'tenant_admin' })
    if (owner) {
      if (dto.email !== undefined) {
        const nextEmail = String(dto.email || '').trim().toLowerCase()
        const taken = await User.exists({ email: nextEmail, systemType: owner.systemType || t.systemType || null, _id: { $ne: owner.id } })
        if (taken) throw error('email_taken', 'Bu e-posta zaten kullaniliyor', 400)
      }
      await User.findByIdAndUpdate(owner.id, { ...(dto.email !== undefined ? { email: String(dto.email || '').trim().toLowerCase() } : {}), ...(dto.phone !== undefined ? { phone: String(dto.phone || '').trim() } : {}) }, { new: true })
    }
  }
  await auditLog(updated.id, actorUserId || null, 'uye_duzenlendi', 'Tenant', updated.id, { name: updated.name })
  const owner = await User.findOne({ tenantId, role: 'tenant_admin' })
  return { id: updated.id, name: updated.name, slug: updated.slug, status: updated.status, isActive: updated.isActive, ownerEmail: owner?.email || null, ownerPhone: owner?.phone || updated.phone || null, phone: updated.phone || owner?.phone || null }
}

export const softDeleteTenantService = async (tenantId, actorUserId) => {
  const t = await findTenantById(tenantId)
  if (!t) throw error('not_found', 'Tenant not found', 404)
  const updated = await updateTenantById(tenantId, { isActive: false, status: 'inactive', subscriptionStatus: 'inactive' })
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
    try { if (session) await session.abortTransaction().catch(() => {}) } catch {}
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
