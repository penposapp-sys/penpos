import React, { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { buildConfiguredProductPayload, getProductPortionOptions } from '../lib/productPortions.js'

export default function ProductConfigModal({ open, item, onClose, onSubmit }) {
  const portionOptions = useMemo(() => getProductPortionOptions(item), [item])
  const [portionKey, setPortionKey] = useState('full')
  const [grams, setGrams] = useState('')

  useEffect(() => {
    if (!open) return
    setPortionKey('full')
    setGrams('')
  }, [open, item?.id])

  const handleSubmit = async () => {
    if (!item) return false
    if (item?.isWeightBased) {
      const weightGrams = Math.round(Number(String(grams || '').replace(',', '.')))
      if (!Number.isFinite(weightGrams) || weightGrams <= 0) return false
      const result = await onSubmit(buildConfiguredProductPayload(item, { portionKey, weightGrams }))
      if (result !== false) onClose()
      return result
    }
    const result = await onSubmit(buildConfiguredProductPayload(item, { portionKey }))
    if (result !== false) onClose()
    return result
  }

  return (
    <Modal open={open} onClose={onClose} title={item?.name || 'Urun Secimi'} dialogStyle={{ width: 'min(520px, calc(100vw - 32px))' }}>
      <div style={{ display: 'grid', gap: 14 }}>
        {portionOptions.length > 1 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <strong>Porsiyon Secin</strong>
            <div style={{ display: 'grid', gap: 8 }}>
              {portionOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={portionKey === option.key ? 'btn btn--primary' : 'btn'}
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => setPortionKey(option.key)}
                >
                  <span>{option.label}</span>
                  <span>{Number(option.price || 0).toFixed(2)} TL</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {item?.isWeightBased ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <strong>Gramaj</strong>
            <input
              className="input"
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              placeholder="Orn: 350"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmit()
              }}
            />
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={onClose}>Vazgec</button>
          <button className="btn btn--primary" type="button" onClick={handleSubmit}>Sepete Ekle</button>
        </div>
      </div>
    </Modal>
  )
}
