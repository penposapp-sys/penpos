import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import * as repo from '../repositories/canteenSettingsRepository.js'
import * as branchRepo from '../repositories/canteenBranchRepository.js'
import { normalizeThemeId } from '../../../utils/themeNormalization.js'

export const DEFAULT_SETTINGS = Object.freeze({
  allowedBranchIds: [],
  defaultBranchId: null,
  defaultVatRate: 0,
  receiptHeader: '',
  receiptFooter: '',
  appearance: {
    themeId: 'white',
    darkMode: false
  },
  qrTitle: '',
  qrDescription: '',
  qrLogoUrl: '',
  qrCoverImageUrl: '',
  qrPhone: '',
  qrWhatsapp: '',
  qrEmail: '',
  qrAddress: '',
  qrWorkingHours: '',
  qrTheme: 'green'
})

const QR_THEME_IDS = new Set(['dark', 'blue', 'green', 'orange'])
const withAssetVersion = (url, versionSource) => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const version = versionSource ? new Date(versionSource).getTime() : 0
  if (!version) return raw
  return `${raw}${raw.includes('?') ? '&' : '?'}v=${version}`
}
export const DEFAULT_PAYMENT_SETTINGS = Object.freeze({
  cashEnabled: true,
  cardEnabled: true,
  ibanEnabled: false,
  ibanText: '',
  posEnabled: true,
  bankEnabled: false,
  bankText: '',
  accountEnabled: true
})

export const getSettings = async (tenantId) => {
  const doc = await repo.findTenantSettings(tenantId)

  const activeBranches = await branchRepo.listByTenant(tenantId)
  const activeIds = new Set((activeBranches || []).map(b => String(b.id || b._id)))

  const storedAllowed = Array.isArray(doc?.canteenAllowedBranchIds)
    ? doc.canteenAllowedBranchIds.map(String).filter(Boolean)
    : []
  const allowedBranchIds = storedAllowed.length > 0
    ? storedAllowed.filter(id => activeIds.has(String(id)))
    : []

  const storedDefault = doc?.canteenDefaultBranchId
    ? String(doc.canteenDefaultBranchId)
    : (doc?.defaultBranchId ? String(doc.defaultBranchId) : null)

  const defaultBranchId = storedDefault && allowedBranchIds.includes(storedDefault)
    ? storedDefault
    : null

  const data = doc ? {
    allowedBranchIds,
    defaultBranchId,
    defaultVatRate: Number(doc.defaultVatRate || 0),
    receiptHeader: String(doc.receiptHeader || ''),
    receiptFooter: String(doc.receiptFooter || ''),
    appearance: {
      themeId: normalizeThemeId(doc.themeId || doc.appearance?.themeId),
      darkMode: doc.darkMode === true
    },
    qrTitle: String(doc.qrTitle || ''),
    qrDescription: String(doc.qrDescription || ''),
    qrLogoUrl: String(doc.qrLogoUrl || ''),
    qrCoverImageUrl: withAssetVersion(doc.qrCoverImageUrl, doc.updatedAt),
    qrPhone: String(doc.qrPhone || ''),
    qrWhatsapp: String(doc.qrWhatsapp || ''),
    qrEmail: String(doc.qrEmail || ''),
    qrAddress: String(doc.qrAddress || ''),
    qrWorkingHours: String(doc.qrWorkingHours || ''),
    qrTheme: QR_THEME_IDS.has(String(doc.qrTheme || '').trim()) ? String(doc.qrTheme || '').trim() : DEFAULT_SETTINGS.qrTheme
  } : { allowedBranchIds, defaultBranchId }

  return { ...DEFAULT_SETTINGS, ...data }
}

