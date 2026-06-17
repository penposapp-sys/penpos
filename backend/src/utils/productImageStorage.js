import fs from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'
import sharp from 'sharp'
import { error } from './errors.js'

export const MAX_PRODUCT_IMAGE_BYTES = 1024 * 1024
export const PRODUCT_IMAGE_PLACEHOLDER = '/images/default-product.webp'
export const PRODUCT_IMAGE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products')
export const PRODUCT_IMAGE_PUBLIC_PREFIX = '/uploads/products/'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
])

const normalizeImageValue = (value) => String(value || '').trim()

export const isRemoteImageUrl = (value) => /^https?:\/\//i.test(normalizeImageValue(value))

export const isLocalProductImagePath = (value) => normalizeImageValue(value).startsWith(PRODUCT_IMAGE_PUBLIC_PREFIX)

export const isAcceptedProductImageMimeType = (value) => ALLOWED_MIME_TYPES.has(String(value || '').toLowerCase())

export const ensureProductImageUploadDir = async () => {
  await fs.mkdir(PRODUCT_IMAGE_UPLOAD_DIR, { recursive: true })
}

const generateFileName = () => {
  const stamp = Math.floor(Date.now() / 1000)
  const suffix = randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
  return `product_${stamp}_${suffix}.webp`
}

export const validateProductImageFile = (file) => {
  if (!file || !file.buffer) throw error('file_required', 'Gorsel dosyasi gerekli.', 400)

  const mimeType = String(file.mimetype || '').toLowerCase()
  if (!isAcceptedProductImageMimeType(mimeType)) {
    throw error('invalid_file_type', 'Desteklenmeyen dosya formatı. Lütfen JPG, PNG veya WEBP yükleyin.', 400)
  }

  const size = Number(file.size || file.buffer?.length || 0)
  if (!Number.isFinite(size) || size <= 0) {
    throw error('invalid_file', 'Gorsel dosyasi okunamadi.', 400)
  }

  if (size > MAX_PRODUCT_IMAGE_BYTES) {
    throw error('file_too_large', 'Görsel boyutu en fazla 1 MB olabilir.', 400)
  }
}

export const saveOptimizedProductImage = async (file) => {
  validateProductImageFile(file)
  await ensureProductImageUploadDir()

  const fileName = generateFileName()
  const absolutePath = path.join(PRODUCT_IMAGE_UPLOAD_DIR, fileName)

  const optimizedBuffer = await sharp(file.buffer, { failOn: 'error' })
    .rotate()
    .resize({ width: 1024, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer()

  await fs.writeFile(absolutePath, optimizedBuffer)

  return {
    imageUrl: `${PRODUCT_IMAGE_PUBLIC_PREFIX}${fileName}`,
    absolutePath,
    size: optimizedBuffer.length,
    mimeType: 'image/webp'
  }
}

export const deleteProductImageFile = async (imageUrl) => {
  if (!isLocalProductImagePath(imageUrl)) return false

  const relativeFileName = normalizeImageValue(imageUrl).slice(PRODUCT_IMAGE_PUBLIC_PREFIX.length)
  if (!relativeFileName || relativeFileName.includes('/') || relativeFileName.includes('\\')) return false

  const absolutePath = path.join(PRODUCT_IMAGE_UPLOAD_DIR, relativeFileName)
  try {
    await fs.unlink(absolutePath)
    return true
  } catch (err) {
    if (err?.code === 'ENOENT') return false
    throw err
  }
}

export const replaceProductImageFile = async (currentImageUrl, file) => {
  const next = await saveOptimizedProductImage(file)
  try {
    await deleteProductImageFile(currentImageUrl)
  } catch {
    // New file is already saved; stale-file cleanup should not block the update flow.
  }
  return next
}
