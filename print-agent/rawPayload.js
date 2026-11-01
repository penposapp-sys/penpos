export const decodeRawPayload = (content, encoding = '', { requireBase64 = false } = {}) => {
  const normalizedEncoding = String(encoding || '').trim().toLowerCase()
  if (requireBase64 && normalizedEncoding !== 'base64') {
    throw new Error('Binary RAW payload requires base64 encoding')
  }
  if (normalizedEncoding !== 'base64') return content
  const value = String(content || '').trim()
  if (!value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid base64 raw payload')
  }
  return Buffer.from(value, 'base64')
}
