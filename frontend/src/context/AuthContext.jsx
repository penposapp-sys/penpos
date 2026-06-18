import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api, clearApiCache } from '../lib/apiClient.js'
import { normalizePermissions } from '../constants/permissions.js'

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
  if (path.startsWith('/kermes') || path.startsWith('/login/restoran')) return 'restaurant'
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
  const fallbackBranchId = Array.isArray(branchIds) && branchIds.length > 0 ? String(branchIds[0] || '').trim() : ''
  const selectedBranchId = primaryBranchId || fallbackBranchId
  if (!selectedBranchId) return

  try {
    if (systemType === 'kantin') {
      localStorage.setItem('selectedBranchId_canteen', selectedBranchId)
    } else {
      localStorage.setItem('selectedBranchId', selectedBranchId)
    }
  } catch {
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tenantCtx, setTenantCtx] = useState(null)
  const [allowedBranchIds, setAllowedBranchIds] = useState([])

  const initInFlightRef = useRef(false)

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
      const portal = resolvePortalFromPathname(pathname)
      const tokenKey = resolveTokenKeyForPortal(portal)
      const token = localStorage.getItem(tokenKey)
      if (!token) {
        setLoading(false)
        initInFlightRef.current = false
        return
      }
      try {
        const portalOverride = portal
        const meRes = await api('/api/auth/me', { silent: true, portalOverride })
        if (!meRes?.ok) {
          localStorage.removeItem(tokenKey)
          setUser(null)
          setTenantCtx(null)
          setAllowedBranchIds([])
          return
        }
        const user = meRes?.user
        const normalized = user ? { ...user, permissions: normalizePermissions(user.permissions) } : null
        setUser(normalized)
        if (normalized?.tenantId) {
          const ctxRes = await api('/api/tenant/context', { silent: true, portalOverride })
          setTenantCtx(ctxRes?.ok ? ctxRes : null)
        } else {
          setTenantCtx(null)
        }

        if (normalized?.tenantId && (normalized.role === 'tenant_admin' || normalized.role === 'staff')) {
          try {
            const res = await api('/api/tenant/profile', { silent: true, portalOverride })
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
      } catch {
        localStorage.removeItem(tokenKey)
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

  const login = async ({ identifier, email, password, portal }) => {
    const payload = { identifier: identifier ?? email, password, portal }
    const portalOverride =
      portal === 'platform' ? 'platform' :
      portal === 'canteen' ? 'canteen' :
      portal === 'kermes' ? 'kermes' :
      portal === 'restaurant' ? 'restaurant' :
      'restaurant'
    const tokenKey = resolveTokenKeyForPortal(portalOverride)

    try {
      console.log('[LOGIN_REQUEST]', {
        identifier: payload.identifier,
        portal: payload.portal,
      })
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        data: payload,
        silent: true,
        suppressAuthRedirect: true,
        portalOverride
      })
      if (loginRes?.ok === false || !loginRes?.token) {
        const err = new Error(loginRes?.message || 'Giriş başarısız')
        err.code = loginRes?.code || null
        err.response = { status: loginRes?.status, data: loginRes?.data }
        throw err
      }

      localStorage.setItem(tokenKey, loginRes.token)
      const meRes = await api('/api/auth/me', { silent: true, suppressAuthRedirect: true, portalOverride })
      if (meRes?.ok === false || !meRes?.user) {
        try {
          localStorage.removeItem(tokenKey)
        } catch {}
        const err = new Error(meRes?.message || 'Giriş başarısız')
        err.code = meRes?.code || null
        err.response = { status: meRes?.status, data: meRes?.data }
        throw err
      }
      const meUser = meRes?.user
      const normalized = meUser ? { ...meUser, permissions: normalizePermissions(meUser.permissions) } : null
      setUser(normalized)
      if (normalized?.tenantId) {
        const ctxRes = await api('/api/tenant/context', { silent: true, suppressAuthRedirect: true, portalOverride })
        setTenantCtx(ctxRes?.ok ? ctxRes : null)
      } else {
        setTenantCtx(null)
      }

      if (normalized?.tenantId && (normalized.role === 'tenant_admin' || normalized.role === 'staff')) {
        try {
          const res = await api('/api/tenant/profile', { silent: true, suppressAuthRedirect: true, portalOverride })
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
    } catch (err) {
      console.error('[LOGIN_ERROR]', {
        identifier: payload.identifier,
        portal: payload.portal,
        status: err?.response?.status,
        data: err?.response?.data,
      })
      throw err
    }
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
      if (pathname.startsWith('/canteen') || String(user?.systemType || '') === 'kantin') return '/canteen/login'
      if (
        pathname.startsWith('/platform') ||
        pathname.startsWith('/platform-admin') ||
        pathname.startsWith('/superadmin') ||
        String(user?.role || '') === 'platform_admin' ||
        String(user?.role || '') === 'superadmin'
      ) {
        return '/platform-login'
      }
      return '/login/restoran'
    })()

    localStorage.removeItem('token_platform')
    localStorage.removeItem('token_restaurant')
    localStorage.removeItem('token_canteen')
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
    try {
      const pathname = (() => {
        try {
          return String(window.location?.pathname || '')
        } catch {
          return ''
        }
      })()
      const portalOverride = resolvePortalFromPathname(pathname)
      const meRes = await api('/api/auth/me', { silent: true, portalOverride })
      if (!meRes?.ok) return
      const user = meRes?.user
      const normalized = user ? { ...user, permissions: normalizePermissions(user.permissions) } : null
      setUser(normalized)
      if (normalized?.tenantId) {
        const ctxRes = await api('/api/tenant/context', { silent: true, portalOverride })
        setTenantCtx(ctxRes?.ok ? ctxRes : null)
      } else {
        setTenantCtx(null)
      }

      if (normalized?.tenantId && (normalized.role === 'tenant_admin' || normalized.role === 'staff')) {
        try {
          const res = await api('/api/tenant/profile', { silent: true, portalOverride })
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
