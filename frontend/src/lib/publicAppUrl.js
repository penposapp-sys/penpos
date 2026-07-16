import { isLocalDevHostname, isNativeRuntime, normalizeBaseUrl } from './runtimeApi.js'

const DEFAULT_PUBLIC_APP_ORIGIN = 'https://penpos.cloud'

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

export const resolvePublicAppOrigin = () => {
  const explicitOrigin = toOrigin(
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.VITE_PUBLIC_BASE_URL ||
    import.meta.env.VITE_PUBLIC_URL ||
    ''
  )
  if (explicitOrigin) return explicitOrigin

  const apiOrigin = toOrigin(
    normalizeBaseUrl(
      import.meta.env.VITE_API_URL_NATIVE ||
      import.meta.env.VITE_API_URL_ANDROID ||
      import.meta.env.VITE_API_URL ||
      ''
    )
  )
  if (apiOrigin) {
    try {
      const host = String(new URL(apiOrigin).hostname || '').trim()
      if (!isLocalDevHostname(host)) return apiOrigin
    } catch {}
  }

  if (isNativeRuntime()) return DEFAULT_PUBLIC_APP_ORIGIN

  try {
    const currentOrigin = String(window.location?.origin || '').trim()
    const currentHost = String(window.location?.hostname || '').trim()
    if (currentOrigin && !isLocalDevHostname(currentHost)) return currentOrigin.replace(/\/+$/, '')
  } catch {}

  return DEFAULT_PUBLIC_APP_ORIGIN
}

export const resolveCurrentAppOrigin = () => {
  try {
    const currentOrigin = String(window.location?.origin || '').trim()
    if (currentOrigin) return currentOrigin.replace(/\/+$/, '')
  } catch {}
  return resolvePublicAppOrigin()
}

export const buildPublicAppUrl = (path, searchParams, options = {}) => {
  const originMode = String(options?.originMode || 'public').trim()
  const baseOrigin = originMode === 'current' ? resolveCurrentAppOrigin() : resolvePublicAppOrigin()
  const url = new URL(path || '/', `${baseOrigin}/`)
  if (searchParams && typeof searchParams === 'object') {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}
