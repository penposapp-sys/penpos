import { randomUUID } from 'crypto'
import { findTenantById } from '../repositories/tenantRepository.js'
import { error } from '../utils/errors.js'
import { log } from './auditService.js'

const legacyBucketMap = {
  cash: 'cash',
  nakit: 'cash',
  card: 'card',
  kart: 'card',
  pos: 'card',
  credit_card: 'card',
  kredi_karti: 'card',
  bank: 'bank',
  banka: 'bank',
  transfer: 'bank',
  havale: 'bank',
  eft: 'bank',
  iban: 'bank',
  account: 'credit',
  credit: 'credit',
  veresiye: 'credit',
  cari: 'credit',
  acik_hesap: 'credit',
}

const INITIAL_METHODS = [
  { id: 'cash', name: 'Nakit', type: 'cash', enabled: true, isDefault: true, isSystem: false, isDeleted: false, sortOrder: 1 },
  { id: 'card', name: 'Kart', type: 'card', enabled: true, isDefault: false, isSystem: false, isDeleted: false, sortOrder: 2 },
  { id: 'bank', name: 'Banka', type: 'bank', enabled: false, isDefault: false, isSystem: false, isDeleted: false, sortOrder: 3 },
  { id: 'credit', name: 'Veresiye', type: 'credit', enabled: false, isDefault: false, isSystem: false, isDeleted: false, sortOrder: 4 },
]

const normalizeText = (value) => String(value || '').trim()

const normalizeNameKey = (value) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeLookupKey = (value) => normalizeNameKey(value)
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '')

const inferKnownType = (...values) => {
  for (const value of values) {
    const key = normalizeLookupKey(value)
    if (!key) continue
    const mapped = legacyBucketMap[key]
    if (mapped) return mapped
  }
  return null
}

const normalizeStoredType = (value, ...fallbackValues) => {
  const inferredFromName = inferKnownType(...fallbackValues)
  if (inferredFromName) return inferredFromName
  const raw = normalizeLookupKey(value)
  const hasNamedFallback = fallbackValues.some((entry) => normalizeText(entry))
  if (hasNamedFallback) {
    return 'custom'
  }
  if (raw === 'custom' || raw === 'other') {
    return 'custom'
  }
  return legacyBucketMap[raw] || 'custom'
}

const ensureSortOrder = (methods = []) => methods
  .map((method, index) => ({
    ...method,
    sortOrder: Number.isFinite(Number(method?.sortOrder)) ? Number(method.sortOrder) : (index + 1),
  }))
  .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'tr'))
  .map((method, index) => ({
    ...method,
    sortOrder: index + 1,
  }))

const normalizeDefaultFlag = (methods = []) => {
  const visibleEnabled = methods.filter((method) => method.isDeleted !== true && method.enabled === true)
  if (visibleEnabled.length === 0) {
    return methods.map((method) => ({ ...method, isDefault: false }))
  }
  const preferred = visibleEnabled.find((method) => method.isDefault === true) || visibleEnabled[0]
  return methods.map((method) => ({
    ...method,
    isDefault: method.isDeleted !== true && method.enabled === true && String(method.id) === String(preferred.id),
  }))
}

const withLegacyShape = (method) => ({
  ...method,
  key: method.id,
  label: method.name,
  bucket: method.type === 'credit' ? 'account' : (method.type === 'custom' ? 'other' : method.type),
  isEnabled: method.enabled === true,
})

const toLegacyResponse = (methods = []) => methods.map(withLegacyShape)

const normalizeIncomingMethod = (method = {}, fallback = {}) => {
  const id = normalizeText(method.id || method.key || fallback.id)
  const name = normalizeText(method.name || method.label || fallback.name)
  const type = normalizeStoredType(
    method.type || method.bucket || fallback.type,
    name,
    method.label,
    method.key,
    id,
    fallback.name,
    fallback.id
  )
  return {
    id: id || fallback.id || randomUUID(),
    name: name || fallback.name || '',
    type,
    enabled: method.enabled ?? method.isEnabled ?? fallback.enabled ?? true,
    isDefault: method.isDefault ?? fallback.isDefault ?? false,
    isSystem: method.isSystem ?? fallback.isSystem ?? false,
    isDeleted: method.isDeleted ?? fallback.isDeleted ?? false,
    sortOrder: method.sortOrder ?? fallback.sortOrder ?? 0,
  }
}

