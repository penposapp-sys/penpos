export const stockActionLabel = (action) => {
  const t = String(action || '').trim().toLowerCase()
  if (t === 'in') return 'Giriş'
  if (t === 'out') return 'Çıkış'
  if (t === 'adjust') return 'Düzeltme'
  if (t === 'count') return 'Sayım'
  if (t === 'transfer') return 'Transfer'
  if (t === 'waste') return 'Fire'
  return 'Hareket'
}

export const stockSourceLabel = (source) => {
  const t = String(source || '').trim().toLowerCase()
  if (t.includes('sale')) return 'Satış'
  if (t.includes('stock_count')) return 'Sayım'
  return 'Manuel'
}

export const stockNoteLabel = (note) => {
  const v = String(note || '').trim()
  if (!v) return ''
  const lower = v.toLowerCase()
  if (lower.startsWith('sale:')) return ''
  if (lower.startsWith('stock_count:')) return ''
  return v
}

