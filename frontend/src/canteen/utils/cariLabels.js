export const movementTypeLabel = (type) => {
  const t = String(type || '').trim().toLowerCase()
  switch (t) {
    case 'account':
    case 'debt':
    case 'charge':
      return 'Cari Borç'
    case 'collect':
    case 'payment':
      return 'Tahsilat'
    default:
      return ''
  }
}

export const paymentMethodLabel = (method) => {
  const m = String(method || '').trim().toLowerCase()
  switch (m) {
    case 'cash':
      return 'Nakit'
    case 'pos':
    case 'card':
      return 'POS'
    case 'bank':
      return 'Banka'
    case 'discount':
      return 'İndirim'
    case 'account':
    case 'credit':
      return 'Cari'
    default:
      return ''
  }
}
