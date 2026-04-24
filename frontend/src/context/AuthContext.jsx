import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api, clearApiCache } from '../lib/apiClient.js'
import { normalizePermissions } from '../constants/permissions.js'

const AuthContext = createContext()

const resolveAllowedBranchIds = (normalizedUser, tenantProfile) => {
  const tenantAllowed = Array.isArray(tenantProfile?.allowedBranchIds) ? tenantProfile.allowedBranchIds.map(String).filter(Boolean) : []
  if (String(normalizedUser?.role || '') !== 'staff') return tenantAllowed
  const staffAllowed = Array.isArray(normalizedUser?.branchIds) && normalizedUser.branchIds.length > 0
    ? normalizedUser.branchIds.map(String).filter(Boolean)
    : (normalizedUser?.branchId ? [String(normalizedUser.branchId)] : [])
  return tenantAllowed.filter(id => staffAllowed.includes(String(id)))
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
      const tokenKey = pathname.startsWith('/platform') || pathname.startsWith('/platform-admin') || pathname.startsWith('/superadmin') || pathname.startsWith('/login/platform')
        ? 'token_platform'
        : 'token_restaurant'
      const token = localStorage.getItem(tokenKey)
      if (!token) {
        setLoading(false)
        initInFlightRef.current = false
        return
      }
      try {
        const portalOverride = tokenKey === 'token_platform' ? 'platform' : 'restaurant'
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
        if (import.meta.env.DEV && normalized) {
          try {
            console.log('[AUTH]', { role: normalized.role, systemType: normalized.systemType || null, permissions: normalized.permissions, branchId: normalized.branchId || null, branchIds: normalized.branchIds || [] })
          } catch {}
        }
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
          if (ids.length === 1) {
            localStorage.setItem('selectedBranchId', String(ids[0]))
          }
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
    const portalOverride = portal === 'platform' ? 'platform' : 'restaurant'
    const tokenKey = portal === 'platform' ? 'token_platform' : 'token_restaurant'
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      data: payload,
      silent: true,
      suppressAuthRedirect: true,
      portalOverride
    })
    if (!loginRes?.ok || !loginRes?.token) {
      const err = new Error(loginRes?.message || 'Giriş başarısız')
      err.code = loginRes?.code || null
      throw err
    }

    localStorage.setItem(tokenKey, loginRes.token)
    const meRes = await api('/api/auth/me', { silent: true, suppressAuthRedirect: true, portalOverride })
    if (!meRes?.ok) {
      try {
        localStorage.removeItem(tokenKey)
      } catch {}
      const err = new Error(meRes?.message || 'Giriş başarısız')
      err.code = meRes?.code || null
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
          if (ids.length === 1) {
            localStorage.setItem('selectedBranchId', String(ids[0]))
          }
        }
      } catch {
        setAllowedBranchIds([])
      }
    } else {
      setAllowedBranchIds([])
    }

    return normalized
  }

  const logout = () => {
    localStorage.removeItem('token_platform')
    localStorage.removeItem('token_restaurant')
    localStorage.removeItem('selectedBranchId')
    localStorage.removeItem('activeSystem')
    localStorage.removeItem('lastSystem')
    clearApiCache()
    setUser(null)
    setTenantCtx(null)
    setAllowedBranchIds([])
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
      const portalOverride = pathname.startsWith('/platform') || pathname.startsWith('/platform-admin') || pathname.startsWith('/superadmin') || pathname.startsWith('/login/platform')
        ? 'platform'
        : 'restaurant'
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
            if (ids.length === 1) {
              localStorage.setItem('selectedBranchId', String(ids[0]))
            }
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
