import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function formatAdminDate(value = new Date(), options = { day: '2-digit', month: 'long', year: 'numeric' }) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('tr-TR', options)
}

export function AdminPageHeader({ title, subtitle, action }) {
  return (
    <div className="admin-page-header">
      <div className="admin-page-heading">
        <div className="admin-page-kicker">Platform Yönetimi</div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="admin-page-header-side">
        <div className="admin-page-date">{formatAdminDate()}</div>
        {action}
      </div>
    </div>
  )
}

export function AdminFilterBar({ children }) {
  return <div className="admin-filter-bar">{children}</div>
}

export function AdminFilterField({ label, children }) {
  return (
    <label className="admin-filter-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function AdminTableCard({ children }) {
  return <div className="admin-table-card">{children}</div>
}

export function AdminStatusBadge({ tone = 'neutral', children }) {
  return <span className={`admin-status-badge tone-${tone}`}>{children}</span>
}

export function AdminEmptyState({ title, description }) {
  return (
    <div className="admin-empty-state">
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
    </div>
  )
}

function useMenuPosition(open, anchorRef, menuRef, itemCount) {
  const [style, setStyle] = useState({ top: 0, left: 0, minWidth: 160 })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || typeof window === 'undefined') return undefined

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(rect.width, 180)
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      const estimatedHeight = Math.max(140, Math.min(360, (menuRef.current?.offsetHeight || (Math.max(1, Number(itemCount) || 1) * 44 + 18))))
      const left = Math.max(12, Math.min(rect.right - width, viewportWidth - width - 12))
      const spaceBelow = viewportHeight - rect.bottom - 16
      const spaceAbove = rect.top - 16
      const openUpward = spaceBelow < Math.min(estimatedHeight, 220) && spaceAbove > spaceBelow
      const top = openUpward
        ? Math.max(12, rect.top - estimatedHeight - 10)
        : rect.bottom + 10
      const maxHeight = openUpward
        ? Math.max(140, rect.top - 24)
        : Math.max(140, viewportHeight - top - 16)
      setStyle({ top, left, minWidth: width, maxHeight })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, menuRef, itemCount])

  return style
}

export function AdminActionMenu({ items = [], label = 'İşlemler' }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const menuRef = useRef(null)
  const enabledItems = items.filter(Boolean)
  const style = useMenuPosition(open, anchorRef, menuRef, enabledItems.length)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      const target = event.target
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`btn btn--compact admin-actions-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        <span aria-hidden="true" className={`admin-actions-caret${open ? ' is-open' : ''}`}>▾</span>
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div ref={menuRef} className="admin-actions-menu" role="menu" style={style}>
          {enabledItems.map((item) => (
            <button
              key={item.key || item.label}
              type="button"
              role="menuitem"
              className={`admin-actions-menu-item${item.danger ? ' is-danger' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                if (!item.disabled && typeof item.onClick === 'function') item.onClick()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </>
  )
}
