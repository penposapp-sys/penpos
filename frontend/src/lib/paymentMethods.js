import { trPaymentMethodLabel } from '../i18n/tr.js'

const normalizeText = (value) => String(value || '').trim()

const normalizeLookupKey = (value) => normalizeText(value)
  .toLocaleLowerCase('tr-TR')
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '')

export const inferPaymentMethodType = (value) => {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [
          value.methodType,
          value.type,
          value.methodBucket,
          value.bucket,
          value.methodId,
          value.method,
          value.key,
          value.id,
          value.methodName,
          value.methodLabel,
          value.label,
          value.name,
        ]
      : [value]

  for (const candidate of candidates) {
    const key = normalizeLookupKey(candidate)
    if (!key) continue
    if (['cash', 'nakit'].includes(key)) return 'cash'
    if (['card', 'kart', 'pos', 'credit_card', 'kredi_karti'].includes(key)) return 'card'
    if (['bank', 'banka', 'transfer', 'havale', 'eft', 'iban'].includes(key)) return 'bank'
    if (['account', 'credit', 'veresiye', 'cari', 'acik_hesap'].includes(key)) return 'credit'
    if (['other', 'custom'].includes(key)) return 'other'
  }
  return 'other'
}

export const isCashPaymentMethod = (value) => inferPaymentMethodType(value) === 'cash'

export const paymentMethodLabel = (value) => {
  if (value && typeof value === 'object') {
    const named = normalizeText(value.methodLabel || value.methodName || value.label || value.name)
    if (named) return named
    return trPaymentMethodLabel(value.methodId || value.method || value.key || value.id) || '-'
  }
  return trPaymentMethodLabel(value) || normalizeText(value) || '-'
}

export const pickInitialPaymentMethod = (methods = [], currentMethod = '') => {
  const enabledMethods = (Array.isArray(methods) ? methods : []).filter((method) => method?.isEnabled !== false)
  const current = normalizeText(currentMethod)
  if (current && enabledMethods.some((method) => String(method?.key || method?.id || '') === current)) {
    return current
  }
  const preferred = enabledMethods.find((method) => method?.isDefault === true) || enabledMethods[0]
  return String(preferred?.key || preferred?.id || '').trim()
}
