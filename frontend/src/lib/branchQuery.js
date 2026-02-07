export const normalizeBranchIds = (allowedBranchIds) => {
  const raw = Array.isArray(allowedBranchIds) ? allowedBranchIds : []
  const ids = raw
    .map(b => (b && typeof b === 'object') ? (b._id || b.id) : b)
    .map(v => String(v || '').trim())
    .filter(Boolean)
  return Array.from(new Set(ids))
}

export const buildBranchQueryParams = (allowedBranchIds) => {
  const ids = normalizeBranchIds(allowedBranchIds)
  if (ids.length === 0) return { ids, params: null }
  const params = new URLSearchParams()
  if (ids.length === 1) params.set('branchId', ids[0])
  else params.set('branchIds', ids.join(','))
  return { ids, params }
}
