import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api, clearApiCache } from '../lib/apiClient.js'
import { normalizePermissions } from '../constants/permissions.js'
import { clearAllAuthTokens, getAuthToken, removeAuthToken, setAuthToken } from '../lib/authStorage.js'

const AuthContext = createContext()

const resolvePortalFromPathname = (pathname) => {
  const path = String(pathname || '').trim().toLowerCase()
  if (
    path.startsWith('/platform') ||
    path.startsWith('/platform-admin') ||
    path.startsWith('/superadmin') ||
    path.startsWith('/login/platform') ||
    path.startsWith('/platform-login')
  ) return 'platform'
  if (path.startsWith('/canteen') || path.startsWith('/login/kantin')) return 'canteen'
  return 'restaurant'
}

const resolveTokenKeyForPortal = (portal) => {
  const normalizedPortal = String(portal || '').trim().toLowerCase()
  if (normalizedPortal === 'platform') return 'token_platform'
  if (normalizedPortal === 'canteen') return 'token_canteen'
  return 'token_restaurant'
}

const resolveAllowedBranchIds = (normalizedUser, tenantProfile) => {
  const tenantAllowed = Array.isArray(tenantProfile?.allowedBranchIds) ? tenantProfile.allowedBranchIds.map(String).filter(Boolean) : []
  if (String(normalizedUser?.role || '') !== 'staff') return tenantAllowed
  const staffAllowed = Array.isArray(normalizedUser?.accessibleBranchIds) && normalizedUser.accessibleBranchIds.length > 0
    ? normalizedUser.accessibleBranchIds.map(String).filter(Boolean)
    : Array.isArray(normalizedUser?.branchIds) && normalizedUser.branchIds.length > 0
      ? normalizedUser.branchIds.map(String).filter(Boolean)
      : (normalizedUser?.branchId ? [String(normalizedUser.branchId)] : [])
  if (staffAllowed.length === 0) return tenantAllowed
  if (tenantAllowed.length === 0) return staffAllowed
  return tenantAllowed.filter(id => staffAllowed.includes(String(id)))
}

const persistActiveBranchSelection = (normalizedUser, branchIds = []) => {
  const systemType = String(normalizedUser?.systemType || '').trim()
  const primaryBranchId = String(normalizedUser?.branchId || '').trim()
  const normalizedBranchIds = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const fallbackBranchId = normalizedBranchIds.length > 0 ? String(normalizedBranchIds[0] || '').trim() : ''
  const selectedBranchId = systemType === 'kantin' || systemType === 'canteen'
    ? (normalizedBranchIds.includes(primaryBranchId) ? primaryBranchId : fallbackBranchId)
    : (primaryBranchId || fallbackBranchId)
  if (!selectedBranchId) return

  try {
    if (systemType === 'kantin' || systemType === 'canteen') {
      localStorage.setItem('selectedBranchId_canteen', selectedBranchId)
    } else {
      localStorage.setItem('selectedBranchId', selectedBranchId)
    }
  } catch {
  }
}

const normalizeUser = (user) => (user ? { ...user, permissions: normalizePermissions(user.permissions) } : null)

const resolvePortalFromUser = (user) => {
  if (!user) return 'restaurant'
  if (user.role === 'platform_admin' || user.role === 'superadmin') return 'platform'
  if (user.systemType === 'kantin' || user.systemType === 'canteen') return 'canteen'
  return 'restaurant'
}

