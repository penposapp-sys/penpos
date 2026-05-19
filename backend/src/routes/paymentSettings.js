import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import * as ctrl from '../controllers/paymentSettingsController.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), ctrl.getSettings)
router.put('/', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin']), ctrl.updateSettings)
router.post('/', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin']), ctrl.createPaymentMethod)
router.patch('/:id', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin']), ctrl.patchPaymentMethod)
router.delete('/:id', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin']), ctrl.deletePaymentMethod)

export default router
