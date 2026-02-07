import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { sendError } from '../utils/errors.js'
import { list, log } from '../services/auditService.js'

const router = Router()

router.get('/', requireAuth, tenantGuard, requireRole(['tenant_admin']), async (req, res) => {
  try {
    const result = await list(req.user.tenantId, req.query || {})
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), async (req, res) => {
  const { action, entityType, entityId, meta } = req.body || {}
  try {
    await log(req.user.tenantId, req.user.id, action, entityType || '', entityId, meta || {})
    res.json({ success: true, audited: true })
  } catch (err) {
    try {
      console.warn('[AUDIT_FAIL]', err?.message || err)
    } catch {}
    res.json({ success: true, audited: false })
  }
})

export default router
