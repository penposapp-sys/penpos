import { Router } from 'express'
import {
  createPublicCanteenQrOrder,
  createPublicOnlineStoreOrder,
  getPublicOnlineStoreCustomerProfile,
  requestPublicOnlineStoreOrderCancellation,
  createPublicWaiterCall,
  downloadPrintAgentSetup,
  getPrintAgentWindowsManifest,
  getPublicCanteenQr,
  getPublicMenu,
  getPublicOnlineStore,
  loginPublicOnlineStoreCustomer,
  getPublicQrCustomerProfile,
  registerPublicOnlineStoreCustomer,
  loginPublicQrCustomer,
  registerPublicQrCustomer,
  updatePublicOnlineStoreCustomerProfile,
  updatePublicQrCustomerProfile,
  updatePublicQrCustomerFavorites,
  upsertPublicOnlineStoreCustomer,
  upsertPublicQrCustomer
} from '../controllers/publicController.js'
import { registerPublicTenant } from '../controllers/publicRegisterController.js'
import { getPublicWebsiteSettings } from '../controllers/websiteSettingsController.js'
import { getPublicTenantWebsite, getPublicWebsiteByHost } from '../controllers/tenantWebsiteController.js'

const router = Router()

router.get('/menu', getPublicMenu)
router.post('/menu/waiter-call', createPublicWaiterCall)
router.get('/online-store', getPublicOnlineStore)
router.post('/online-store/orders', createPublicOnlineStoreOrder)
router.post('/online-store/orders/:orderId/cancel-request', requestPublicOnlineStoreOrderCancellation)
router.post('/online-store/customer/session', upsertPublicOnlineStoreCustomer)
router.post('/online-store/customer/register', registerPublicOnlineStoreCustomer)
router.post('/online-store/customer/login', loginPublicOnlineStoreCustomer)
router.get('/online-store/customer/profile', getPublicOnlineStoreCustomerProfile)
router.put('/online-store/customer/profile', updatePublicOnlineStoreCustomerProfile)
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
