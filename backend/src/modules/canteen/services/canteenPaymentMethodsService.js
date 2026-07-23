import { randomUUID } from 'crypto'
import { error } from '../../../utils/errors.js'
import * as repo from '../repositories/canteenSettingsRepository.js'

const normalizeText = (value) => String(value || '').trim()

const normalizeNameKey = (value) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeLookupKey = (value) => normalizeNameKey(value)
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '')

const FIXED_ACCOUNT_METHOD_ID = 'credit'
const FIXED_ACCOUNT_METHOD_NAME = 'Veresiye'

const knownTypeMap = {
  cash: 'cash',
  nakit: 'cash',
  card: 'pos',
  kart: 'pos',
  pos: 'pos',
  kredi_karti: 'pos',
  credit_card: 'pos',
  yemek_karti: 'pos',
  multinet: 'pos',
  sodexo: 'pos',
  ticket: 'pos',
  setcard: 'pos',
  metropol: 'pos',
  bank: 'bank',
  banka: 'bank',
  havale: 'bank',
  eft: 'bank',
  iban: 'bank',
  transfer: 'bank',
  account: 'account',
  credit: 'account',
  veresiye: 'account',
  cari: 'account',
  acik_hesap: 'account',
  open_account: 'account',
  online_odeme: 'other',
  online_payment: 'other',
}

const inferMethodType = (...values) => {
  for (const value of values) {
    const key = normalizeLookupKey(value)
    if (!key) continue
    if (knownTypeMap[key]) return knownTypeMap[key]
  }
  return 'other'
}

const buildFixedAccountMethod = (method = {}) => ({
  ...method,
  id: FIXED_ACCOUNT_METHOD_ID,
  name: normalizeText(method.name) || FIXED_ACCOUNT_METHOD_NAME,
  type: 'account',
  enabled: true,
  isDefault: false,
  isDeleted: false,
})

const initialMethodsFromLegacyFlags = (doc = {}) => {
  const methods = []
  if (doc?.cashEnabled !== false) methods.push({ id: 'cash', name: 'Nakit', type: 'cash', enabled: true, isDefault: true, isDeleted: false, sortOrder: methods.length + 1 })
  if ((doc?.posEnabled === undefined ? !!doc?.cardEnabled : !!doc?.posEnabled) === true) methods.push({ id: 'card', name: 'Kart', type: 'pos', enabled: true, isDefault: methods.length === 0, isDeleted: false, sortOrder: methods.length + 1 })
  if ((doc?.bankEnabled === undefined ? !!doc?.ibanEnabled : !!doc?.bankEnabled) === true) methods.push({ id: 'bank', name: 'Banka', type: 'bank', enabled: true, isDefault: methods.length === 0, isDeleted: false, sortOrder: methods.length + 1 })
  methods.push(buildFixedAccountMethod({ sortOrder: methods.length + 1 }))
  return methods
}

const normalizeMethod = (method = {}, fallback = {}) => {
  const name = normalizeText(method.name || method.label || fallback.name)
  const id = normalizeText(method.id || method.key || fallback.id) || randomUUID()
  const type = (() => {
    const raw = normalizeLookupKey(method.type || fallback.type)
    if (['cash', 'pos', 'bank', 'account', 'other'].includes(raw)) return raw
    return inferMethodType(raw, name, id, fallback.name, fallback.id)
  })()
  const normalized = {
    id,
    name,
    type,
    enabled: method.enabled ?? method.isEnabled ?? fallback.enabled ?? true,
    isDefault: method.isDefault ?? fallback.isDefault ?? false,
    isDeleted: method.isDeleted ?? fallback.isDeleted ?? false,
    sortOrder: Number(method.sortOrder ?? fallback.sortOrder ?? 0) || 0,
  }
  if (String(normalized.id) === FIXED_ACCOUNT_METHOD_ID || normalized.type === 'account' && normalizeLookupKey(normalized.name) === 'veresiye') {
    return buildFixedAccountMethod(normalized)
  }
  return normalized
}

