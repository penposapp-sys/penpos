import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { sendError } from '../utils/errors.js'
import { listStaff, createStaffService, updateStaff, resetStaffPassword, deleteOrDisableStaff } from '../services/staffService.js'
import { PERMISSIONS } from '../constants/permissions.js'

const router = Router()

// Tüm elevated roller (tenant_admin, anaokulu_region_admin, superadmin, platform_admin) + staff
// Elevated roller requirePermission tarafından zaten bypass ediliyor, sadece rol kontrolü yeterli
const TENANT_ELEVATED_ROLES = ['tenant_admin', 'staff', 'anaokulu_region_admin', 'superadmin', 'platform_admin']

router.get('/', requireAuth, tenantGuard, requireRole(TENANT_ELEVATED_ROLES), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), async (req, res) => {
  try {
    const items = await listStaff(req.user.tenantId)
    res.json({ staff: items })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/', requireAuth, tenantGuard, requireRole(TENANT_ELEVATED_ROLES), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), async (req, res) => {
  try {
    const created = await createStaffService(req.user.tenantId, { ...(req.body || {}), actorUserId: req.user.id })
    res.json({ staff: created })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/:id', requireAuth, tenantGuard, requireRole(TENANT_ELEVATED_ROLES), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), async (req, res) => {
  try {
    const updated = await updateStaff(req.user.tenantId, req.params.id, { ...(req.body || {}), actorUserId: req.user.id })
    res.json({ staff: updated })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/:id/password', requireAuth, tenantGuard, requireRole(TENANT_ELEVATED_ROLES), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), async (req, res) => {
  try {
    const result = await resetStaffPassword(req.user.tenantId, req.params.id, req.body?.password)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/:id', requireAuth, tenantGuard, requireRole(TENANT_ELEVATED_ROLES), requirePermission([PERMISSIONS.MANAGE_SETTINGS]), async (req, res) => {
  try {
    const result = await deleteOrDisableStaff(req.user.tenantId, req.params.id, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

export default router
