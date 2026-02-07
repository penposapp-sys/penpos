import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { PERMISSIONS } from '../constants/permissions.js'
import * as ctrl from '../controllers/branchController.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), ctrl.list)
router.post('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), ctrl.create)
router.put('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), ctrl.update)
router.delete('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), ctrl.remove)

export default router
