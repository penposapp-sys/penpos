import { createHash } from 'crypto'

const hash = (v) => {
  try {
    return createHash('sha1').update(String(v || '')).digest('hex')
  } catch {
    return String(v || '')
  }
}

export const rateLimit = ({ windowMs, max, keyFn, retryAfterSeconds = 2 }) => {
  const hits = new Map()
  const maxEntries = 20000

  const getKey = (req) => {
    if (typeof keyFn === 'function') return String(keyFn(req) || req.ip || 'unknown')
    const auth = String(req.headers?.authorization || '').trim()
    if (auth) return `auth:${hash(auth)}`
    return String(req.ip || 'unknown')
  }

  const getMax = (req) => {
    if (typeof max === 'function') return Number(max(req))
    return Number(max)
  }

  const getRetryAfterSeconds = (req) => {
    if (typeof retryAfterSeconds === 'function') return Number(retryAfterSeconds(req))
    return Number(retryAfterSeconds)
  }

  const maybePrune = (now) => {
    if (hits.size <= maxEntries) return
    for (const [k, v] of hits) {
      if (now - v.start > windowMs * 2) hits.delete(k)
    }
    if (hits.size <= maxEntries) return
    const extra = hits.size - maxEntries
    let i = 0
    for (const k of hits.keys()) {
      hits.delete(k)
      i += 1
      if (i >= extra) break
    }
  }

  return (req, res, next) => {
    const now = Date.now()
    maybePrune(now)

    const key = getKey(req)
    const limit = getMax(req)
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 60

    const record = hits.get(key) || { start: now, count: 0 }
    if (now - record.start > windowMs) {
      record.start = now
      record.count = 0
    }
    record.count += 1
    hits.set(key, record)

    if (record.count > safeLimit) {
      const ra = getRetryAfterSeconds(req)
      const retryAfter = Number.isFinite(ra) && ra > 0 ? Math.ceil(ra) : 2
      try {
        res.setHeader('Retry-After', String(retryAfter))
      } catch {}
      return res.status(429).json({
        success: false,
        error: 'rate_limited',
        code: 'rate_limited',
        message: 'Çok fazla istek',
        requestId: res.locals?.requestId || null
      })
    }
    next()
  }
}
