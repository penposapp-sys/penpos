import mongoose from 'mongoose'
import { error } from './errors.js'

export const normalizeObjectIdArray = (input) => {
  const list = Array.isArray(input) ? input : []
  const ids = Array.from(new Set(
    list
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))

  const invalid = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id))
  if (invalid.length > 0) {
    throw error('invalid_request', 'Invalid branch id', 400)
  }
  return ids
}

export const documentBranchIds = (doc, field = 'branchIds') => {
  const raw = Array.isArray(doc?.[field]) ? doc[field] : []
  return Array.from(new Set(
    raw
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))
}

export const isVisibleInBranch = (doc, branchId, field = 'branchIds') => {
  const target = String(branchId || '').trim()
  if (!target) return true
  const ids = documentBranchIds(doc, field)
  if (ids.length === 0) return true
  return ids.includes(target)
}

export const buildBranchVisibilityFilter = (branchIdsInput, field = 'branchIds') => {
  const ids = normalizeObjectIdArray(branchIdsInput)
  if (ids.length === 0) return {}

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id))
  return {
    $or: [
      { [field]: { $exists: false } },
      { [field]: { $size: 0 } },
      { [field]: { $in: objectIds } },
      { [field]: { $in: ids } }
    ]
  }
}

export const normalizeVisibilityPayload = ({ branchIds, allBranches }) => {
  if (allBranches === true) return []
  return normalizeObjectIdArray(branchIds)
}

export const getUserAccessibleBranchIds = (user) => {
  const accessible = Array.isArray(user?.accessibleBranchIds) ? user.accessibleBranchIds : []
  const branchIds = Array.isArray(user?.branchIds) ? user.branchIds : []
  const branchId = user?.branchId ? [user.branchId] : []
  return Array.from(new Set(
    [...accessible, ...branchIds, ...branchId]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))
}
