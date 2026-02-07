import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import * as ctrl from '../controllers/settingsMenuController.js'

const router = Router()

router.get(
  '/active-items',
  requireAuth,
  tenantGuard,
  requireRole(['tenant_admin', 'staff']),
  requirePermission(['kitchen_access']),
  ctrl.getActiveMenuItems
)

export default router

