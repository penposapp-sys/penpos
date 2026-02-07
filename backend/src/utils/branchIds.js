import mongoose from 'mongoose'

export const parseBranchIds = (branchId, branchIds) => {
  const parts = []
  if (branchIds !== undefined && branchIds !== null && branchIds !== '') {
    if (Array.isArray(branchIds)) parts.push(...branchIds)
    else parts.push(branchIds)
  } else if (branchId !== undefined && branchId !== null && branchId !== '') {
    parts.push(branchId)
  }

  const ids = parts
    .flatMap(v => String(v).split(','))
    .map(s => s.trim())
    .filter(Boolean)
    .map(String)

  return Array.from(new Set(ids))
}

export const requireValidObjectIds = (ids) => {
  const bad = (Array.isArray(ids) ? ids : []).filter(id => !mongoose.Types.ObjectId.isValid(String(id)))
  return bad
}

export const intersectAllowed = (requestedIds, allowedIds) => {
  const requested = Array.isArray(requestedIds) ? requestedIds.map(String) : []
  const allowed = Array.isArray(allowedIds) ? allowedIds.map(String) : []
  const finalIds = requested.length > 0 ? requested.filter(id => allowed.includes(String(id))) : allowed
  return { requested, allowed, finalIds }
}
