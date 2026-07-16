import React from 'react'
import { SettingsField, SettingsToggle } from './SettingsUi.jsx'
import { normalizeBranchIdList } from '../../lib/branchVisibility.js'

export default function BranchAccessField({
  label,
  hint = '',
  branches = [],
  value,
  onChange,
  allLabel = 'Tum subelerde gecerli',
  emptyText = 'Aktif sube bulunamadi.'
}) {
  const visibleBranches = Array.isArray(branches)
    ? branches.filter((branch) => branch?.isActive !== false)
    : []

  const allBranchIds = Array.isArray(visibleBranches)
    ? visibleBranches.map((branch) => String(branch?._id || branch?.id || '')).filter(Boolean)
    : []

  const safeValue = value && typeof value === 'object'
    ? {
        allBranches: value.allBranches !== false,
        branchIds: normalizeBranchIdList(value.branchIds)
      }
    : { allBranches: true, branchIds: [] }

  const update = (patch) => {
    if (typeof onChange !== 'function') return
    const next = {
      allBranches: safeValue.allBranches,
      branchIds: [...safeValue.branchIds],
      ...patch
    }
    onChange({
      allBranches: next.allBranches !== false,
      branchIds: next.allBranches ? [] : normalizeBranchIdList(next.branchIds)
    })
  }

  return (
    <SettingsField label={label}>
      <div className="settings-ui-branch-field">
        {hint ? <div className="settings-ui-branch-hint">{hint}</div> : null}
        <div className="settings-ui-branch-list">
          <SettingsToggle
            label={allLabel}
            description="Aciksa bu kullanici tum aktif subeleri gorebilir."
            checked={safeValue.allBranches}
            onChange={(event) => update(event.target.checked ? { allBranches: true, branchIds: [] } : { allBranches: false, branchIds: [] })}
          />
          {visibleBranches.length === 0 ? (
            <div className="settings-ui-branch-empty">{emptyText}</div>
          ) : (
            visibleBranches.map((branch) => {
              const branchId = String(branch?._id || branch?.id || '')
              const checked = safeValue.allBranches || safeValue.branchIds.includes(branchId)
              return (
                <SettingsToggle
                  key={branchId}
                  label={branch?.name || '-'}
                  description={branch?.address || branch?.description || 'Bu subeye erisim verilir.'}
                  checked={checked}
                  onChange={(event) => {
                    const isChecked = event.target.checked
                    if (safeValue.allBranches) {
                      update({
                        allBranches: false,
                        branchIds: isChecked ? allBranchIds : allBranchIds.filter((id) => id !== branchId)
                      })
                      return
                    }
                    const nextIds = isChecked
                      ? [...safeValue.branchIds, branchId]
                      : safeValue.branchIds.filter((id) => id !== branchId)
                    update({ allBranches: false, branchIds: nextIds })
                  }}
                />
              )
            })
          )}
        </div>
      </div>
    </SettingsField>
  )
}
