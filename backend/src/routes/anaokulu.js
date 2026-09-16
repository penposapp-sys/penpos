import { Router } from 'express'

import {
  getAnaokuluSchool,
  saveAnaokuluSchool,
  resetAnaokuluSchool,
  getAnaokuluStudent,
  updateAnaokuluStudent,
  delAnaokuluStudent,
  delAnaokuluCollection,
  delAnaokuluInvoice,
  getAnaokuluInvoicePdf,
  checkLucaInvoices,
  checkLucaJobStatus,
  claimLucaExtensionTask,
  submitLucaExtensionInvoices,
  registerLucaDevice,
  heartbeatLucaDevice,
  getLucaDeviceStatus,
  listLucaDeviceTasks,
  revokeLucaDevice
} from '../controllers/anaokuluController.js'

import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireLucaDevice } from '../middlewares/requireLucaDevice.js'

const router = Router()

const forbidSuperadminSchoolMutation = (req, res, next) => {
  if (req.user?.role !== 'superadmin') return next()

  const body = req.body || {}
  const hasSchoolMutationPayload = Array.isArray(body.students)
    || Array.isArray(body.collections)
    || Array.isArray(body.invoices)
    || Array.isArray(body.checks)

  if (hasSchoolMutationPayload) {
    return res.status(403).json({
      error: 'Süper Admin okul içi öğrenci, taksit, tahsilat ve fatura verisini düzenleyemez.'
    })
  }

  next()
}

// ============================================================
// LUCA CHROME EXTENSION BRIDGE
// ============================================================
//
// Bu iki endpoint PenPOS JWT istemez.
// Güvenlik jobId + tek kullanımlık kısa ömürlü token ile sağlanır.
//
// Extension:
//   PenPOS -> claim-luca
//   Luca   -> submit-luca
//
// ============================================================

router.post(
  '/claim-luca/:jobId',
  claimLucaExtensionTask
)

router.post(
  '/submit-luca/:jobId',
  submitLucaExtensionInvoices
)

// Extension cihaz tokenı ile çalışan endpointler JWT tenant middleware'inden bağımsızdır.
router.post('/luca-device/heartbeat', requireLucaDevice, heartbeatLucaDevice)
router.get('/luca-device/tasks', requireLucaDevice, listLucaDeviceTasks)
router.post('/luca-device/revoke', requireLucaDevice, revokeLucaDevice)


// ============================================================
// ANAOKULU API
// ============================================================

router.use(
  requireAuth,
  tenantGuard
)

router.post('/luca-device/register', registerLucaDevice)
router.get('/luca-device/status', getLucaDeviceStatus)


// Anaokulu ana verileri
router.get(
  '/',
  getAnaokuluSchool
)

router.put(
  '/',
  forbidSuperadminSchoolMutation,
  saveAnaokuluSchool
)

router.delete(
  '/reset',
  resetAnaokuluSchool
)


// Öğrenci
router.get(
  '/students/:id',
  getAnaokuluStudent
)

router.put(
  '/students/:id',
  forbidSuperadminSchoolMutation,
  updateAnaokuluStudent
)

router.delete(
  '/students/:id',
  forbidSuperadminSchoolMutation,
  delAnaokuluStudent
)


// Tahsilat
router.delete(
  '/collections/:id',
  forbidSuperadminSchoolMutation,
  delAnaokuluCollection
)


// Fatura
router.delete(
  '/invoices/:uuid',
  forbidSuperadminSchoolMutation,
  delAnaokuluInvoice
)

router.get(
  '/invoices/:uuid/pdf',
  getAnaokuluInvoicePdf
)


// ============================================================
// LUCA
// ============================================================

// PenPOS'tan Luca kontrolünü başlat
router.post(
  '/check-luca',
  checkLucaInvoices
)

// Luca Extension job durumunu sorgula
router.get(
  '/check-luca/:jobId',
  checkLucaJobStatus
)


export default router