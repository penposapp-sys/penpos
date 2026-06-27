import { Router } from 'express'
import { requireAuth } from '../../../middlewares/requireAuth.js'
import { tenantGuard } from '../../../middlewares/tenantGuard.js'
import { requireRole } from '../../../middlewares/requireRole.js'
import { requireAnyPermission, requirePermission } from '../../../middlewares/requirePermission.js'
import { PERMISSIONS } from '../../../constants/permissions.js'
import { tenantUserGuard } from '../middlewares/tenantUserGuard.js'
import { activeUserGuard } from '../middlewares/activeUserGuard.js'
import { tenantTypeGuard } from '../middlewares/tenantTypeGuard.js'
import { canteenBranchListGuard } from '../middlewares/canteenBranchListGuard.js'
import { canteenBranchParamGuard } from '../middlewares/canteenBranchParamGuard.js'
import { canteenBranchQueryGuard } from '../middlewares/canteenBranchQueryGuard.js'
import { canteenBranchHeaderGuard } from '../middlewares/canteenBranchHeaderGuard.js'
import * as branchesCtrl from '../controllers/canteenBranchesController.js'
import * as staffCtrl from '../controllers/canteenStaffController.js'
import * as settingsCtrl from '../controllers/canteenSettingsController.js'
import * as catalogCtrl from '../controllers/canteenCatalogController.js'
import * as sessionCtrl from '../controllers/canteenSessionController.js'
import * as salesCtrl from '../controllers/canteenSalesController.js'
import * as customersCtrl from '../controllers/canteenCustomersController.js'
import * as reportsCtrl from '../controllers/canteenReportsController.js'
import * as billingCtrl from '../controllers/canteenBillingController.js'
import * as stockCtrl from '../controllers/canteenStockController.js'
import * as meCtrl from '../controllers/canteenMeController.js'
import * as bulkProductsCtrl from '../controllers/canteenProductsBulkController.js'
import * as qrOrdersCtrl from '../controllers/canteenQrOrdersController.js'
import multer from 'multer'
import { error } from '../../../utils/errors.js'
import { requireActiveSubscription } from '../../../middlewares/requireActiveSubscription.js'
import { MAX_IMAGE_UPLOAD_BYTES } from '../../../utils/imageUpload.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES }
})

const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return next(error('file_too_large', 'Gorsel boyutu en fazla 5 MB olabilir.', 400))
    return next(error('invalid_upload', 'Dosya yükleme hatası', 400))
  })
}

router.use(requireAuth, tenantUserGuard, activeUserGuard, tenantGuard, tenantTypeGuard('kantin'))

router.get('/session', requireRole(['tenant_admin', 'staff']), sessionCtrl.getSession)
router.put('/session/branch', requireRole(['tenant_admin', 'staff']), sessionCtrl.setBranch)

router.get('/me', requireRole(['tenant_admin', 'staff']), meCtrl.getMe)
router.put('/me/email', requireRole(['tenant_admin', 'staff']), meCtrl.updateEmail)
router.put('/me/password', requireRole(['tenant_admin', 'staff']), meCtrl.updatePassword)
router.put('/me/username', requireRole(['tenant_admin', 'staff']), meCtrl.updateUsername)

router.get('/branches', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchesCtrl.list)
router.post('/branches', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchesCtrl.create)
router.put('/branches/:id', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchesCtrl.update)
router.put('/branches/:id/status', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), branchesCtrl.updateStatus)

router.get('/branches/:id/staff', requireRole(['tenant_admin']), requirePermission([PERMISSIONS.CANTEEN_STAFF_MANAGE]), branchesCtrl.getBranchStaff)
router.put('/branches/:id/staff', requireRole(['tenant_admin']), requirePermission([PERMISSIONS.CANTEEN_STAFF_MANAGE]), branchesCtrl.setBranchStaff)

router.get('/staff', requireRole(['tenant_admin']), requirePermission([PERMISSIONS.CANTEEN_STAFF_MANAGE]), staffCtrl.list)
router.post('/staff', requireRole(['tenant_admin']), requirePermission([PERMISSIONS.CANTEEN_STAFF_MANAGE]), staffCtrl.create)
router.put('/staff/:id', requireRole(['tenant_admin']), requirePermission([PERMISSIONS.CANTEEN_STAFF_MANAGE]), staffCtrl.update)
router.delete('/staff/:id', requireRole(['tenant_admin']), requirePermission([PERMISSIONS.CANTEEN_STAFF_MANAGE]), staffCtrl.remove)

router.get('/settings', requireRole(['tenant_admin', 'staff']), settingsCtrl.getSettings)
router.put('/settings', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), settingsCtrl.updateSettings)
router.put('/settings/qr', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), settingsCtrl.updateQrSettings)

