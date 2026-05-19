import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requireAnyPermission } from '../middlewares/requirePermission.js'
import * as ctrl from '../controllers/reportsController.js'
import { branchListGuard } from '../middlewares/branchListGuard.js'

const router = Router()

router.get('/summary', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['closed_tables_view']), ctrl.summary)
router.get('/dashboard', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['reports_dashboard_view']), ctrl.dashboard)
router.get('/products', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['reports_dashboard_view']), ctrl.products)
router.get('/orders', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['closed_tables_view']), ctrl.orders)
router.get('/export', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['reports_dashboard_view']), ctrl.exportXlsx)
router.get('/z-report', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['reports_dashboard_view']), ctrl.zReport)

export default router
