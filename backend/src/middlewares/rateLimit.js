export const rateLimit = ({ windowMs, max }) => {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = `${req.ip}`
    const record = hits.get(key) || { start: now, count: 0 }
    if (now - record.start > windowMs) {
      record.start = now
      record.count = 0
    }
    record.count += 1
    hits.set(key, record)
    if (record.count > max) {
      return res.status(429).json({ success: false, error: 'rate_limited', message: 'Çok fazla istek', requestId: res.locals?.requestId || null })
    }
    next()
  }
}
