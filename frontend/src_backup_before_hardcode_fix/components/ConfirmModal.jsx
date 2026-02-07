import React from 'react'
import Modal from './Modal.jsx'

export default function ConfirmModal({ open, onClose, title, description, confirmText = 'Evet, Sil', cancelText = 'Vazgeç', danger = false, onConfirm, confirmDisabled = false, cancelDisabled = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'grid', gap: 10 }}>
        {description && <div>{description}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={cancelDisabled}>{cancelText}</button>
          <button
            className={danger ? 'btn btn--danger' : 'btn'}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
