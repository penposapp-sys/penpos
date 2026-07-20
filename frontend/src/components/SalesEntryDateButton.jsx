import React, { useRef } from 'react'

export default function SalesEntryDateButton({ value = '', onChange, title = 'Sipariş tarihi seç' }) {
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
          width: 20,
          height: 20,
          minWidth: 20,
          padding: 0,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
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
