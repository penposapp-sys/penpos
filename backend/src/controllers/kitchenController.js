import { sendError } from '../utils/errors.js'
import Order from '../models/Order.js'
import { error } from '../utils/errors.js'
import Table from '../models/Table.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import KitchenBulkPrepState from '../models/KitchenBulkPrepState.js'
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

    const menuItemIds = Array.from(new Set(
      (orders || [])
        .flatMap(o => (Array.isArray(o?.batches) ? o.batches : []))
        .flatMap(b => (Array.isArray(b?.items) ? b.items : []))
        .map(it => String(it?.menuItemId || ''))
        .filter(Boolean)
    ))
    const menuItems = menuItemIds.length
      ? await MenuItem.find({ _id: { $in: menuItemIds }, tenantId: req.user.tenantId }).select('_id categoryId').lean()
      : []
    const categoryIdByMenuItemId = Object.fromEntries((menuItems || []).map(m => [String(m._id), String(m.categoryId || '')]))
    const categoryIds = Array.from(new Set((menuItems || []).map(m => String(m?.categoryId || '')).filter(Boolean)))
    const categories = categoryIds.length
      ? await Category.find({ _id: { $in: categoryIds }, tenantId: req.user.tenantId }).select('_id name').lean()
      : []

    res.json({
      success: true,
      sign: SIGN,
      categories,
      categoryIdByMenuItemId,
      orders: orders.map(o => ({
        ...o,
        tableName: o.tableId ? (tableMap.get(String(o.tableId)) || '') : ''
      }))
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const bulkList = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')

    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }

    const orders = await listKitchenOrdersService(req.user.tenantId, { branchIds })
    const orderById = new Map((orders || []).map(o => [String(o?.id || ''), o]).filter(([k]) => k))
    const orderIds = Array.from(orderById.keys()).filter(Boolean)
    const tableIds = (orders || []).map(o => o?.tableId).filter(Boolean)
    const tables = tableIds.length
      ? await Table.find({ _id: { $in: tableIds }, tenantId: req.user.tenantId }).lean()
      : []
    const tableMap = new Map(tables.map(t => [String(t._id), t.name]))

    const doneRows = orderIds.length
      ? await KitchenBulkPrepState.find({ tenantId: req.user.tenantId, sourceOrderId: { $in: orderIds }, isDone: true })
        .select('rowKey')
        .lean()
      : []
    const doneSet = new Set((doneRows || []).map(d => String(d?.rowKey || '')).filter(Boolean))

    const rows = []
    for (const o of orders || []) {
      const displayTable = o?.tableId ? (tableMap.get(String(o.tableId)) || '') : ''
      const displayName = displayTable || (o?.orderNo ? `Sipariş ${o.orderNo}` : 'Sipariş')
      const batches = Array.isArray(o?.batches) ? o.batches : []
      for (const b of batches) {
        const items = Array.isArray(b?.items) ? b.items : []
        for (const it of items) {
          if (!it || it.status !== 'sent') continue
          const orderId = String(o?.id || '')
          const itemId = String(it?._id || '')
          if (!orderId || !itemId) continue
          const rowKey = `${orderId}:${itemId}`
          if (doneSet.has(rowKey)) continue
          const createdAt = it?.kitchenSentAt || it?.sentAt || o?.createdAt || null
          rows.push({
            rowKey,
            orderId,
            itemId,
            menuItemId: String(it?.menuItemId || ''),
            name: String(it?.nameSnapshot || ''),
            note: String(it?.note || ''),
            tableName: displayName,
            isWeightBased: !!it?.isWeightBased,
            weightGrams: Number(it?.weightGrams || 0) || 0,
            qty: Number(it?.qty || 1),
            createdAt
          })
        }
      }
    }

    const menuItemIds = Array.from(new Set(rows.map(r => r.menuItemId).filter(Boolean)))
    const menuItems = menuItemIds.length
      ? await MenuItem.find({ _id: { $in: menuItemIds }, tenantId: req.user.tenantId }).select('_id categoryId').lean()
      : []
    const categoryIdByMenuItemId = new Map((menuItems || []).map(m => [String(m._id), String(m.categoryId || '')]))
    const categoryIds = Array.from(new Set((menuItems || []).map(m => String(m?.categoryId || '')).filter(Boolean)))
    const categories = categoryIds.length
      ? await Category.find({ _id: { $in: categoryIds }, tenantId: req.user.tenantId }).select('_id name').lean()
      : []

    const byMenuItemId = new Map()
    for (const r of rows) {
      const key = `${String(r.menuItemId || '')}|${String(r.weightGrams || '')}`
      if (!key) continue
      const entry = byMenuItemId.get(key) || {
        menuItemId: String(r.menuItemId || ''),
        name: String(r.name || ''),
        categoryId: categoryIdByMenuItemId.get(String(r.menuItemId || '')) || '',
        isWeightBased: !!r.isWeightBased,
        weightGrams: Number(r.weightGrams || 0) || 0,
        totalQty: 0,
        rows: []
      }
      entry.totalQty += Math.max(1, Number(r.qty || 1))
      entry.rows.push({
        rowKey: r.rowKey,
        tableName: r.tableName,
        qty: Math.max(1, Number(r.qty || 1)),
        isWeightBased: !!r.isWeightBased,
        weightGrams: Number(r.weightGrams || 0) || 0,
        createdAt: r.createdAt
      })
      byMenuItemId.set(key, entry)
    }

    const items = Array.from(byMenuItemId.values())
      .map(it => ({
        ...it,
        rows: (it.rows || []).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      }))
      .sort((a, b) => {
        const at = a.rows?.[0]?.createdAt ? new Date(a.rows[0].createdAt).getTime() : 0
        const bt = b.rows?.[0]?.createdAt ? new Date(b.rows[0].createdAt).getTime() : 0
        return at - bt
      })

    res.json({
      success: true,
      sign: `${SIGN}:bulk`,
      items,
      categories
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const bulkDone = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'kitchen')

    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }

    const rowKey = String(req.params.rowKey || '').trim()
    const [orderId, itemId] = rowKey.split(':')
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw error('invalid_request', 'Invalid rowKey', 400)
    }

    const order = await Order.findOne({ _id: orderId, tenantId: req.user.tenantId }).select('branchId items tableId orderNo createdAt').lean()
    if (!order) throw error('not_found', 'Order not found', 404)
    if (!branchIds.includes(String(order.branchId))) {
      throw error('forbidden', 'Branch access denied', 403)
    }

    const items = Array.isArray(order.items) ? order.items : []
    const it = items.find(x => String(x?._id || '') === String(itemId))
    if (!it) throw error('not_found', 'Item not found', 404)

    const tableName = String(req.body?.tableName || '').trim()
    const createdAt = req.body?.createdAt ? new Date(req.body.createdAt) : (it?.kitchenSentAt || it?.sentAt || order?.createdAt || null)
    const qty = Math.max(1, Number(req.body?.qty || it?.qty || 1))
    const weightGrams = Number(req.body?.weightGrams || it?.weightGrams || 0) || 0
    const now = new Date()

    await KitchenBulkPrepState.findOneAndUpdate(
      { tenantId: req.user.tenantId, rowKey },
      {
        $set: {
          tenantId: req.user.tenantId,
          branchId: order.branchId,
          menuItemId: it.menuItemId,
          sourceOrderId: order._id,
          sourceItemId: it._id,
          rowKey,
          tableName,
          qty,
          weightGrams,
          createdAt: createdAt && Number.isFinite(new Date(createdAt).getTime()) ? createdAt : null,
          isDone: true,
          doneAt: now,
          doneBy: req.user.id
        }
      },
      { upsert: true, new: true }
    )

    res.json({ success: true })
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
