import { Router } from 'express'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import { branchListGuard } from '../middlewares/branchListGuard.js'
import { validateObjectIdParam } from '../middlewares/validateObjectIdParam.js'
import * as ctrl from '../controllers/reservationController.js'

const router = Router()
const secured = [requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables'])]

router.get('/pending-count', ...secured, branchListGuard, ctrl.pendingCount)
router.get('/notifications', ...secured, branchListGuard, ctrl.notifications)
router.put('/notifications/read', ...secured, branchListGuard, ctrl.readNotifications)
router.put('/notifications/:id/read', ...secured, branchListGuard, ctrl.readNotifications)
router.get('/availability', ...secured, branchGuard, ctrl.branchAvailability)
router.get('/settings', ...secured, branchGuard, ctrl.settings)
router.put('/settings', ...secured, branchGuard, ctrl.settings)
router.get('/', ...secured, branchListGuard, ctrl.list)
router.post('/', ...secured, branchGuard, ctrl.create)
router.put('/:id', ...secured, validateObjectIdParam('id'), branchListGuard, ctrl.update)
router.patch('/:id/status', ...secured, validateObjectIdParam('id'), branchListGuard, ctrl.setStatus)
router.post('/:id/arrive', ...secured, validateObjectIdParam('id'), branchListGuard, ctrl.arrive)

export default router
