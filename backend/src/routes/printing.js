import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { PERMISSIONS } from '../constants/permissions.js'
import * as ctrl from '../controllers/printingController.js'
import * as agentCtrl from '../controllers/stationAgentController.js'

const router = Router()

const authSettings = [requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_SETTINGS])]
const adminOnly = [requireAuth, tenantGuard, requireRole(['tenant_admin'])]

router.post('/stations/pair', ctrl.pairStation)

router.get('/printers', ...authSettings, ctrl.listPrinters)
router.post('/printers', ...authSettings, ctrl.createPrinter)
router.patch('/printers/:id', ...authSettings, ctrl.updatePrinter)

router.get('/profiles', ...authSettings, ctrl.listProfiles)
router.post('/profiles', ...authSettings, ctrl.createProfile)
router.patch('/profiles/:id', ...authSettings, ctrl.updateProfile)

router.get('/stations', ...authSettings, ctrl.listStations)
router.post('/stations', ...authSettings, ctrl.createStation)
router.patch('/stations/:id', ...authSettings, ctrl.updateStation)
router.post('/stations/:stationId/rotate-secret', ...adminOnly, ctrl.rotateStationSecret)
router.delete('/stations/:stationId', ...adminOnly, ctrl.deleteStation)

router.get('/jobs', ...authSettings, ctrl.listJobs)
router.post('/jobs', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), ctrl.createJob)

router.post('/stations/:stationId/auth', agentCtrl.stationAuth)
router.post('/stations/:stationId/heartbeat', agentCtrl.heartbeat)

router.post('/stations/:stationId/claim-next', agentCtrl.claimNext)
router.get('/jobs/:jobId/file', agentCtrl.downloadJobFile)

router.post('/jobs/:jobId/complete', agentCtrl.completeJob)
router.post('/jobs/:jobId/fail', agentCtrl.failJob)
router.patch('/jobs/:jobId/complete', agentCtrl.completeJob)
router.patch('/jobs/:jobId/fail', agentCtrl.failJob)
router.patch('/jobs/:jobId/cancel', ...authSettings, ctrl.cancelJob)

router.get('/stations/:stationId/printers', ...authSettings, ctrl.listStationPrinters)

export default router
