const STATUS_META = {
  open: {
    label: 'Bekliyor',
    compactLabel: 'Bekliyor',
    bg: 'var(--app-surface-soft, var(--panelElevated))',
    border: 'var(--app-border, var(--border))',
    color: 'var(--app-text-secondary, var(--text-secondary))'
  },
  sent: {
    label: 'Hazırlanıyor',
    compactLabel: 'Hazırl.',
    bg: '#eff6ff',
    border: '#93c5fd',
    color: '#1d4ed8'
  },
  preparing: {
    label: 'Hazırlanıyor',
    compactLabel: 'Hazırl.',
    bg: '#eff6ff',
    border: '#93c5fd',
    color: '#1d4ed8'
  },
  cooking: {
    label: 'Ocakta',
    compactLabel: 'Ocakta',
    bg: '#fff7ed',
    border: '#fdba74',
    color: '#c2410c'
  },
  completed: {
    label: 'Hazır',
    compactLabel: 'Hazır',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    color: '#047857'
  },
  ready: {
    label: 'Hazır',
    compactLabel: 'Hazır',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    color: '#047857'
  },
  cancelled: {
    label: 'İptal',
    compactLabel: 'İptal',
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#b91c1c'
  }
}

export const getKitchenItemStatusMeta = (status, { compact = false } = {}) => {
  const key = String(status || '').trim()
  const meta = STATUS_META[key]
  if (!meta) return null
  return {
    ...meta,
    label: compact ? (meta.compactLabel || meta.label) : meta.label
  }
}

export const isKitchenActiveItemStatus = (status) => {
  const key = String(status || '').trim()
  return key === 'sent' || key === 'preparing' || key === 'cooking'
}

export const isKitchenTerminalItemStatus = (status) => {
  const key = String(status || '').trim()
  return key === 'completed' || key === 'ready' || key === 'cancelled'
}
