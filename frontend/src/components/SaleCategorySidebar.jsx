import React, { memo, useCallback, useEffect } from 'react'
import { incrementPerfCounter, logPerf } from '../lib/perfDebug.js'

function SaleCategorySidebar({
  title = 'Kategoriler',
  categories = [],
  activeCategoryId,
  onSelect
}) {
  const handleSelect = useCallback((categoryId) => onSelect?.(categoryId), [onSelect])

  useEffect(() => {
    const renderCount = incrementPerfCounter('sidebarRenders', title || 'categories')
    if (renderCount > 0 && renderCount <= 2) {
      logPerf('SaleCategorySidebar', 'render', {
        title,
        renderCount,
        categoryCount: categories.length,
        activeCategoryId: String(activeCategoryId || '')
      })
    }
  }, [activeCategoryId, categories.length, title])

  return (
    <div className="card salePanel saleCategoryPanel">
      <div className="saleCategoryPanelTitle" style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)', fontWeight: 800 }}>{title}</div>
      <div
        className="saleCategoryPanelScroll category-scroll sale-category-scroll"
      >
        {categories.map(c => (
          <button
            key={c.id}
            className="btn btn--full btn--left saleCategoryButton sale-category-chip"
            type="button"
            onClick={() => handleSelect(c.id)}
            aria-pressed={String(activeCategoryId) === String(c.id)}
            style={{
              marginBottom: 0,
              borderColor: String(activeCategoryId) === String(c.id) ? 'color-mix(in srgb, var(--theme-accent, #2563eb) 50%, var(--app-border, var(--border)))' : 'var(--app-border, var(--border))',
              background: String(activeCategoryId) === String(c.id)
                ? 'color-mix(in srgb, var(--theme-accent, #2563eb) 22%, var(--app-surface, var(--panel)))'
                : 'var(--app-button-bg, var(--button-bg))',
              color: 'var(--app-text, var(--text))',
              boxShadow: String(activeCategoryId) === String(c.id)
                ? 'inset 0 0 0 1px color-mix(in srgb, var(--theme-accent, #2563eb) 22%, transparent)'
                : 'none'
            }}
          >
            {c.name}
          </button>
        ))}
        {categories.length === 0 && <div style={{ color: 'var(--muted)' }}>Kategori yok</div>}
      </div>
    </div>
  )
}

export default memo(SaleCategorySidebar, (prev, next) => (
  prev.title === next.title &&
  String(prev.activeCategoryId || '') === String(next.activeCategoryId || '') &&
  prev.categories === next.categories
))
