import { sendError, error as errFn } from '../utils/errors.js'
import { toggleBranchActiveService, updateBranchService, deleteBranchService } from '../services/branchService.js'

export const toggle = async (req, res) => {
  try {
    const branch = await toggleBranchActiveService(req.user.tenantId, req.user.id, req.params.id)
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const name = req.body?.name !== undefined ? String(req.body?.name || '').trim() : undefined
    const description = req.body?.description !== undefined ? String(req.body?.description || '').trim() : undefined
    const address = req.body?.address !== undefined ? String(req.body?.address || '').trim() : undefined
    if (name !== undefined && !name) {
      throw errFn('name_required', 'Name required', 400)
    }
    const branch = await updateBranchService(req.user.tenantId, req.user.id, req.params.id, {
      name,
      description,
      address,
      isActive: req.body?.isActive
    })
    res.json({ success: true, branch })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await deleteBranchService(req.user.tenantId, req.user.id, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
