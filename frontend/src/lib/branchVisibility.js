export const normalizeBranchIdList = (value) => {
  const raw = Array.isArray(value) ? value : []
  return Array.from(new Set(raw.map((entry) => String(entry || '').trim()).filter(Boolean)))
}

export const isAllBranchesValue = (value) => normalizeBranchIdList(value).length === 0

export const isVisibleInBranchSelection = (record, selectedBranchIds = []) => {
  const allowed = normalizeBranchIdList(selectedBranchIds)
  const recordBranchIds = normalizeBranchIdList(record?.branchIds)
  if (allowed.length === 0) return true
  if (recordBranchIds.length === 0) return true
  return recordBranchIds.some((branchId) => allowed.includes(branchId))
}

export const formatBranchSummary = (branchIds, branchNameById) => {
  const normalized = normalizeBranchIdList(branchIds)
  if (normalized.length === 0) return 'Tüm Şubeler'
  return normalized
    .map((branchId) => branchNameById[String(branchId)] || 'Bilinmeyen Şube')
    .join(', ')
}
