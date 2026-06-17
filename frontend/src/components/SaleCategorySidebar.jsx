import React, { memo, useCallback, useEffect, useRef } from 'react'
import { incrementPerfCounter, logPerf } from '../lib/perfDebug.js'

function SaleCategorySidebar({
  title = 'Kategoriler',
  categories = [],
  activeCategoryId,
  onSelect
}) {
  const scrollRef = useRef(null)
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false
  })
  const handleSelect = useCallback((categoryId) => onSelect?.(categoryId), [onSelect])

  const handleWheel = useCallback((event) => {
    const el = scrollRef.current
    if (!el) return
    const canScrollX = el.scrollWidth > el.clientWidth + 2
    if (!canScrollX) return
    if (Math.abs(event.deltaX) > 0) return
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
    el.scrollLeft += event.deltaY
  }, [])

  const handleMouseDown = useCallback((event) => {
    const el = scrollRef.current
    if (!el) return

    dragState.current.isDown = true
    dragState.current.startX = event.pageX - el.offsetLeft
    dragState.current.scrollLeft = el.scrollLeft
    dragState.current.moved = false
  }, [])

  const handleMouseMove = useCallback((event) => {
    const el = scrollRef.current
    const state = dragState.current
    if (!el || !state.isDown) return

    const x = event.pageX - el.offsetLeft
    const walk = x - state.startX

    if (Math.abs(walk) > 5) state.moved = true

    el.scrollLeft = state.scrollLeft - walk
  }, [])

  const stopDragging = useCallback(() => {
    dragState.current.isDown = false
  }, [])

  const handleCategoryClick = useCallback((event, categoryId) => {
    if (dragState.current.moved) {
      event.preventDefault()
      event.stopPropagation()
      dragState.current.moved = false
      return
    }
    handleSelect(categoryId)
  }, [handleSelect])

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
        ref={scrollRef}
        className="salePanelScroll saleCategoryPanelScroll category-scroll sale-category-scroll"
        style={{ paddingTop: 10 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onWheel={handleWheel}
      >
        {categories.map(c => (
          <button
            key={c.id}
            className="btn btn--full btn--left saleCategoryButton sale-category-chip"
            type="button"
            onClick={(event) => handleCategoryClick(event, c.id)}
            aria-pressed={String(activeCategoryId) === String(c.id)}
            style={{
              marginBottom: 8,
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
