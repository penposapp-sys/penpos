export const decodeRawPayload = (content, encoding = '', { requireBase64 = false } = {}) => {
  const normalizedEncoding = String(encoding || '').trim().toLowerCase()
  const value = String(content || '').trim()
  const isBase64 = value && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  if (!isBase64) {
    if (requireBase64) throw new Error('Invalid base64 raw payload')
    if (normalizedEncoding !== 'base64') return content
    throw new Error('Invalid base64 raw payload')
  }
  const decoded = Buffer.from(value, 'base64')
  if (normalizedEncoding === 'base64') return decoded
  if (decoded[0] === 0x1b && decoded[1] === 0x40) return decoded
  if (requireBase64) throw new Error('Binary RAW payload requires base64 encoding')
  return content
}
