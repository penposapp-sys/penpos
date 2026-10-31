import { error } from '../utils/errors.js'

const isLoopbackAddress = (address) => {
  const normalized = String(address || '').replace(/^::ffff:/i, '').toLowerCase()
  return normalized === '127.0.0.1' || normalized === '::1'
}

export const requireCallAgentHttps = (req, res, next) => {
  if (req.socket?.encrypted) return next()

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').trim().toLowerCase()
  if (isLoopbackAddress(req.socket?.remoteAddress) && forwardedProto === 'https') return next()

  next(error('https_required', 'Çağrı ajanı API erişimi için HTTPS gereklidir', 426))
}
