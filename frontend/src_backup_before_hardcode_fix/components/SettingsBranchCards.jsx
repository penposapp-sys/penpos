import React, { useMemo } from 'react'

export default function SettingsBranchCards({
  branches,
  tablesByBranchId,
  selectedBranchId,
  onSelectBranchId,
  showAll = true,
}) {
  const cards = useMemo(() => {
    const list = Array.isArray(branches) ? branches : []
    const items = list.map((b) => {
      const id = String(b?.id || b?._id || '').trim()
      const count = Array.isArray(tablesByBranchId?.[id]) ? tablesByBranchId[id].length : 0
      return {
        id,
        name: b?.name || 'Şube',
        count,
      }
    }).filter(x => x.id)
    if (!showAll) return items
    const total = items.reduce((sum, it) => sum + (Number(it.count) || 0), 0)
    return [{ id: 'all', name: 'Tümü', count: total }, ...items]
  }, [branches, showAll, tablesByBranchId])

  const selected = String(selectedBranchId || '').trim() || ''

  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Şubeler</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {cards.map((c) => {
          const isSelected = c.id === selected
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectBranchId(c.id)}
              className="card"
              style={{
                padding: 12,
                textAlign: 'left',
                cursor: 'pointer',
                background: '#ffffff',
                borderColor: isSelected ? '#16a34a' : 'var(--border)',
                boxShadow: isSelected ? '0 0 0 2px rgba(22,163,74,0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden="true">📍</span>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                </div>
                {isSelected && <span className="page-pill">Seçili</span>}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Masa sayısı: {c.count}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