const validateMethods = (methods = []) => {
  const visibleMethods = methods.filter((method) => method.isDeleted !== true)
  const activeNameSet = new Set()
  for (const method of visibleMethods) {
    if (!normalizeText(method.name)) {
      throw error('invalid_payment_methods', 'Odeme yontemi adi bos olamaz', 400)
    }
    const normalizedName = normalizeNameKey(method.name)
    if (activeNameSet.has(normalizedName)) {
      throw error('duplicate_payment_method_name', 'Ayni isimde aktif odeme yontemi olamaz', 400)
    }
    activeNameSet.add(normalizedName)
  }
}

const normalizeMethodList = (methods = []) => normalizeDefaultFlag(
  ensureSortOrder((Array.isArray(methods) ? methods : []).map((method) => normalizeIncomingMethod(method, {})))
)

const readSettingsSnapshot = (tenant) => {
  const raw = tenant?.settings
  if (!raw) return {}
  if (typeof raw.toObject === 'function') {
    return raw.toObject({ depopulate: true })
  }
  return raw
}

const readTenantMethods = async (tenantId) => {
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  const settings = readSettingsSnapshot(tenant)
  const hasStoredMethods = Object.prototype.hasOwnProperty.call(settings, 'paymentMethods')
  const stored = hasStoredMethods
    ? (Array.isArray(settings?.paymentMethods) ? settings.paymentMethods : [])
    : INITIAL_METHODS
  const methods = normalizeMethodList(stored)
  validateMethods(methods)
  return { tenant, methods }
}

const persistTenantMethods = async (tenantId, methods, actorUserId = null) => {
  const normalized = normalizeMethodList(methods)
  validateMethods(normalized)
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  const currentSettings = readSettingsSnapshot(tenant)
  tenant.settings = {
    ...currentSettings,
    paymentMethods: normalized,
  }
  tenant.markModified('settings')
  await tenant.save()
  await log(tenantId, actorUserId || null, 'odeme_ayarlari_guncellendi', 'Tenant', tenant?.id || tenantId, {})
  return normalized
}

export const getPaymentMethodsService = async (tenantId, { includeDeleted = false } = {}) => {
  const { methods } = await readTenantMethods(tenantId)
  const visibleMethods = includeDeleted ? methods : methods.filter((method) => method.isDeleted !== true)
  return {
    paymentMethods: visibleMethods,
    methods: toLegacyResponse(visibleMethods),
  }
}

export const updatePaymentMethodsService = async (tenantId, methods, actorUserId = null) => {
  const incoming = Array.isArray(methods) ? methods : []
  const { methods: existing } = await readTenantMethods(tenantId)
  const merged = incoming.map((method, index) => {
    const fallback = existing.find((item) => String(item.id) === String(method?.id || method?.key)) || {}
    return normalizeIncomingMethod({ ...method, sortOrder: method?.sortOrder ?? index + 1 }, fallback)
  })
  const saved = await persistTenantMethods(tenantId, merged, actorUserId)
  return {
    paymentMethods: saved.filter((method) => method.isDeleted !== true),
    methods: toLegacyResponse(saved.filter((method) => method.isDeleted !== true)),
  }
}

export const createPaymentMethodService = async (tenantId, name, actorUserId = null) => {
  const safeName = normalizeText(name)
  if (!safeName) throw error('invalid_payment_method_name', 'Odeme yontemi adi bos olamaz', 400)
  const { methods } = await readTenantMethods(tenantId)
  const exists = methods.some((method) => method.isDeleted !== true && normalizeNameKey(method.name) === normalizeNameKey(safeName))
  if (exists) throw error('duplicate_payment_method_name', 'Ayni isimde aktif odeme yontemi olamaz', 400)
  const next = [
    ...methods,
    {
      id: randomUUID(),
      name: safeName,
      type: inferKnownType(safeName) || 'custom',
      enabled: true,
      isDefault: false,
      isSystem: false,
      isDeleted: false,
      sortOrder: methods.length + 1,
    },
  ]
  const saved = await persistTenantMethods(tenantId, next, actorUserId)
  return {
    paymentMethods: saved.filter((method) => method.isDeleted !== true),
    methods: toLegacyResponse(saved.filter((method) => method.isDeleted !== true)),
  }
}

