import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { sendError } from '../utils/errors.js'
import { createTenantService, listTenantsService, extendTrialService, endTrialService, editTenantService, softDeleteTenantService, createTenantAdminService } from '../services/superadminService.js'
import { updateTenantStatusService, hardDeleteTenantService } from '../services/platformAdminService.js'
import { getSuperadminWebsiteSettings, updateSuperadminWebsiteSettings } from '../controllers/websiteSettingsController.js'

const router = Router()

router.post('/tenants', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const { name, slug } = req.body || {}
    const tenant = await createTenantService({ name, slug }, req.user.id)
    res.json({ tenant })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants/:tenantId/admin', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const { tenantId } = req.params
    const { name, email, password } = req.body || {}
    const user = await createTenantAdminService(tenantId, { name, email, password })
    res.json({ user })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/tenants', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const tenants = await listTenantsService()
    res.json({ tenants })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const { tenantId } = req.params
    const { name } = req.body || {}
    const tenant = await editTenantService(tenantId, { name }, req.user.id)
    res.json({ tenant })
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/tenants/:tenantId', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const { tenantId } = req.params
    const result = await hardDeleteTenantService(tenantId, req.user.id)
    res.json({ success: true })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/status', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const { tenantId } = req.params
    const { isActive } = req.body || {}
    const result = await updateTenantStatusService(tenantId, !!isActive, req.user.id)
    res.json({ success: true, isActive: result.isActive })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/trial-extend', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const { tenantId } = req.params
    const { days } = req.body || {}
    const result = await extendTrialService(tenantId, days, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/trial-end', requireAuth, requireRole(['superadmin']), async (req, res) => {
  try {
    const { tenantId } = req.params
    const result = await endTrialService(tenantId, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/website-settings', requireAuth, requireRole(['superadmin']), getSuperadminWebsiteSettings)
router.put('/website-settings', requireAuth, requireRole(['superadmin']), updateSuperadminWebsiteSettings)

export default router
