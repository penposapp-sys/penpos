export const normalizeMethod = (method) => {
  const raw = method === null || method === undefined ? '' : String(method)
  const m = raw.trim().toLowerCase()
  if (!m) return 'pos'
  if (m === 'cash' || m === 'nakit') return 'cash'
  if (m === 'pos' || m === 'card' || m === 'kart' || m === 'kredi_karti' || m === 'credit' || m === 'credit_card' || m === 'other') return 'pos'
  if (m === 'bank' || m === 'transfer' || m === 'eft' || m === 'havale') return 'bank'
  if (m === 'account' || m === 'veresiye' || m === 'credit_account') return 'account'
  return 'pos'
}