const restorePortalOrder = (pathname) => {
  const currentPortal = resolvePortalFromPathname(pathname)
  const order = [currentPortal, 'restaurant', 'canteen', 'platform']
  return order.filter((portal, index) => order.indexOf(portal) === index)
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tenantCtx, setTenantCtx] = useState(null)
  const [allowedBranchIds, setAllowedBranchIds] = useState([])

  const initInFlightRef = useRef(false)

  const hydratePortalState = async (portal, meRes) => {
    const meUser = meRes?.user
    const normalized = normalizeUser(meUser)
    setUser(normalized)

    if (normalized?.tenantId) {
      const ctxRes = await api('/api/tenant/context', { silent: true, portalOverride: portal })
      setTenantCtx(ctxRes?.ok ? ctxRes : null)
    } else {
      setTenantCtx(null)
    }

    if (normalized?.tenantId && (normalized.role === 'tenant_admin' || normalized.role === 'staff')) {
      try {
        const res = await api('/api/tenant/profile', { silent: true, portalOverride: portal })
        if (!res?.ok || res?.success === false) {
          setAllowedBranchIds([])
        } else {
          const ids = resolveAllowedBranchIds(normalized, res?.tenant)
          setAllowedBranchIds(ids)
          persistActiveBranchSelection(normalized, ids)
        }
      } catch {
        setAllowedBranchIds([])
      }
    } else {
      setAllowedBranchIds([])
    }

    return normalized
  }

  useEffect(() => {
    const init = async () => {
      if (initInFlightRef.current) return
      initInFlightRef.current = true
      const pathname = (() => {
        try {
          return String(window.location?.pathname || '')
        } catch {
          return ''
        }
      })()

      try {
        for (const portal of restorePortalOrder(pathname)) {
          const tokenKey = resolveTokenKeyForPortal(portal)
          const token = getAuthToken(tokenKey)
          if (!token) continue

          const meRes = await api('/api/auth/me', { silent: true, suppressAuthRedirect: true, portalOverride: portal })
          if (!meRes?.ok || !meRes?.user) {
            removeAuthToken(tokenKey)
            continue
          }

          await hydratePortalState(portal, meRes)
          return
        }

        setUser(null)
        setTenantCtx(null)
        setAllowedBranchIds([])
      } finally {
        setLoading(false)
        initInFlightRef.current = false
      }
    }

    init()
  }, [])

  const login = async ({ identifier, email, password, portal, rememberMe = true }) => {
    const payload = { identifier: identifier ?? email, password, portal }
    const portalOverride =
      portal === 'platform' ? 'platform' :
      portal === 'canteen' ? 'canteen' :
      portal === 'kermes' ? 'kermes' :
      portal === 'restaurant' ? 'restaurant' :
      'restaurant'
    const tokenKey = resolveTokenKeyForPortal(portalOverride)

    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      data: payload,
      silent: true,
      suppressAuthRedirect: true,
      portalOverride,
    })
    if (loginRes?.ok === false || !loginRes?.token) {
      const err = new Error(loginRes?.message || 'Login failed')
      err.code = loginRes?.code || loginRes?.error || null
      err.response = { status: loginRes?.status, data: loginRes?.data || loginRes }
      throw err
    }

    setAuthToken(tokenKey, loginRes.token, rememberMe !== false)
    const meRes = await api('/api/auth/me', { silent: true, suppressAuthRedirect: true, portalOverride })
    if (meRes?.ok === false || !meRes?.user) {
      removeAuthToken(tokenKey)
      const err = new Error(meRes?.message || 'Login failed')
      err.code = meRes?.code || null
      err.response = { status: meRes?.status, data: meRes?.data || meRes }
      throw err
    }

    return hydratePortalState(resolvePortalFromUser(meRes.user), meRes)
  }

  const logout = () => {
    const pathname = (() => {
      try {
        return String(window.location?.pathname || '')
      } catch {
        return ''
      }
    })()
    const nextPath = (() => {
      if (pathname.startsWith('/platform') || pathname.startsWith('/platform-admin') || pathname.startsWith('/superadmin') || String(user?.role || '') === 'platform_admin' || String(user?.role || '') === 'superadmin') {
        return '/platform-login'
      }
      if (pathname.startsWith('/canteen') || String(user?.systemType || '') === 'kantin' || String(user?.systemType || '') === 'canteen') {
        return '/canteen/login'
      }
      return '/login/restoran'
    })()

    clearAllAuthTokens()
    localStorage.removeItem('selectedBranchId')
    localStorage.removeItem('selectedBranchId_canteen')
    localStorage.removeItem('activeSystem')
    localStorage.removeItem('lastSystem')
    clearApiCache()
    setUser(null)
    setTenantCtx(null)
    setAllowedBranchIds([])
    try {
      if (typeof window !== 'undefined') window.location.replace(nextPath)
    } catch {}
  }

  const refresh = async () => {
    const portal = resolvePortalFromUser(user) || resolvePortalFromPathname(window.location?.pathname || '')
    const tokenKey = resolveTokenKeyForPortal(portal)
    if (!getAuthToken(tokenKey)) return

    try {
      const meRes = await api('/api/auth/me', { silent: true, portalOverride: portal })
      if (!meRes?.ok || !meRes?.user) return
      await hydratePortalState(portal, meRes)
    } catch {
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, tenantCtx, allowedBranchIds, setAllowedBranchIds }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
