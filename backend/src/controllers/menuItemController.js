import { listMenuItems, getMenuItemService, createMenuItemService, updateMenuItemService, deleteMenuItemService } from '../services/menuItemService.js'
import { sendError } from '../utils/errors.js'

export const list = async (req, res) => {
  try {
    const query = {
      ...(req.query || {}),
      branchIds: req.query?.branchIds,
      branchId: req.query?.branchId || req.branch?.id || null
    }
    const items = await listMenuItems(req.user.tenantId, query)
    res.json({ items })
  } catch (err) {
    sendError(res, err)
  }
}

export const getOne = async (req, res) => {
  try {
    const item = await getMenuItemService(req.user.tenantId, req.params.id)
    res.json({ item })
  } catch (err) {
    sendError(res, err)
  }
}

export const create = async (req, res) => {
  try {
    const item = await createMenuItemService(req.user.tenantId, {
      ...(req.body || {}),
      actorUserId: req.user?.id || null,
      actorName: req.user?.name || req.user?.email || 'Bilinmeyen Kullanici'
    })
    res.json({ item })
  } catch (err) {
    sendError(res, err)
  }
}

export const update = async (req, res) => {
  try {
    const item = await updateMenuItemService(req.user.tenantId, req.params.id, {
      ...(req.body || {}),
      actorUserId: req.user?.id || null,
      actorName: req.user?.name || req.user?.email || 'Bilinmeyen Kullanici'
    })
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
