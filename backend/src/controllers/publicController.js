import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'

const buildBaseUrl = (req) => {
  const envBase = String(process.env.BASE_URL || '').trim()
  if (envBase) return envBase.replace(/\/+$/, '')
  try {
    const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const xfHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
    const proto = xfProto || String(req.protocol || 'http')
    const host = xfHost || String(req.get('host') || '')
    if (!host) return ''
    return `${proto}://${host}`
  } catch {
    return ''
  }
}

const getPrintAgentVersion = () => {
  const envVersion = String(process.env.PRINT_AGENT_WINDOWS_VERSION || '').trim()
  if (envVersion) return envVersion
  try {
    const packageJsonPath = path.join(process.cwd(), 'print-agent', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return String(packageJson?.version || '0.1.0').trim() || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

const resolvePrintAgentWindowsBinary = () => {
  const envPath = String(process.env.PRINT_AGENT_WINDOWS_FILE || '').trim()
  const version = getPrintAgentVersion()
  const exeFileName = String(process.env.PRINT_AGENT_WINDOWS_FILENAME || 'PenPOS_PrintAgent.exe').trim() || 'PenPOS_PrintAgent.exe'
  const setupFileName = `PenPOS_PrintAgent_Setup_${version}.exe`
  const candidates = [
    envPath,
    path.join(process.cwd(), 'backend', 'public', 'downloads', 'print-agent', 'windows', exeFileName),
    path.join(process.cwd(), 'public', 'downloads', 'print-agent', 'windows', exeFileName),
    path.join(process.cwd(), 'backend', 'public', 'downloads', setupFileName),
    path.join(process.cwd(), 'public', 'downloads', setupFileName)
  ].filter(Boolean)

  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate)
    } catch {
      return false
    }
  })

  let publishedAt = null
  if (existing) {
    try {
      publishedAt = fs.statSync(existing).mtime.toISOString()
    } catch {
      publishedAt = null
    }
  }

  return {
    version,
    fileName: existing ? path.basename(existing) : exeFileName,
    filePath: existing || '',
    publishedAt
  }
}

export const getPublicMenu = async (req, res) => {
  const tenantSlug = String(req.query?.tenantSlug || '').trim()
  const tenantIdRaw = String(req.query?.tenantId || '').trim()

  const tenant = tenantSlug
    ? await Tenant.findOne({ slug: tenantSlug, isActive: true, status: 'active' }).lean()
    : (mongoose.Types.ObjectId.isValid(tenantIdRaw)
      ? await Tenant.findOne({ _id: tenantIdRaw, isActive: true, status: 'active' }).lean()
      : null)

  if (!tenant) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  if (tenant?.settings?.qrMenuEnabled === false) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  const [categories, items] = await Promise.all([
    Category.find({ tenantId: tenant._id, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    MenuItem.find({ tenantId: tenant._id, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean()
  ])

  return res.json({
    tenant: { id: String(tenant._id), name: tenant.name, slug: tenant.slug, logoUrl: String(tenant.logoUrl || '') },
    categories: (categories || []).map(c => ({ id: String(c._id), name: c.name, sortOrder: Number(c.sortOrder || 0) })),
    items: (items || []).map(i => ({
      id: String(i._id),
      categoryId: String(i.categoryId),
      name: i.name,
      price: Number(i.price || 0),
      description: String(i.description || ''),
      imageUrl: String(i.imageUrl || ''),
      sortOrder: Number(i.sortOrder || 0)
    }))
  })
}

export const downloadPrintAgentSetup = async (req, res) => {
  const resolved = resolvePrintAgentWindowsBinary()
  if (!resolved.filePath) {
    return res.status(404).json({
      success: false,
      code: 'print_agent_not_found',
      error: 'print_agent_not_found',
      message: 'Print Agent dosyasi bulunamadi'
    })
  }

  return res.download(resolved.filePath, resolved.fileName)
}

export const getPrintAgentWindowsManifest = async (req, res) => {
  const resolved = resolvePrintAgentWindowsBinary()
  if (!resolved.filePath) {
    return res.status(404).json({
      success: false,
      code: 'print_agent_not_found',
      error: 'print_agent_not_found',
      message: 'Print Agent dosyasi bulunamadi'
    })
  }

  const fallbackPath = '/api/public/downloads/print-agent/windows'
  const base = buildBaseUrl(req)
  const downloadUrl = String(process.env.PRINT_AGENT_WINDOWS_URL || (base ? new URL(fallbackPath, base).toString() : fallbackPath)).trim()

  return res.json({
    success: true,
    platform: 'windows',
    version: resolved.version,
    fileName: resolved.fileName,
    downloadUrl,
    required: false,
    notes: String(process.env.PRINT_AGENT_WINDOWS_NOTES || '').trim(),
    publishedAt: resolved.publishedAt
  })
}
