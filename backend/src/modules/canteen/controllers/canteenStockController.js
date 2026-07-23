import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenStockService.js'

export const createMovement = async (req, res) => {
  try {
    const result = await service.createMovement(req.user.tenantId, req.canteenBranchId, req.user.id, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const listMovements = async (req, res) => {
  try {
    const items = await service.listMovements(req.user.tenantId, req.canteenBranchId, req.query || {})
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}

export const createReceipt = async (req, res) => {
  try {
    const result = await service.createReceipt(req.user.tenantId, req.canteenBranchId, req.user.id, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const startCount = async (req, res) => {
  try {
    const result = await service.startStockCount(req.user.tenantId, req.canteenBranchId, req.user.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const scanCount = async (req, res) => {
  try {
    const result = await service.scanStockCount(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.sessionId, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const summaryCount = async (req, res) => {
  try {
    const summary = await service.getStockCountSummary(req.user.tenantId, req.canteenBranchId, req.params.sessionId)
    res.json({ success: true, summary })
  } catch (err) {
    sendError(res, err)
  }
}

export const finishCount = async (req, res) => {
  try {
    const summary = await service.finishStockCount(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.sessionId)
    res.json({ success: true, summary })
  } catch (err) {
    sendError(res, err)
  }
}

export const cancelCount = async (req, res) => {
  try {
    const result = await service.cancelStockCount(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.sessionId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateCountItem = async (req, res) => {
  try {
    const result = await service.updateStockCountItem(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.sessionId, req.params.itemId, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const applyCount = async (req, res) => {
  try {
    const result = await service.applyStockCount(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.sessionId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const revertCount = async (req, res) => {
  try {
    const result = await service.reopenStockCount(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.sessionId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const listCounts = async (req, res) => {
  try {
    const items = await service.listStockCounts(req.user.tenantId, req.canteenBranchId, req.query || {})
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}

export const getCountDetail = async (req, res) => {
  try {
    const result = await service.getStockCountDetail(req.user.tenantId, req.canteenBranchId, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
