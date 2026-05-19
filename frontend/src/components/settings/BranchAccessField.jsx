import React from 'react'
import { SettingsField } from './SettingsUi.jsx'
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
  const allBranchIds = Array.isArray(branches)
    ? branches.map((branch) => String(branch?._id || branch?.id || '')).filter(Boolean)
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
        <div className="settings-ui-branch-actions">
          <button
            type="button"
            className={`settings-ui-branch-all-btn ${safeValue.allBranches ? 'active' : ''}`}
            onClick={() => update(safeValue.allBranches ? { allBranches: false, branchIds: [] } : { allBranches: true, branchIds: [] })}
          >
            {safeValue.allBranches ? 'Tum subelerde aktif' : allLabel}
          </button>
          {!safeValue.allBranches ? (
            <button
              type="button"
              className="settings-ui-branch-clear-btn"
              onClick={() => {
                const shouldSelectAll = safeValue.branchIds.length !== allBranchIds.length
                update({ allBranches: false, branchIds: shouldSelectAll ? allBranchIds : [] })
              }}
            >
              {safeValue.branchIds.length === allBranchIds.length ? 'Secimleri kaldir' : 'Tum subeleri sec'}
            </button>
          ) : null}
        </div>

        <div className="settings-ui-branch-list settings-ui-branch-pill-list">
          {branches.length === 0 ? (
            <div className="settings-ui-branch-empty">{emptyText}</div>
          ) : (
            branches.map((branch) => {
              const branchId = String(branch?._id || branch?.id || '')
              const checked = safeValue.allBranches || safeValue.branchIds.includes(branchId)
              return (
                <button
                  key={branchId}
                  type="button"
                  className={`settings-ui-branch-pill ${checked ? 'active' : ''}`}
                  onClick={() => {
                    if (safeValue.allBranches) {
                      update({ allBranches: false, branchIds: allBranchIds.filter((id) => id !== branchId) })
                      return
                    }
                    const nextIds = checked
                      ? safeValue.branchIds.filter((id) => id !== branchId)
                      : [...safeValue.branchIds, branchId]
                    update({ allBranches: false, branchIds: nextIds })
                  }}
                >
                  <span>{branch?.name || '-'}</span>
                  {!!(branch?.address || branch?.description) ? <small>{branch?.address || branch?.description}</small> : null}
                </button>
              )
            })
          )}
        </div>
      </div>
    </SettingsField>
  )
}
