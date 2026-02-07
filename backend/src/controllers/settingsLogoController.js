import fs from 'fs/promises'
import path from 'path'
import Tenant from '../models/Tenant.js'
import { error } from '../utils/errors.js'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp']
])

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const safeUnlink = async (filePath) => {
  try {
    await fs.unlink(filePath)
  } catch {}
}

const getTenantDir = (tenantId) => path.join(process.cwd(), 'uploads', `tenant-${tenantId}`)

const normalizePublicLogoUrl = (tenantId, ext) => `/uploads/tenant-${tenantId}/logo.${ext}`

export const uploadLogo = async (req, res) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) throw error('missing_tenant', 'Tenant required', 403)

  const file = req.file
  if (!file) throw error('file_required', 'Dosya gerekli', 400)

  const mime = String(file.mimetype || '').toLowerCase()
  const ext = ALLOWED_MIME.get(mime)
  if (!ext) throw error('invalid_file_type', 'Sadece png/jpg/webp kabul edilir', 400)
  if (!file.buffer || file.buffer.length === 0) throw error('invalid_file', 'Dosya okunamadı', 400)
  if (file.buffer.length > MAX_BYTES) throw error('file_too_large', 'Dosya çok büyük (max 2MB)', 400)

  const dir = getTenantDir(tenantId)
  await ensureDir(dir)

  await Promise.all([
    safeUnlink(path.join(dir, 'logo.png')),
    safeUnlink(path.join(dir, 'logo.jpg')),
    safeUnlink(path.join(dir, 'logo.webp'))
  ])

  const filename = `logo.${ext}`
  const target = path.join(dir, filename)
  await fs.writeFile(target, file.buffer)

  const logoUrl = normalizePublicLogoUrl(tenantId, ext)
  const t = await Tenant.findByIdAndUpdate(tenantId, { logoUrl }, { new: true })
  if (!t) throw error('not_found', 'Tenant not found', 404)

  return res.json({ success: true, logoUrl })
}

export const removeLogo = async (req, res) => {
  const tenantId = req.user?.tenantId
  if (!tenantId) throw error('missing_tenant', 'Tenant required', 403)

  const dir = getTenantDir(tenantId)
  await Promise.all([
    safeUnlink(path.join(dir, 'logo.png')),
    safeUnlink(path.join(dir, 'logo.jpg')),
    safeUnlink(path.join(dir, 'logo.webp'))
  ])

  const t = await Tenant.findByIdAndUpdate(tenantId, { logoUrl: '' }, { new: true })
  if (!t) throw error('not_found', 'Tenant not found', 404)

  return res.json({ success: true, logoUrl: '' })
}

