import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { error } from '../utils/errors.js'
import User from '../models/User.js'
import { createTenant, listTenants, findTenantById, updateById as updateTenantById } from '../repositories/tenantRepository.js'
import { findPlanById } from '../repositories/planRepository.js'
import { createUser } from '../repositories/userRepository.js'
import { getPlanStatus, getPlanDaysLeft } from './planService.js'
import { log as auditLog } from './auditService.js'
import { normalizeSystemType, resolveTenantPackageType, toLegacySystemType } from '../utils/systemType.js'

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

export const createTenantService = async ({ name, slug, systemType }, actorUserId) => {
  if (!name || !slug) throw error('validation_error', 'name and slug required', 400)
  const packageType = normalizeSystemType(systemType, 'restaurant')
  const legacySystemType = toLegacySystemType(packageType, 'kermes')
  let tenant
  try {
    tenant = await createTenant({
      name,
      slug,
      systemType: legacySystemType,
      vertical: packageType,
      businessType: packageType
    })
  } catch (err) {
    if (err && err.code === 11000) {
      throw error('slug_in_use', 'Slug zaten kullanılıyor', 409)
    }
    throw err
  }
  await auditLog(tenant.id, actorUserId || null, 'tenant_olusturuldu', 'Tenant', tenant.id, { name, systemType: legacySystemType, vertical: packageType })
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    isActive: tenant.isActive,
    systemType: tenant.systemType,
    vertical: tenant.vertical,
    businessType: tenant.businessType
  }
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
      systemType: t.systemType,
      vertical: t.vertical,
      businessType: t.businessType,
      createdAt: t.createdAt,
      plan: await buildPlanDto(t)
    })
  }
  return items
}

export const createTenantAdminService = async (tenantId, { name, email, password }) => {
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  const tenantSystemType = resolveTenantPackageType(tenant)
  const legacySystemType = toLegacySystemType(tenantSystemType, 'kermes')
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await createUser({
    tenantId: tenant.id,
    name,
    email,
    passwordHash,
    role: 'tenant_admin',
    isActive: true,
    systemType: legacySystemType
  })
  await auditLog(tenant.id, null, 'tenant_admin_olusturuldu', 'User', user.id, { email, role: 'tenant_admin', systemType: legacySystemType })
  return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, systemType: user.systemType }
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

export const listAnaokuluRegionAdminsService = async () => {
  let items = []
  let usedFallback = false
  try {
    items = await User.find({
      role: 'anaokulu_region_admin',
      regionSystemType: 'anaokulu',
      isDeleted: { $ne: true }
    }).sort({ createdAt: -1 }).select('_id name email phone isActive status createdAt accessibleTenantIds').lean()
  } catch (e) {
    usedFallback = true
    try {
      items = await User.find({
        role: 'anaokulu_region_admin',
        isDeleted: { $ne: true }
      }).sort({ createdAt: -1 }).select('_id name email phone isActive status createdAt accessibleTenantIds role regionSystemType').lean()
      items = items.filter(u => {
        const rs = String(u?.regionSystemType || '').trim().toLowerCase()
        const r = String(u?.role || '').trim()
        const okRegion = !u.regionSystemType || rs === 'anaokulu'
        const okRole = !u.role || r === 'anaokulu_region_admin'
        return okRegion && okRole
      })
    } catch (e2) {
      const err = error('server_error', (e?.message || e2?.message || 'Okul süper adminleri listelenemedi.') + (usedFallback ? ' [fb]' : ''), 500)
      err.cause = { msg1: String(e?.message || ''), msg2: String(e2?.message || '') }
      throw err
    }
  }
  const results = []
  for (const u of items || []) {
    let tids = []
    try {
      const rawTids = Array.isArray(u.accessibleTenantIds) ? u.accessibleTenantIds : []
      for (const id of rawTids) {
        const s = typeof id === 'object' && id?._bsontype === 'ObjectId'
          ? String(id)
          : String(id || '').trim()
        if (!s) continue
        if (!mongoose.Types.ObjectId.isValid(s)) continue
        tids.push(s)
      }
    } catch {
      tids = []
    }
    const names = []
    for (const tid of tids) {
      try {
        if (!mongoose.Types.ObjectId.isValid(tid)) continue
        const t = await findTenantById(tid).catch(() => null)
        if (t) names.push(String(t.name || ''))
      } catch {}
    }
    let idStr = ''
    try { idStr = String(u?._id || u?.id || '') } catch { idStr = '' }
    let statusStr = 'active'
    try {
      if (u?.isActive === false || u?.status === 'inactive') statusStr = 'inactive'
    } catch {}
    results.push({
      id: idStr,
      _id: idStr,
      name: String(u?.name || ''),
      email: String(u?.email || ''),
      phone: String(u?.phone || ''),
      isActive: u?.isActive !== false,
      status: statusStr,
      createdAt: u?.createdAt || null,
      accessibleTenantIds: tids,
      accessibleTenantNames: names.filter(Boolean)
    })
  }
  return results
}

