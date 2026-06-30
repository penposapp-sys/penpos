import { resolveApiOrigin } from './runtimeApi.js'

export const PRODUCT_PLACEHOLDER_SRC = '/images/default-product.webp'
export const ACCEPTED_PRODUCT_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif'
]
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
const API_ORIGIN = resolveApiOrigin()
const API_UPLOADS_PREFIX = '/api/uploads/'

const normalizeImageValue = (value) => String(value || '').trim().replace(/\\/g, '/')
const toAbsoluteProductUrl = (value) => (API_ORIGIN ? `${API_ORIGIN}${value}` : value)

export function formatProductImageSize(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

export function validateProductImageFile(file) {
  if (!file) return ''
  const type = String(file.type || '').toLowerCase()
  if (!ACCEPTED_PRODUCT_IMAGE_TYPES.includes(type)) {
    return 'Desteklenmeyen dosya formati. Lutfen JPG, PNG, WEBP, AVIF veya HEIC/HEIF yukleyin.'
  }
  if (Number(file.size || 0) > MAX_PRODUCT_IMAGE_BYTES) {
    return 'Gorsel boyutu en fazla 5 MB olabilir.'
  }
  return ''
}

export function resolveProductImageUrl(product) {
  const raw = normalizeImageValue(
    product?.imageUrl ||
    product?.photoUrl ||
    product?.image ||
    product?.photo ||
    product?.media?.imageUrl ||
    product?.media?.photoUrl ||
    product?.media?.image ||
    ''
  )

  if (!raw) return PRODUCT_PLACEHOLDER_SRC
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) return raw
  if (raw.startsWith('/api/uploads/')) return toAbsoluteProductUrl(raw)
  if (raw.startsWith('api/uploads/')) return toAbsoluteProductUrl(`/${raw}`)
  if (raw.startsWith('/uploads/')) return toAbsoluteProductUrl(`${API_UPLOADS_PREFIX}${raw.slice('/uploads/'.length)}`)
  if (raw.startsWith('uploads/')) return toAbsoluteProductUrl(`${API_UPLOADS_PREFIX}${raw.slice('uploads/'.length)}`)
  if (raw.startsWith('/')) return toAbsoluteProductUrl(raw)
  if (/^[^/]+\.(jpe?g|png|webp|avif|heic|heif)$/i.test(raw)) {
    return toAbsoluteProductUrl(`${API_UPLOADS_PREFIX}products/${raw}`)
  }
  return PRODUCT_PLACEHOLDER_SRC
}
