import React from 'react'
import Modal from './Modal.jsx'

export default function ConfirmDialog({
  open,
  title = 'Onay Gerekli',
  message = '',
  confirmText = 'Sil',
  cancelText = 'Vazgeç',
  tone = 'danger',
  loading = false,
  onConfirm,
  onClose
}) {
  const confirmClass = tone === 'danger' ? 'settings-ui-btn-danger' : 'settings-ui-submit'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ color: '#475569', lineHeight: 1.6, fontWeight: 600 }}>
          {message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="settings-ui-btn" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? 'İşleniyor...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