export const createAnaokuluRegionAdminService = async ({ name, email, password, phone, accessibleTenantIds }, actorUserId) => {
  const safeName = String(name || '').trim()
  const safeEmail = String(email || '').trim().toLowerCase()
  const safePassword = String(password || '')
  const safePhone = String(phone || '').trim()
  const rawIds = Array.isArray(accessibleTenantIds) ? accessibleTenantIds : []

  if (!safeName || !safeEmail || !safePassword) {
    throw error('validation_error', 'Ad, e-posta ve şifre zorunlu.', 400)
  }
  if (safePassword.length < 6) {
    throw error('validation_error', 'Şifre en az 6 karakter olmalı.', 400)
  }

  const normalizedIds = []
  const seen = new Set()
  for (const id of rawIds) {
    const s = String(id || '').trim()
    if (!s || seen.has(s)) continue
    if (!mongoose.Types.ObjectId.isValid(s)) {
      throw error('invalid_request', `Geçersiz anaokulu ID formatı: ${s}`, 400)
    }
    let t = null
    try {
      t = await findTenantById(s)
    } catch (e) {
      throw error('not_found', `Geçersiz anaokulu: ${s}`, 404)
    }
    if (!t) throw error('not_found', `Geçersiz anaokulu: ${s}`, 404)
    let tenantPkg = 'unknown'
    try {
      tenantPkg = typeof resolveTenantPackageType === 'function' ? resolveTenantPackageType(t) : 'unknown'
    } catch {
      tenantPkg = 'unknown'
    }
    const isAnaokulu = tenantPkg === 'anaokulu'
      || String(t?.systemType || '').trim().toLowerCase() === 'anaokulu'
      || String(t?.vertical || '').trim().toLowerCase() === 'anaokulu'
      || String(t?.businessType || '').trim().toLowerCase() === 'anaokulu'
    if (!isAnaokulu) {
      throw error('invalid_request', 'Sadece anaokulu tipindeki üyeler atanabilir.', 400)
    }
    seen.add(s)
    try {
      normalizedIds.push(new mongoose.Types.ObjectId(String(t._id || s)))
    } catch {
      normalizedIds.push(String(t._id || s))
    }
  }
  if (normalizedIds.length === 0) {
    throw error('validation_error', 'En az 1 anaokulu seçiniz.', 400)
  }

  let existing = null
  try {
    existing = await User.findOne({
      email: safeEmail,
      $or: [
        { regionSystemType: 'anaokulu' },
        { systemType: { $in: ['kermes', 'kantin', 'anaokulu'] } }
      ]
    }).select('email systemType regionSystemType role name').lean()
  } catch {
    existing = null
  }
  if (existing) {
    const portalLabel = existing.regionSystemType === 'anaokulu'
      ? `Okul Süper Admin (${existing.role})`
      : `${existing.systemType === 'kantin' ? 'Mağaza' : existing.systemType === 'anaokulu' ? 'Anaokulu' : existing.systemType === 'kermes' ? 'Restoran' : String(existing.systemType || 'Bilinmiyor')} portalinda (${existing.role || 'kullanici'})`
    const detail = existing.name ? ` (${existing.name})` : ''
    throw error(
      'email_in_use',
      `Bu e-posta ${portalLabel}${detail} için zaten kayıtlı. Farklı bir e-posta kullanabilir veya +alias kullanabilirsiniz (örnek: ${safeEmail.replace('@', '+bolge@')}).`,
      409
    )
  }

  let passwordHash = ''
  try {
    passwordHash = await bcrypt.hash(safePassword, 10)
  } catch (e) {
    throw error('server_error', 'Şifre hashlenemedi: ' + String(e?.message || ''), 500)
  }
  let user = null
  try {
    user = await createUser({
      tenantId: null,
      branchId: null,
      branchIds: [],
      accessibleBranchIds: [],
      accessibleTenantIds: normalizedIds,
      regionSystemType: 'anaokulu',
      systemType: null,
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      passwordHash,
      role: 'anaokulu_region_admin',
      isActive: true,
      status: 'active'
    })
  } catch (e) {
    if (e && e.name === 'MongoServerError' && e.code === 11000) {
      throw error('email_in_use', 'Bu e-posta ile zaten bir üyelik var.', 409)
    }
    if (e && e.name === 'ValidationError') {
      const vmsg = Object.values(e.errors || {}).map(x => String(x?.message || x || '')).join(', ')
      throw error('validation_error', vmsg || 'Geçerli olmayan alanlar var.', 400)
    }
    if (e && (e.name === 'CastError' || /Cast to ObjectId failed|enum value failed|`regionSystemType`|`role`|`isActive`|`status`|MissingSchemaError|Schema hasn't been registered/i.test(String(e.message || '')))) {
      throw error('validation_error', 'Geçerli olmayan alanlar var. (' + String(e?.message || '').slice(0, 120) + ')', 400)
    }
    throw error('server_error', e?.message || 'Kullanıcı oluşturulamadı.', 500)
  }
  if (!user) throw error('server_error', 'Kullanıcı oluşturulamadı.', 500)
  try {
    await auditLog(null, actorUserId || null, 'anaokulu_bolge_yoneticisi_olusturuldu', 'User', String(user.id || user._id || ''), {
      email: safeEmail,
      accessibleTenantIds: normalizedIds.map(String)
    })
  } catch {
  }
  return {
    id: String(user.id || user._id || ''),
    _id: String(user.id || user._id || ''),
    name: user.name || safeName,
    email: user.email || safeEmail,
    phone: user.phone || safePhone,
    role: user.role || 'anaokulu_region_admin',
    regionSystemType: user.regionSystemType || 'anaokulu',
    accessibleTenantIds: normalizedIds.map(String),
    isActive: user.isActive !== false
  }
}

export const updateAnaokuluRegionAdminService = async (userId, { name, email, phone, password, accessibleTenantIds, isActive }, actorUserId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw error('invalid_request', 'Geçersiz kullanıcı.', 400)
  const user = await User.findById(userId)
  if (!user || user.role !== 'anaokulu_region_admin') throw error('not_found', 'Okul süper admin bulunamadı.', 404)

  const patch = {}
  if (name !== undefined) patch.name = String(name || '').trim()
  if (email !== undefined) patch.email = String(email || '').trim().toLowerCase()
  if (phone !== undefined) patch.phone = String(phone || '').trim()
  if (isActive !== undefined) {
    patch.isActive = Boolean(isActive)
    patch.status = Boolean(isActive) ? 'active' : 'inactive'
  }
  if (password !== undefined && String(password || '').length > 0) {
    const pw = String(password || '')
    if (pw.length < 6) throw error('validation_error', 'Şifre en az 6 karakter olmalı.', 400)
    patch.passwordHash = await bcrypt.hash(pw, 10)
  }
  if (accessibleTenantIds !== undefined) {
    const rawIds = Array.isArray(accessibleTenantIds) ? accessibleTenantIds : []
    const normalizedIds = []
    const seen = new Set()
    for (const id of rawIds) {
      const s = String(id || '').trim()
      if (!s || seen.has(s)) continue
      if (!mongoose.Types.ObjectId.isValid(s)) {
        throw error('invalid_request', `Geçersiz anaokulu ID formatı: ${s}`, 400)
      }
      let t = null
      try {
        t = await findTenantById(s)
      } catch (e) {
        throw error('not_found', `Geçersiz anaokulu: ${s}`, 404)
      }
      if (!t) throw error('not_found', `Geçersiz anaokulu: ${s}`, 404)
      const tenantPkg = resolveTenantPackageType(t)
      const isAnaokulu = tenantPkg === 'anaokulu' || t.systemType === 'anaokulu' || t.vertical === 'anaokulu' || t.businessType === 'anaokulu'
      if (!isAnaokulu) {
        throw error('invalid_request', 'Sadece anaokulu tipindeki üyeler atanabilir.', 400)
      }
      seen.add(s)
      normalizedIds.push(t._id || s)
    }
    if (normalizedIds.length === 0) throw error('validation_error', 'En az 1 anaokulu seçiniz.', 400)
    patch.accessibleTenantIds = normalizedIds
  }

  if (patch.email && patch.email !== user.email) {
    const existing = await User.findOne({
      _id: { $ne: user._id },
      email: patch.email,
      $or: [
        { regionSystemType: 'anaokulu' },
        { systemType: { $in: ['kermes', 'kantin', 'anaokulu'] } }
      ]
    }).select('_id').lean()
    if (existing) throw error('email_in_use', 'Bu e-posta ile zaten bir üyelik var.', 409)
  }

  let updated = null
  try {
    updated = await User.findByIdAndUpdate(userId, patch, { new: true }).select('_id name email phone role regionSystemType accessibleTenantIds isActive status')
  } catch (e) {
    if (e && e.name === 'MongoServerError' && e.code === 11000) {
      throw error('email_in_use', 'Bu e-posta ile zaten bir üyelik var.', 409)
    }
    if (e && e.name === 'ValidationError') {
      const vmsg = Object.values(e.errors || {}).map(x => String(x?.message || x || '')).join(', ')
      throw error('validation_error', vmsg || 'Gecerli olmayan alanlar var.', 400)
    }
    if (e && (e.name === 'CastError' || /Cast to ObjectId failed|enum value failed/i.test(String(e.message || '')))) {
      throw error('validation_error', 'Gecerli olmayan alanlar var.', 400)
    }
    throw error('server_error', e?.message || 'Okul süper admin güncellenemedi.', 500)
  }
  try {
    await auditLog(null, actorUserId || null, 'anaokulu_bolge_yoneticisi_guncellendi', 'User', String(updated?._id || userId), {})
  } catch {}
  return {
    id: String(updated?._id || userId),
    _id: String(updated?._id || userId),
    name: updated?.name || user?.name,
    email: updated?.email || user?.email,
    phone: updated?.phone || user?.phone,
    role: updated?.role || 'anaokulu_region_admin',
    regionSystemType: updated?.regionSystemType || 'anaokulu',
    accessibleTenantIds: Array.isArray(updated?.accessibleTenantIds) ? updated.accessibleTenantIds.map(String) : [],
    isActive: updated?.isActive !== false,
    status: updated?.status || 'active'
  }
}

export const deleteAnaokuluRegionAdminService = async (userId, actorUserId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw error('invalid_request', 'Geçersiz kullanıcı.', 400)
  let updated = null
  try {
    updated = await User.findByIdAndUpdate(userId, {
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
      status: 'inactive'
    }, { new: true }).select('_id')
  } catch (e) {
    if (e && (e.name === 'CastError' || /Cast to ObjectId failed/i.test(String(e.message || '')))) {
      throw error('not_found', 'Okul süper admin bulunamadı.', 404)
    }
    throw error('server_error', e?.message || 'Okul süper admin silinemedi.', 500)
  }
  try {
    await auditLog(null, actorUserId || null, 'anaokulu_bolge_yoneticisi_silindi', 'User', String(updated?._id || userId), {})
  } catch {}
  return { success: true, id: String(updated?._id || userId) }
}
