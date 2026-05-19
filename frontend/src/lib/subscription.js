export const getSubscriptionStatus = (tenantCtx) => {
  const explicit = String(tenantCtx?.tenant?.subscriptionStatus || '').trim()
  if (explicit) return explicit
  return String(tenantCtx?.tenant?.plan?.status || '').trim()
}

export const isSubscriptionExpired = (tenantCtx) => getSubscriptionStatus(tenantCtx) === 'expired'

export const getSubscriptionPortal = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'canteen' || raw === 'kantin' || raw.startsWith('/canteen')) return 'canteen'
  return 'restaurant'
}

export const getSubscriptionUpgradePath = (portalOrPathname) => {
  const portal = getSubscriptionPortal(portalOrPathname)
  return portal === 'canteen' ? '/canteen/ayarlar/paket' : '/kermes/settings/billing'
}

export const getSubscriptionProfilePath = (portalOrPathname) => {
  const portal = getSubscriptionPortal(portalOrPathname)
  return portal === 'canteen' ? '/canteen/ayarlar/me' : '/kermes/settings/me'
}

export const isSubscriptionAllowedPath = (pathname, portalOrPathname) => {
  const path = String(pathname || '')
  const portal = getSubscriptionPortal(portalOrPathname || pathname)

  if (portal === 'canteen') {
    return path === '/canteen/ayarlar' || path === '/canteen/ayarlar/paket' || path === '/canteen/ayarlar/me'
  }

  return path === '/kermes/settings' || path === '/kermes/settings/billing' || path === '/kermes/settings/me'
}
