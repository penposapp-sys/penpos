import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenCustomerService.js'
import { parseBranchIds, requireValidObjectIds } from '../../../utils/branchIds.js'

export const list = async (req, res) => {
  try {
    const q = String(req.query?.q || '').trim()
    const customers = q ? await service.searchCustomers(req.user.tenantId, q, { limit: 50 }) : await service.listCustomers(req.user.tenantId)
    res.json({ success: true, customers })
  } catch (err) {
    sendError(res, err)
  }
}

export const create = async (req, res) => {
  try {
    const customer = await service.createCustomer(req.user.tenantId, req.user.id, req.body || {})
    res.json({ success: true, customer })
  } catch (err) {
    sendError(res, err)
  }
}

export const get = async (req, res) => {
  try {
    const customer = await service.getCustomer(req.user.tenantId, req.params.id)
    res.json({ success: true, customer })
  } catch (err) {
    sendError(res, err)
  }
}

export const sales = async (req, res) => {
  try {
    const requestedBranchIds = parseBranchIds(req.query?.branchId, req.query?.branchIds)
    const bad = requireValidObjectIds(requestedBranchIds)
    if (bad.length > 0) return res.status(400).json({ success: false, code: 'invalid_request', message: 'Invalid branch id' })

    const branchIds = requestedBranchIds.length > 0
      ? (Array.isArray(req.branchIds) ? req.branchIds.filter((id) => requestedBranchIds.includes(String(id))) : requestedBranchIds)
      : []

    const items = await service.listCustomerSales(req.user.tenantId, req.params.id, branchIds)
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}

export const collect = async (req, res) => {
  try {
    const branchId = req.canteenBranchId ? String(req.canteenBranchId) : null
    const result = await service.collect(req.user.tenantId, req.user.id, req.params.id, { ...(req.body || {}), branchId })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const adjust = async (req, res) => {
  try {
    const branchId = req.canteenBranchId ? String(req.canteenBranchId) : null
    const result = await service.adjustBalance(req.user.tenantId, req.user.id, req.params.id, { ...(req.body || {}), branchId })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const movements = async (req, res) => {
  try {
    const result = await service.listCustomerMovements(req.user.tenantId, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const deletePayment = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim()
    const result = await service.deleteCustomerPayment(req.user.tenantId, req.user.id, req.params.customerId, req.params.paymentId, reason)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const customer = await service.updateCustomer(req.user.tenantId, req.user.id, req.params.id, req.body || {})
    res.json({ success: true, customer })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await service.deleteCustomer(req.user.tenantId, req.user.id, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
