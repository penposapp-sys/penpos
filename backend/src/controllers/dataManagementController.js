import { error, sendError } from '../utils/errors.js'
import { error as logError } from '../utils/logger.js'
import multer from 'multer'
import {
  executeTenantDataManagement,
  previewTenantDataManagement
} from '../services/dataManagementService.js'
import {
  downloadTenantBackup,
  previewTenantReset,
  previewTenantRestore,
  resetTenantBusinessData,
  restoreTenantBackup
} from '../services/tenantBackupService.js'

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 }
})

export const receiveBackupFile = (req, res, next) => {
  backupUpload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(error('backup_too_large', 'JSON yedek dosyası 100 MB sınırını aşıyor.', 413))
    }
    return next(error('invalid_backup_upload', 'JSON yedek dosyası yüklenemedi.', 400))
  })
}

const getTenantId = (req) => req.user?.tenantId
const logRestoreFailure = (operation, req, system, err) => {
  if ((Number(err?.status) || 500) < 500) return
  logError(
    `[TENANT_BACKUP_${operation}_ERROR]`,
    {
      requestId: req.requestId || null,
      tenantId: getTenantId(req) ? String(getTenantId(req)) : null,
      system,
      errorName: err?.name || null,
      errorCode: err?.codeName || err?.code || null
    },
    err?.stack || String(err?.message || 'Unknown restore error')
  )
}

export const preview = (system) => async (req, res) => {
  try {
    if (req.body?.action === 'reset') {
      const result = await previewTenantReset({ tenantId: getTenantId(req), system })
      res.json({ success: true, action: 'reset', ...result })
      return
    }
    const result = await previewTenantDataManagement({
      tenantId: getTenantId(req),
      system,
      action: req.body?.action
    })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const execute = (system) => async (req, res) => {
  try {
    if (req.body?.action === 'reset') {
      const result = await resetTenantBusinessData({
        tenantId: getTenantId(req),
        actorUserId: req.user?.id,
        system,
        confirmationName: req.body?.confirmationName,
        resetToken: req.body?.resetToken,
        counts: req.body?.counts
      })
      res.json({ success: true, action: 'reset', ...result })
      return
    }
    const result = await executeTenantDataManagement({
      tenantId: getTenantId(req),
      actorUserId: req.user?.id,
      system,
      action: req.body?.action,
      confirmationName: req.body?.confirmationName,
      backupHash: req.body?.backupHash,
      counts: req.body?.counts
    })
    res.json({ success: true, ...result })
  } catch (err) {
    if (req.body?.action === 'reset' && (Number(err?.status) || 500) >= 409) {
      logError(
        '[TENANT_RESET_EXECUTE_ERROR]',
        {
          requestId: req.requestId || null,
          tenantId: getTenantId(req) ? String(getTenantId(req)) : null,
          system,
          status: Number(err?.status) || 500,
          errorCode: err?.codeName || err?.code || null
        },
        err?.stack || String(err?.message || 'Unknown reset error')
      )
    }
    sendError(res, err)
  }
}

export const backup = (system) => async (req, res) => {
  try {
    const result = await downloadTenantBackup({
      tenantId: getTenantId(req),
      actorUserId: req.user?.id,
      system
    })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const restorePreview = (system) => async (req, res) => {
  try {
    if (!req.file?.buffer) throw error('backup_file_required', 'JSON yedek dosyası seçin.', 400)
    const result = await previewTenantRestore({
      tenantId: getTenantId(req),
      system,
      fileBuffer: req.file.buffer
    })
    res.json({ success: true, ...result })
  } catch (err) {
    logRestoreFailure('RESTORE_PREVIEW', req, system, err)
    sendError(res, err)
  }
}

export const restore = (system) => async (req, res) => {
  try {
    if (!req.file?.buffer) throw error('backup_file_required', 'JSON yedek dosyası seçin.', 400)
    const result = await restoreTenantBackup({
      tenantId: getTenantId(req),
      actorUserId: req.user?.id,
      system,
      fileBuffer: req.file.buffer,
      confirmationName: req.body?.confirmationName,
      overwriteConfirmed: req.body?.overwriteConfirmed === 'true',
      referenceCleanupConfirmed: req.body?.referenceCleanupConfirmed === 'true',
      expectedChecksum: req.body?.expectedChecksum
    })
    res.json({ success: true, ...result })
  } catch (err) {
    logRestoreFailure('RESTORE_EXECUTE', req, system, err)
    sendError(res, err)
  }
}
