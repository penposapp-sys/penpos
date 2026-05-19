import React from 'react'

export function CanteenSettingsCard({ children, style = {}, ...props }) {
  return (
    <div
      {...props}
      className={props.className || 'card'}
      style={{
        borderRadius: 24,
        border: '1px solid var(--app-border, var(--border))',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
        boxShadow: 'var(--card-shadow)',
        color: 'var(--app-text, var(--text))',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CanteenSettingsStat({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px solid var(--app-border, var(--border))',
        background: 'var(--theme-accent-soft)',
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--theme-accent-text)' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: 'var(--app-text, var(--text))', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

export default function CanteenSettingsSection({
  actions = null,
  stats = null,
  children,
}) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div> : null}

      {Array.isArray(stats) && stats.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {stats.map((item) => (
            <CanteenSettingsStat key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      ) : null}

      {children}
    </div>
  )
}
