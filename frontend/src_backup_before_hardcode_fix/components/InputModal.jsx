import React, { useState, useEffect } from 'react'
import Modal from './Modal.jsx'

export default function InputModal({ open, onClose, title, initialValue = '', placeholder = '', onSubmit }) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  const handleSubmit = async () => {
    const res = await onSubmit(value)
    if (res !== false) onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'grid', gap: 10 }}>
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>İptal</button>
          <button className="btn btn--primary" onClick={handleSubmit}>Kaydet</button>
        </div>
      </div>
    </Modal>
  )
}
