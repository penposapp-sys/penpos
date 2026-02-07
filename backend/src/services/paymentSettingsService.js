import { upsert, findByTenantAndBranch } from '../repositories/paymentSettingsRepository.js'
import { log } from './auditService.js'

const defaults = [
  { key: 'cash', label: 'Nakit', isEnabled: true, isDefault: true },
  { key: 'card', label: 'Kart', isEnabled: true, isDefault: false },
  { key: 'bank', label: 'Banka', isEnabled: false, isDefault: false },
  { key: 'credit', label: 'Veresiye', isEnabled: false, isDefault: false }
]

export const getSettingsService = async (tenantId, branchId) => {
  const s = await findByTenantAndBranch(tenantId, branchId)
  const methods = (s && Array.isArray(s.methods) && s.methods.length > 0) ? s.methods : defaults
  return { tenantId, branchId, methods }
}

export const updateSettingsService = async (tenantId, branchId, methods) => {
  const normalized = Array.isArray(methods) ? methods.map(m => ({
    key: m.key,
    label: m.label,
    isEnabled: !!m.isEnabled,
    isDefault: !!m.isDefault
  })) : defaults
  const ensuredSingleDefault = (() => {
    const hasDefault = normalized.some(m => m.isDefault)
    if (!hasDefault) return normalized.map(m => ({ ...m, isDefault: m.key === 'cash' }))
    const firstDefaultKey = normalized.find(m => m.isDefault)?.key
    return normalized.map(m => ({ ...m, isDefault: m.key === firstDefaultKey }))
  })()
  const s = await upsert(tenantId, branchId, ensuredSingleDefault)
  await log(tenantId, null, 'odeme_ayarlari_guncellendi', 'payment_settings', s.id, { branchId })
  return { methods: s.methods }
}
