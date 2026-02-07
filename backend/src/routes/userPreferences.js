import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import * as ctrl from '../controllers/userPreferencesController.js'

const router = Router()

router.get('/kitchen-filters', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), ctrl.getKitchenFilters)
router.put('/kitchen-filters', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), ctrl.putKitchenFilters)

export default router

