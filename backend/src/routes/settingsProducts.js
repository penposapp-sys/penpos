import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { PERMISSIONS } from '../constants/permissions.js'
import * as ctrl from '../controllers/settingsProductsController.js'
import { error } from '../utils/errors.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
})

const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return next(error('file_too_large', 'Dosya çok büyük (max 5MB)', 400))
    return next(error('invalid_upload', 'Dosya yükleme hatası', 400))
  })
}

const authChain = [requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU])]

router.get('/export', ...authChain, ctrl.exportProducts)
router.get('/template', ...authChain, ctrl.downloadTemplate)
router.post('/import', ...authChain, uploadSingleFile, ctrl.importProducts)

export default router
