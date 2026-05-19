import { Router } from 'express'
import {
  createPublicCanteenQrOrder,
  downloadPrintAgentSetup,
  getPrintAgentWindowsManifest,
  getPublicCanteenQr,
  getPublicMenu,
  getPublicQrCustomerProfile,
  loginPublicQrCustomer,
  registerPublicQrCustomer,
  updatePublicQrCustomerProfile,
  updatePublicQrCustomerFavorites,
  upsertPublicQrCustomer
} from '../controllers/publicController.js'
import { registerPublicTenant } from '../controllers/publicRegisterController.js'
import { getPublicWebsiteSettings } from '../controllers/websiteSettingsController.js'
import { getPublicTenantWebsite, getPublicWebsiteByHost } from '../controllers/tenantWebsiteController.js'

const router = Router()

router.get('/menu', getPublicMenu)
router.get('/qr', getPublicCanteenQr)
router.post('/qr-orders', createPublicCanteenQrOrder)
router.post('/qr-customer/session', upsertPublicQrCustomer)
router.post('/qr-customer/register', registerPublicQrCustomer)
router.post('/qr-customer/login', loginPublicQrCustomer)
router.get('/qr-customer/profile', getPublicQrCustomerProfile)
router.put('/qr-customer/profile', updatePublicQrCustomerProfile)
router.put('/qr-customer/favorites', updatePublicQrCustomerFavorites)
router.get('/website-settings', getPublicWebsiteSettings)
router.get('/sites/:slug', getPublicTenantWebsite)
router.get('/site-by-host', getPublicWebsiteByHost)
router.post('/register', registerPublicTenant)
router.get('/downloads/print-agent/windows/manifest', getPrintAgentWindowsManifest)
router.get('/downloads/print-agent/windows', downloadPrintAgentSetup)

export default router
