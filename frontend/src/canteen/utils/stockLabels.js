export const stockActionLabel = (action) => {
  const t = String(action || '').trim().toLowerCase()
  if (t === 'in') return 'Giris'
  if (t === 'out') return 'Cikis'
  if (t === 'adjust') return 'Duzeltme'
  if (t === 'count') return 'Sayim'
  if (t === 'transfer') return 'Transfer'
  if (t === 'waste') return 'Fire'
  return 'Hareket'
}

export const stockSourceLabel = (source) => {
  const t = String(source || '').trim().toLowerCase()
  if (t.includes('sale')) return 'Satis'
  if (t.includes('stock_count')) return 'Sayim'
  if (t.includes('purchase_batch')) return 'Urun Alimi'
  if (t.includes('urun duzenleme')) return 'Urun Duzenleme'
  return 'Manuel'
}

export const stockNoteLabel = (note) => {
  const v = String(note || '').trim()
  if (!v) return ''
  const lower = v.toLowerCase()
  if (lower.startsWith('sale:')) return ''
  if (lower.startsWith('stock_count:')) return ''
  if (lower.startsWith('purchase_batch:')) return ''
  return v
}
