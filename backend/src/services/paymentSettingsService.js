import { upsert, findByTenantAndBranch } from '../repositories/paymentSettingsRepository.js'
import { log } from './auditService.js'

const defaults = [
  { key: 'cash', label: 'Nakit', bucket: 'cash', isEnabled: true, isDefault: true },
  { key: 'card', label: 'Kart', bucket: 'card', isEnabled: true, isDefault: false },
  { key: 'bank', label: 'Banka', bucket: 'bank', isEnabled: false, isDefault: false },
  { key: 'account', label: 'Veresiye', bucket: 'account', isEnabled: false, isDefault: false }
]

const allowedBuckets = new Set(['cash', 'card', 'bank', 'account', 'other'])

const slugifyKey = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

const inferBucket = (key = '') => {
  const raw = String(key || '').trim().toLowerCase()
  if (raw === 'cash' || raw === 'nakit') return 'cash'
  if (raw === 'card' || raw === 'pos' || raw === 'kart') return 'card'
  if (raw === 'bank' || raw === 'transfer' || raw === 'eft' || raw === 'havale') return 'bank'
  if (raw === 'account' || raw === 'credit' || raw === 'veresiye') return 'account'
  return 'other'
}

const normalizeMethodShape = (methods = []) => {
  const list = Array.isArray(methods) ? methods : []
  const seen = new Set()
  const normalized = []

  for (const method of list) {
    const label = String(method?.label || '').trim()
    const rawKey = String(method?.key || '').trim()
    const key = slugifyKey(rawKey || label)
    if (!label || !key || seen.has(key)) continue
    seen.add(key)

    const bucketCandidate = String(method?.bucket || '').trim().toLowerCase()
    const bucket = allowedBuckets.has(bucketCandidate) ? bucketCandidate : inferBucket(key)

    normalized.push({
      key,
      label,
      bucket,
      isEnabled: method?.isEnabled !== false,
      isDefault: !!method?.isDefault
    })
  }

  return normalized
}

const ensureSingleDefault = (methods = []) => {
  const list = Array.isArray(methods) ? methods : []
  if (list.length === 0) return defaults.map((m) => ({ ...m }))

  const enabled = list.filter((m) => m.isEnabled)
  const defaultKey = list.find((m) => m.isDefault)?.key || enabled[0]?.key || list[0]?.key || 'cash'

  return list.map((m) => ({
    ...m,
    isDefault: m.key === defaultKey
  }))
}

export const getSettingsService = async (tenantId, branchId) => {
  let s = await findByTenantAndBranch(tenantId, branchId)
  if (!s && branchId) {
    s = await findByTenantAndBranch(tenantId, null)
  }
  const methods = s && Array.isArray(s.methods) && s.methods.length > 0
    ? ensureSingleDefault(normalizeMethodShape(s.methods))
    : defaults.map((m) => ({ ...m }))
  return { tenantId, branchId, methods }
}

export const updateSettingsService = async (tenantId, branchId, methods) => {
  const normalized = normalizeMethodShape(methods)
  const ensuredSingleDefault = ensureSingleDefault(normalized)
  const s = await upsert(tenantId, branchId, ensuredSingleDefault)
  await log(tenantId, null, 'odeme_ayarlari_guncellendi', 'payment_settings', s.id, { branchId })
  return { methods: s.methods }
}

export const resolvePaymentMethodSelection = async (tenantId, branchId, methodKey) => {
  const raw = String(methodKey || '').trim()
  const normalizedKey = slugifyKey(raw)
  const { methods } = await getSettingsService(tenantId, branchId)
  const enabledMethods = (methods || []).filter((m) => m.isEnabled)
  const allMethods = enabledMethods.length > 0 ? enabledMethods : (methods || [])
  const exact = allMethods.find((m) => m.key === normalizedKey || m.key === raw)
  if (exact) {
    return {
      method: exact.key,
      methodLabel: exact.label,
      methodBucket: exact.bucket || inferBucket(exact.key)
    }
  }

  const fallbackBucket = inferBucket(normalizedKey || raw)
  const fallbackLabel = raw || 'Diger'
  return {
    method: normalizedKey || 'other',
    methodLabel: fallbackLabel,
    methodBucket: fallbackBucket
  }
}
