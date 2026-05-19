import React, { useEffect } from 'react'

export default function MobileTopSheetNav({ open, title, items, onClose, onSelect }) {
  const list = Array.isArray(items) ? items : []

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="topSheetBackdrop" />
      <div className="topSheetPanel" role="dialog" aria-modal="true">
        <div className="topSheetInner">
          <div className="topSheetHeader">
            <div style={{ fontWeight: 900 }}>{title || 'Menü'}</div>
            <button className="btn btn--compact" type="button" onClick={() => onClose?.()}>Kapat</button>
          </div>
          <div className="topSheetList">
            {list.map((i) => {
              const Icon = i.icon
              return (
                <button
                  key={i.key || i.to || i.label}
                  type="button"
                  className="topSheetItem"
                  data-active={i.active ? 'true' : 'false'}
                  style={i.active ? {
                    background: 'var(--canteen-nav-active-bg, #e5e7eb)',
                    borderColor: 'var(--canteen-nav-active-border, #d1d5db)',
                    color: 'var(--canteen-nav-active-text, #111827)',
                    boxShadow: 'var(--canteen-nav-active-shadow, none)'
                  } : undefined}
                  onClick={() => {
                    try { onSelect?.(i) } catch {}
                    try { onClose?.() } catch {}
                  }}
                >
                  {!!Icon && <span className="nav-icon"><Icon size={18} /></span>}
                  <span style={{ fontWeight: 800 }}>{i.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
