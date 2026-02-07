import React, { useMemo, useState } from 'react'

const normalizeId = (v) => String(v || '').trim()

export default function MenuItemFilterDrawer({
  open,
  onClose,
  categories,
  menuItems,
  hiddenSet,
  onToggleMenuItem,
  onReset
}) {
  const [query, setQuery] = useState('')
  const cats = Array.isArray(categories) ? categories : []
  const items = Array.isArray(menuItems) ? menuItems : []

  const q = String(query || '').trim().toLowerCase()
  const filteredItems = useMemo(() => {
    if (!q) return items
    return items.filter(it => String(it?.name || '').toLowerCase().includes(q))
  }, [items, q])

  const itemsByCategory = useMemo(() => {
    const map = new Map()
    for (const it of filteredItems) {
      const catId = normalizeId(it?.categoryId)
      const arr = map.get(catId) || []
      arr.push(it)
      map.set(catId, arr)
    }
    return map
  }, [filteredItems])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      <div
        className="card"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 360,
          maxWidth: '92vw',
          padding: 12,
          borderRadius: 0,
          overflow: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Ürün Filtreleri</div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ürün ara..."
          />
          <button className="btn" type="button" onClick={() => setQuery('')}>Temizle</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <button className="btn btn--toggle" type="button" aria-pressed={false} onClick={onReset}>Hepsini Aç</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {cats.map(c => {
            const catId = normalizeId(c?._id)
            const catItems = (itemsByCategory.get(catId) || []).slice()
            if (catItems.length === 0) return null
            return (
              <div key={catId}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{String(c?.name || '-')}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {catItems.map(it => {
                    const id = normalizeId(it?._id)
                    if (!id) return null
                    const hidden = hiddenSet?.has(id)
                    const checked = !hidden
                    return (
                      <label key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <input type="checkbox" checked={checked} onChange={() => onToggleMenuItem(id)} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(it?.name || '-')}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

