import fs from 'fs/promises'
import path from 'path'
import MenuItem from '../models/MenuItem.js'
import CanteenProduct from '../modules/canteen/models/CanteenProduct.js'
import {
  PRODUCT_IMAGE_PUBLIC_PREFIX,
  PRODUCT_IMAGE_UPLOAD_DIRS,
  ensureProductImageUploadDir,
  isLocalProductImagePath,
  normalizeLocalProductImagePath
} from '../utils/productImageStorage.js'

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const START_DELAY_MS = 60 * 1000

const listReferencedImagePaths = async () => {
  const [menuItems, canteenProducts] = await Promise.all([
    MenuItem.find({ imageUrl: { $regex: 'uploads/products/' } }).select('imageUrl').lean(),
    CanteenProduct.find({ imageUrl: { $regex: 'uploads/products/' } }).select('imageUrl').lean()
  ])

  const references = new Set()
  for (const doc of [...menuItems, ...canteenProducts]) {
    const imageUrl = String(doc?.imageUrl || '').trim()
    if (isLocalProductImagePath(imageUrl)) references.add(normalizeLocalProductImagePath(imageUrl))
  }
  return references
}

export const cleanupUnusedProductImages = async () => {
  await ensureProductImageUploadDir()
  const [directories, references] = await Promise.all([
    Promise.all(PRODUCT_IMAGE_UPLOAD_DIRS.map(async (dir) => {
      try {
        return {
          dir,
          entries: await fs.readdir(dir, { withFileTypes: true })
        }
      } catch (err) {
        if (err?.code === 'ENOENT') return { dir, entries: [] }
        throw err
      }
    })),
    listReferencedImagePaths()
  ])

  let deletedCount = 0
  for (const directory of directories) {
    for (const entry of directory.entries) {
      if (!entry.isFile()) continue
      const publicPath = `${PRODUCT_IMAGE_PUBLIC_PREFIX}${entry.name}`
      if (references.has(publicPath)) continue
      try {
        await fs.unlink(path.join(directory.dir, entry.name))
        deletedCount += 1
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err
      }
    }
  }

  return { deletedCount, referencedCount: references.size }
}

export const startProductImageCleanupScheduler = () => {
  const runCleanup = async () => {
    try {
      const result = await cleanupUnusedProductImages()
      console.log('[PRODUCT_IMAGE_CLEANUP]', result)
    } catch (err) {
      console.error('[PRODUCT_IMAGE_CLEANUP_ERROR]', err?.message || err)
    }
  }

  setTimeout(runCleanup, START_DELAY_MS)
  setInterval(runCleanup, ONE_WEEK_MS)
}
