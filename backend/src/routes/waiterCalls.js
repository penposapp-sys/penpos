import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import * as ctrl from '../controllers/waiterCallsController.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.list)
router.put('/table/:tableId/resolve', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.resolveByTable)
router.put('/:id/resolve', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.resolve)

export default router
