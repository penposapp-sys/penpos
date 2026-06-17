const PERF_DEBUG_KEY = 'penposPerfDebug'
const DISABLE_IMAGES_KEY = 'penposDisableProductImages'
const flagCache = new Map()

function readFlag(key) {
  try {
    return String(window?.localStorage?.getItem(key) || '').trim() === '1'
  } catch {
    return false
  }
}

function readCachedFlag(key) {
  if (flagCache.has(key)) return flagCache.get(key) === true
  const nextValue = readFlag(key)
  flagCache.set(key, nextValue)
  return nextValue
}

function refreshCachedFlags() {
  flagCache.set(PERF_DEBUG_KEY, readFlag(PERF_DEBUG_KEY))
  flagCache.set(DISABLE_IMAGES_KEY, readFlag(DISABLE_IMAGES_KEY))
}

try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event) => {
      const changedKey = String(event?.key || '')
      if (!changedKey || changedKey === PERF_DEBUG_KEY || changedKey === DISABLE_IMAGES_KEY) {
        refreshCachedFlags()
      }
    })
    window.addEventListener('focus', refreshCachedFlags)
    document?.addEventListener?.('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshCachedFlags()
    })
  }
} catch {}

export function isPerfDebugEnabled() {
  return readCachedFlag(PERF_DEBUG_KEY)
}

export function isProductImagesDisabled() {
  return readCachedFlag(DISABLE_IMAGES_KEY)
}

export function getPerfNow() {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now()
    }
  } catch {}
  return Date.now()
}

function createStore() {
  return {
    counters: {},
    marks: {}
  }
}

export function getPerfStore() {
  try {
    if (typeof window === 'undefined') return createStore()
    if (!window.__penposPerfStore) {
      window.__penposPerfStore = createStore()
    }
    return window.__penposPerfStore
  } catch {
    return createStore()
  }
}

export function incrementPerfCounter(group, key = 'default', delta = 1) {
  if (!isPerfDebugEnabled()) return 0
  const store = getPerfStore()
  if (!store.counters[group]) store.counters[group] = {}
  const groupCounters = store.counters[group]
  const nextValue = Number(groupCounters[key] || 0) + Number(delta || 1)
  groupCounters[key] = nextValue
  return nextValue
}

export function snapshotPerfCounter(group) {
  const counters = getPerfStore().counters?.[group]
  return counters ? { ...counters } : {}
}

export function diffPerfCounter(group, previous = {}) {
  const current = snapshotPerfCounter(group)
  const changed = []
  Object.keys(current).forEach((key) => {
    const nextValue = Number(current[key] || 0)
    const prevValue = Number(previous[key] || 0)
    if (nextValue !== prevValue) {
      changed.push({
        key,
        before: prevValue,
        after: nextValue,
        delta: nextValue - prevValue
      })
    }
  })
  return { current, changed }
}

export function markPerfStart(scope, label, data = null) {
  if (!isPerfDebugEnabled()) return null
  const store = getPerfStore()
  const key = `${scope}:${label}`
  const startedAt = getPerfNow()
  store.marks[key] = { startedAt, data }
  console.debug(`[PenPosPerf][${scope}] ${label}:start`, data || {})
  return startedAt
}

export function markPerfEnd(scope, label, data = null) {
  if (!isPerfDebugEnabled()) return null
  const store = getPerfStore()
  const key = `${scope}:${label}`
  const startedAt = Number(store.marks?.[key]?.startedAt || 0)
  const elapsedMs = startedAt > 0 ? Number((getPerfNow() - startedAt).toFixed(2)) : null
  if (store.marks?.[key]) delete store.marks[key]
  console.debug(`[PenPosPerf][${scope}] ${label}:end`, {
    elapsedMs,
    ...(data || {})
  })
  return elapsedMs
}

export function logPerf(scope, event, data = null) {
  if (!isPerfDebugEnabled()) return
  console.debug(`[PenPosPerf][${scope}] ${event}`, data || {})
}
