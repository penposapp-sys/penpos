import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ roles, permissions, permissionsMode = 'all', system, children }) {
  const { user, loading, tenantCtx } = useAuth()
  const { pathname } = useLocation()
  
  if (loading) return <div className="card">Yükleniyor...</div>
  if (!user) return <Navigate to="/" replace />
  
  // Role enforcement
  if (roles && !roles.includes(user.role)) {
    return <div className="card">403 – Bu sistem için yetkiniz yok</div>
  }

  // System Type check
  if (system) {
    if (user.systemType !== system) {
      return <div className="card">403 – Bu sistem için yetkiniz yok</div>
    }
    if (tenantCtx?.tenant?.systemType && tenantCtx.tenant.systemType !== system) {
      return <div className="card">403 – Bu sistem için yetkiniz yok</div>
    }
  }

  // Permissions check
  const required = Array.isArray(permissions) ? permissions : (permissions ? [permissions] : [])
  if (required.length > 0) {
    if (user.role !== 'tenant_admin' && user.role !== 'superadmin') {
      const userPerms = Array.isArray(user.permissions) ? user.permissions : []
      const mode = permissionsMode === 'any' ? 'any' : 'all'
      const ok = mode === 'any'
        ? required.some(p => userPerms.includes(p))
        : required.every(p => userPerms.includes(p))
      if (!ok) return <div className="card">403 – Bu sistem için yetkiniz yok</div>
    }
  }
  return children
}
