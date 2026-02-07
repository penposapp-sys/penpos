import { sendError } from '../utils/errors.js'
import { listBranches, createBranchService, updateBranchService, deleteBranchService } from '../services/branchService.js'

export const list = async (req, res) => {
  try {
    const items = await listBranches(req.user.tenantId)
    res.json({ branches: items })
  } catch (err) {
    sendError(res, err)
  }
}

export const create = async (req, res) => {
  try {
    const b = await createBranchService(req.user.tenantId, req.user.id, req.body || {})
    res.json({ branch: b })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const b = await updateBranchService(req.user.tenantId, req.user.id, req.params.id, req.body || {})
    res.json({ branch: b })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await deleteBranchService(req.user.tenantId, req.user.id, req.params.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}
