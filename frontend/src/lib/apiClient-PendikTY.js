import { toast } from './toast.js'
import { getSubscriptionUpgradePath, isSubscriptionAllowedPath } from './subscription.js'
import { getAuthToken, removeAuthToken } from './authStorage.js'
import { resolveApiBase } from './runtimeApi.js'

const inflight = new Map()
const cache = new Map()
let lastRateLimitToastAt = 0

export const clearApiCache = () => {
  try {
    cache.clear()
  } catch {}
}

const forcePort4000 = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const u = new URL(raw)
    u.port = '4000'
    u.pathname = ''
    u.search = ''
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return '/api'
  }
}

const normalizeApiPath = (path) => {
  const p = String(path || '')
  if (/^https?:\/\//i.test(p)) return p
  if (p.startsWith('/api/')) return p
  if (p === '/api') return '/api'
  if (p.startsWith('/')) return `/api${p}`
  return `/api/${p}`
}

const inferPortalFromPathname = (pathname) => {
  const p = String(pathname || '').trim().toLowerCase()
  if (p.startsWith('/canteen')) return 'canteen'
  if (p.startsWith('/platform') || p.startsWith('/platform-admin') || p.startsWith('/superadmin') || p.startsWith('/login/platform') || p.startsWith('/platform-login')) return 'platform'
  return 'restaurant'
}

const normalizeForAllowlist = (path) => {
  const raw = String(path || '')
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      return u.pathname || ''
    } catch {
      return ''
    }
  }
  return normalizeApiPath(raw)
}

const base = resolveApiBase()

const MISSING_BRANCH_MESSAGE = 'Sube secimi gerekli. Ayarlar > Sistem Ayarlari > Yetkili Subeler bolumunden sube secin.'

const parseRetryAfterMs = (headerValue) => {
  const raw = String(headerValue || '').trim()
  if (!raw) return 0
  const sec = Number(raw)
  if (Number.isFinite(sec) && sec > 0) return Math.round(sec * 1000)
  const ts = Date.parse(raw)
  if (Number.isFinite(ts)) {
    const diff = ts - Date.now()
    return diff > 0 ? diff : 0
  }
  return 0
}

const getDefaultCacheTtlMs = (normalizedPath, method) => {
  if (method !== 'GET') return 0
  const p = String(normalizedPath || '')
  if (p === '/api/tenant/context') return 15000
  if (p === '/api/tenant/profile') return 15000
  if (p === '/api/tenant/payment-settings') return 15000
  if (p === '/api/settings/menu/active-items') return 15000
  if (p.startsWith('/api/user/preferences/kitchen-filters')) return 15000
  if (p.startsWith('/api/tenant/categories')) return 10000
  if (/^\/api\/pos\/orders\/[^/]+$/.test(p)) return 1500
  return 0
}

const getAuthRedirectPath = (portal) => (
  portal === 'canteen'
    ? '/canteen/login'
    : (portal === 'platform' ? '/platform-login' : '/login/restoran')
)

const isPublicAuthPath = (pathname) => {
  const path = String(pathname || '').trim().toLowerCase()
  return (
    path === '/login' ||
    path === '/login-selection' ||
    path === '/login/platform' ||
    path === '/platform-login' ||
    path === '/login/restoran' ||
    path === '/login/kantin' ||
    path === '/canteen/login' ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password')
  )
}

const shouldSkipAuthRedirect = (targetPath) => {
  try {
    const currentPath = String(window.location?.pathname || '').trim().toLowerCase()
    const nextPath = String(targetPath || '').trim().toLowerCase()
    if (!nextPath) return true
    if (currentPath === nextPath) return true
    return isPublicAuthPath(currentPath) && isPublicAuthPath(nextPath)
  } catch {
    return false
  }
}

