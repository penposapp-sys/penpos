const lastToastAtByKey = new Map()

const shouldEmit = (type, message, ttlMs = 5000) => {
  const msg = String(message || '')
  if (!msg) return false
  const key = `${type}::${msg}`
  const now = Date.now()
  const last = lastToastAtByKey.get(key) || 0
  if (now - last < ttlMs) return false
  lastToastAtByKey.set(key, now)
  return true
}

export const toast = {
  success: (message, options = {}) => {
    if (!shouldEmit('success', message)) return
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message, ...options } }))
  },
  error: (message, options = {}) => {
    if (!shouldEmit('error', message)) return
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message, ...options } }))
  },
  info: (message, options = {}) => {
    if (!shouldEmit('info', message)) return
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', message, ...options } }))
  }
}
