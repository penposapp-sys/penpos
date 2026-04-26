import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import { branchListGuard } from '../middlewares/branchListGuard.js'
import * as ctrl from '../controllers/kitchenController.js'

const router = Router()

router.get('/orders', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.list)
router.get('/bulk-items', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.bulkList)
router.post('/bulk-items/:rowKey/done', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.bulkDone)
router.put('/orders/:id/complete', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.complete)
router.put('/orders/:orderId/batches/:batchId/complete', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.batchComplete)
router.put('/orders/:id/items/group-cooking', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.itemGroupCooking)
router.put('/orders/:id/items/group-complete', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.itemGroupComplete)
router.put('/orders/:id/items/group-cancel', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.itemGroupCancel)
router.put('/orders/:id/items/:itemId/cooking', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.itemCooking)
router.put('/orders/:id/items/:itemId/complete', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.itemComplete)
router.put('/orders/:id/items/:itemId/cancel', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['kitchen_access']), ctrl.itemCancel)

export default router