export const api = async (path, options = {}) => {
  const silent = !!options.silent
  const suppressAuthRedirect = !!options.suppressAuthRedirect
  const portalOverride = String(options.portalOverride || '').trim()
  const cacheTtlMsOpt = options.cacheTtlMs
  const cacheMode = String(options.cacheMode || '').trim()
  const retryOn429 = options.retryOn429 !== false
  const pathname = (() => {
    try {
      return String(window.location?.pathname || '')
    } catch {
      return ''
    }
  })()
  const portal = portalOverride || inferPortalFromPathname(pathname)
  const tokenKey = portal === 'canteen' ? 'token_canteen' : (portal === 'platform' ? 'token_platform' : 'token_restaurant')
  const branchKey = portal === 'canteen' ? 'selectedBranchId_canteen' : 'selectedBranchId'
  const allowlistPath = normalizeForAllowlist(path)
  const isAuthPath = allowlistPath.startsWith('/api/auth/')
  const isHealthPath = allowlistPath === '/api/health' || allowlistPath.startsWith('/api/health/')
  const isAuthLogin = allowlistPath === '/api/auth/login'
  const token = isAuthLogin ? null : getAuthToken(tokenKey)
  const selectedBranchId = localStorage.getItem(branchKey)
  const skipBranchHeader = !!options.skipBranchHeader
  const branchIdOverride = options.branchIdOverride
  const suppressBranchModal = !!options.suppressBranchModal
  const baseHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const incomingHeaders = { ...(options.headers || {}) }
  const shouldAttachBranch = portal !== 'platform' && portal !== 'canteen' && !isAuthPath && !isHealthPath
  const headers = {
    ...baseHeaders,
    ...(!skipBranchHeader && shouldAttachBranch && (branchIdOverride || selectedBranchId) ? { 'x-branch-id': String(branchIdOverride || selectedBranchId) } : {}),
    ...incomingHeaders,
  }
  const { silent: _silent, skipBranchHeader: _skipBranchHeader, branchIdOverride: _branchIdOverride, data: _data, suppressAuthRedirect: _suppressAuthRedirect, portalOverride: _portalOverride, cacheTtlMs: _cacheTtlMs, cacheMode: _cacheMode, retryOn429: _retryOn429, ...fetchOptions } = options

  const wrap = (ok, status, data) => {
    const basePayload = {
      ok: !!ok,
      status: Number(status || 0),
      data: data ?? {},
      success: !!ok,
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) return { ...basePayload, ...data }
    return basePayload
  }

  const attemptRequest = async (attempt) => {
    const normalizedPath = normalizeApiPath(path)
    const urlRaw = /^https?:\/\//i.test(normalizedPath) ? normalizedPath : `${base}${normalizedPath}`
    let url = urlRaw
    try {
      if (import.meta.env.DEV && /^https?:\/\//i.test(urlRaw)) {
        const u = new URL(urlRaw)
        u.port = '4000'
        url = u.toString()
      }
    } catch {}

    const method = String(fetchOptions.method || 'GET').toUpperCase()
    if (_data !== undefined && fetchOptions.body === undefined && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(_data)
    }

    const bodyIsFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
    if (bodyIsFormData) {
      try {
        delete headers['Content-Type']
      } catch {}
    }

    const bodyKey = bodyIsFormData ? '[formdata]' : String(fetchOptions.body || '')
    const key = `${method} ${url} | ${bodyKey} | ${(headers.Authorization || '')} | ${(headers['x-branch-id'] || '')}`
    const canDedupe = !fetchOptions.signal && !bodyIsFormData
    const cacheKey = `${method} ${url} | ${(headers.Authorization || '')} | ${(headers['x-branch-id'] || '')}`
    const shouldCache = method === 'GET' && !fetchOptions.signal && !bodyIsFormData && cacheMode !== 'no-store'
    const ttl = (() => {
      if (!shouldCache) return 0
      if (cacheMode === 'no-cache') return 0
      const n = Number(cacheTtlMsOpt)
      if (Number.isFinite(n) && n > 0) return Math.round(n)
      return getDefaultCacheTtlMs(normalizedPath, method)
    })()

    if (shouldCache && ttl > 0) {
      const hit = cache.get(cacheKey)
      if (hit && hit.expiresAt > Date.now()) return hit.value
    }
    if (canDedupe && inflight.has(key)) return inflight.get(key)

    const run = (async () => {
      let res
      try {
        res = await fetch(url, { ...fetchOptions, headers })
      } catch {
        if (!silent) toast.error('Ag hatasi')
        return wrap(false, 0, { code: 'network_error', error: 'network_error', message: 'network_error' })
      }

      const retryAfterMs = res?.status === 429 ? parseRetryAfterMs(res.headers?.get?.('Retry-After')) : 0
      const data = await res.json().catch(() => ({}))

      if (res.status === 429 && retryOn429 && attempt < 1 && (method === 'GET' || method === 'HEAD')) {
        const baseWait = retryAfterMs > 0 ? retryAfterMs : 1500
        const jitter = Math.floor(Math.random() * 250)
        const waitMs = Math.min(8000, baseWait + jitter)
        await new Promise(r => setTimeout(r, waitMs))
        return attemptRequest(attempt + 1)
      }

      if (!res.ok) {
        const code = data.code || data.error || 'error'
        const message = data.message || 'Islem basarisiz'

        if (res.status === 401 && !suppressAuthRedirect) {
          try {
            removeAuthToken(tokenKey)
          } catch {}
          try {
            const redirectPath = getAuthRedirectPath(portal)
            if (!shouldSkipAuthRedirect(redirectPath)) {
              window.location.href = redirectPath
            }
          } catch {}
        }

        if (res.status === 403 && code === 'missing_branch') {
          const shouldDispatch = !(method === 'GET' || suppressBranchModal)
          if (shouldDispatch) {
            try {
              window.dispatchEvent(new CustomEvent('missing_branch', { detail: { path: normalizedPath } }))
            } catch {}
          }
        }

        if (res.status === 402 && code === 'SUBSCRIPTION_EXPIRED') {
          try {
            const redirectTo = getSubscriptionUpgradePath(pathname)
            window.dispatchEvent(new CustomEvent('subscription_expired', { detail: { path: normalizedPath, redirectTo, message } }))
            if (!isSubscriptionAllowedPath(pathname, pathname)) {
              window.location.replace(redirectTo)
            }
          } catch {}
        }

        if (!silent) {
          if (res.status === 429) {
            const now = Date.now()
            if (now - lastRateLimitToastAt > 1500) {
              lastRateLimitToastAt = now
              toast.error(message)
            }
          } else if (res.status === 403 && code === 'missing_branch') {
            toast.error(MISSING_BRANCH_MESSAGE)
          } else {
            toast.error(message)
          }
        }

        return wrap(false, res.status, { ...data, code, message })
      }

      const okPayload = wrap(true, res.status, data)
      if (shouldCache && ttl > 0) {
        cache.set(cacheKey, { expiresAt: Date.now() + ttl, value: okPayload })
      }
      return okPayload
    })()

    if (canDedupe) {
      inflight.set(key, run)
      run.finally(() => inflight.delete(key))
    }
    return run
  }

  return attemptRequest(0)
}

