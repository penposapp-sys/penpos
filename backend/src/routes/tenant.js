import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { sendError } from '../utils/errors.js'
import { getContext, getProfile, updateProfile, updateSettings } from '../services/tenantService.js'
import { listActivePlans } from '../services/planService.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requireAnyPermission } from '../middlewares/requirePermission.js'
import * as selfAccount from '../services/selfAccountService.js'
import * as tenantBilling from '../controllers/tenantBillingController.js'
import {
  getTenantWebsiteSettings,
  updateTenantWebsiteSettings,
  publishTenantWebsite,
  unpublishTenantWebsite
} from '../controllers/tenantWebsiteController.js'
import { uploadWebsiteMedia } from '../controllers/websiteMediaController.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import User from '../models/User.js'
import { error } from '../utils/errors.js'
import { MAX_IMAGE_UPLOAD_BYTES } from '../utils/imageUpload.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES }
})

const uploadSingleImage = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return next(error('file_too_large', 'Gorsel boyutu en fazla 5 MB olabilir.', 400))
    return next(error('invalid_upload', 'Gorsel yukleme hatasi.', 400))
  })
}

router.get('/context', requireAuth, tenantGuard, async (req, res) => {
  try {
    const ctx = await getContext(req.user)
    res.json(ctx)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/profile', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), async (req, res) => {
  try {
    const profile = await getProfile(req.user.tenantId)
    res.json({ tenant: profile })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/profile', requireAuth, tenantGuard, requireRole(['tenant_admin']), async (req, res) => {
  try {
    const updated = await updateProfile(req.user.tenantId, { ...(req.body || {}), actorUserId: req.user.id })
    res.json({ tenant: updated })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/settings', requireAuth, tenantGuard, requireRole(['tenant_admin']), async (req, res) => {
  try {
    const updated = await updateSettings(req.user.tenantId, { ...(req.body || {}), actorUserId: req.user.id })
    res.json({ tenant: updated })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/plans', requireAuth, tenantGuard, requireRole(['tenant_admin']), async (req, res) => {
  try {
    const tenant = await (await import('../repositories/tenantRepository.js')).findTenantById(req.user.tenantId)
    const plans = await listActivePlans(tenant?.vertical || tenant?.businessType || tenant?.systemType || 'kermes')
    res.json({ plans })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/billing/requests', requireAuth, tenantGuard, requireRole(['tenant_admin']), tenantBilling.listRequests)
router.get('/billing/plans', requireAuth, tenantGuard, requireRole(['tenant_admin']), tenantBilling.listPlans)
router.post('/billing/requests', requireAuth, tenantGuard, requireRole(['tenant_admin']), tenantBilling.createRequest)
router.post('/billing/requests/:id/cancel', requireAuth, tenantGuard, requireRole(['tenant_admin']), tenantBilling.cancelRequest)

router.get('/setup-status', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['pos_access', 'manage_settings']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const hasCategory = (await Category.exists({ tenantId })) ? true : false
    const hasItem = (await MenuItem.exists({ tenantId })) ? true : false
    const hasStaff = (await User.exists({ tenantId, role: 'staff' })) ? true : false
    res.json({ hasCategory, hasItem, hasStaff })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/me', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), async (req, res) => {
  try {
    const user = await selfAccount.getMe(req.user.id)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/email', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), async (req, res) => {
  try {
    const { email, currentPassword } = req.body || {}
    const user = await selfAccount.updateEmail(req.user.id, email, currentPassword)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/password', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    const result = await selfAccount.updatePassword(req.user.id, currentPassword, newPassword)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/username', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), async (req, res) => {
  try {
    const { username, currentPassword } = req.body || {}
    const user = await selfAccount.updateUsername(req.user.id, username, currentPassword)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/website', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['manage_settings', 'manage_menu']), getTenantWebsiteSettings)
router.put('/website', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['manage_settings', 'manage_menu']), updateTenantWebsiteSettings)
router.post('/website/media/:kind(logo|cover|gallery|about)', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['manage_settings', 'manage_menu']), uploadSingleImage, uploadWebsiteMedia)
router.post('/website/publish', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['manage_settings', 'manage_menu']), publishTenantWebsite)
router.post('/website/unpublish', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requireAnyPermission(['manage_settings', 'manage_menu']), unpublishTenantWebsite)

export default router
