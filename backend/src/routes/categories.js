import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { PERMISSIONS } from '../constants/permissions.js'
import * as ctrl from '../controllers/categoryController.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.list)
router.post('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.create)
router.put('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.update)
router.delete('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.remove)

export default router
