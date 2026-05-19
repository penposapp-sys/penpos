import { useEffect, useRef } from 'react'

function isUserInteracting() {
  try {
    if (document.hidden) return true
    if (document.body?.classList?.contains('modal-open')) return true
    const el = document.activeElement
    const tag = String(el?.tagName || '').toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable === true
  } catch {
    return false
  }
}

export default function useCanteenAutoRefresh(callback, deps = [], options = {}) {
  const { enabled = true, intervalMs = 3000 } = options
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return

    const timerId = window.setInterval(() => {
      if (isUserInteracting()) return
      try {
        callbackRef.current?.({ background: true })
      } catch {}
    }, intervalMs)

    return () => window.clearInterval(timerId)
  }, [enabled, intervalMs, ...deps])
}
