import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenSettingsService.js'
import fs from 'fs/promises'
import path from 'path'
import { optimizeImageToWebp, validateImageUploadFile } from '../../../utils/imageUpload.js'
import { resolveUploadDir } from '../../../utils/uploads.js'

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const getQrMediaConfig = (tenantId, kind) => {
  const baseDir = resolveUploadDir(`tenant-${tenantId}`)
  if (kind === 'logo') {
    return {
      fileName: 'canteen-qr-logo.webp',
      filePath: path.join(baseDir, 'canteen-qr-logo.webp'),
      publicUrl: `/uploads/tenant-${tenantId}/canteen-qr-logo.webp`,
      field: 'qrLogoUrl',
      label: 'QR Logo'
    }
  }
  return {
    fileName: 'canteen-qr-cover.webp',
    filePath: path.join(baseDir, 'canteen-qr-cover.webp'),
    publicUrl: `/uploads/tenant-${tenantId}/canteen-qr-cover.webp`,
    field: 'qrCoverImageUrl',
    label: 'QR Kapak'
  }
}

export const getSettings = async (req, res) => {
  try {
    const settings = await service.getSettings(req.user.tenantId)
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateSettings = async (req, res) => {
  try {
    const settings = await service.updateSettings(req.user.tenantId, req.body || {})
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const getPaymentSettings = async (req, res) => {
  try {
    const settings = await service.getPaymentSettings(req.user.tenantId)
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updatePaymentSettings = async (req, res) => {
  try {
    const settings = await service.updatePaymentSettings(req.user.tenantId, req.body || {})
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateQrSettings = async (req, res) => {
  try {
    const settings = await service.updateQrSettings(req.user.tenantId, req.canteenBranchId, req.body || {})
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const uploadQrMedia = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    const kind = String(req.params?.kind || '').trim().toLowerCase() === 'logo' ? 'logo' : 'cover'
    const file = req.file
    const config = getQrMediaConfig(tenantId, kind)

    await validateImageUploadFile(file, { label: config.label })
    const optimized = await optimizeImageToWebp(file, { label: config.label })
    await ensureDir(path.dirname(config.filePath))
    await fs.rm(config.filePath, { force: true })
    await fs.writeFile(config.filePath, optimized.buffer)

    const settings = await service.updateQrSettings(tenantId, req.canteenBranchId, {
      [config.field]: config.publicUrl
    })

    res.json({
      success: true,
      imageUrl: config.publicUrl,
      settings
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const removeQrMedia = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    const kind = String(req.params?.kind || '').trim().toLowerCase() === 'logo' ? 'logo' : 'cover'
    const config = getQrMediaConfig(tenantId, kind)
    await fs.rm(config.filePath, { force: true })

    const settings = await service.updateQrSettings(tenantId, req.canteenBranchId, {
      [config.field]: ''
    })

    res.json({
      success: true,
      imageUrl: '',
      settings
    })
  } catch (err) {
    sendError(res, err)
  }
}
