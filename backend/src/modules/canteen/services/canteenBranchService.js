import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as repo from '../repositories/canteenBranchRepository.js'
import { findTenantSettings, upsertTenantSettings } from '../repositories/canteenSettingsRepository.js'
import User from '../../../models/User.js'
import { findTenantById } from '../../../repositories/tenantRepository.js'

const normalizeName = (name) => String(name || '').trim()
const normalizeKey = (name) => normalizeName(name).toLowerCase()
const slugifyCompactName = (name) => normalizeName(name)
  .toLocaleLowerCase('tr-TR')
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
  .replace(/[^a-z0-9]+/g, '')

export const buildBranchPublicSlugBase = (branchName, tenantName) => {
  const branchPart = slugifyCompactName(branchName) || 'sube'
  const tenantPart = slugifyCompactName(tenantName) || 'firma'
  return `${branchPart}-${tenantPart}`
}

export const ensureUniqueBranchPublicSlug = async ({ tenantName, branchName, branchId = null }) => {
  const base = buildBranchPublicSlugBase(branchName, tenantName)
  let candidate = base
  let counter = 2
  while (true) {
    const existing = await repo.findAnyByPublicSlug(candidate)
    if (!existing || String(existing.id || existing._id || '') === String(branchId || '')) return candidate
    candidate = `${base}-${counter}`
    counter += 1
  }
}

export const ensureBranchPublicSlugs = async (tenantId, tenantName, branches = []) => {
  const items = Array.isArray(branches) ? branches : []
  const next = []
  for (const branch of items) {
    const currentSlug = String(branch?.publicSlug || '').trim()
    const shouldRefreshSlug = !currentSlug || currentSlug === `${slugifyCompactName(branch?.name) || 'sube'}-kantin`
    if (!shouldRefreshSlug) {
      next.push(branch)
      continue
    }
    const publicSlug = await ensureUniqueBranchPublicSlug({
      tenantName,
      branchName: branch?.name,
      branchId: branch?.id || branch?._id || null
    })
    await repo.updateByIdAndTenant(branch.id || branch._id, tenantId, { publicSlug })
    next.push({ ...branch, publicSlug })
  }
  return next
}

export const listBranches = async (tenantId, user) => {
  const tenant = await findTenantById(tenantId)
  const tenantName = String(tenant?.name || '').trim()

  if (user?.role === 'tenant_admin') {
    const items = await ensureBranchPublicSlugs(tenantId, tenantName, await repo.listAllByTenant(tenantId))
    return items.map((b) => ({ id: b.id, name: b.name, publicSlug: b.publicSlug || '', description: b.description || '', isActive: b.isActive !== false }))
  }

  const st = await findTenantSettings(tenantId)
  const tenantAllowed = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
  const staffAllowed = Array.isArray(user?.branchIds) ? user.branchIds.map(String).filter(Boolean) : []
  if (tenantAllowed.length === 0) return []
  const ids = tenantAllowed.length > 0
    ? staffAllowed.filter((id) => tenantAllowed.includes(String(id)))
    : staffAllowed

  const items = ids.length > 0
    ? await ensureBranchPublicSlugs(tenantId, tenantName, await repo.listActiveByIdsAndTenant(ids, tenantId))
    : []
  return items.map((b) => ({ id: b.id, name: b.name, publicSlug: b.publicSlug || '', description: b.description || '', isActive: b.isActive !== false }))
}

export const createBranch = async (tenantId, actorUserId, input) => {
  const name = normalizeName(input?.name)
  if (!name) throw error('name_required', 'Åube adÄ± zorunludur', 400)
  const tenant = await findTenantById(tenantId)
  const publicSlug = await ensureUniqueBranchPublicSlug({ tenantName: tenant?.name, branchName: name })
  const branch = await repo.create({
    tenantId,
    name,
    nameNormalized: normalizeKey(name),
    publicSlug,
    description: String(input?.description || '').trim(),
    isActive: true,
    createdAt: new Date(),
    actorUserId
  })
  return { id: branch.id, name: branch.name, publicSlug: branch.publicSlug || publicSlug, description: branch.description || '', isActive: !!branch.isActive }
}

