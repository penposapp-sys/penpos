import { sendError } from '../utils/errors.js'
import { listTablesService, createTableService, updateTableService, deleteTableService } from '../services/tableService.js'
import { log as auditLog } from '../services/auditService.js'
import { error } from '../utils/errors.js'

export const list = async (req, res) => {
  try {
    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    const branchId = req.branch?.id || null
    const items = await listTablesService(req.user.tenantId, branchIds.length > 0 ? { branchIds } : branchId)
    res.json({ tables: items })
  } catch (err) {
    sendError(res, err)
  }
}

export const create = async (req, res) => {
  try {
    const branchId = req.branch?.id || req.body?.branchId || null
    if (!branchId) throw error('branch_required', 'Branch required', 400)
    const dto = { ...(req.body || {}), branchId }
    const t = await createTableService(req.user.tenantId, req.user.id, dto)
    res.json({ table: t })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const t = await updateTableService(req.user.tenantId, req.user.id, req.params.id, req.body || {})
    res.json({ table: t })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    await auditLog(req.user.tenantId, req.user.id, 'masa_silme_deneme', 'Table', req.params.id, { attempt: true })
    const result = await deleteTableService(req.user.tenantId, req.user.id, req.params.id)
    await auditLog(req.user.tenantId, req.user.id, 'masa_silme_deneme', 'Table', req.params.id, { success: true })
    res.json(result)
  } catch (err) {
    try {
      await auditLog(req.user.tenantId, req.user.id, 'masa_silme_deneme', 'Table', req.params.id, { success: false, error: err?.code || err?.message })
    } catch {}
    sendError(res, err)
  }
}
