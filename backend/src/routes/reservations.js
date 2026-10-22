import { Router } from 'express'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import { branchListGuard } from '../middlewares/branchListGuard.js'
import { validateObjectIdParam } from '../middlewares/validateObjectIdParam.js'
import { reservationBranchScope } from '../middlewares/reservationBranchScope.js'
import * as ctrl from '../controllers/reservationController.js'
import { PERMISSIONS } from '../constants/permissions.js'

const router = Router()
const secured = [requireRole(['tenant_admin', 'staff'])]
const requireReservationPermission = (permission) => requirePermission([permission, PERMISSIONS.MANAGE_TABLES], { mode: 'any' })

router.get('/pending-count', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_VIEW), branchListGuard, reservationBranchScope, ctrl.pendingCount)
router.get('/notifications', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_VIEW), branchListGuard, reservationBranchScope, ctrl.notifications)
router.put('/notifications/read', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_VIEW), branchListGuard, reservationBranchScope, ctrl.readNotifications)
router.put('/notifications/:id/read', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_VIEW), branchListGuard, reservationBranchScope, ctrl.readNotifications)
router.get('/availability', ...secured, requirePermission([PERMISSIONS.RESERVATIONS_CREATE, PERMISSIONS.RESERVATIONS_APPROVE, PERMISSIONS.MANAGE_TABLES], { mode: 'any' }), branchGuard, reservationBranchScope, ctrl.branchAvailability)
router.get('/settings', ...secured, requireRole(['tenant_admin']), branchGuard, ctrl.settings)
router.put('/settings', ...secured, requireRole(['tenant_admin']), branchGuard, ctrl.settings)
router.get('/', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_VIEW), branchListGuard, reservationBranchScope, ctrl.list)
router.post('/', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_CREATE), branchGuard, reservationBranchScope, ctrl.create)
router.put('/:id', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_APPROVE), validateObjectIdParam('id'), branchListGuard, reservationBranchScope, ctrl.update)
router.patch('/:id/status', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_APPROVE), validateObjectIdParam('id'), branchListGuard, reservationBranchScope, ctrl.setStatus)
router.post('/:id/arrive', ...secured, requireReservationPermission(PERMISSIONS.RESERVATIONS_APPROVE), validateObjectIdParam('id'), branchListGuard, reservationBranchScope, ctrl.arrive)

export default router
