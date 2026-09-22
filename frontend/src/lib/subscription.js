export const getSubscriptionStatus = (tenantCtx) => {
  const explicit = String(tenantCtx?.tenant?.subscriptionStatus || '').trim()
  if (explicit) return explicit
  return String(tenantCtx?.tenant?.plan?.status || '').trim()
}

export const isSubscriptionExpired = (tenantCtx) => getSubscriptionStatus(tenantCtx) === 'expired'

export const getSubscriptionPortal = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'canteen' || raw === 'kantin' || raw.startsWith('/magaza')) return 'canteen'
  return 'restaurant'
}

export const getSubscriptionUpgradePath = (portalOrPathname) => {
  const portal = getSubscriptionPortal(portalOrPathname)
  return portal === 'canteen' ? '/magaza/ayarlar/paket' : '/restoran/settings/billing'
}

export const getSubscriptionProfilePath = (portalOrPathname) => {
  const portal = getSubscriptionPortal(portalOrPathname)
  return portal === 'canteen' ? '/magaza/ayarlar/me' : '/restoran/settings/me'
}

export const isSubscriptionAllowedPath = (pathname, portalOrPathname) => {
  const path = String(pathname || '')
  const portal = getSubscriptionPortal(portalOrPathname || pathname)

  if (portal === 'canteen') {
    return path === '/magaza/ayarlar' || path === '/magaza/ayarlar/paket' || path === '/magaza/ayarlar/me'
  }

  return path === '/restoran/settings' || path === '/restoran/settings/billing' || path === '/restoran/settings/me'
}
