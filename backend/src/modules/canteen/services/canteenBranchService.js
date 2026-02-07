import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as repo from '../repositories/canteenBranchRepository.js'
import { findTenantSettings, upsertTenantSettings } from '../repositories/canteenSettingsRepository.js'
import User from '../../../models/User.js'

const normalizeName = (name) => String(name || '').trim()
const normalizeKey = (name) => normalizeName(name).toLowerCase()

export const listBranches = async (tenantId, user) => {
  if (user?.role === 'tenant_admin') {
    const items = await repo.listAllByTenant(tenantId)
    return items.map(b => ({ id: b.id, name: b.name, description: b.description || '', isActive: b.isActive !== false }))
  }

  const st = await findTenantSettings(tenantId)
  const tenantAllowed = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
  const staffAllowed = Array.isArray(user?.branchIds) ? user.branchIds.map(String).filter(Boolean) : []
  if (tenantAllowed.length === 0) return []
  const ids = tenantAllowed.length > 0
    ? staffAllowed.filter(id => tenantAllowed.includes(String(id)))
    : staffAllowed

  const items = ids.length > 0 ? await repo.listActiveByIdsAndTenant(ids, tenantId) : []
  return items.map(b => ({ id: b.id, name: b.name, description: b.description || '', isActive: b.isActive !== false }))
}

export const createBranch = async (tenantId, actorUserId, input) => {
  const name = normalizeName(input?.name)
  if (!name) throw error('name_required', 'Şube adı zorunludur', 400)
  const branch = await repo.create({
    tenantId,
    name,
    nameNormalized: normalizeKey(name),
    description: String(input?.description || '').trim(),
    isActive: true,
    createdAt: new Date(),
    actorUserId
  })
  return { id: branch.id, name: branch.name, description: branch.description || '', isActive: !!branch.isActive }
}

export const updateBranch = async (tenantId, actorUserId, branchId, input) => {
  const update = {}
  if (input?.name !== undefined) {
    const name = normalizeName(input?.name)
    if (!name) throw error('name_required', 'Şube adı zorunludur', 400)
    update.name = name
    update.nameNormalized = normalizeKey(name)
  }
  if (input?.description !== undefined) update.description = String(input?.description || '').trim()
  const updated = await repo.updateByIdAndTenant(branchId, tenantId, { ...update, actorUserId })
  if (!updated) throw error('not_found', 'Şube bulunamadı', 404)
  return { id: updated.id, name: updated.name, description: updated.description || '', isActive: !!updated.isActive }
}

export const updateBranchStatus = async (tenantId, actorUserId, branchId, input) => {
  const isActive = input?.isActive
  if (isActive !== true && isActive !== false) throw error('invalid_request', 'isActive zorunlu', 400)
  const updated = await repo.updateByIdAndTenant(branchId, tenantId, { isActive: !!isActive, actorUserId })
  if (!updated) throw error('not_found', 'Şube bulunamadı', 404)

  if (updated.isActive === false) {
    try {
      const st = await findTenantSettings(tenantId)
      const allowed = Array.isArray(st?.canteenAllowedBranchIds) ? st.canteenAllowedBranchIds.map(String).filter(Boolean) : []
      const nextAllowed = allowed.filter(id => String(id) !== String(updated.id))
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
  return { id: updated.id, name: updated.name, description: updated.description || '', isActive: updated.isActive !== false }
}

export const getBranchStaff = async (tenantId, branchId) => {
  if (!mongoose.isValidObjectId(branchId)) throw error('invalid_request', 'Invalid branch id', 400)
  const branch = await repo.findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) throw error('not_found', 'Şube bulunamadı', 404)

  const staff = await User.find({ tenantId, role: 'staff', systemType: 'kantin' }).sort({ createdAt: -1 })
  const assigned = staff
    .filter(s => Array.isArray(s.branchIds) && s.branchIds.map(String).includes(String(branchId)))
    .map(s => String(s.id))

  return {
    branchId: String(branch.id),
    staff: staff.map(s => ({ id: String(s.id), name: s.name, email: s.email, isActive: s.isActive !== false })),
    assignedStaffIds: assigned
  }
}

export const setBranchStaff = async (tenantId, actorUserId, branchId, input) => {
  if (!mongoose.isValidObjectId(branchId)) throw error('invalid_request', 'Invalid branch id', 400)
  const branch = await repo.findAnyByIdAndTenant(branchId, tenantId)
  if (!branch) throw error('not_found', 'Şube bulunamadı', 404)

  const staffIds = Array.isArray(input?.staffIds) ? input.staffIds.map(String).map(s => s.trim()).filter(Boolean) : []
  for (const id of staffIds) {
    if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Invalid staff id', 400)
  }

  const staff = await User.find({ tenantId, role: 'staff', systemType: 'kantin' }, { _id: 1 }).lean()
  const allStaffIds = (staff || []).map(s => String(s._id))
  const selected = Array.from(new Set(staffIds))
  const selectedSet = new Set(selected)
  const missing = selected.filter(id => !allStaffIds.includes(id))
  if (missing.length > 0) throw error('invalid_request', 'Staff tenant’a ait değil', 400)

  const toRemove = allStaffIds.filter(id => !selectedSet.has(id))

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
  if (!deleted) throw error('not_found', 'Şube bulunamadı', 404)
  return { success: true, id: deleted.id, actorUserId }
}
