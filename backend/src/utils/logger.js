const isProd = process.env.NODE_ENV === 'production'

export const info = (...args) => {
  console.log('[INFO]', ...args)
}

export const warn = (...args) => {
  console.warn('[WARN]', ...args)
}

export const error = (...args) => {
  console.error('[ERROR]', ...args)
}
