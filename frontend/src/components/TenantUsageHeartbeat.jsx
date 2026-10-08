import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'

const HEARTBEAT_INTERVAL_MS = 60 * 1000

const resolvePortal = (systemType) => {
  const system = String(systemType || '').trim().toLowerCase()
  if (system === 'kantin' || system === 'canteen') return 'canteen'
  if (system === 'anaokulu') return 'anaokulu'
  return 'restaurant'
}

export default function TenantUsageHeartbeat() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.tenantId || !['tenant_admin', 'staff'].includes(user.role)) return undefined

    const tenantId = String(user.tenantId)
    const storageKey = `tenant-usage-session:${tenantId}:${user.id}`
    let sessionKey = sessionStorage.getItem(storageKey)
    if (!sessionKey) {
      sessionKey = typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(storageKey, sessionKey)
    }
    const portalOverride = resolvePortal(user.systemType)
    let isSessionOpen = false

    const send = async (event) => {
      try {
        const result = await api('/api/tenant/usage/heartbeat', {
          method: 'POST',
          body: JSON.stringify({ sessionKey, event }),
          portalOverride,
          silent: true,
          suppressAuthRedirect: true,
          keepalive: event === 'end'
        })
        if (!result?.ok) {
          console.warn('[TENANT_USAGE_HEARTBEAT_FAILED]', result?.message || result?.status || 'Heartbeat request failed')
          return
        }
        isSessionOpen = event !== 'end'
      } catch (error) {
        console.warn('[TENANT_USAGE_HEARTBEAT_FAILED]', error)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void send('heartbeat')
      } else if (isSessionOpen) {
        void send('end')
      }
    }
    const onPageHide = () => {
      if (isSessionOpen) void send('end')
    }
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void send('heartbeat')
    }, HEARTBEAT_INTERVAL_MS)

    void send('heartbeat')
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      if (isSessionOpen) void send('end')
    }
  }, [user?.id, user?.role, user?.tenantId, user?.systemType])

  return null
}