export const updateBranch = async (tenantId, actorUserId, branchId, input) => {
  const update = {}
  if (input?.name !== undefined) {
    const name = normalizeName(input?.name)
    if (!name) throw error('name_required', 'Åube adÄ± zorunludur', 400)
    const tenant = await findTenantById(tenantId)
    update.name = name
    update.nameNormalized = normalizeKey(name)
    update.publicSlug = await ensureUniqueBranchPublicSlug({ tenantName: tenant?.name, branchName: name, branchId })
  }
  if (input?.description !== undefined) update.description = String(input?.description || '').trim()
  const updated = await repo.updateByIdAndTenant(branchId, tenantId, { ...update, actorUserId })
  if (!updated) throw error('not_found', 'Åube bulunamadÄ±', 404)
  return { id: updated.id, name: updated.name, publicSlug: updated.publicSlug || '', description: updated.description || '', isActive: !!updated.isActive }
}

export const updateBranchStatus = async (tenantId, actorUserId, branchId, input) => {
  const isActive = input?.isActive
  if (isActive !== true && isActive !== false) throw error('invalid_request', 'isActive zorunlu', 400)
  const updated = await repo.updateByIdAndTenant(branchId, tenantId, { isActive: !!isActive, actorUserId })
  if (!updated) throw error('not_found', 'Åube bulunamadÄ±', 404)

  if (updated.isActive === false) {
    try {
      const st = await findTenantSettings(tenantId)
      const allowed = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
      const nextAllowed = allowed.filter((id) => String(id) !== String(updated.id))
      const currentDefault = st?.canteenDefaultBranchId
        ? String(st.canteenDefaultBranchId)
        : (st?.defaultBranchId ? String(st.defaultBranchId) : null)
      const nextDefault = currentDefault === String(updated.id)
        ? (nextAllowed[0] || null)
        : currentDefault
      if (allowed.length > 0) {
        await upsertTenantSettings(tenantId, {
          canteenAllowedBranchIds: nextAllowed,
          canteenDefaultBranchId: nextDefault,
          defaultBranchId: nextDefault
        })
      }
    } catch {
    }
  }
  return { id: updated.id, name: updated.name, publicSlug: updated.publicSlug || '', description: updated.description || '', isActive: updated.isActive !== false }
}

export const getBranchStaff = async (tenantId, branchId) => {
  if (!mongoose.isValidObjectId(branchId)) throw error('invalid_request', 'Invalid branch id', 400)
  const branch = await repo.findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) throw error('not_found', 'Åube bulunamadÄ±', 404)

  const staff = await User.find({ tenantId, role: 'staff', systemType: 'kantin' }).sort({ createdAt: -1 })
  const assigned = staff
    .filter((s) => Array.isArray(s.branchIds) && s.branchIds.map(String).includes(String(branchId)))
    .map((s) => String(s.id))

  return {
    branchId: String(branch.id),
    staff: staff.map((s) => ({ id: String(s.id), name: s.name, email: s.email, isActive: s.isActive !== false })),
    assignedStaffIds: assigned
  }
}

export const setBranchStaff = async (tenantId, actorUserId, branchId, input) => {
  if (!mongoose.isValidObjectId(branchId)) throw error('invalid_request', 'Invalid branch id', 400)
  const branch = await repo.findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) throw error('not_found', 'Åube bulunamadÄ±', 404)

  const staffIds = Array.isArray(input?.staffIds) ? input.staffIds.map(String).map((s) => s.trim()).filter(Boolean) : []
  for (const id of staffIds) {
    if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Invalid staff id', 400)
  }

  const staff = await User.find({ tenantId, role: 'staff', systemType: 'kantin' }, { _id: 1 }).lean()
  const allStaffIds = (staff || []).map((s) => String(s._id))
  const selected = Array.from(new Set(staffIds))
  const selectedSet = new Set(selected)
  const missing = selected.filter((id) => !allStaffIds.includes(id))
  if (missing.length > 0) throw error('invalid_request', 'Staff tenantâ€™a ait deÄŸil', 400)

  const toRemove = allStaffIds.filter((id) => !selectedSet.has(id))

  if (selected.length > 0) {
    await User.updateMany(
      { _id: { $in: selected }, tenantId, role: 'staff', systemType: 'kantin' },
      { $addToSet: { branchIds: branch.id } }
    )
  }
  if (toRemove.length > 0) {
    await User.updateMany(
      { _id: { $in: toRemove }, tenantId, role: 'staff', systemType: 'kantin' },
      { $pull: { branchIds: branch.id } }
    )
  }

  return getBranchStaff(tenantId, branchId)
}

export const removeBranch = async (tenantId, actorUserId, branchId) => {
  const deleted = await repo.softDeleteByIdAndTenant(branchId, tenantId)
  if (!deleted) throw error('not_found', 'Åube bulunamadÄ±', 404)
  return { success: true, id: deleted.id, actorUserId }
}
