import { sendError } from '../utils/errors.js'
import Order from '../models/Order.js'
import { error } from '../utils/errors.js'
import Table from '../models/Table.js'
import mongoose from 'mongoose'
import { ensureFeature, ensureNotExpired } from '../services/planService.js'
import { completeItemByItemIdService, cancelItemByItemIdService, completeKitchenBatchByIdService, completeKitchenBatchService, listKitchenOrdersService } from '../services/orderService.js'
import { applyBranchFilter } from '../utils/branchFilter.js'

const SIGN = 'kitchen_v4_12h_2026-01-16'

export const list = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')

    const now = Date.now()
    const cutoffMins = 12 * 60

    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }
    if (process.env.NODE_ENV !== 'production') {
      try {
        const finalQuery = applyBranchFilter({ tenantId: req.user.tenantId }, branchIds)
        console.debug('[BRANCH_FILTER]', { route: req.originalUrl, branchIds, finalQuery })
      } catch {}
    }

    let orders = await listKitchenOrdersService(
      req.user.tenantId,
      { branchIds }
    )

    orders = (orders || []).filter(o => {
      if (!o?.createdAt) return true
      const createdTs = new Date(o.createdAt).getTime()
      const ageMins = Math.floor((now - createdTs) / 60000)
      return Number.isFinite(ageMins) && ageMins <= cutoffMins
    })

    const tableIds = orders.map(o => o.tableId).filter(Boolean)
    const tables = tableIds.length
      ? await Table.find({ _id: { $in: tableIds }, tenantId: req.user.tenantId }).lean()
      : []
    const tableMap = new Map(tables.map(t => [String(t._id), t.name]))

    res.json({
      success: true,
      sign: SIGN,
      orders: orders.map(o => ({
        ...o,
        tableName: o.tableId ? (tableMap.get(String(o.tableId)) || '') : ''
      }))
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const complete = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')
    const { order } = await completeKitchenBatchService(req.user.tenantId, req.params.id)
    res.json({ order })
  } catch (err) {
    sendError(res, err)
  }
}

export const batchComplete = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')
    const { orderId, batchId } = req.params
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw error('invalid_request', 'Invalid order id', 400)
    }
    const { order } = await completeKitchenBatchByIdService(req.user.tenantId, orderId, batchId)
    res.json({ order })
  } catch (err) {
    sendError(res, err)
  }
}

export const itemComplete = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')
    const { id, itemId } = req.params
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw error('invalid_request', 'Invalid order or item id', 400)
    }
    const { order } = await completeItemByItemIdService(req.user.tenantId, id, itemId)
    res.json({ order })
  } catch (err) {
    sendError(res, err)
  }
}

export const itemCancel = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')
    const { id, itemId } = req.params
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw error('invalid_request', 'Invalid order or item id', 400)
    }
    const { order } = await cancelItemByItemIdService({
      orderId: id,
      itemId,
      reason: req.body?.reason || '',
      user: req.user
    })
    res.json({ order })
  } catch (err) {
    sendError(res, err)
  }
}
