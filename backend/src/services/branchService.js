import mongoose from 'mongoose'
import { error } from '../utils/errors.js'
import { findAllByTenant, findAllByTenantAny, createBranch, confirmNameAvailable, updateById, findByIdAndTenant } from '../repositories/branchRepository.js'
import { log as auditLog } from './auditService.js'
import User from '../models/User.js'

export const listBranches = async (tenantId, { includeInactive = false } = {}) => {
  const list = includeInactive ? await findAllByTenantAny(tenantId) : await findAllByTenant(tenantId)
  return list.map(b => ({ id: b.id, name: b.name, description: b.description || '', address: b.address, isActive: b.isActive }))
}

export const createBranchService = async (tenantId, actorUserId, dto) => {
  const ok = await confirmNameAvailable(tenantId, dto.name)
  if (!ok) throw error('name_in_use', 'Name already in use', 400)
  const b = await createBranch({ tenantId, name: dto.name, description: dto.description ?? '', address: dto.address ?? '' })
  await auditLog(tenantId, actorUserId, 'branch_create', 'Branch', b.id, { name: b.name })
  return { id: b.id, name: b.name, description: b.description || '', address: b.address, isActive: b.isActive }
}

export const updateBranchService = async (tenantId, actorUserId, id, dto) => {
  const b = await findByIdAndTenant(id, tenantId)
  if (!b) throw error('branch_not_found', 'Branch not found', 404)
  if (dto.name) {
    const ok = await confirmNameAvailable(tenantId, dto.name, b.id)
    if (!ok) throw error('name_in_use', 'Name already in use', 400)
  }
  const updated = await updateById(id, {
    name: dto.name ?? b.name,
    description: dto.description ?? b.description,
    address: dto.address ?? b.address,
    isActive: dto.isActive ?? b.isActive
  })
  await auditLog(tenantId, actorUserId, 'branch_update', 'Branch', updated.id, { name: updated.name })
  return { id: updated.id, name: updated.name, description: updated.description || '', address: updated.address, isActive: updated.isActive }
}

export const toggleBranchActiveService = async (tenantId, actorUserId, id) => {
  const b = await findByIdAndTenant(id, tenantId)
  if (!b) throw error('branch_not_found', 'Branch not found', 404)
  const updated = await updateById(id, { isActive: !b.isActive })
  await auditLog(tenantId, actorUserId, 'branch_toggle', 'Branch', updated.id, { isActive: updated.isActive })
  return { id: updated.id, name: updated.name, description: updated.description || '', address: updated.address, isActive: updated.isActive }
}

export const deleteBranchService = async (tenantId, actorUserId, id) => {
  const b = await findByIdAndTenant(id, tenantId)
  if (!b) throw error('branch_not_found', 'Branch not found', 404)
  const updated = await updateById(id, { isActive: false })
  await auditLog(tenantId, actorUserId, 'branch_delete', 'Branch', updated.id, {})
  return { id: updated.id, isActive: updated.isActive }
}

export const setBranchStaffService = async (tenantId, actorUserId, branchId, staffIds = []) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) throw error('invalid_request', 'Invalid branch id', 400)
  const b = await findByIdAndTenant(branchId, tenantId)
  if (!b) throw error('branch_not_found', 'Branch not found', 404)

  const safeStaffIds = Array.isArray(staffIds)
    ? staffIds.map(String).filter(Boolean)
    : []

  const allStaff = await User.find({ tenantId, role: 'staff' })
  const selected = new Set(safeStaffIds)

  for (const u of allStaff) {
    const prev = Array.isArray(u.branchIds) ? u.branchIds.map(String) : []
    const has = prev.includes(String(branchId))
    const want = selected.has(String(u.id))

    if (want && !has) {
      u.branchIds = [...prev, String(branchId)]
    }
    if (!want && has) {
      u.branchIds = prev.filter(x => String(x) !== String(branchId))
    }

    const nextIds = Array.isArray(u.branchIds) ? u.branchIds.map(String) : []
    if (nextIds.length === 1) {
      u.branchId = nextIds[0]
    } else {
      if (String(u.branchId || '') === String(branchId) || (u.branchId && !nextIds.includes(String(u.branchId)))) {
        u.branchId = null
      }
    }
    await u.save()
  }

  await auditLog(tenantId, actorUserId, 'branch_staff_set', 'Branch', branchId, { staffCount: safeStaffIds.length })
  return { success: true, branch: { id: b.id, name: b.name, description: b.description || '', address: b.address, isActive: b.isActive } }
}
