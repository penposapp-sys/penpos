import { toast } from './toast.js'

const inflight = new Map()
let lastRateLimitToastAt = 0

const normalizeBaseUrl = (value) => {
  const v = String(value || '').replace(/\/+$/, '')
  if (v.endsWith('/api')) return v.slice(0, -4)
  return v
}

const forcePort4000 = (value) => {
  const raw = String(value || '').trim()
  if (!raw) {
    try {
      const host = String(window.location?.hostname || '').trim()
      if (host) return `http://${host}:4000`
    } catch {
    }
    return '/api'
  }
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
  const p = String(pathname || '')
  if (p.startsWith('/canteen')) return 'canteen'
  if (p.startsWith('/platform') || p.startsWith('/platform-admin') || p.startsWith('/login/platform')) return 'platform'
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

const base = forcePort4000(normalizeBaseUrl(import.meta.env.VITE_API_URL) || '/api')

if (import.meta.env.DEV) {
  try {
    const siteHost = String(window.location?.hostname || '').trim().toLowerCase()
    const apiHost = (() => {
      try { return new URL(base).hostname } catch { return '' }
    })()
    const isSiteLocal = siteHost === 'localhost' || siteHost === '127.0.0.1'
    const isApiLan = /^192\.168\./.test(String(apiHost || ''))
    if (isSiteLocal && isApiLan) {
      console.warn('⚠️ Local ortamda LAN API URL kullanıyorsun. .env.lan yerine .env ile çalışmalısın.')
    }
  } catch {
  }
}

const MISSING_BRANCH_MESSAGE = 'Şube seçimi gerekli. “Ayarlar > Sistem Ayarları > Yetkili Şubeler” bölümünden şube seçin.'

export const api = async (path, options = {}) => {
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
  const allowlistPath = normalizeForAllowlist(path)
  const isAuthPath = allowlistPath.startsWith('/api/auth/')
  const isHealthPath = allowlistPath === '/api/health' || allowlistPath.startsWith('/api/health/')
  const isAuthLogin = allowlistPath === '/api/auth/login'
  const token = isAuthLogin ? null : localStorage.getItem(tokenKey)
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
    ...incomingHeaders
  }
  const { silent: _silent, skipBranchHeader: _skipBranchHeader, branchIdOverride: _branchIdOverride, data: _data, suppressAuthRedirect: _suppressAuthRedirect, portalOverride: _portalOverride, ...fetchOptions } = options
  const wrap = (ok, status, data) => {
    const basePayload = {
      ok: !!ok,
      status: Number(status || 0),
      data: data ?? {},
      success: !!ok
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return { ...basePayload, ...data }
    }
    return basePayload
  }

  const attemptRequest = async (attempt) => {
    const normalizedPath = normalizeApiPath(path)
    const urlRaw = /^https?:\/\//i.test(normalizedPath) ? normalizedPath : `${base}${normalizedPath}`
    let url = urlRaw
    try {
      const u = new URL(urlRaw)
      u.port = '4000'
      url = u.toString()
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
    const hasBranchHeader = Object.prototype.hasOwnProperty.call(headers, 'x-branch-id') && !!headers['x-branch-id']
    if (import.meta.env.DEV) {
      try {
        const isListRequest = method === 'GET' && (url.includes('overview') || url.includes('list') || url.includes('reports') || url.includes('accounts') || url.includes('kitchen'))
        const u = new URL(url)
        const branchHeaderValue = hasBranchHeader ? headers['x-branch-id'] : null
        if (isListRequest) {
          console.debug('[API_LIST]', { url, method, params: u.searchParams, hasBranchHeader, branchHeaderValue })
        } else {
          console.debug('[API_ACTION]', { url, method, hasBranchHeader, branchHeaderValue })
        }
      } catch {}
    }
    let res
    const bodyKey = bodyIsFormData ? '[formdata]' : String(fetchOptions.body || '')
    const key = `${method} ${url} | ${bodyKey} | ${(headers.Authorization || '')} | ${(headers['x-branch-id'] || '')}`
    const canDedupe = !fetchOptions.signal && !bodyIsFormData
    if (canDedupe && inflight.has(key)) {
      return inflight.get(key)
    }

    const run = (async () => {
      try {
        res = await fetch(url, { ...fetchOptions, headers })
      } catch (raw) {
        const data = { message: 'network_error', raw }
        if (!silent) toast.error('Ağ hatası')
        return wrap(false, 0, data)
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
      const code = data.code || data.error || 'error'
      const message = data.message || 'İşlem başarısız'

      if (import.meta.env.DEV && res.status === 403) {
        try {
          console.debug('[API_403]', { url, method, code, message, data })
        } catch {
        }
      }

      if (res.status === 401 && !suppressAuthRedirect) {
        try {
          localStorage.removeItem(tokenKey)
        } catch {}
        try {
          window.location.href = portal === 'canteen' ? '/canteen/login' : (portal === 'platform' ? '/login/platform' : '/login/restoran')
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
      return wrap(true, res.status, data)
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
  const token = localStorage.getItem(tokenKey)
  const selectedBranchId = localStorage.getItem(branchKey)
  const skipBranchHeader = !!options.skipBranchHeader
  const branchIdOverride = options.branchIdOverride

  const normalizedPath = normalizeApiPath(path)
  const urlRaw = /^https?:\/\//i.test(normalizedPath) ? normalizedPath : `${base}${normalizedPath}`
  let url = urlRaw
  try {
    const u = new URL(urlRaw)
    u.port = '4000'
    url = u.toString()
  } catch {}

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!skipBranchHeader && (branchIdOverride || selectedBranchId) ? { 'x-branch-id': String(branchIdOverride || selectedBranchId) } : {}),
    ...(options.headers || {})
  }

  let res
  try {
    res = await fetch(url, { method: 'GET', headers })
  } catch (raw) {
    if (!silent) toast.error('Ağ hatası')
    return { ok: false, status: 0, blob: null, filename: '', error: { message: 'network_error', raw } }
  }

  if (!res.ok) {
    let data = {}
    try {
      data = await res.json()
    } catch {
      data = {}
    }
    const code = data.code || data.error || 'error'
    const message = data.message || 'İşlem başarısız'

    if (res.status === 401 && !suppressAuthRedirect) {
      try {
        localStorage.removeItem(tokenKey)
      } catch {}
      try {
        window.location.href = portal === 'canteen' ? '/canteen/login' : (portal === 'platform' ? '/login/platform' : '/login/restoran')
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
