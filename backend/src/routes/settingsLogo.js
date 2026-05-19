import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { PERMISSIONS } from '../constants/permissions.js'
import { error } from '../utils/errors.js'
import * as ctrl from '../controllers/settingsLogoController.js'
import * as businessCtrl from '../controllers/businessSettingsController.js'
import * as paymentSettingsCtrl from '../controllers/paymentSettingsController.js'
import * as printersCtrl from '../controllers/settingsPrintersController.js'
import * as deliveryCustomersCtrl from '../controllers/deliveryCustomersController.js'

const router = Router()

router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SETTINGS_LOGO_ROUTE_HIT]', req.method, req.originalUrl)
  }
  next()
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
})

const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return next(error('file_too_large', 'Dosya çok büyük (max 2MB)', 400))
    return next(error('invalid_upload', 'Dosya yükleme hatası', 400))
  })
}

const authChain = [requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS])]

router.post('/logo', ...authChain, uploadSingleFile, ctrl.uploadLogo)
router.delete('/logo', ...authChain, ctrl.removeLogo)
router.get('/business', ...authChain, businessCtrl.getSettings)
router.put('/business', ...authChain, businessCtrl.updateSettings)
router.get('/business/branches', ...authChain, businessCtrl.getBranches)
router.post('/business/logo', ...authChain, uploadSingleFile, ctrl.uploadLogo)
router.delete('/business/logo', ...authChain, ctrl.removeLogo)
router.get('/payment-methods', ...authChain, paymentSettingsCtrl.getSettings)
router.put('/payment-methods', ...authChain, paymentSettingsCtrl.updateSettings)
router.post('/payment-methods', ...authChain, paymentSettingsCtrl.createPaymentMethod)
router.patch('/payment-methods/:id', ...authChain, paymentSettingsCtrl.patchPaymentMethod)
router.delete('/payment-methods/:id', ...authChain, paymentSettingsCtrl.deletePaymentMethod)

router.get('/printers', ...authChain, printersCtrl.getPrintersSettings)
router.get('/delivery-customers', ...authChain, deliveryCustomersCtrl.listDeliveryCustomers)
router.get('/delivery-customers/:id', ...authChain, deliveryCustomersCtrl.getDeliveryCustomerDetail)

export default router
