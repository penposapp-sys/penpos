import fs from 'fs/promises'
import path from 'path'
import Tenant from '../models/Tenant.js'
import { error } from '../utils/errors.js'
import { optimizeImageToWebp, validateImageUploadFile } from '../utils/imageUpload.js'
import { resolveUploadDir } from '../utils/uploads.js'
import { syncTenantLogoSettings, removeTenantLogoFiles } from '../services/businessSettingsService.js'

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const getTenantDir = (tenantId) => resolveUploadDir(`tenant-${tenantId}`)

const normalizePublicLogoUrl = (tenantId) => `/uploads/tenant-${tenantId}/logo.webp`
const normalizePublicQrFeaturedImageUrl = (tenantId) => `/uploads/tenant-${tenantId}/qr-featured.webp`

export const uploadLogo = async (req, res) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) throw error('missing_tenant', 'Tenant required', 403)

  const file = req.file
  if (!file) throw error('file_required', 'Dosya gerekli', 400)

  await validateImageUploadFile(file, { label: 'Logo' })

  const dir = getTenantDir(tenantId)
  await ensureDir(dir)
  await removeTenantLogoFiles(tenantId)

  const optimized = await optimizeImageToWebp(file, { label: 'Logo' })
  const filename = 'logo.webp'
  const target = path.join(dir, filename)
  await fs.writeFile(target, optimized.buffer)

  const logoUrl = normalizePublicLogoUrl(tenantId)
  const logo = await syncTenantLogoSettings(tenantId, {
    url: logoUrl,
    fileName: filename,
    mimeType: optimized.mimeType,
    size: optimized.size
  })

  return res.json({ success: true, logoUrl, logo })
}

export const removeLogo = async (req, res) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) throw error('missing_tenant', 'Tenant required', 403)

  await removeTenantLogoFiles(tenantId)

  const logo = await syncTenantLogoSettings(tenantId, { url: '', fileName: '', mimeType: '', size: 0 })

  return res.json({ success: true, logoUrl: '', logo })
}

export const uploadQrFeaturedImage = async (req, res) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) throw error('missing_tenant', 'Tenant required', 403)
  if (!req.file) throw error('file_required', 'Dosya gerekli', 400)

  const optimized = await optimizeImageToWebp(req.file, { label: 'Öneri görseli' })
  const dir = getTenantDir(tenantId)
  await ensureDir(dir)
  await fs.writeFile(path.join(dir, 'qr-featured.webp'), optimized.buffer)

  const imageUrl = `${normalizePublicQrFeaturedImageUrl(tenantId)}?v=${Date.now()}`
  const result = await Tenant.updateOne(
    { _id: tenantId },
    { $set: { 'settings.qrMenu.featuredImageUrl': imageUrl } }
  )
  if (!result.matchedCount) throw error('not_found', 'Tenant not found', 404)

  return res.json({ success: true, imageUrl })
}
