import fs from 'fs/promises'
import path from 'path'
import { error } from '../utils/errors.js'
import { optimizeImageToWebp, validateImageUploadFile } from '../utils/imageUpload.js'
import { resolveUploadDir } from '../utils/uploads.js'

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const buildFileName = (kind) => {
  const safeKind = String(kind || 'media').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  return `website-${safeKind}-${Date.now()}.webp`
}

export const uploadWebsiteMedia = async (req, res) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) throw error('missing_tenant', 'Tenant required', 403)

  const file = req.file
  if (!file) throw error('file_required', 'Dosya gerekli', 400)

  const kind = String(req.params?.kind || 'media').trim().toLowerCase()
  await validateImageUploadFile(file, { label: 'Web site gorseli' })

  const optimized = await optimizeImageToWebp(file, {
    label: 'Web site gorseli',
    width: kind === 'gallery' ? 1600 : 1400,
    height: kind === 'logo' ? 900 : 1400,
    quality: 78,
    targetMaxBytes: 1200 * 1024,
  })

  const dir = resolveUploadDir(`tenant-${tenantId}`)
  await ensureDir(dir)

  const fileName = buildFileName(kind)
  const targetPath = path.join(dir, fileName)
  await fs.writeFile(targetPath, optimized.buffer)

  return res.json({
    success: true,
    imageUrl: `/uploads/tenant-${tenantId}/${fileName}`,
    fileName,
    mimeType: optimized.mimeType,
    size: optimized.size,
    width: optimized.width,
    height: optimized.height,
  })
}
