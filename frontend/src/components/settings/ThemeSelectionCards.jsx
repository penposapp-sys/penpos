import React from 'react'

export default function ThemeSelectionCards({
  darkMode,
  onToggleDarkMode,
  darkModeLabel = 'Gorunum Modu',
  darkModeDescription = 'Panelin beyaz modda mi koyu modda mi gorunecegini belirler.',
}) {
  const canToggleDarkMode = typeof darkMode === 'boolean' && typeof onToggleDarkMode === 'function'

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {canToggleDarkMode ? (
        <div style={{ display: 'grid', gap: 12, padding: 14, border: '1px solid var(--app-border, var(--border))', borderRadius: 18, background: 'var(--app-surface)' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontWeight: 800 }}>{darkModeLabel}</div>
            <div style={{ fontSize: 13, color: 'var(--app-text-secondary, var(--muted))' }}>{darkModeDescription}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <button type="button" className="btn" aria-pressed={!darkMode} data-active={!darkMode ? 'true' : 'false'} onClick={() => onToggleDarkMode(false)} style={{ minWidth: 0, fontWeight: 900 }}>
              Beyaz Mod
            </button>
            <button type="button" className="btn" aria-pressed={darkMode} data-active={darkMode ? 'true' : 'false'} onClick={() => onToggleDarkMode(true)} style={{ minWidth: 0, fontWeight: 900 }}>
              Koyu Mod
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
