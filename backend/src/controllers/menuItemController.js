import { listMenuItems, createMenuItemService, updateMenuItemService, deleteMenuItemService } from '../services/menuItemService.js'
import { sendError } from '../utils/errors.js'

export const list = async (req, res) => {
  try {
    const items = await listMenuItems(req.user.tenantId, req.query || {})
    res.json({ items })
  } catch (err) {
    sendError(res, err)
  }
}

export const create = async (req, res) => {
  try {
    const item = await createMenuItemService(req.user.tenantId, req.body || {})
    res.json({ item })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const item = await updateMenuItemService(req.user.tenantId, req.params.id, req.body || {})
    res.json({ item })
  } catch (err) {
    sendError(res, err)
  }
}

export const remove = async (req, res) => {
  try {
    const result = await deleteMenuItemService(req.user.tenantId, req.user.id, req.params.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}
