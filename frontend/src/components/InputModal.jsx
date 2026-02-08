import React, { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'

export default function InputModal({ open, onClose, title, initialValue = '', placeholder = '', onSubmit, autoFocus = true }) {
  const [value, setValue] = useState(initialValue)
  const cancelRef = useRef(null)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  useEffect(() => {
    if (!open) return
    if (autoFocus) return
    const id = requestAnimationFrame(() => cancelRef.current?.focus?.())
    return () => cancelAnimationFrame(id)
  }, [open, autoFocus])

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
          autoFocus={!!autoFocus}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} ref={cancelRef}>İptal</button>
          <button className="btn btn--primary" onClick={handleSubmit}>Kaydet</button>
        </div>
      </div>
    </Modal>
  )
}