const parseFilenameFromContentDisposition = (value) => {
  const raw = String(value || '')
  const utf8 = /filename\*=UTF-8''([^;\n]+)/i.exec(raw)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].replaceAll('"', '').trim())
    } catch {
      return utf8[1].replaceAll('"', '').trim()
    }
  }
  const simple = /filename=([^;\n]+)/i.exec(raw)
  if (simple?.[1]) return simple[1].replaceAll('"', '').trim()
  return ''
}

export const apiDownload = async (path, options = {}) => {
  const silent = !!options.silent
  const suppressAuthRedirect = !!options.suppressAuthRedirect
  const portalOverride = String(options.portalOverride || '').trim()
  const pathname = (() => {
    try {
      return String(window.location?.pathname || '')
    } catch {
      return ''
    }
  })()
  const portal = portalOverride || inferPortalFromPathname(pathname)
  const tokenKey = portal === 'canteen' ? 'token_canteen' : (portal === 'platform' ? 'token_platform' : 'token_restaurant')
  const branchKey = portal === 'canteen' ? 'selectedBranchId_canteen' : 'selectedBranchId'
  const token = getAuthToken(tokenKey)
  const selectedBranchId = localStorage.getItem(branchKey)
  const skipBranchHeader = !!options.skipBranchHeader
  const branchIdOverride = options.branchIdOverride

  const normalizedPath = normalizeApiPath(path)
  const urlRaw = /^https?:\/\//i.test(normalizedPath) ? normalizedPath : `${base}${normalizedPath}`
  let url = urlRaw
  try {
    if (import.meta.env.DEV && /^https?:\/\//i.test(urlRaw)) {
      const u = new URL(urlRaw)
      u.port = '4000'
      url = u.toString()
    }
  } catch {}

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!skipBranchHeader && (branchIdOverride || selectedBranchId) ? { 'x-branch-id': String(branchIdOverride || selectedBranchId) } : {}),
    ...(options.headers || {}),
  }

  let res
  try {
    res = await fetch(url, { method: 'GET', headers })
  } catch {
    if (!silent) toast.error('Ag hatasi')
    return { ok: false, status: 0, blob: null, filename: '', error: { code: 'network_error', error: 'network_error', message: 'network_error' } }
  }

  if (!res.ok) {
    let data = {}
    try {
      data = await res.json()
    } catch {
      data = {}
    }
    const code = data.code || data.error || 'error'
    const message = data.message || 'Islem basarisiz'

    if (res.status === 401 && !suppressAuthRedirect) {
      try {
        removeAuthToken(tokenKey)
      } catch {}
      try {
        const redirectPath = getAuthRedirectPath(portal)
        if (!shouldSkipAuthRedirect(redirectPath)) {
          window.location.href = redirectPath
        }
      } catch {}
    }

    if (res.status === 402 && code === 'SUBSCRIPTION_EXPIRED') {
      try {
        const redirectTo = getSubscriptionUpgradePath(pathname)
        window.dispatchEvent(new CustomEvent('subscription_expired', { detail: { path: normalizedPath, redirectTo, message } }))
        if (!isSubscriptionAllowedPath(pathname, pathname)) {
          window.location.replace(redirectTo)
        }
      } catch {}
    }

    if (!silent) {
      if (res.status === 403 && code === 'missing_branch') toast.error(MISSING_BRANCH_MESSAGE)
      else toast.error(message)
    }
    return { ok: false, status: res.status, blob: null, filename: '', error: { ...data, code, message } }
  }

  const blob = await res.blob()
  const filename = parseFilenameFromContentDisposition(res.headers.get('content-disposition'))
  return { ok: true, status: res.status, blob, filename }
}