const ensureSorted = (methods = []) => {
  const rawList = (Array.isArray(methods) ? methods : [])
    .map((method, index) => normalizeMethod({ ...method, sortOrder: method?.sortOrder ?? index + 1 }))
  const fixedAccount = rawList.find((method) => String(method.id) === FIXED_ACCOUNT_METHOD_ID)
  const list = [
    buildFixedAccountMethod(fixedAccount || {}),
    ...rawList.filter((method) => String(method.id) !== FIXED_ACCOUNT_METHOD_ID)
  ].sort((a, b) => {
    const aPinned = String(a.id) === FIXED_ACCOUNT_METHOD_ID ? 0 : 1
    const bPinned = String(b.id) === FIXED_ACCOUNT_METHOD_ID ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned
    return (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'tr')
  })

  const visibleEnabled = list.filter((method) => method.isDeleted !== true && method.enabled === true)
  const preferredDefault = visibleEnabled.find((method) => method.isDefault === true) || visibleEnabled[0] || null

  return list.map((method, index) => ({
    ...method,
    sortOrder: index + 1,
    isDefault: String(method.id) === FIXED_ACCOUNT_METHOD_ID
      ? false
      : (preferredDefault ? (String(method.id) === String(preferredDefault.id) && method.isDeleted !== true && method.enabled === true) : false),
  }))
}

const validateMethods = (methods = []) => {
  const visible = methods.filter((method) => method.isDeleted !== true)
  const seenIds = new Set()
  const seenNames = new Set()

  for (const method of visible) {
    const id = normalizeText(method.id)
    const name = normalizeText(method.name)
    if (!id) throw error('invalid_payment_method', 'Odeme yontemi kimligi bos olamaz', 400)
    if (!name) throw error('invalid_payment_method', 'Odeme yontemi adi bos olamaz', 400)
    if (seenIds.has(id)) throw error('duplicate_payment_method', 'Ayni odeme yontemi iki kez eklenemez', 400)
    seenIds.add(id)
    const nameKey = normalizeNameKey(name)
    if (seenNames.has(nameKey)) throw error('duplicate_payment_method_name', 'Ayni isimde aktif odeme yontemi olamaz', 400)
    seenNames.add(nameKey)
  }
}

const sanitizeMethods = (methods = []) => {
  const sanitized = []
  const seenIds = new Set()
  const seenNames = new Set()

  for (const rawMethod of Array.isArray(methods) ? methods : []) {
    const method = normalizeMethod(rawMethod)
    const id = normalizeText(method.id)
    const name = normalizeText(method.name)
    if (!id || !name) continue

    const nameKey = normalizeNameKey(name)
    if (seenIds.has(id) || seenNames.has(nameKey)) continue

    seenIds.add(id)
    seenNames.add(nameKey)
    sanitized.push(method)
  }

  const hasAccountMethod = sanitized.some((method) => String(method.id) === FIXED_ACCOUNT_METHOD_ID)
  if (!hasAccountMethod) sanitized.unshift(buildFixedAccountMethod({ sortOrder: 0 }))

  return ensureSorted(sanitized)
}

const computeFlagsFromMethods = (methods = [], doc = {}) => {
  const active = methods.filter((method) => method.isDeleted !== true && method.enabled === true)
  return {
    cashEnabled: active.some((method) => method.type === 'cash'),
    cardEnabled: active.some((method) => method.type === 'pos'),
    ibanEnabled: active.some((method) => method.type === 'bank'),
    ibanText: String(doc?.ibanText || ''),
    posEnabled: active.some((method) => method.type === 'pos'),
    bankEnabled: active.some((method) => method.type === 'bank'),
    bankText: String(doc?.bankText || doc?.ibanText || ''),
    accountEnabled: active.some((method) => method.type === 'account'),
  }
}

const toLegacyResponse = (methods = []) => methods.map((method) => ({
  ...method,
  key: method.id,
  label: method.name,
  bucket: method.type === 'pos' ? 'card' : method.type,
  isEnabled: method.enabled === true,
}))

export const getCanteenPaymentSettingsDocument = async (tenantId) => {
  const doc = await repo.findTenantPaymentSettings(tenantId)
  return doc || null
}

