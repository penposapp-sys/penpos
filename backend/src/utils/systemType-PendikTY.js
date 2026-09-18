const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[ _/]+/g, '-')
    .replace(/-+/g, '-')

export const normalizeSystemType = (value, fallback = null) => {
  const raw = normalizeToken(value)
  if (!raw) return fallback
  if (['restaurant', 'restoran', 'cafe', 'restaurant-cafe', 'kermes'].includes(raw)) return 'restaurant'
  if (['canteen', 'kantin', 'market', 'canteen-market'].includes(raw)) return 'canteen'
  return fallback
}

export const normalizePackageType = normalizeSystemType

export const toLegacySystemType = (value, fallback = null) => {
  const packageType = normalizeSystemType(value)
  if (packageType === 'restaurant') return 'kermes'
  if (packageType === 'canteen') return 'kantin'
  return fallback
}

export const toPanelSystemLabel = (value) => {
  const normalized = normalizeSystemType(value)
  if (normalized === 'restaurant') return 'RESTORAN'
  if (normalized === 'canteen') return 'KANTİN'
  return String(value || '')
}

export const resolveTenantPackageType = (tenant, fallback = null) =>
  normalizeSystemType(
    tenant?.systemType ||
    tenant?.vertical ||
    tenant?.businessType,
    fallback
  )

export const resolvePlanPackageType = (plan, fallback = null) =>
  normalizeSystemType(
    plan?.packageType ||
    plan?.vertical ||
    plan?.systemType ||
    plan?.system ||
    plan?.type,
    fallback
  )

export const getSystemTypeAliases = (value) => {
  const normalizedType = normalizeSystemType(value)
  if (!normalizedType) return []
  if (normalizedType === 'restaurant') {
    return ['restaurant', 'restoran', 'RESTORAN', 'cafe', 'restaurant-cafe', 'kermes']
  }
  return ['canteen', 'kantin', 'KANTİN', 'market', 'canteen-market', 'kantin']
}

export const buildPlanTypeMatchQuery = (value) => {
  const normalizedType = normalizeSystemType(value)
  if (!normalizedType) return []
  const aliases = Array.from(new Set(getSystemTypeAliases(normalizedType)))
  return [
    { packageType: normalizedType },
    { vertical: normalizedType },
    { systemType: normalizedType },
    { systemType: toLegacySystemType(normalizedType) },
    { system: normalizedType },
    ...aliases.map((alias) => ({ system: alias })),
    ...aliases.map((alias) => ({ type: alias })),
  ]
}

export const buildTrialMatchQuery = () => ([
  { isTrial: true },
  { trialDays: 7 },
  { trialDurationDays: 7 },
  { trialPeriodDays: 7 },
])

export const isTrialPlan = (plan) => {
  if (!plan) return false
  if (plan.isTrial === true) return true
  if (Number(plan.trialDays || 0) === 7) return true
  if (Number(plan.trialDurationDays || 0) === 7) return true
  if (Number(plan.trialPeriodDays || 0) === 7) return true
  return /trial|deneme/i.test(String(plan.name || ''))
}
