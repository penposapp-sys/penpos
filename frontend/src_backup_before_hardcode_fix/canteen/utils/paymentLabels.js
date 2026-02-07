export const paymentLabel = (key) => {
  const t = String(key || '').trim().toLowerCase()
  if (t === 'cash') return 'Nakit'
  if (t === 'pos' || t === 'card') return 'POS'
  if (t === 'bank') return 'Banka'
  if (t === 'account') return 'Cari / Veresiye'
  return String(key || '')
}

