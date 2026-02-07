import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { listBranches, createBranchService } from '../services/branchService.js'
import { sendError } from '../utils/errors.js'
import * as branchCtrl from '../controllers/branchesController.js'
import { PERMISSIONS } from '../constants/permissions.js'

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
        isActive: b.isActive !== false
      }))
      return res.json({ success: true, branches })
    }

    const allowed = Array.isArray(req.user?.branchIds) && req.user.branchIds.length > 0
      ? req.user.branchIds.map(String)
      : (req.user?.branchId ? [String(req.user.branchId)] : [])

    const items = await listBranches(req.user.tenantId, { includeInactive: false })
    const filtered = (items || []).filter(b => allowed.includes(String(b.id)))
    const branches = filtered.map(b => ({ _id: b._id || b.id, name: b.name }))
    return res.json({ success: true, branches })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const description = String(req.body?.description || '').trim()
    if (!name) return res.status(400).json({ success: false, code: 'name_required', error: 'name_required', message: 'Name required' })
    const b = await createBranchService(req.user.tenantId, req.user.id, { name, description })
    res.json({ success: true, branch: b })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchCtrl.update)

router.put('/:id/toggle', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchCtrl.toggle)

router.put('/:id/staff', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchCtrl.setStaff)

export default router
