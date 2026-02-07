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
