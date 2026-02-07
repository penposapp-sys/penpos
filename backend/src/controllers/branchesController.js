import { sendError, error as errFn } from '../utils/errors.js'
import { toggleBranchActiveService, setBranchStaffService, updateBranchService } from '../services/branchService.js'

export const toggle = async (req, res) => {
  try {
    const branch = await toggleBranchActiveService(req.user.tenantId, req.user.id, req.params.id)
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

export const setStaff = async (req, res) => {
  try {
    const staffIds = Array.isArray(req.body?.staffIds) ? req.body.staffIds : []
    const { branch } = await setBranchStaffService(req.user.tenantId, req.user.id, req.params.id, staffIds)
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const name = req.body?.name !== undefined ? String(req.body?.name || '').trim() : undefined
    const description = req.body?.description !== undefined ? String(req.body?.description || '').trim() : undefined
    if (name !== undefined && !name) {
      throw errFn('name_required', 'Name required', 400)
    }
    const branch = await updateBranchService(req.user.tenantId, req.user.id, req.params.id, { name, description })
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

