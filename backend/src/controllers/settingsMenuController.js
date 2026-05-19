import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import { sendError } from '../utils/errors.js'
import { ensureFeature, ensureNotExpired } from '../services/planService.js'
import { notDeletedFilter } from '../utils/softDelete.js'
import { buildBranchVisibilityFilter, normalizeObjectIdArray } from '../utils/branchVisibility.js'

export const getActiveMenuItems = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')

    const requestedBranchIds = normalizeObjectIdArray(req.query?.branchIds !== undefined
      ? req.query.branchIds
      : (req.query?.branchId || req.branch?.id ? [req.query?.branchId || req.branch?.id] : []))
    const visibilityFilter = buildBranchVisibilityFilter(requestedBranchIds)
    const categoryFilter = notDeletedFilter({ tenantId: req.user.tenantId, isActive: true })
    const menuItemFilter = notDeletedFilter({ tenantId: req.user.tenantId, isActive: true })
    if (Object.keys(visibilityFilter).length > 0) {
      categoryFilter.$and = [...(Array.isArray(categoryFilter.$and) ? categoryFilter.$and : []), visibilityFilter]
      menuItemFilter.$and = [...(Array.isArray(menuItemFilter.$and) ? menuItemFilter.$and : []), visibilityFilter]
    }

    const [categories, menuItems] = await Promise.all([
      Category.find(categoryFilter).select('_id name sortOrder branchIds').lean(),
      MenuItem.find(menuItemFilter).select('_id name categoryId sortOrder branchIds').lean()
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