router.get('/payment-settings', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), settingsCtrl.getPaymentSettings)
router.put('/payment-settings', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), settingsCtrl.updatePaymentSettings)

router.get('/products/template', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), bulkProductsCtrl.downloadTemplate)
router.get('/products/export', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), bulkProductsCtrl.exportProducts)
router.post('/products/import', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), uploadSingleFile, bulkProductsCtrl.importProducts)

router.get('/billing/requests', requireRole(['tenant_admin']), requireAnyPermission([PERMISSIONS.CANTEEN_BILLING_VIEW, PERMISSIONS.MANAGE_SETTINGS]), billingCtrl.listRequests)
router.get('/billing/plans', requireRole(['tenant_admin']), requireAnyPermission([PERMISSIONS.CANTEEN_BILLING_VIEW, PERMISSIONS.MANAGE_SETTINGS]), billingCtrl.listPlans)
router.post('/billing/requests', requireRole(['tenant_admin']), requireAnyPermission([PERMISSIONS.CANTEEN_BILLING_MANAGE, PERMISSIONS.MANAGE_SETTINGS]), billingCtrl.createRequest)
router.post('/billing/requests/:id/cancel', requireRole(['tenant_admin']), requireAnyPermission([PERMISSIONS.CANTEEN_BILLING_MANAGE, PERMISSIONS.MANAGE_SETTINGS]), billingCtrl.cancelRequest)

router.use(requireActiveSubscription)

// Catalog - Branch dependent
router.get('/catalog/categories', canteenBranchHeaderGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.MANAGE_MENU, PERMISSIONS.CANTEEN_POS_ACCESS]), catalogCtrl.listCategories)
router.post('/catalog/categories', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.createCategory)
router.put('/catalog/categories/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.updateCategory)
router.post('/catalog/categories/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), uploadSingleFile, catalogCtrl.uploadCategoryImage)
router.delete('/catalog/categories/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeCategoryImage)
router.delete('/catalog/categories/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeCategory)
router.get('/catalog/products', canteenBranchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.MANAGE_MENU, PERMISSIONS.CANTEEN_POS_ACCESS]), catalogCtrl.listProducts)
// Alias: products list should be accessible from POS / product view / settings
router.post('/catalog/products', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.createProduct)
router.put('/catalog/products/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.updateProduct)
router.post('/catalog/products/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), uploadSingleFile, catalogCtrl.uploadProductImage)
router.delete('/catalog/products/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeProductImage)
router.delete('/catalog/products/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeProduct)

// Products (alias) - Branch dependent
router.get(
  '/categories',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([
    PERMISSIONS.CANTEEN_POS_ACCESS,
    PERMISSIONS.CANTEEN_PRODUCTS_VIEW,
    PERMISSIONS.MANAGE_MENU,
    PERMISSIONS.MANAGE_SETTINGS
  ]),
  catalogCtrl.listCategories
)
router.post('/categories', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.createCategory)
router.put('/categories/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.updateCategory)
router.post('/categories/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), uploadSingleFile, catalogCtrl.uploadCategoryImage)
router.delete('/categories/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeCategoryImage)
router.delete('/categories/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeCategory)

router.get(
  '/products',
  canteenBranchListGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([
    PERMISSIONS.CANTEEN_POS_ACCESS,
    PERMISSIONS.CANTEEN_PRODUCTS_VIEW,
    PERMISSIONS.MANAGE_MENU,
    PERMISSIONS.MANAGE_SETTINGS
  ]),
  catalogCtrl.listProducts
)

router.get(
  '/products/by-barcode/:barcode',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([
    PERMISSIONS.CANTEEN_POS_ACCESS,
    PERMISSIONS.CANTEEN_PRODUCTS_VIEW,
    PERMISSIONS.MANAGE_MENU,
    PERMISSIONS.MANAGE_SETTINGS
  ]),
  catalogCtrl.getProductByBarcode
)

router.get(
  '/products/search',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([
    PERMISSIONS.CANTEEN_POS_ACCESS,
    PERMISSIONS.CANTEEN_PRODUCTS_VIEW,
    PERMISSIONS.MANAGE_MENU,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.CANTEEN_STOCK_MANAGE,
    PERMISSIONS.CANTEEN_STOCK_COUNT,
  ]),
  catalogCtrl.searchProducts
)
router.post('/products', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.createProduct)
router.put('/products/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.updateProduct)
router.post('/products/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), uploadSingleFile, catalogCtrl.uploadProductImage)
router.delete('/products/:id/image', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeProductImage)
router.delete('/products/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), catalogCtrl.removeProduct)

router.post('/sales', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_POS_ACCESS]), salesCtrl.create)
router.get('/sales/completed', canteenBranchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.CANTEEN_SALES_VIEW, PERMISSIONS.CANTEEN_REPORTS_VIEW]), salesCtrl.listCompleted)
router.post('/sales/:id/reopen', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.CANTEEN_SALES_VIEW, PERMISSIONS.CANTEEN_REPORTS_VIEW]), salesCtrl.reopen)
router.get('/sales/:id', canteenBranchQueryGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.CANTEEN_CUSTOMERS_VIEW, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE, PERMISSIONS.CANTEEN_POS_ACCESS, PERMISSIONS.CANTEEN_SALES_VIEW, PERMISSIONS.CANTEEN_REPORTS_VIEW]), salesCtrl.get)
router.delete('/sales/:id', canteenBranchQueryGuard, requireRole(['tenant_admin']), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), salesCtrl.remove)

router.get('/customers', requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.CANTEEN_CUSTOMERS_VIEW, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE, PERMISSIONS.CANTEEN_POS_ACCESS]), customersCtrl.list)
router.post('/customers', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_CUSTOMERS_CREATE]), customersCtrl.create)
router.get('/customers/:id', requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.CANTEEN_CUSTOMERS_VIEW, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE, PERMISSIONS.CANTEEN_POS_ACCESS]), customersCtrl.get)
router.get('/customers/:id/movements', requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.CANTEEN_CUSTOMERS_VIEW, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE, PERMISSIONS.CANTEEN_POS_ACCESS]), customersCtrl.movements)
router.put('/customers/:id', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_CUSTOMERS_EDIT]), customersCtrl.update)
router.delete('/customers/:id', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]), customersCtrl.remove)
router.get(
  '/customers/:id/sales',
  canteenBranchListGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_CUSTOMERS_VIEW, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE, PERMISSIONS.CANTEEN_POS_ACCESS]),
  customersCtrl.sales
)
router.post('/customers/:id/collect', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]), customersCtrl.collect)
router.delete('/customers/:customerId/payments/:paymentId', requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_CUSTOMER_PAYMENT_DELETE]), customersCtrl.deletePayment)