export const updateSettings = async (tenantId, input) => {
  const patch = input || {}

  let allowedBranchIds = undefined
  if (patch.allowedBranchIds !== undefined) {
    if (!Array.isArray(patch.allowedBranchIds) || patch.allowedBranchIds.length === 0) {
      throw error('invalid_request', 'allowedBranchIds boş olamaz', 400)
    }
    const ids = patch.allowedBranchIds.map(String).map(s => s.trim()).filter(Boolean)
    const uniq = Array.from(new Set(ids))
    if (uniq.length === 0) throw error('invalid_request', 'allowedBranchIds boş olamaz', 400)
    for (const id of uniq) {
      if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Geçersiz şube id', 400)
    }
    const branches = await branchRepo.listActiveByIdsAndTenant(uniq, tenantId)
    if ((branches || []).length !== uniq.length) {
      throw error('invalid_request', 'Şubeler tenant’a ait olmalı ve pasif olamaz', 400)
    }
    allowedBranchIds = uniq
  }

  let defaultBranchId = undefined
  if (patch.defaultBranchId !== undefined) {
    defaultBranchId = patch.defaultBranchId ? String(patch.defaultBranchId).trim() : null
    if (defaultBranchId && !mongoose.isValidObjectId(defaultBranchId)) {
      throw error('invalid_request', 'Geçersiz varsayılan şube id', 400)
    }
  }

  if (allowedBranchIds !== undefined) {
    if (defaultBranchId && !allowedBranchIds.includes(defaultBranchId)) {
      throw error('invalid_request', 'defaultBranchId allowedBranchIds içinde olmalı', 400)
    }
    if (defaultBranchId === undefined) {
      const current = await repo.findTenantSettings(tenantId)
      const currentDefault = current?.canteenDefaultBranchId
        ? String(current.canteenDefaultBranchId)
        : (current?.defaultBranchId ? String(current.defaultBranchId) : null)
      defaultBranchId = currentDefault && allowedBranchIds.includes(currentDefault)
        ? currentDefault
        : allowedBranchIds[0]
    }
    if (defaultBranchId === null) {
      defaultBranchId = allowedBranchIds[0]
    }
  }

  const next = {
    canteenAllowedBranchIds: allowedBranchIds === undefined ? undefined : allowedBranchIds,
    canteenDefaultBranchId: defaultBranchId === undefined ? undefined : defaultBranchId,
    defaultBranchId: defaultBranchId === undefined ? undefined : defaultBranchId,
    defaultVatRate: patch.defaultVatRate === undefined ? undefined : Number(patch.defaultVatRate || 0),
    receiptHeader: patch.receiptHeader === undefined ? undefined : String(patch.receiptHeader || ''),
    receiptFooter: patch.receiptFooter === undefined ? undefined : String(patch.receiptFooter || ''),
    themeId: patch.appearance?.themeId === undefined && patch.themeId === undefined
      ? undefined
      : normalizeThemeId(patch.appearance?.themeId ?? patch.themeId),
    darkMode: patch.appearance?.darkMode === undefined && patch.darkMode === undefined
      ? undefined
      : (patch.appearance?.darkMode ?? patch.darkMode) === true,
    qrTitle: patch.qrTitle === undefined ? undefined : String(patch.qrTitle || ''),
    qrDescription: patch.qrDescription === undefined ? undefined : String(patch.qrDescription || ''),
    qrLogoUrl: patch.qrLogoUrl === undefined ? undefined : String(patch.qrLogoUrl || ''),
    qrCoverImageUrl: patch.qrCoverImageUrl === undefined ? undefined : String(patch.qrCoverImageUrl || ''),
    qrPhone: patch.qrPhone === undefined ? undefined : String(patch.qrPhone || ''),
    qrWhatsapp: patch.qrWhatsapp === undefined ? undefined : String(patch.qrWhatsapp || ''),
    qrEmail: patch.qrEmail === undefined ? undefined : String(patch.qrEmail || ''),
    qrAddress: patch.qrAddress === undefined ? undefined : String(patch.qrAddress || ''),
    qrWorkingHours: patch.qrWorkingHours === undefined ? undefined : String(patch.qrWorkingHours || ''),
    qrTheme: patch.qrTheme === undefined
      ? undefined
      : (QR_THEME_IDS.has(String(patch.qrTheme || '').trim()) ? String(patch.qrTheme || '').trim() : DEFAULT_SETTINGS.qrTheme)
  }

  const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined))
  await repo.upsertTenantSettings(tenantId, cleaned)
  return getSettings(tenantId)
}

