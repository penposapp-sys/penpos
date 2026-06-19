import fs from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'
import sharp from 'sharp'
import { error } from './errors.js'
import { resolveUploadDir, resolveUploadDirCandidates } from './uploads.js'

export const MAX_PRODUCT_IMAGE_BYTES = 1024 * 1024
export const PRODUCT_IMAGE_PLACEHOLDER = '/images/default-product.webp'
export const PRODUCT_IMAGE_UPLOAD_DIR = resolveUploadDir('products')
export const PRODUCT_IMAGE_UPLOAD_DIRS = resolveUploadDirCandidates('products')
export const PRODUCT_IMAGE_PUBLIC_PREFIX = '/uploads/products/'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
])

const normalizeImageValue = (value) => String(value || '').trim().replace(/\\/g, '/')

export const normalizeLocalProductImagePath = (value) => {
  const normalized = normalizeImageValue(value)
  if (!normalized) return ''
  if (normalized.startsWith(PRODUCT_IMAGE_PUBLIC_PREFIX)) return normalized
  if (normalized.startsWith(`/api${PRODUCT_IMAGE_PUBLIC_PREFIX}`)) return normalized.slice(4)
  if (normalized.startsWith(`api${PRODUCT_IMAGE_PUBLIC_PREFIX}`)) return normalized.slice(3)
  if (normalized.startsWith(PRODUCT_IMAGE_PUBLIC_PREFIX.slice(1))) return `/${normalized}`
  return normalized
}

export const isRemoteImageUrl = (value) => /^https?:\/\//i.test(normalizeImageValue(value))

export const isLocalProductImagePath = (value) => normalizeLocalProductImagePath(value).startsWith(PRODUCT_IMAGE_PUBLIC_PREFIX)

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

  const relativeFileName = normalizeLocalProductImagePath(imageUrl)
    .slice(PRODUCT_IMAGE_PUBLIC_PREFIX.length)
    .split(/[?#]/, 1)[0]
  if (!relativeFileName || relativeFileName.includes('/') || relativeFileName.includes('\\')) return false

  let deleted = false
  for (const absolutePath of PRODUCT_IMAGE_UPLOAD_DIRS.map((dir) => path.join(dir, relativeFileName))) {
    try {
      await fs.unlink(absolutePath)
      deleted = true
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err
    }
  }
  return deleted
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
