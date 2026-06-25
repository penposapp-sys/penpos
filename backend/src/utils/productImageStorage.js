import fs from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'
import { resolveUploadDir, resolveUploadDirCandidates } from './uploads.js'
import {
  MAX_IMAGE_UPLOAD_BYTES,
  isAcceptedImageMimeType,
  optimizeImageToWebp,
  validateImageUploadFile
} from './imageUpload.js'

export const MAX_PRODUCT_IMAGE_BYTES = MAX_IMAGE_UPLOAD_BYTES
export const PRODUCT_IMAGE_PLACEHOLDER = '/images/default-product.webp'
export const PRODUCT_IMAGE_UPLOAD_DIR = resolveUploadDir('products')
export const PRODUCT_IMAGE_UPLOAD_DIRS = resolveUploadDirCandidates('products')
export const PRODUCT_IMAGE_PUBLIC_PREFIX = '/uploads/products/'

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

export const isAcceptedProductImageMimeType = (value) => isAcceptedImageMimeType(value)

export const ensureProductImageUploadDir = async () => {
  await fs.mkdir(PRODUCT_IMAGE_UPLOAD_DIR, { recursive: true })
}

const generateFileName = () => {
  const stamp = Math.floor(Date.now() / 1000)
  const suffix = randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
  return `product_${stamp}_${suffix}.webp`
}

export const validateProductImageFile = (file) => validateImageUploadFile(file)

export const saveOptimizedProductImage = async (file) => {
  await validateProductImageFile(file)
  await ensureProductImageUploadDir()

  const fileName = generateFileName()
  const absolutePath = path.join(PRODUCT_IMAGE_UPLOAD_DIR, fileName)
  const optimized = await optimizeImageToWebp(file)

  await fs.writeFile(absolutePath, optimized.buffer)

  return {
    imageUrl: `${PRODUCT_IMAGE_PUBLIC_PREFIX}${fileName}`,
    absolutePath,
    size: optimized.size,
    mimeType: optimized.mimeType
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
