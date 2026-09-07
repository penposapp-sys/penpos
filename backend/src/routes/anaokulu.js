import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import {
  getAnaokuluSchool,
  saveAnaokuluSchool,
  getAnaokuluStudent,
  delAnaokuluStudent,
  delAnaokuluCollection,
  delAnaokuluInvoice,
  checkLucaInvoices
} from '../controllers/anaokuluController.js'

const router = Router()

router.use(requireAuth, tenantGuard)

// Tüm okul verisi tek endpoint'den (GET = oku, POST = ekle/güncelle)
router.get('/', getAnaokuluSchool)
router.post('/', saveAnaokuluSchool)

// Tekil veri işlemleri
router.get('/students/:id', getAnaokuluStudent)
router.delete('/students/:id', delAnaokuluStudent)
router.delete('/collections/:id', delAnaokuluCollection)
router.delete('/invoices/:uuid', delAnaokuluInvoice)

// LUCA e-Fatura entegrasyon endpoint'i
router.post('/check-luca', checkLucaInvoices)

export default router
