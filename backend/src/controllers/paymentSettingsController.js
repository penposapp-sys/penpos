import { sendError } from '../utils/errors.js'
import { getSettingsService, updateSettingsService } from '../services/paymentSettingsService.js'

export const getSettings = async (req, res) => {
  try {
    const branchId = req.branch?.id || null
    const result = await getSettingsService(req.user.tenantId, branchId)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const updateSettings = async (req, res) => {
  try {
    const branchId = req.body?.branchId || req.branch?.id || null
    const result = await updateSettingsService(req.user.tenantId, branchId, req.body?.methods || [])
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}
