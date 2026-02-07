import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenBranchService.js'

export const list = async (req, res) => {
  try {
    const branches = await service.listBranches(req.user.tenantId, req.user)
    res.json({ success: true, branches })
  } catch (err) {
    sendError(res, err)
  }
}

export const create = async (req, res) => {
  try {
    const branch = await service.createBranch(req.user.tenantId, req.user.id, req.body || {})
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const branch = await service.updateBranch(req.user.tenantId, req.user.id, req.params.id, req.body || {})
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateStatus = async (req, res) => {
  try {
    const branch = await service.updateBranchStatus(req.user.tenantId, req.user.id, req.params.id, req.body || {})
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

export const getBranchStaff = async (req, res) => {
  try {
    const result = await service.getBranchStaff(req.user.tenantId, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const setBranchStaff = async (req, res) => {
  try {
    const result = await service.setBranchStaff(req.user.tenantId, req.user.id, req.params.id, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await service.removeBranch(req.user.tenantId, req.user.id, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
