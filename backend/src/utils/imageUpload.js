import sharp from 'sharp'
import { error } from './errors.js'

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
export const TARGET_IMAGE_MAX_BYTES = 1024 * 1024
export const OPTIMIZED_IMAGE_MAX_WIDTH = 800
export const OPTIMIZED_IMAGE_MAX_HEIGHT = 800
export const DEFAULT_IMAGE_QUALITY = 75

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
])

const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp'])

const normalizeMimeToFormat = (mimeType) => {
  const value = String(mimeType || '').toLowerCase()
  if (value === 'image/jpeg') return 'jpeg'
  if (value === 'image/png') return 'png'
  if (value === 'image/webp') return 'webp'
  return ''
}

export const isAcceptedImageMimeType = (value) => ALLOWED_IMAGE_MIME_TYPES.has(String(value || '').toLowerCase())

export const validateImageUploadFile = async (file, { label = 'Gorsel' } = {}) => {
  if (!file || !file.buffer) throw error('file_required', `${label} dosyasi gerekli.`, 400)

  const mimeType = String(file.mimetype || '').toLowerCase()
  if (!isAcceptedImageMimeType(mimeType)) {
    throw error('invalid_file_type', 'Sadece JPG, JPEG, PNG ve WEBP dosyalari kabul edilir.', 400)
  }

  const size = Number(file.size || file.buffer?.length || 0)
  if (!Number.isFinite(size) || size <= 0) {
    throw error('invalid_file', `${label} dosyasi okunamadi.`, 400)
  }

  if (size > MAX_IMAGE_UPLOAD_BYTES) {
    throw error('file_too_large', 'Gorsel boyutu en fazla 5 MB olabilir.', 400)
  }

  let metadata
  try {
    metadata = await sharp(file.buffer, { failOn: 'error' }).metadata()
  } catch {
    throw error('invalid_file', 'Yuklenen dosya gecerli bir gorsel degil.', 400)
  }

  const detectedFormat = String(metadata?.format || '').toLowerCase()
  if (!ALLOWED_IMAGE_FORMATS.has(detectedFormat)) {
    throw error('invalid_file_type', 'Sadece JPG, JPEG, PNG ve WEBP dosyalari kabul edilir.', 400)
  }

  const expectedFormat = normalizeMimeToFormat(mimeType)
  if (expectedFormat && expectedFormat !== detectedFormat) {
    throw error('mime_type_mismatch', 'Dosya uzantisi veya MIME tipi gorsel icerigiyle eslesmiyor.', 400)
  }

  return {
    metadata,
    detectedFormat,
    size,
    mimeType
  }
}

export const optimizeImageToWebp = async (file, options = {}) => {
  await validateImageUploadFile(file, options)

  const width = Number(options.width || OPTIMIZED_IMAGE_MAX_WIDTH)
  const height = Number(options.height || OPTIMIZED_IMAGE_MAX_HEIGHT)
  const targetMaxBytes = Number(options.targetMaxBytes || TARGET_IMAGE_MAX_BYTES)
  const requestedQuality = Number(options.quality || DEFAULT_IMAGE_QUALITY)
  const qualitySteps = Array.from(new Set([
    requestedQuality,
    70,
    65,
    60,
    55,
    50
  ].filter((value) => Number.isFinite(value) && value > 0 && value <= 100)))

  let optimizedBuffer = null
  let appliedQuality = requestedQuality

  for (const quality of qualitySteps) {
    const nextBuffer = await sharp(file.buffer, { failOn: 'error' })
      .rotate()
      .resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality })
      .toBuffer()

    optimizedBuffer = nextBuffer
    appliedQuality = quality
    if (nextBuffer.length <= targetMaxBytes) break
  }

  const metadata = await sharp(optimizedBuffer).metadata()

  return {
    buffer: optimizedBuffer,
    size: optimizedBuffer.length,
    mimeType: 'image/webp',
    width: Number(metadata?.width || 0),
    height: Number(metadata?.height || 0),
    quality: appliedQuality
  }
}
