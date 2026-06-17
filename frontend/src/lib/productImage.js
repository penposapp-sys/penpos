export const PRODUCT_PLACEHOLDER_SRC = '/images/default-product.webp'
export const ACCEPTED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PRODUCT_IMAGE_BYTES = 1024 * 1024

const normalizeBaseUrl = (value) => String(value || '').replace(/\/+$/, '')

const inferApiOrigin = () => {
  const envBase = normalizeBaseUrl(import.meta.env.VITE_API_URL)
  if (envBase) {
    try {
      const url = new URL(envBase)
      if (import.meta.env.DEV) url.port = '4000'
      url.pathname = ''
      url.search = ''
      url.hash = ''
      return url.toString().replace(/\/+$/, '')
    } catch {
      return envBase
    }
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location
    if (import.meta.env.DEV && (port === '5173' || port === '4173')) {
      return `${protocol}//${hostname}:4000`
    }
    return origin
  }

  return ''
}

const API_ORIGIN = inferApiOrigin()

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
    return 'Desteklenmeyen dosya formatı. Lütfen JPG, PNG veya WEBP yükleyin.'
  }
  if (Number(file.size || 0) > MAX_PRODUCT_IMAGE_BYTES) {
    return 'Görsel boyutu en fazla 1 MB olabilir.'
  }
  return ''
}

export function resolveProductImageUrl(product) {
  const raw = String(
    product?.imageUrl ||
    product?.photoUrl ||
    product?.image ||
    product?.photo ||
    product?.media?.imageUrl ||
    product?.media?.photoUrl ||
    product?.media?.image ||
    ''
  ).trim()

  if (!raw) return PRODUCT_PLACEHOLDER_SRC
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) return raw
  if (raw.startsWith('/')) return API_ORIGIN ? `${API_ORIGIN}${raw}` : raw
  return PRODUCT_PLACEHOLDER_SRC
}
