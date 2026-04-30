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

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined
    syncBodyModalState(true)

    return () => {
      syncBodyModalState(false)
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card card--stable modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Modal'}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div className="modalHeader">
          <h3 className="modalTitle">{title}</h3>
          <button className="btn btn--compact" onClick={onClose}>Kapat</button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>,
    document.body
  )
}
