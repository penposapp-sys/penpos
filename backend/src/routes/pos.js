import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requireAnyPermission, requirePermission } from '../middlewares/requirePermission.js'
import { branchGuard } from '../middlewares/branchGuard.js'
import { branchListGuard } from '../middlewares/branchListGuard.js'
import { resolveBranchFromTable, resolveBranchFromOrder } from '../middlewares/branchResolvers.js'
import { validateObjectIdParam } from '../middlewares/validateObjectIdParam.js'
import * as ctrl from '../controllers/posController.js'

const router = Router()

router.post('/orders', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.createOrder)
// Use resolver for GET /orders/:id to handle 409 flow correctly
router.get('/orders/:id', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['pos_access', 'closed_tables_detail_view']), ctrl.getOrder)
router.post('/orders/:id/items', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.addItem)
router.delete('/orders/:id/items/:menuItemId', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.removeItem)
router.put('/orders/:id/note', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.setNote)
router.put('/orders/:id/customer-name', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.setCustomerName)
router.put('/orders/:id/customer', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.setCustomerName)
router.put('/orders/:orderId/items/:itemId/note', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.setItemNoteByItemId)
router.put('/orders/:orderId/items/:itemId/cancel', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.cancelItem)
router.put('/orders/:orderId/items/:itemId/complete', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.completeItem)
router.put('/orders/:orderId/items/:itemId/quantity', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.setItemQuantityByItemId)
router.put('/orders/:orderId/items/:itemId/weight', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.setItemWeightByItemId)
router.put('/orders/:id/cancel', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.cancel)
router.put('/orders/:id/send', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.send)
router.put('/orders/:id/kitchen-mode', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.setKitchenMode)
router.put('/orders/:id/pay', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'take_payment']), ctrl.pay)
router.post('/orders/:id/payments', requireAuth, tenantGuard, validateObjectIdParam('id'), resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'take_payment']), ctrl.addPayment)
router.delete('/orders/:id/payments/:paymentId', requireAuth, tenantGuard, validateObjectIdParam('id'), resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'take_payment']), ctrl.deletePayment)
router.put('/orders/:id/discount', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'take_payment']), ctrl.setDiscount)
router.post('/orders/:id/veresiye', requireAuth, tenantGuard, validateObjectIdParam('id'), resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'create_veresiye']), ctrl.veresiye)
router.delete('/orders/:id/veresiye/:entryId', requireAuth, tenantGuard, validateObjectIdParam('id'), resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'create_veresiye']), ctrl.deleteVeresiye)
router.delete('/orders/:id/collections/:txId', requireAuth, tenantGuard, validateObjectIdParam('id'), resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'take_payment']), ctrl.deleteCollection)
router.put('/orders/:id/close', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.close)
router.put('/orders/:id/reopen', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['pos_access', 'closed_tables_reopen']), ctrl.reopen)
router.put('/orders/:id/split', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.split)
router.put('/orders/:id/transfer', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.transfer)
router.get('/orders/:id/receipt', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.receipt)
router.get('/tables/overview', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.tablesOverview)
router.post('/tables/:tableId/start', requireAuth, tenantGuard, resolveBranchFromTable, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.startForTable)
router.put('/tables/:tableId/close', requireAuth, tenantGuard, resolveBranchFromTable, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.closeTable)
router.put('/tables/:tableId/abandon', requireAuth, tenantGuard, resolveBranchFromTable, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.abandonTable)
router.get('/tables/:tableId/meta', requireAuth, tenantGuard, resolveBranchFromTable, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.getTableMeta)
router.get('/tables/:tableId/order', requireAuth, tenantGuard, resolveBranchFromTable, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.getTableOrder)
router.put('/tables/:targetTableId/merge', requireAuth, tenantGuard, resolveBranchFromTable, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['manage_tables']), ctrl.mergeTables)

router.post('/walkin/orders', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'walkin_access']), ctrl.createWalkInOrder)
router.get('/walkin/orders', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'walkin_access']), ctrl.listWalkInOrders)

router.post('/delivery/orders', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'manage_delivery']), ctrl.createDeliveryOrder)
router.get('/delivery/orders', requireAuth, tenantGuard, branchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'view_delivery']), ctrl.listDeliveryOrders)
router.put('/delivery/orders/:id/status', requireAuth, tenantGuard, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'manage_delivery']), ctrl.updateDeliveryStatus)
router.put('/delivery/orders/:id/customer', requireAuth, tenantGuard, resolveBranchFromOrder, branchGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access', 'manage_delivery']), ctrl.updateDeliveryCustomer)

export default router
