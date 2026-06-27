import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getSubscriptionUpgradePath, isSubscriptionExpired } from '../lib/subscription.js'

const normalizeSystemType = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'canteen' || raw === 'kantin') return 'canteen'
  if (raw === 'restaurant' || raw === 'kermes') return 'kermes'
  return raw
}

export default function ProtectedRoute({ roles, permissions, permissionsMode = 'all', system, allowExpired = false, children }) {
  const { user, loading, tenantCtx } = useAuth()
  const { pathname } = useLocation()

  if (loading) {
    return null
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <div className="card">403 - Bu sistem icin yetkiniz yok</div>
  }

  if (system) {
    const expectedSystem = normalizeSystemType(system)
    const userSystem = normalizeSystemType(user.systemType)
    const tenantSystem = normalizeSystemType(tenantCtx?.tenant?.systemType)

    if (userSystem !== expectedSystem) {
      return <div className="card">403 - Bu sistem icin yetkiniz yok</div>
    }
    if (tenantSystem && tenantSystem !== expectedSystem) {
      return <div className="card">403 - Bu sistem icin yetkiniz yok</div>
    }
  }

  const required = Array.isArray(permissions) ? permissions : (permissions ? [permissions] : [])
  if (required.length > 0 && user.role !== 'tenant_admin' && user.role !== 'superadmin') {
    const userPerms = Array.isArray(user.permissions) ? user.permissions : []
    const mode = permissionsMode === 'any' ? 'any' : 'all'
    const ok = mode === 'any'
      ? required.some((permission) => userPerms.includes(permission))
      : required.every((permission) => userPerms.includes(permission))

    if (!ok) return <div className="card">403 - Bu sistem icin yetkiniz yok</div>
  }

  if (!allowExpired && isSubscriptionExpired(tenantCtx)) {
    return <Navigate to={getSubscriptionUpgradePath(pathname)} replace state={{ subscriptionExpired: true }} />
  }

  return children
}
