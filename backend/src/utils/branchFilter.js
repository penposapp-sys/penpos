import mongoose from 'mongoose'

export const buildBranchMatch = (branchIds = []) => {
  const ids = Array.isArray(branchIds) ? branchIds.filter(Boolean).map(String) : []
  if (ids.length === 0) return null
  const objIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id))
  const stringIds = ids

  if (objIds.length > 0 && stringIds.length > 0) {
    return { $or: [{ branchId: { $in: objIds } }, { branchId: { $in: stringIds } }] }
  }
  if (objIds.length > 0) return { branchId: { $in: objIds } }
  return { branchId: { $in: stringIds } }
}

export const applyBranchFilter = (baseQuery = {}, branchIds = []) => {
  const branchMatch = buildBranchMatch(branchIds)
  const base = baseQuery && typeof baseQuery === 'object' ? { ...baseQuery } : {}
  if (!branchMatch) return base
  if (Object.keys(base).length === 0) return branchMatch
  if (Array.isArray(base.$and)) return { ...base, $and: [...base.$and, branchMatch] }
  return { $and: [base, branchMatch] }
}
