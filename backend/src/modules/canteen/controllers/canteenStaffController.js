import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenStaffService.js'

export const list = async (req, res) => {
  try {
    const q = String(req.query?.includeInactive || '').trim().toLowerCase()
    const includeInactive = q === '1' || q === 'true' || q === 'yes'
    const staff = await service.listStaff(req.user.tenantId, { includeInactive })
    res.json({ success: true, staff })
  } catch (err) {
    sendError(res, err)
  }
}

export const create = async (req, res) => {
  try {
    const staff = await service.createStaff(req.user.tenantId, req.user.id, req.body || {})
    res.json({ success: true, staff })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const staff = await service.updateStaff(req.user.tenantId, req.user.id, req.params.id, req.body || {})
    res.json({ success: true, staff })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await service.removeStaff(req.user.tenantId, req.user.id, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
