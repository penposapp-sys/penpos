import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenQrOrderService.js'

export const createPublic = async (req, res) => {
  try {
    const order = await service.createPublicQrOrder(req.body || {})
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const list = async (req, res) => {
  try {
    const items = await service.listQrOrders(req.user.tenantId, req.canteenBranchIds || [], req.query || {})
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateStatus = async (req, res) => {
  try {
    const order = await service.updateQrOrderStatus(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.id, req.body?.orderStatus)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const updatePayment = async (req, res) => {
  try {
    const order = await service.updateQrOrderPayment(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.id, req.body || {})
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const transferToCari = async (req, res) => {
  try {
    const result = await service.transferQrOrderToCari(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.id, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await service.deleteQrOrder(req.user.tenantId, req.canteenBranchId, req.user.id, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
