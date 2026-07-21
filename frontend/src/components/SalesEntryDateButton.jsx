import React, { useRef } from 'react'

const formatDateLabel = (value) => {
  if (!value) return 'Tarih sec'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export default function SalesEntryDateButton({ value = '', onChange, title = 'Siparis tarihini sec', showValue = false }) {
  const inputRef = useRef(null)

  const openPicker = () => {
    const input = inputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.click()
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={openPicker}
        title={value ? `${title}: ${value}` : title}
        aria-label={title}
        style={{
          width: showValue ? '100%' : 20,
          height: 36,
          minWidth: showValue ? 0 : 20,
          padding: showValue ? '0 12px' : 0,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: showValue ? 8 : 0
        }}
      >
        <svg width={showValue ? '14' : '9'} height={showValue ? '14' : '9'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {showValue ? <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDateLabel(value)}</span> : null}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 0,
          height: 0
        }}
      />
    </>
  )
}
