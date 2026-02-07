export const STATUS_LABELS_TR = {
  open: 'Bekliyor',
  pending: 'Bekliyor',
  closed: 'Kapandı',
  sent: 'Hazırlanıyor',
  preparing: 'Hazırlanıyor',
  accepted: 'Onaylandı',
  completed: 'Tamamlandı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
  paid: 'Ödendi',
  unpaid: 'Ödenmedi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  active: 'Aktif',
  inactive: 'Pasif',
  expired: 'Süresi Doldu'
}

export const PAYMENT_METHOD_LABELS_TR = {
  cash: 'Nakit',
  pos: 'Kart',
  card: 'Kart',
  bank: 'Banka',
  transfer: 'Banka',
  other: 'Diğer',
  account: 'Veresiye',
  veresiye: 'Veresiye'
}

export const SERVING_TYPE_LABELS_TR = {
  tray: 'TEPSİDE',
  plate: 'TABAKTA',
  package: 'PAKET'
}

export function trStatusLabel(status) {
  const key = String(status || '').trim()
  return STATUS_LABELS_TR[key] || status
}

export function trPaymentMethodLabel(method) {
  const key = String(method || '').trim()
  return PAYMENT_METHOD_LABELS_TR[key] || method
}

export function trServingTypeLabel(servingType) {
  const key = String(servingType || '').trim()
  return SERVING_TYPE_LABELS_TR[key] || servingType
}
