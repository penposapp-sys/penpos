import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'

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
  const envPath = String(process.env.PRINT_AGENT_WINDOWS_FILE || '').trim()
  const fileName = 'PenPOS_PrintAgent_Setup_0.1.0.exe'
  const candidates = [
    envPath,
    path.join(process.cwd(), 'backend', 'public', 'downloads', fileName),
    path.join(process.cwd(), 'public', 'downloads', fileName)
  ].filter(Boolean)

  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate)
    } catch {
      return false
    }
  })

  if (!existing) {
    return res.status(404).json({
      success: false,
      code: 'print_agent_not_found',
      error: 'print_agent_not_found',
      message: 'Print Agent kurulum dosyası bulunamadı'
    })
  }

  return res.download(existing, fileName)
}
