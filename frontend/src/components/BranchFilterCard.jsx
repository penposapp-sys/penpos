import React, { useEffect, useMemo, useRef, useState } from 'react'

const WRAPPER_STYLE = {}

const CARD_STYLE = {
  border: '1px solid var(--app-border, var(--border))',
  borderRadius: 24,
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
  color: 'var(--app-text, var(--text))',
  boxShadow: 'var(--card-shadow)',
  backdropFilter: 'blur(12px)',
  padding: 16
}

function BranchPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? 'color-mix(in srgb, var(--theme-accent, #3b82f6) 55%, white 10%)' : 'var(--app-border, var(--border))'}`,
        borderRadius: 20,
        background: active
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #2563eb) 24%, var(--app-surface)), color-mix(in srgb, #0ea5e9 14%, var(--app-surface-soft, var(--panelElevated))))'
          : 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 94%, transparent), color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 96%, transparent))',
        color: 'var(--app-text, var(--text))',
        padding: '12px 14px',
        textAlign: 'left',
        fontWeight: 800,
        fontSize: 13,
        transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
        boxShadow: active ? '0 14px 28px color-mix(in srgb, var(--theme-accent, #2563eb) 22%, transparent)' : '0 8px 18px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span
        aria-hidden="true"
        style={{
          width: 42,
          height: 24,
          borderRadius: 999,
          background: active
            ? 'linear-gradient(135deg, var(--theme-accent, #2563eb), color-mix(in srgb, #0ea5e9 82%, var(--theme-accent, #2563eb)))'
            : 'color-mix(in srgb, var(--app-text-secondary, var(--muted)) 35%, transparent)',
          position: 'relative',
          flexShrink: 0,
          boxShadow: active
            ? 'inset 0 0 0 1px rgba(255,255,255,0.18)'
            : 'inset 0 0 0 1px color-mix(in srgb, var(--app-border, var(--border)) 80%, transparent)'
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: active ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--app-text, #ffffff)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.22)',
            transition: 'left 160ms ease'
          }}
        />
      </span>
    </button>
  )
}

export default function BranchFilterCard({
  branchOptions,
  selectedBranches,
  setSelectedBranches,
  title = 'Şube Seç',
  compact = false,
  iconOnly = false,
  hideSummary = false
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const visibleOptions = Array.isArray(branchOptions) ? branchOptions : []
  const selectedNames = useMemo(
    () => visibleOptions.filter((branch) => selectedBranches.includes(branch.id)).map((branch) => branch.name),
    [visibleOptions, selectedBranches]
  )

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  if (visibleOptions.length === 0) return null

  const toggleBranch = (branchId) => {
    if (selectedBranches.includes(branchId)) {
      const next = selectedBranches.filter((id) => id !== branchId)
      setSelectedBranches(next.length > 0 ? next : [branchId])
      return
    }
    setSelectedBranches([...selectedBranches, branchId])
  }

  return (
    <div ref={rootRef} style={{ ...WRAPPER_STYLE, position: 'relative' }}>
      <div style={compact ? { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } : CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={compact ? { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } : { minWidth: 220, flex: '1 1 320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setOpen((current) => !current)}
                style={{
                  borderRadius: iconOnly ? 16 : (compact ? 14 : 18),
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #111827) 78%, black 8%), color-mix(in srgb, var(--theme-accent, #111827) 52%, var(--app-surface)))',
                  borderColor: 'color-mix(in srgb, var(--theme-accent, #111827) 45%, var(--app-border, var(--border)))',
                  color: '#ffffff',
                  padding: iconOnly ? '10px 12px' : (compact ? '10px 14px' : '12px 16px'),
                  fontWeight: 900,
                  fontSize: compact ? 13 : 14,
                  minWidth: iconOnly ? 44 : undefined,
                  minHeight: iconOnly ? 44 : undefined
                }}
                title={title}
              >
                {iconOnly ? (
                  <span style={{ display: 'grid', placeItems: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 7l1-3h14l1 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M4 7v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M5 10v11h14V10" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </span>
                ) : title}
              </button>
              {!iconOnly && !hideSummary && (
                <span style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {selectedNames.length > 0 ? `${selectedNames.length} şube seçili` : 'Tüm subeler seçili degil'}
                </span>
              )}
            </div>
          </div>

          {!compact && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedBranches(visibleOptions.map((branch) => branch.id))}
                style={{ borderRadius: 16, padding: '10px 14px', fontWeight: 800 }}
              >
                Tumunu Seç
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedBranches(visibleOptions.slice(0, 1).map((branch) => branch.id))}
                style={{ borderRadius: 16, padding: '10px 14px', fontWeight: 800 }}
              >
                Tek Şube
              </button>
            </div>
          )}
        </div>

        {!compact && selectedNames.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedNames.map((name) => (
              <span
                key={name}
                style={{
                  borderRadius: 999,
                  background: 'color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 92%, transparent)',
                  color: 'var(--app-text-secondary, var(--muted))',
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 800
                }}
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {open && (
          <div
            style={compact ? {
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: iconOnly ? 'auto' : 0,
              right: iconOnly ? 0 : 'auto',
              zIndex: 40,
              minWidth: 320,
              maxWidth: 520,
              width: 'max-content',
              ...CARD_STYLE,
              padding: 14
            } : { marginTop: 16, display: 'grid', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--app-text-secondary, var(--muted))' }}>
                Gosterilecek subeleri seç
              </div>
              {compact && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedBranches(visibleOptions.map((branch) => branch.id))}
                    style={{ borderRadius: 12, padding: '8px 10px', fontWeight: 800, fontSize: 12 }}
                  >
                    Tumunu Seç
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedBranches(visibleOptions.slice(0, 1).map((branch) => branch.id))}
                    style={{ borderRadius: 12, padding: '8px 10px', fontWeight: 800, fontSize: 12 }}
                  >
                    Tek Şube
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(140px, 1fr))' : 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {visibleOptions.map((branch) => (
                <BranchPill
                  key={branch.id}
                  label={branch.name}
                  active={selectedBranches.includes(branch.id)}
                  onClick={() => toggleBranch(branch.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
