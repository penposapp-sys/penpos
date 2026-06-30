import sharp from 'sharp'
import { error } from './errors.js'

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
export const TARGET_IMAGE_MAX_BYTES = 1024 * 1024
export const OPTIMIZED_IMAGE_MAX_WIDTH = 800
export const OPTIMIZED_IMAGE_MAX_HEIGHT = 800
export const DEFAULT_IMAGE_QUALITY = 75

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif'
])

const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif', 'heif', 'heic'])

const normalizeMimeToFormat = (mimeType) => {
  const value = String(mimeType || '').toLowerCase()
  if (value === 'image/jpeg' || value === 'image/jpg' || value === 'image/pjpeg') return 'jpeg'
  if (value === 'image/png' || value === 'image/x-png') return 'png'
  if (value === 'image/webp') return 'webp'
  if (value === 'image/avif') return 'avif'
  if (value === 'image/heic') return 'heif'
  if (value === 'image/heif') return 'heif'
  return ''
}

export const isAcceptedImageMimeType = (value) => ALLOWED_IMAGE_MIME_TYPES.has(String(value || '').toLowerCase())

export const validateImageUploadFile = async (file, { label = 'Gorsel' } = {}) => {
  if (!file || !file.buffer) throw error('file_required', `${label} dosyasi gerekli.`, 400)

  const mimeType = String(file.mimetype || '').toLowerCase()
  if (!isAcceptedImageMimeType(mimeType)) {
    throw error('invalid_file_type', 'Sadece JPG, JPEG, PNG, WEBP, AVIF ve HEIC/HEIF dosyalari kabul edilir.', 400)
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
    throw error('invalid_file_type', 'Sadece JPG, JPEG, PNG, WEBP, AVIF ve HEIC/HEIF dosyalari kabul edilir.', 400)
  }

  const expectedFormat = normalizeMimeToFormat(mimeType)
  const formatMatches = !expectedFormat || expectedFormat === detectedFormat || (expectedFormat === 'heif' && detectedFormat === 'heic')
  if (!formatMatches) {
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
    50,
    45,
    40,
    35
  ].filter((value) => Number.isFinite(value) && value > 0 && value <= 100)))
  const resizeSteps = Array.from(new Set([
    { width, height },
    { width: Math.min(width, 720), height: Math.min(height, 720) },
    { width: Math.min(width, 640), height: Math.min(height, 640) },
    { width: Math.min(width, 560), height: Math.min(height, 560) },
    { width: Math.min(width, 480), height: Math.min(height, 480) }
  ].filter((step) => Number.isFinite(step.width) && step.width > 0 && Number.isFinite(step.height) && step.height > 0)
    .map((step) => `${step.width}x${step.height}`)))
    .map((key) => {
      const [stepWidth, stepHeight] = key.split('x').map(Number)
      return { width: stepWidth, height: stepHeight }
    })

  let optimizedBuffer = null
  let appliedQuality = requestedQuality
  let appliedWidth = width
  let appliedHeight = height
  let smallestBuffer = null
  let smallestQuality = requestedQuality
  let smallestWidth = width
  let smallestHeight = height

  for (const resizeStep of resizeSteps) {
    for (const quality of qualitySteps) {
      const nextBuffer = await sharp(file.buffer, { failOn: 'error' })
        .rotate()
        .resize({
          width: resizeStep.width,
          height: resizeStep.height,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality })
        .toBuffer()

      optimizedBuffer = nextBuffer
      appliedQuality = quality
      appliedWidth = resizeStep.width
      appliedHeight = resizeStep.height

      if (!smallestBuffer || nextBuffer.length < smallestBuffer.length) {
        smallestBuffer = nextBuffer
        smallestQuality = quality
        smallestWidth = resizeStep.width
        smallestHeight = resizeStep.height
      }

      if (nextBuffer.length <= targetMaxBytes) break
    }

    if (optimizedBuffer && optimizedBuffer.length <= targetMaxBytes) break
  }

  if (optimizedBuffer && optimizedBuffer.length > targetMaxBytes && smallestBuffer) {
    optimizedBuffer = smallestBuffer
    appliedQuality = smallestQuality
    appliedWidth = smallestWidth
    appliedHeight = smallestHeight
  }

  const metadata = await sharp(optimizedBuffer).metadata()

  return {
    buffer: optimizedBuffer,
    size: optimizedBuffer.length,
    mimeType: 'image/webp',
    width: Number(metadata?.width || 0),
    height: Number(metadata?.height || 0),
    quality: appliedQuality,
    requestedWidth: appliedWidth,
    requestedHeight: appliedHeight
  }
}
