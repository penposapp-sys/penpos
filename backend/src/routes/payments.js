import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { sendError } from '../utils/errors.js'
import { fakePaymentAndActivatePlan, createPaymentRequestService } from '../services/paymentService.js'

const router = Router()

router.post('/fake', requireAuth, tenantGuard, requireRole(['tenant_admin']), async (req, res) => {
  try {
    const { planId } = req.body || {}
    const result = await fakePaymentAndActivatePlan({ tenantId: req.user.tenantId, planId, actorUserId: req.user.id })
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/request', requireAuth, tenantGuard, requireRole(['tenant_admin']), async (req, res) => {
  try {
    const { planId } = req.body || {}
    const result = await createPaymentRequestService(req.user.tenantId, req.user.id, planId)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

export default router
