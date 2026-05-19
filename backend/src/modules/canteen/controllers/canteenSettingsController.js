import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenSettingsService.js'

export const getSettings = async (req, res) => {
  try {
    const settings = await service.getSettings(req.user.tenantId)
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateSettings = async (req, res) => {
  try {
    const settings = await service.updateSettings(req.user.tenantId, req.body || {})
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const getPaymentSettings = async (req, res) => {
  try {
    const settings = await service.getPaymentSettings(req.user.tenantId)
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updatePaymentSettings = async (req, res) => {
  try {
    const settings = await service.updatePaymentSettings(req.user.tenantId, req.body || {})
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateQrSettings = async (req, res) => {
  try {
    const settings = await service.updateQrSettings(req.user.tenantId, req.canteenBranchId, req.body || {})
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}
