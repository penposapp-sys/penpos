import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { sendError } from '../utils/errors.js'
import { error } from '../utils/errors.js'
import * as selfAccount from '../services/selfAccountService.js'
import { createTenantWithOwnerService, listPlatformTenantsService, updateTenantStatusService, createPlanService, listPlansService, listPlansForTenantService, updatePlanService, deletePlanService, assignTenantPlanService, trialExtendService, trialEndService, editTenantService, softDeleteTenantService, hardDeleteTenantService, setPlatformUserPasswordService } from '../services/platformAdminService.js'
import { listPaymentRequestsService, approvePaymentRequestService, rejectPaymentRequestService } from '../services/paymentService.js'
import { listMembershipRequestsService, approveMembershipRequestService, rejectMembershipRequestService } from '../services/platformBillingService.js'

const router = Router()

router.get('/me', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const user = await selfAccount.getMe(req.user.id)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/email', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { email, currentPassword } = req.body || {}
    const user = await selfAccount.updateEmail(req.user.id, email, currentPassword)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/password', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    const result = await selfAccount.updatePassword(req.user.id, currentPassword, newPassword)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/username', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { username, currentPassword } = req.body || {}
    const user = await selfAccount.updateUsername(req.user.id, username, currentPassword)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants/kermes', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await createTenantWithOwnerService({ ...(req.body || {}), systemType: 'kermes' })
    res.json({ success: true, id: result.tenant?._id || null })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants/canteen', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const incoming = req.body || {}
    if (incoming.systemType !== undefined && !['kantin', 'canteen'].includes(String(incoming.systemType))) {
      throw error('invalid_request', 'Invalid system type', 400)
    }
    const result = await createTenantWithOwnerService({ ...incoming, systemType: 'canteen' })
    res.json({ success: true, id: result.tenant?._id || null })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await createTenantWithOwnerService(req.body || {})
    res.json({ success: true, id: result.tenant?._id || null })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/tenants', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const list = await listPlatformTenantsService(req.query?.system)
    res.json(list)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:id/status', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { isActive } = req.body || {}
    const result = await updateTenantStatusService(req.params.id, !!isActive, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { name, email } = req.body || {}
    const tenant = await editTenantService(req.params.tenantId, { name, email }, req.user.id)
    res.json({ success: true, tenant })
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/tenants/:tenantId', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await hardDeleteTenantService(req.params.tenantId, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/plans', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const plan = await createPlanService(req.body || {}, req.user.id)
    res.json({ success: true, id: plan._id })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/plans', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = String(req.query?.tenantId || '').trim()
    const items = tenantId
      ? await listPlansForTenantService(tenantId, req.query?.systemType)
      : await listPlansService(req.query?.systemType)
    res.json({ success: true, items, plans: items })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/plans/:id', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const plan = await updatePlanService(req.params.id, req.body || {}, req.user.id)
    res.json({ plan })
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/plans/:id', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await deletePlanService(req.params.id, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/plan', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await assignTenantPlanService(req.params.tenantId, req.body || {}, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/trial-extend', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const days = Number(req.body?.days || 0)
    const result = await trialExtendService(req.params.tenantId, days, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/trial-end', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await trialEndService(req.params.tenantId, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/payments', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await listPaymentRequestsService()
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/payments/:id/approve', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await approvePaymentRequestService(req.params.id, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/payments/:id/reject', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await rejectPaymentRequestService(req.params.id, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/billing/requests', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await listMembershipRequestsService({ status: req.query?.status, systemType: req.query?.systemType })
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/billing/requests/:id/approve', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await approveMembershipRequestService(req.params.id, req.user.id, req.body?.decisionNote)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/billing/requests/:id/reject', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await rejectMembershipRequestService(req.params.id, req.user.id, req.body?.decisionNote)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/users/:id/password', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const password = req.body?.password
    const result = await setPlatformUserPasswordService(req.params.id, password, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

export default router