export const getPaymentSettings = async (tenantId) => {
  const doc = await repo.findTenantPaymentSettings(tenantId)
  const data = doc ? {
    cashEnabled: !!doc.cashEnabled,
    cardEnabled: !!doc.cardEnabled,
    ibanEnabled: !!doc.ibanEnabled,
    ibanText: String(doc.ibanText || ''),
    posEnabled: doc.posEnabled === undefined ? !!doc.cardEnabled : !!doc.posEnabled,
    bankEnabled: doc.bankEnabled === undefined ? !!doc.ibanEnabled : !!doc.bankEnabled,
    bankText: String(doc.bankText || doc.ibanText || ''),
    accountEnabled: doc.accountEnabled === undefined ? true : !!doc.accountEnabled
  } : {}
  return { ...DEFAULT_PAYMENT_SETTINGS, ...data }
}

export const updatePaymentSettings = async (tenantId, input) => {
  const next = {
    cashEnabled: input?.cashEnabled === undefined ? undefined : !!input.cashEnabled,
    cardEnabled: input?.cardEnabled === undefined ? undefined : !!input.cardEnabled,
    ibanEnabled: input?.ibanEnabled === undefined ? undefined : !!input.ibanEnabled,
    ibanText: input?.ibanText === undefined ? undefined : String(input.ibanText || ''),
    posEnabled: input?.posEnabled === undefined ? undefined : !!input.posEnabled,
    bankEnabled: input?.bankEnabled === undefined ? undefined : !!input.bankEnabled,
    bankText: input?.bankText === undefined ? undefined : String(input.bankText || ''),
    accountEnabled: input?.accountEnabled === undefined ? undefined : !!input.accountEnabled
  }
  const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined))
  await repo.upsertTenantPaymentSettings(tenantId, cleaned)
  return getPaymentSettings(tenantId)
}

export const updateQrSettings = async (tenantId, branchId, input) => {
  const patch = input || {}
  const settingsPatch = {
    qrTitle: patch.qrTitle === undefined ? undefined : String(patch.qrTitle || ''),
    qrDescription: patch.qrDescription === undefined ? undefined : String(patch.qrDescription || ''),
    qrLogoUrl: patch.qrLogoUrl === undefined ? undefined : String(patch.qrLogoUrl || ''),
    qrCoverImageUrl: patch.qrCoverImageUrl === undefined ? undefined : String(patch.qrCoverImageUrl || ''),
    qrPhone: patch.qrPhone === undefined ? undefined : String(patch.qrPhone || ''),
    qrWhatsapp: patch.qrWhatsapp === undefined ? undefined : String(patch.qrWhatsapp || ''),
    qrEmail: patch.qrEmail === undefined ? undefined : String(patch.qrEmail || ''),
    qrAddress: patch.qrAddress === undefined ? undefined : String(patch.qrAddress || ''),
    qrWorkingHours: patch.qrWorkingHours === undefined ? undefined : String(patch.qrWorkingHours || ''),
    qrTheme: patch.qrTheme === undefined
      ? undefined
      : (QR_THEME_IDS.has(String(patch.qrTheme || '').trim()) ? String(patch.qrTheme || '').trim() : DEFAULT_SETTINGS.qrTheme)
  }
  const cleanedSettingsPatch = Object.fromEntries(Object.entries(settingsPatch).filter(([, value]) => value !== undefined))
  if (Object.keys(cleanedSettingsPatch).length > 0) {
    await repo.upsertTenantSettings(tenantId, cleanedSettingsPatch)
  }

  const products = (Array.isArray(patch.products) ? patch.products : [])
    .map((item) => ({
      id: String(item?.id || item?._id || '').trim(),
      imageUrl: String(item?.imageUrl || '').trim()
    }))
    .filter((item) => item.id)

  if (products.length > 0) {
    const { listByIdsAndScope, updateByIdAndScope } = await import('../repositories/canteenProductRepository.js')
    const existing = await listByIdsAndScope(products.map((item) => item.id), tenantId, branchId)
    const existingIds = new Set((existing || []).map((item) => String(item.id || item._id)))
    await Promise.all(
      products
        .filter((item) => existingIds.has(item.id))
        .map((item) => updateByIdAndScope(item.id, tenantId, branchId, { imageUrl: item.imageUrl }))
    )
  }

  return getSettings(tenantId)
}