router.get('/reports/summary', canteenBranchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_REPORTS_VIEW]), reportsCtrl.summary)
router.get('/reports/products', canteenBranchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_REPORTS_VIEW]), reportsCtrl.products)
router.get('/reports/customers', canteenBranchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_REPORTS_VIEW]), reportsCtrl.customers)
router.get('/reports/z-report', canteenBranchListGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.CANTEEN_REPORTS_VIEW]), reportsCtrl.zReport)
router.get('/reports/export', canteenBranchListGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission([PERMISSIONS.CANTEEN_REPORTS_EXPORT, PERMISSIONS.CANTEEN_REPORTS_VIEW]), reportsCtrl.exportAll)

router.get(
  '/qr-orders',
  canteenBranchListGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_POS_ACCESS, PERMISSIONS.CANTEEN_CUSTOMERS_VIEW, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]),
  qrOrdersCtrl.list
)
router.patch(
  '/qr-orders/:id/status',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_POS_ACCESS, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]),
  qrOrdersCtrl.updateStatus
)
router.patch(
  '/qr-orders/:id/payment',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_POS_ACCESS, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]),
  qrOrdersCtrl.updatePayment
)
router.post(
  '/qr-orders/:id/transfer-to-cari',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_POS_ACCESS, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]),
  qrOrdersCtrl.transferToCari
)
router.delete(
  '/qr-orders/:id',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_POS_ACCESS, PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]),
  qrOrdersCtrl.remove
)

router.post(
  '/stock/movements',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_MANAGE, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.createMovement
)
router.get(
  '/stock/movements',
  canteenBranchQueryGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_MANAGE, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.listMovements
)

router.post(
  '/stock-counts',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_COUNT, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.startCount
)
router.get(
  '/stock-counts',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requirePermission([PERMISSIONS.CANTEEN_STOCK_COUNT_VIEW]),
  stockCtrl.listCounts
)
router.post(
  '/stock-counts/:sessionId/scan',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_COUNT, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.scanCount
)
router.get(
  '/stock-counts/:sessionId/summary',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_COUNT, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.summaryCount
)
router.get(
  '/stock-counts/:id',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requirePermission([PERMISSIONS.CANTEEN_STOCK_COUNT_VIEW]),
  stockCtrl.getCountDetail
)
router.post(
  '/stock-counts/:sessionId/finish',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_COUNT, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.finishCount
)
router.put(
  '/stock-counts/:sessionId/items/:itemId',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_COUNT, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.updateCountItem
)
router.post(
  '/stock-counts/:sessionId/apply',
  canteenBranchHeaderGuard,
  requireRole(['tenant_admin', 'staff']),
  requireAnyPermission([PERMISSIONS.CANTEEN_STOCK_COUNT, PERMISSIONS.MANAGE_SETTINGS]),
  stockCtrl.applyCount
)

export default router
