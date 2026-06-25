const DEFAULT_REMOTE_API_ORIGIN = 'https://penpos.cloud'
const DEFAULT_LOCAL_DEV_API_ORIGIN = 'http://localhost:4000'

const isLoopbackHostname = (value) => {
  const host = String(value || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1'
}

export const normalizeBaseUrl = (value) => {
  const normalized = String(value || '').replace(/\/+$/, '')
  if (normalized.endsWith('/api')) return normalized.slice(0, -4)
  return normalized
}

export const isNativeRuntime = () => {
  try {
    if (typeof window === 'undefined') return false
    const capacitor = window.Capacitor
    if (typeof capacitor?.isNativePlatform === 'function') return !!capacitor.isNativePlatform()
    const platform = String(capacitor?.getPlatform?.() || '').toLowerCase()
    return platform === 'android' || platform === 'ios'
  } catch {
    return false
  }
}

export const isLocalDevHostname = (value) => {
  const host = String(value || '').trim().toLowerCase()
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

const toOrigin = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

const forceOriginPort = (value, port) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    url.port = String(port || '4000')
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export const resolveApiOrigin = () => {
  const envBase = normalizeBaseUrl(import.meta.env.VITE_API_URL) || ''
  const nativeEnvBase = normalizeBaseUrl(import.meta.env.VITE_API_URL_NATIVE || import.meta.env.VITE_API_URL_ANDROID || '') || ''

  if (import.meta.env.DEV) {
    let currentWindowOrigin = ''
    try {
      const protocol = String(window.location?.protocol || 'http:')
      const hostname = String(window.location?.hostname || '').trim()
      if (isLocalDevHostname(hostname)) currentWindowOrigin = `${protocol}//${hostname}:4000`
    } catch {}

    try {
      if (envBase) {
        const envUrl = new URL(envBase)
        if (currentWindowOrigin && isLoopbackHostname(envUrl.hostname)) {
          return currentWindowOrigin
        }
        if (isLocalDevHostname(envUrl.hostname)) {
          const localOrigin = forceOriginPort(envBase, 4000)
          if (localOrigin) return localOrigin
        }
      }
    } catch {}

    if (currentWindowOrigin) return currentWindowOrigin

    return DEFAULT_LOCAL_DEV_API_ORIGIN
  }

  if (isNativeRuntime()) {
    const nativeOrigin = toOrigin(nativeEnvBase)
    if (nativeOrigin) return nativeOrigin
    const envOrigin = toOrigin(envBase)
    if (envOrigin) return envOrigin
    return DEFAULT_REMOTE_API_ORIGIN
  }

  const envOrigin = toOrigin(envBase)
  if (envOrigin) return envOrigin

  try {
    return String(window.location?.origin || '')
  } catch {
    return ''
  }
}

export const resolveApiBase = () => {
  const envBase = normalizeBaseUrl(import.meta.env.VITE_API_URL) || ''
  const nativeEnvBase = normalizeBaseUrl(import.meta.env.VITE_API_URL_NATIVE || import.meta.env.VITE_API_URL_ANDROID || '') || ''
  const remoteBase = nativeEnvBase || (envBase && /^https?:\/\//i.test(envBase) ? envBase : DEFAULT_REMOTE_API_ORIGIN)

  if (import.meta.env.DEV) return resolveApiOrigin()
  return isNativeRuntime() ? remoteBase : envBase
}
