import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { listBranches, createBranchService } from '../services/branchService.js'
import { sendError } from '../utils/errors.js'
import * as branchCtrl from '../controllers/branchesController.js'
import { PERMISSIONS } from '../constants/permissions.js'
import { getUserAccessibleBranchIds } from '../utils/branchVisibility.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), async (req, res) => {
  try {
    const role = req.user?.role
    if (role === 'tenant_admin') {
      const items = await listBranches(req.user.tenantId, { includeInactive: true })
      const branches = (items || []).map(b => ({
        _id: b._id || b.id,
        name: b.name,
        description: b.description || '',
        address: b.address || '',
        isActive: b.isActive !== false
      }))
      return res.json({ success: true, branches })
    }

    const items = await listBranches(req.user.tenantId, { includeInactive: false })
    const allowed = getUserAccessibleBranchIds(req.user).map(String)
    const filtered = allowed.length > 0
      ? (items || []).filter(b => allowed.includes(String(b.id)))
      : (items || [])
    const branches = filtered.map(b => ({
      _id: b._id || b.id,
      name: b.name,
      description: b.description || '',
      address: b.address || '',
      isActive: b.isActive !== false
    }))
    return res.json({ success: true, branches })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const description = String(req.body?.description || '').trim()
    const address = String(req.body?.address || '').trim()
    if (!name) return res.status(400).json({ success: false, code: 'name_required', error: 'name_required', message: 'Name required' })
    const b = await createBranchService(req.user.tenantId, req.user.id, { name, description, address })
    res.json({ success: true, branch: b })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchCtrl.update)
router.delete('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchCtrl.remove)

router.put('/:id/toggle', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchCtrl.toggle)

export default router
