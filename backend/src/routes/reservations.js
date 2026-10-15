import { Router } from 'express'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import { branchListGuard } from '../middlewares/branchListGuard.js'
import { validateObjectIdParam } from '../middlewares/validateObjectIdParam.js'
import { reservationBranchScope } from '../middlewares/reservationBranchScope.js'
import * as ctrl from '../controllers/reservationController.js'

const router = Router()
const secured = [requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables'])]

router.get('/pending-count', ...secured, branchListGuard, reservationBranchScope, ctrl.pendingCount)
router.get('/notifications', ...secured, branchListGuard, reservationBranchScope, ctrl.notifications)
router.put('/notifications/read', ...secured, branchListGuard, reservationBranchScope, ctrl.readNotifications)
router.put('/notifications/:id/read', ...secured, branchListGuard, reservationBranchScope, ctrl.readNotifications)
router.get('/availability', ...secured, branchGuard, reservationBranchScope, ctrl.branchAvailability)
router.get('/settings', ...secured, requireRole(['tenant_admin']), branchGuard, ctrl.settings)
router.put('/settings', ...secured, requireRole(['tenant_admin']), branchGuard, ctrl.settings)
router.get('/', ...secured, branchListGuard, reservationBranchScope, ctrl.list)
router.post('/', ...secured, branchGuard, reservationBranchScope, ctrl.create)
router.put('/:id', ...secured, validateObjectIdParam('id'), branchListGuard, reservationBranchScope, ctrl.update)
router.patch('/:id/status', ...secured, validateObjectIdParam('id'), branchListGuard, reservationBranchScope, ctrl.setStatus)
router.post('/:id/arrive', ...secured, validateObjectIdParam('id'), branchListGuard, reservationBranchScope, ctrl.arrive)

export default router
