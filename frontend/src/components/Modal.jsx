import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

let openModalCount = 0

function syncBodyModalState(nextOpen) {
  if (typeof document === 'undefined') return
  if (nextOpen) openModalCount += 1
  else openModalCount = Math.max(0, openModalCount - 1)

  if (openModalCount > 0) document.body.classList.add('modal-open')
  else document.body.classList.remove('modal-open')
}

export default function Modal({ open, onClose, title, children, backdropClose = false, dialogStyle = null, bodyStyle = null }) {
  useEffect(() => {
    if (!open) return undefined
    syncBodyModalState(true)

    return () => {
      syncBodyModalState(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ backdropFilter: 'blur(18px)', background: 'var(--modal-backdrop)' }}
      onClick={backdropClose ? onClose : undefined}
    >
      <div
        className="card card--stable modal app-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Modal'}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          border: '1px solid var(--border-soft)',
          borderRadius: 32,
          background: 'var(--card-bg)',
          backdropFilter: 'var(--glass-blur)',
          color: 'var(--app-text, var(--text))',
          boxShadow: 'var(--shadow-soft), var(--shadow-glow)',
          overflow: 'hidden',
          ...(dialogStyle || {})
        }}
      >
        <div className="modalHeader" style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border-soft)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-surface, var(--panel)) 78%, transparent), color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 84%, transparent))', backdropFilter: 'var(--glass-blur)', position: 'sticky', top: 0, zIndex: 2 }}>
          <h3 className="modalTitle" style={{ fontSize: 24, fontWeight: 950, color: 'var(--app-text, var(--text))' }}>{title}</h3>
          <button className="btn btn--compact" onClick={onClose} style={{ borderRadius: 16, fontWeight: 900 }}>Kapat</button>
        </div>
        <div className="modalBody app-modal-body scrollbar-hidden" style={{ padding: 22, ...(bodyStyle || {}) }}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
