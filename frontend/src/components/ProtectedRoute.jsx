import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getSubscriptionUpgradePath, isSubscriptionExpired } from '../lib/subscription.js'
import WebsiteLoadingScreen from './WebsiteLoadingScreen.jsx'

export default function ProtectedRoute({ roles, permissions, permissionsMode = 'all', system, allowExpired = false, children }) {
  const { user, loading, tenantCtx } = useAuth()
  const { pathname } = useLocation()

  if (loading) {
    return (
      <WebsiteLoadingScreen
        badge="PenPOS girisi"
        title="Oturum dogrulaniyor"
        message="Yetkileriniz kontrol edilirken paneliniz web sitesi temasi ile hazirlaniyor."
        compact
      />
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <div className="card">403 - Bu sistem icin yetkiniz yok</div>
  }

  if (system) {
    if (user.systemType !== system) {
      return <div className="card">403 - Bu sistem icin yetkiniz yok</div>
    }
    if (tenantCtx?.tenant?.systemType && tenantCtx.tenant.systemType !== system) {
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
