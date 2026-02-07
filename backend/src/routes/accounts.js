import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import { branchListGuard } from '../middlewares/branchListGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import * as ctrl from '../controllers/accountsController.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['view_accounts']), ctrl.listAccounts)
router.post('/', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_accounts']), ctrl.createAccount)
router.get('/:id', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['view_accounts']), ctrl.getAccount)
router.put('/:id', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_accounts']), ctrl.updateAccount)
router.delete('/:id', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_accounts']), ctrl.deleteAccount)
router.get('/:id/transactions', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['view_accounts']), ctrl.listTransactions)
router.get('/transactions/:id/order', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['view_accounts']), ctrl.getTransactionOrder)
router.post('/:id/collect', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['view_accounts', 'collect_debt']), ctrl.collect)
router.delete('/transactions/:id', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['cari_tahsilat_sil']), ctrl.deleteTransaction)

export default router
