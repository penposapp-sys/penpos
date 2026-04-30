import React, { useEffect, useMemo, useRef, useState } from 'react'

const WRAPPER_STYLE = {}

const CARD_STYLE = {
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  background: 'rgba(255,255,255,0.96)',
  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.08)',
  backdropFilter: 'blur(12px)',
  padding: 16
}

function BranchPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? '#0f172a' : '#e2e8f0'}`,
        borderRadius: 18,
        background: active ? '#0f172a' : '#f8fafc',
        color: active ? '#ffffff' : '#334155',
        padding: '12px 14px',
        textAlign: 'left',
        fontWeight: 800,
        fontSize: 13,
        transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
        boxShadow: active ? '0 12px 24px rgba(15, 23, 42, 0.18)' : 'none'
      }}
    >
      {label}
    </button>
  )
}

export default function BranchFilterCard({
  branchOptions,
  selectedBranches,
  setSelectedBranches,
  title = 'Sube Sec',
  compact = false,
  iconOnly = false
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

  if (visibleOptions.length <= 1) return null

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
                  background: '#0f172a',
                  borderColor: '#0f172a',
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
              {!iconOnly && (
                <span style={{ color: '#475569', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {selectedNames.length > 0 ? `${selectedNames.length} sube secili` : 'Tum subeler secili degil'}
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
                Tumunu Sec
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedBranches(visibleOptions.slice(0, 1).map((branch) => branch.id))}
                style={{ borderRadius: 16, padding: '10px 14px', fontWeight: 800 }}
              >
                Tek Sube
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
                  background: '#f1f5f9',
                  color: '#475569',
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
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>
                Gosterilecek subeleri sec
              </div>
              {compact && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedBranches(visibleOptions.map((branch) => branch.id))}
                    style={{ borderRadius: 12, padding: '8px 10px', fontWeight: 800, fontSize: 12 }}
                  >
                    Tumunu Sec
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedBranches(visibleOptions.slice(0, 1).map((branch) => branch.id))}
                    style={{ borderRadius: 12, padding: '8px 10px', fontWeight: 800, fontSize: 12 }}
                  >
                    Tek Sube
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
