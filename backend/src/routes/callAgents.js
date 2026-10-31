import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { requireCallAgentAuth } from '../middlewares/requireCallAgentAuth.js'
import * as ctrl from '../controllers/callAgentController.js'
import { PERMISSIONS } from '../constants/permissions.js'
import { requireActiveSubscription } from '../middlewares/requireActiveSubscription.js'

const router = Router()
const pairingStartLimit = rateLimit({ windowMs: 60 * 1000, max: 10 })
const pairingApproveLimit = rateLimit({ windowMs: 60 * 1000, max: 10 })
const pairingCompleteLimit = rateLimit({ windowMs: 60 * 1000, max: 30 })
const refreshLimit = rateLimit({ windowMs: 60 * 1000, max: 20 })
const heartbeatLimit = rateLimit({ windowMs: 60 * 1000, max: 30 })

const manageDevices = [
  requireAuth,
  tenantGuard,
  requireRole(['tenant_admin', 'staff']),
  requirePermission([PERMISSIONS.MANAGE_SETTINGS])
]

router.post('/pairings', pairingStartLimit, ctrl.createPairing)
router.post('/pairings/:pairingId/approve', pairingApproveLimit, ...manageDevices, requireActiveSubscription, ctrl.approvePairing)
router.post('/pairings/:pairingId/complete', pairingCompleteLimit, ctrl.completePairingRequest)
router.post('/tokens/refresh', refreshLimit, ctrl.refreshTokens)
router.post('/devices/:deviceId/heartbeat', heartbeatLimit, requireCallAgentAuth, ctrl.heartbeat)
router.get('/branches', ...manageDevices, requireActiveSubscription, ctrl.listBranches)
router.get('/devices', ...manageDevices, requireActiveSubscription, ctrl.listDevices)
router.post('/devices/:deviceId/revoke', ...manageDevices, ctrl.revokeDevice)

export default router
