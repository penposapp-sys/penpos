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
export const TARGET_PRODUCT_UPLOAD_BYTES = 950 * 1024
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

const loadImageElement = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    URL.revokeObjectURL(objectUrl)
    resolve(img)
  }
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    reject(new Error('image_load_failed'))
  }
  img.src = objectUrl
})

const canvasToWebpBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(new Error('image_encode_failed'))
  }, 'image/webp', quality)
})

export async function optimizeProductImageForUpload(file, options = {}) {
  if (!file) return null
  const size = Number(file.size || 0)
  const targetMaxBytes = Number(options.targetMaxBytes || TARGET_PRODUCT_UPLOAD_BYTES)
  if (!Number.isFinite(size) || size <= 0) return file
  if (size <= targetMaxBytes) return file

  try {
    const image = await loadImageElement(file)
    const resizeSteps = [
      800,
      720,
      640,
      560,
      480
    ]
    const qualitySteps = [
      0.82,
      0.76,
      0.7,
      0.64,
      0.58,
      0.52,
      0.46,
      0.4
    ]

    let bestBlob = null

    for (const maxEdge of resizeSteps) {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1))
      const width = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * scale))
      const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) continue
      context.drawImage(image, 0, 0, width, height)

      for (const quality of qualitySteps) {
        const blob = await canvasToWebpBlob(canvas, quality)
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob
        if (blob.size <= targetMaxBytes) {
          return new File([blob], `${String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image'}.webp`, {
            type: 'image/webp',
            lastModified: Date.now()
          })
        }
      }
    }

    if (bestBlob && bestBlob.size < size) {
      return new File([bestBlob], `${String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image'}.webp`, {
        type: 'image/webp',
        lastModified: Date.now()
      })
    }
  } catch {
  }

  return file
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
