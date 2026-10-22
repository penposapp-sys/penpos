import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import * as ctrl from '../controllers/tablesController.js'
import { PERMISSIONS } from '../constants/permissions.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_TABLES, PERMISSIONS.RESERVATIONS_VIEW, PERMISSIONS.RESERVATIONS_CREATE, PERMISSIONS.RESERVATIONS_APPROVE], { mode: 'any' }), ctrl.list)
router.post('/', requireAuth, tenantGuard, requireRole(['tenant_admin']), ctrl.create)
router.put('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin']), ctrl.update)
router.delete('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin']), ctrl.remove)

export default router
