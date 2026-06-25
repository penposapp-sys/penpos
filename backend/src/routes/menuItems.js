import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middlewares/requireAuth.js'
import { tenantGuard } from '../middlewares/tenantGuard.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requirePermission } from '../middlewares/requirePermission.js'
import { PERMISSIONS } from '../constants/permissions.js'
import * as ctrl from '../controllers/menuItemController.js'
import { error } from '../utils/errors.js'
import { MAX_IMAGE_UPLOAD_BYTES } from '../utils/imageUpload.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES }
})

const uploadSingleImage = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return next(error('file_too_large', 'Gorsel boyutu en fazla 5 MB olabilir.', 400))
    return next(error('invalid_upload', 'Gorsel yukleme hatasi.', 400))
  })
}

router.get('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission(['pos_access']), ctrl.list)
router.get('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.getOne)
router.post('/', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.create)
router.put('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.update)
router.post('/:id/image', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), uploadSingleImage, ctrl.uploadImage)
router.delete('/:id/image', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.removeImage)
router.delete('/:id', requireAuth, tenantGuard, requireRole(['tenant_admin', 'staff']), requirePermission([PERMISSIONS.MANAGE_MENU]), ctrl.remove)

export default router
