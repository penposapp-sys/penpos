import { error as logError } from './logger.js'

export const error = (code, message, status = 400) => {
  const err = new Error(message || code)
  err.status = status
  err.payload = { error: code, message: message || code }
  return err
}

export const sendError = (res, err) => {
  const requestId = res.locals?.requestId || null

  if (
    err?.code === 11000 &&
    (err?.keyPattern?.email || err?.keyValue?.email)
  ) {
    return res.status(409).json({
      success: false,
      error: 'duplicate_email',
      code: 'duplicate_email',
      message: 'Bu e-posta zaten kayıtlı',
      requestId
    })
  }

  if (
    err?.code === 11000 &&
    (err?.keyPattern?.username || err?.keyValue?.username)
  ) {
    return res.status(409).json({
      success: false,
      error: 'duplicate_username',
      code: 'duplicate_username',
      message: 'Bu kullanıcı adı zaten kayıtlı',
      requestId
    })
  }

  const status = err.status || 500
  if (status >= 500) {
    try {
      if (process.env.DEBUG_LOGIN === '1') {
        logError('[UNHANDLED_ERROR]', { requestId }, err?.stack || err)
      } else {
        logError('[UNHANDLED_ERROR]', { requestId, msg: String(err?.message || 'Internal error') })
      }
    } catch {
    }
  }
  let payload
  if (status >= 500) {
    payload = err?.expose
      ? (err.payload || { error: 'internal_error', message: err.message || 'Internal error' })
      : { error: 'internal_error', message: 'Internal server error' }
  } else {
    payload = err.payload || { error: 'internal_error', message: err.message || 'Internal error' }
  }
  if (payload && payload.error && payload.code === undefined) {
    payload.code = payload.error
  }
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    payload.stack = err.stack
  }
  res.status(status).json({ ...payload, success: false, requestId })
}
