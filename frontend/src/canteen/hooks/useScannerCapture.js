import { useEffect, useRef } from 'react'

const isDigit = (key) => {
  const k = String(key || '')
  return k.length === 1 && k >= '0' && k <= '9'
}

const isEditableTarget = (target) => {
  const tag = String(target?.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable
}

const allowsScannerCapture = (target) => {
  try {
    return String(target?.dataset?.scannerCapture || '').trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

export default function useScannerCapture({
  onScan,
  enabled = true,
  minLen = 8,
  maxLen = 32,
  idleMs = 110,
  burstDeltaMs = 50,
  humanDeltaMs = 70,
} = {}) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const bufRef = useRef('')
  const timesRef = useRef([])
  const lastAtRef = useRef(0)
  const collectingRef = useRef(false)
  const confirmedRef = useRef(false)
  const idleTimerRef = useRef(null)
  const restoreRef = useRef(null)

  const reset = () => {
    bufRef.current = ''
    timesRef.current = []
    lastAtRef.current = 0
    collectingRef.current = false
    confirmedRef.current = false
    restoreRef.current = null
    try { clearTimeout(idleTimerRef.current) } catch {}
    idleTimerRef.current = null
  }

  const restoreSnapshot = () => {
    const snap = restoreRef.current
    if (!snap) return
    const el = snap.el
    const tag = String(el?.tagName || '').toLowerCase()
    if (tag !== 'input' && tag !== 'textarea') return
    try {
      el.value = String(snap.value || '')
      if (typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(Number(snap.start || 0), Number(snap.end || 0))
      }
      try { el.dispatchEvent(new Event('input', { bubbles: true })) } catch {}
    } catch {}
  }

  const shouldConfirmScanner = () => {
    const buf = String(bufRef.current || '')
    if (!/^[0-9]+$/.test(buf)) return false
    const len = buf.length
    if (len < 3) return false

    const times = Array.isArray(timesRef.current) ? timesRef.current : []
    if (times.length < 3) return false
    const diffs = []
    for (let i = 1; i < times.length; i++) diffs.push(times[i] - times[i - 1])
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const maxDt = Math.max(...diffs)
    return avg < 35 && maxDt < Number(burstDeltaMs || 50)
  }

  const finalize = () => {
    const code = String(bufRef.current || '').trim()
    if (!/^[0-9]+$/.test(code)) return
    const min = Number(minLen || 8)
    const max = Number(maxLen || 32)
    if (code.length < min || code.length > max) return
    onScanRef.current?.(code)
  }

  useEffect(() => {
    if (!enabled) {
      reset()
      return
    }

    const handler = (e) => {
      if (!enabled) return
      if (e.defaultPrevented) return
      if (e.ctrlKey || e.metaKey || e.altKey) {
        reset()
        return
      }

      if (isEditableTarget(e.target) && !allowsScannerCapture(e.target)) {
        reset()
        return
      }

      const now = Date.now()
      const key = String(e.key || '')
      const isEnter = key === 'Enter'
      const isEscape = key === 'Escape'
      const digit = isDigit(key)

      const idle = Number(idleMs || 110)
      const humanBreak = Number(humanDeltaMs || 70)
      const maxLenSafe = clamp(Number(maxLen || 32), 8, 64)

      if (isEscape) {
        reset()
        return
      }

      if (isEnter) {
        if (confirmedRef.current === true) {
          e.preventDefault()
          e.stopPropagation()
          finalize()
          reset()
        } else {
          reset()
        }
        return
      }

      if (!digit) {
        reset()
        return
      }

      const last = Number(lastAtRef.current || 0)
      const delta = last ? now - last : 0
      if (last && delta > idle) {
        reset()
      }
      if (last && delta > humanBreak && confirmedRef.current !== true) {
        reset()
      }

      if (!collectingRef.current) {
        collectingRef.current = true
        bufRef.current = ''
        timesRef.current = []
        if (isEditableTarget(e.target)) {
          try {
            restoreRef.current = {
              el: e.target,
              value: String(e.target.value || ''),
              start: Number(e.target.selectionStart || 0),
              end: Number(e.target.selectionEnd || 0)
            }
          } catch {
            restoreRef.current = null
          }
        } else {
          restoreRef.current = null
        }
      }

      lastAtRef.current = now
      bufRef.current = String(bufRef.current || '') + key
      timesRef.current = Array.isArray(timesRef.current) ? timesRef.current : []
      timesRef.current.push(now)
      if (bufRef.current.length > maxLenSafe) {
        bufRef.current = bufRef.current.slice(-maxLenSafe)
        timesRef.current = timesRef.current.slice(-maxLenSafe)
      }

      const confirmNow = confirmedRef.current !== true && shouldConfirmScanner()
      if (confirmNow) {
        confirmedRef.current = true
        restoreSnapshot()
      }

      if (confirmedRef.current === true) {
        e.preventDefault()
        e.stopPropagation()
      }

      try { clearTimeout(idleTimerRef.current) } catch {}
      idleTimerRef.current = setTimeout(() => {
        if (confirmedRef.current !== true) {
          reset()
          return
        }
        finalize()
        reset()
      }, idle)
    }

    window.addEventListener('keydown', handler, true)
    return () => {
      window.removeEventListener('keydown', handler, true)
      reset()
    }
  }, [enabled, minLen, maxLen, idleMs, burstDeltaMs, humanDeltaMs])
}
