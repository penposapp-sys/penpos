const toMoney = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const computeVeresiyeTotal = (order) => {
  if (!order) return 0
  const entries = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
  if (entries.length > 0) {
    return entries.reduce((sum, e) => sum + toMoney(e?.amount), 0)
  }
  if (order.settlementType === 'veresiye') {
    return toMoney(order.veresiyeAmount)
  }
  return 0
}

const computeCollectionsTotal = (order) => {
  if (!order) return 0
  const entries = Array.isArray(order.collectionEntries) ? order.collectionEntries : []
  return entries.reduce((sum, e) => sum + toMoney(e?.amount), 0)
}

export const computePaymentSummary = (order) => {
  if (!order) {
    return { total: 0, discountTotal: 0, netTotal: 0, paidTotal: 0, balanceDue: 0, veresiyeTotal: 0, paymentsTotal: 0 }
  }
  const items = Array.isArray(order.items) ? order.items : []
  const total = items
    .filter(it => it && it.status !== 'cancelled')
    .reduce((sum, it) => sum + toMoney(it?.subtotal), 0)
  const discountPercent = Math.max(0, Math.min(100, toMoney(order.discountPercent)))
  const discountTotal = toMoney((total * discountPercent) / 100)
  const netTotal = toMoney(Math.max(0, total - discountTotal))

  const payments = Array.isArray(order.payments) ? order.payments : []
  const paymentsTotal = payments.reduce((sum, p) => sum + toMoney(p?.amount), 0)

  const veresiyeTotal = computeVeresiyeTotal(order)
  const collectionsTotal = computeCollectionsTotal(order)
  const paid = toMoney(paymentsTotal + veresiyeTotal + collectionsTotal)
  const balanceDue = toMoney(Math.max(0, netTotal - paid))
  return { total, discountTotal, netTotal, paidTotal: paid, balanceDue, veresiyeTotal, paymentsTotal, collectionsTotal }
}
