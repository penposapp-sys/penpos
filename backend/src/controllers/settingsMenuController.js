import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import { sendError } from '../utils/errors.js'
import { ensureFeature, ensureNotExpired } from '../services/planService.js'

export const getActiveMenuItems = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')

    const [categories, menuItems] = await Promise.all([
      Category.find({ tenantId: req.user.tenantId, isActive: true }).select('_id name sortOrder').lean(),
      MenuItem.find({ tenantId: req.user.tenantId, isActive: true }).select('_id name categoryId sortOrder').lean()
    ])

    res.json({
      success: true,
      categories: (categories || []).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)),
      menuItems: (menuItems || []).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    })
  } catch (err) {
    sendError(res, err)
  }
}

