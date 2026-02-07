import React from 'react'

export default function SaleCategorySidebar({
  title = 'Kategoriler',
  categories = [],
  activeCategoryId,
  onSelect
}) {
  return (
    <div className="card salePanel">
      <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)', fontWeight: 800 }}>{title}</div>
      <div className="salePanelScroll" style={{ paddingTop: 10 }}>
        {categories.map(c => (
          <button
            key={c.id}
            className="btn btn--full btn--left"
            type="button"
            onClick={() => onSelect?.(c.id)}
            aria-pressed={String(activeCategoryId) === String(c.id)}
            style={{ marginBottom: 8 }}
          >
            {c.name}
          </button>
        ))}
        {categories.length === 0 && <div style={{ color: 'var(--muted)' }}>Kategori yok</div>}
      </div>
    </div>
  )
}

