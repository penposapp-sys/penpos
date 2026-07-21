export const buildCanteenPaymentMethods = (settings = {}) => {
  if (Array.isArray(settings?.paymentMethods) && settings.paymentMethods.length > 0) {
    return settings.paymentMethods
      .filter((method) => method?.isDeleted !== true && method?.enabled === true)
      .map((method, index) => ({
        id: String(method?.id || method?.key || ''),
        name: String(method?.name || method?.label || ''),
        type: String(method?.type || '').trim().toLowerCase() || 'other',
        isDefault: method?.isDefault === true || index === 0,
      }))
      .filter((method) => method.id && method.name)
  }

  const methods = []

  if (settings?.cashEnabled !== false) {
    methods.push({ id: 'cash', name: 'Nakit', type: 'cash', isDefault: true })
  }
  if (settings?.posEnabled !== false) {
    methods.push({ id: 'card', name: 'Kart', type: 'pos', isDefault: methods.length === 0 })
  }
  if (settings?.bankEnabled === true) {
    methods.push({ id: 'bank', name: 'Banka', type: 'bank', isDefault: methods.length === 0 })
  }
  if (settings?.accountEnabled !== false) {
    methods.push({ id: 'credit', name: 'Veresiye', type: 'account', isDefault: methods.length === 0 })
  }

  return methods
}