export const patchPaymentMethodService = async (tenantId, id, patch = {}, actorUserId = null) => {
  const methodId = normalizeText(id)
  if (!methodId) throw error('invalid_request', 'Invalid payment method id', 400)
  const { methods } = await readTenantMethods(tenantId)
  const index = methods.findIndex((method) => String(method.id) === methodId)
  if (index === -1) throw error('not_found', 'Payment method not found', 404)
  const current = methods[index]
  if (current.isDeleted === true) throw error('not_found', 'Payment method not found', 404)

  const next = methods.map((method, currentIndex) => {
    if (currentIndex !== index) return { ...method }
    return normalizeIncomingMethod({
      ...method,
      ...patch,
      id: method.id,
      isSystem: false,
      isDeleted: method.isDeleted,
      type: patch.type || method.type,
    }, method)
  })
  const saved = await persistTenantMethods(tenantId, next, actorUserId)
  return {
    paymentMethods: saved.filter((method) => method.isDeleted !== true),
    methods: toLegacyResponse(saved.filter((method) => method.isDeleted !== true)),
  }
}

export const deletePaymentMethodService = async (tenantId, id, actorUserId = null) => {
  const methodId = normalizeText(id)
  const { methods } = await readTenantMethods(tenantId)
  const current = methods.find((method) => String(method.id) === methodId)
  if (!current) throw error('not_found', 'Payment method not found', 404)
  const next = methods.map((method) => (
    String(method.id) === methodId
      ? { ...method, isDeleted: true, enabled: false, isDefault: false }
      : { ...method }
  ))
  const saved = await persistTenantMethods(tenantId, next, actorUserId)
  return {
    paymentMethods: saved.filter((method) => method.isDeleted !== true),
    methods: toLegacyResponse(saved.filter((method) => method.isDeleted !== true)),
  }
}

export const resolvePaymentMethodSelection = async (tenantId, branchId, methodKey) => {
  const raw = normalizeText(methodKey)
  const { paymentMethods } = await getPaymentMethodsService(tenantId, { includeDeleted: false })
  const enabledMethods = paymentMethods.filter((method) => method.enabled === true && method.isDeleted !== true)
  const source = enabledMethods.length > 0 ? enabledMethods : paymentMethods
  const normalizedRaw = raw.toLocaleLowerCase('tr-TR')
  const exact = source.find((method) =>
    String(method.id) === raw
    || normalizeNameKey(method.name) === normalizedRaw
    || String(method.key) === raw
  )

  if (exact) {
    const exactType = normalizeStoredType(exact.type, exact.name, exact.id)
    const methodType = exactType === 'credit' ? 'account' : (exactType === 'custom' ? 'other' : exactType)
    return {
      method: exact.id,
      methodId: exact.id,
      methodLabel: exact.name,
      methodName: exact.name,
      methodBucket: methodType,
      methodType,
    }
  }

  const inferredType = inferKnownType(raw)
  const fallbackType = inferredType || 'other'
  const fallbackName = raw || 'Diger'
  const methodType = fallbackType === 'credit' ? 'account' : fallbackType
  return {
    method: raw || 'other',
    methodId: raw || 'other',
    methodLabel: fallbackName,
    methodName: fallbackName,
    methodBucket: methodType,
    methodType,
  }
}

export const normalizePaymentMethod = (payment = {}) => {
  const methodName = normalizeText(payment?.methodName || payment?.paymentMethodName || payment?.methodLabel)
  const rawMethodId = normalizeText(payment?.methodId || payment?.paymentMethod || payment?.method || payment?.paymentType)
  const inferredType = normalizeStoredType(payment?.methodType || payment?.methodBucket, rawMethodId, methodName)
  if (methodName) {
    return {
      methodId: rawMethodId || 'other',
      methodName,
      methodType: inferredType === 'credit' ? 'credit' : (inferredType === 'custom' ? 'other' : inferredType),
    }
  }
  if (inferredType === 'cash') return { methodId: rawMethodId || 'cash', methodName: 'Nakit', methodType: 'cash' }
  if (inferredType === 'card') return { methodId: rawMethodId || 'card', methodName: 'Kart', methodType: 'card' }
  if (inferredType === 'bank') return { methodId: rawMethodId || 'bank', methodName: 'Banka', methodType: 'bank' }
  if (inferredType === 'credit') return { methodId: rawMethodId || 'credit', methodName: 'Veresiye', methodType: 'credit' }
  return { methodId: rawMethodId || 'other', methodName: 'Diger', methodType: 'other' }
}
