import React, { useMemo } from 'react'

const normalizeId = (v) => String(v || '').trim()

export default function CategoryFilterDrawer({
  open,
  onClose,
  categories,
  value,
  onChange
}) {
  const list = Array.isArray(categories) ? categories : []
  const allIds = useMemo(() => list.map(c => normalizeId(c?._id)).filter(Boolean), [list])
  const selected = useMemo(() => {
    const raw = Array.isArray(value) ? value : []
    const set = new Set(raw.map(normalizeId).filter(Boolean))
    return set
  }, [value])

  const allSelected = useMemo(() => allIds.length > 0 && allIds.every(id => selected.has(id)), [allIds, selected])

  const toggleAll = () => {
    if (allSelected) onChange([])
    else onChange(allIds)
  }

  const toggleOne = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      <div
        className="card"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 320,
          maxWidth: '90vw',
          padding: 12,
          borderRadius: 0,
          overflow: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Kategoriler</div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>Tümü</span>
          </label>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }} />

          {list.map(c => {
            const id = normalizeId(c?._id)
            if (!id) return null
            const checked = selected.has(id)
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleOne(id)} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(c?.name || '-')}</span>
                </div>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
