import React from 'react'

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div className="modalHeader">
          <h3 className="modalTitle">{title}</h3>
          <button className="btn btn--compact" onClick={onClose}>Kapat</button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  )
}