export const getCanteenPaymentMethods = async (tenantId, { includeDeleted = false } = {}) => {
  const doc = await getCanteenPaymentSettingsDocument(tenantId)
  const rawMethods = Array.isArray(doc?.paymentMethods) && doc.paymentMethods.length > 0
    ? doc.paymentMethods
    : initialMethodsFromLegacyFlags(doc || {})
  let methods = ensureSorted(rawMethods)
  try {
    validateMethods(methods)
  } catch (err) {
    const code = String(err?.payload?.error || err?.payload?.code || err?.code || '')
    if (
      code !== 'invalid_payment_method'
      && code !== 'duplicate_payment_method'
      && code !== 'duplicate_payment_method_name'
    ) throw err
    methods = sanitizeMethods(rawMethods)
  }
  return includeDeleted ? methods : methods.filter((method) => method.isDeleted !== true)
}

export const getCanteenPaymentSettingsPayload = async (tenantId) => {
  const doc = await getCanteenPaymentSettingsDocument(tenantId)
  const methods = await getCanteenPaymentMethods(tenantId, { includeDeleted: false })
  const flags = computeFlagsFromMethods(methods, doc || {})
  return {
    ...flags,
    paymentMethods: methods,
    methods: toLegacyResponse(methods),
  }
}

export const updateCanteenPaymentSettings = async (tenantId, input = {}) => {
  const currentDoc = await getCanteenPaymentSettingsDocument(tenantId)

  let nextMethods = null
  if (Array.isArray(input?.paymentMethods) || Array.isArray(input?.methods)) {
    const incoming = Array.isArray(input?.paymentMethods) ? input.paymentMethods : input.methods
    const existing = await getCanteenPaymentMethods(tenantId, { includeDeleted: true })
    nextMethods = ensureSorted(incoming.map((method, index) => {
      const fallback = existing.find((item) => String(item.id) === String(method?.id || method?.key)) || {}
      return normalizeMethod({ ...method, sortOrder: method?.sortOrder ?? index + 1 }, fallback)
    }))
    validateMethods(nextMethods)
  } else {
    const currentMethods = await getCanteenPaymentMethods(tenantId, { includeDeleted: true })
    nextMethods = ensureSorted(currentMethods.map((method) => {
      if (method.isDeleted === true) return method
      if (method.type === 'cash' && input?.cashEnabled !== undefined) return { ...method, enabled: !!input.cashEnabled }
      if (method.type === 'pos' && (input?.posEnabled !== undefined || input?.cardEnabled !== undefined)) return { ...method, enabled: input?.posEnabled !== undefined ? !!input.posEnabled : !!input.cardEnabled }
      if (method.type === 'bank' && (input?.bankEnabled !== undefined || input?.ibanEnabled !== undefined)) return { ...method, enabled: input?.bankEnabled !== undefined ? !!input.bankEnabled : !!input.ibanEnabled }
      if (method.type === 'account' && input?.accountEnabled !== undefined) return { ...method, enabled: !!input.accountEnabled }
      return method
    }))
  }

  const flags = computeFlagsFromMethods(nextMethods, {
    ...currentDoc?.toObject?.(),
    ibanText: input?.ibanText === undefined ? currentDoc?.ibanText : String(input.ibanText || ''),
    bankText: input?.bankText === undefined ? currentDoc?.bankText : String(input.bankText || ''),
  })

  await repo.upsertTenantPaymentSettings(tenantId, {
    ...flags,
    ibanText: input?.ibanText === undefined ? flags.ibanText : String(input.ibanText || ''),
    bankText: input?.bankText === undefined ? flags.bankText : String(input.bankText || ''),
    paymentMethods: nextMethods,
  })

  return getCanteenPaymentSettingsPayload(tenantId)
}

export const resolveCanteenPaymentMethodSelection = async (tenantId, methodKey) => {
  const raw = normalizeText(methodKey)
  if (!raw) throw error('invalid_request', 'Invalid payment method', 400)

  const methods = await getCanteenPaymentMethods(tenantId, { includeDeleted: false })
  const enabled = methods.filter((method) => method.enabled === true)
  const source = enabled.length > 0 ? enabled : methods
  const normalizedRaw = normalizeNameKey(raw)

  const selected = source.find((method) => (
    String(method.id) === raw
    || normalizeNameKey(method.name) === normalizedRaw
    || normalizeLookupKey(method.id) === normalizeLookupKey(raw)
  ))

  if (!selected) throw error('invalid_request', 'Invalid payment method', 400)

  return {
    method: selected.id,
    methodId: selected.id,
    methodLabel: selected.name,
    methodName: selected.name,
    methodBucket: selected.type === 'pos' ? 'card' : selected.type,
    methodType: selected.type,
  }
}
