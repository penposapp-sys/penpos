import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenSalesService.js'

export const create = async (req, res) => {
  try {
    const sale = await service.createSale(req.user.tenantId, req.canteenBranchId, req.user.id, req.body || {})
    res.json({ success: true, sale })
  } catch (err) {
    sendError(res, err)
  }
}

export const preview = async (req, res) => {
  try {
    const preview = await service.previewSale(req.user.tenantId, req.canteenBranchId, req.body || {})
    res.json({ success: true, preview })
  } catch (err) {
    sendError(res, err)
  }
}

export const listCompleted = async (req, res) => {
  try {
    const sales = await service.listSales(req.user.tenantId, req.canteenBranchIds || [], req.query || {})
    res.json({ success: true, ...sales })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await service.deleteSale(req.user.tenantId, req.user.id, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const reopen = async (req, res) => {
  try {
    const result = await service.reopenSale(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const get = async (req, res) => {
  try {
    const sale = await service.getSale(req.user.tenantId, req.canteenBranchId, req.params.id)
    res.json({ success: true, sale })
  } catch (err) {
    sendError(res, err)
  }
}
