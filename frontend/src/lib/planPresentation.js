import { formatAdminDate } from '../components/AdminListUi.jsx'

export const normalizePlanTenantType = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (['restaurant', 'restoran', 'cafe', 'restaurant-cafe', 'kermes'].includes(raw)) return 'restaurant'
  if (['canteen', 'kantin', 'market', 'canteen-market'].includes(raw)) return 'canteen'
  return raw
}

export const resolvePlanType = (plan) =>
  normalizePlanTenantType(plan?.type || plan?.packageType || plan?.vertical || plan?.systemType || plan?.businessType)

export const resolveTenantType = (tenant) =>
  normalizePlanTenantType(tenant?.systemType || tenant?.type || tenant?.vertical || tenant?.businessType)

export const getPlanDisplayName = (value) =>
  String(
    value?.currentPlanName ||
    value?.expiredPlanName ||
    value?.planName ||
    value?.name ||
    ''
  ).trim()

export const hasPlanInfo = (value) =>
  !!(getPlanDisplayName(value) || value?.id || value?._id || value?.currentPlanId)

export const getRemainingDays = (planEndDate) => {
  if (!planEndDate) return null
  const endDate = new Date(planEndDate)
  if (Number.isNaN(endDate.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)
  return Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export const getPlanStatus = (value) => {
  const explicit = String(
    value?.subscriptionStatus ||
    value?.packageStatus ||
    value?.planStatus ||
    value?.status ||
    ''
  ).trim().toLowerCase()

  if (explicit === 'trial' || explicit === 'active' || explicit === 'expired' || explicit === 'inactive') {
    return explicit
  }

  const remainingDays = getRemainingDays(value?.endsAt || value?.planEndsAt || value?.trialEndsAt)
  if (remainingDays === null) return hasPlanInfo(value) ? 'inactive' : 'none'
  return remainingDays < 0 ? 'expired' : 'active'
}

export const formatPlanBadge = (value) => {
  const status = getPlanStatus(value)
  if (status === 'trial') return { key: 'trial', label: 'Deneme aktif', tone: 'info' }
  if (status === 'active') return { key: 'active', label: 'Aktif paket', tone: 'success' }
  if (status === 'expired') return { key: 'expired', label: 'Süresi doldu', tone: 'danger' }
  if (status === 'inactive' && hasPlanInfo(value)) return { key: 'inactive', label: 'Plan atanmamış', tone: 'neutral' }
  return { key: 'inactive', label: 'Plan bilgisi bulunamadı', tone: 'neutral' }
}

export const getRemainingPlanMeta = (value) => {
  const remainingDays = getRemainingDays(value?.endsAt || value?.planEndsAt || value?.trialEndsAt)
  const status = getPlanStatus(value)

  if (status === 'expired') return { label: 'Süresi doldu', status: 'expired', tone: 'danger', days: remainingDays }
  if (remainingDays === null) {
    return {
      label: hasPlanInfo(value) ? 'Süre bilgisi yok' : 'Plan bilgisi bulunamadı',
      status: 'none',
      tone: 'neutral',
      days: null
    }
  }
  if (remainingDays === 0) return { label: 'Bugün bitiyor', status: 'today', tone: 'danger', days: 0 }
  if (remainingDays <= 6) return { label: `${remainingDays} gün kaldı`, status: 'active', tone: 'danger', days: remainingDays }
  if (remainingDays <= 15) return { label: `${remainingDays} gün kaldı`, status: 'active', tone: 'warning', days: remainingDays }
  return { label: `${remainingDays} gün kaldı`, status: 'active', tone: 'success', days: remainingDays }
}

export const formatPlanDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatAdminDate(date)
}
