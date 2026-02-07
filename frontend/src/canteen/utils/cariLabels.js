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
      return 'POS'
    case 'bank':
      return 'Banka'
    case 'account':
      return 'Cari'
    default:
      return ''
  }
}

