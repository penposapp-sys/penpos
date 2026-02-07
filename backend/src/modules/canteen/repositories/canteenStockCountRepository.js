import CanteenStockCountSession from '../models/StockCountSession.js'
import CanteenStockCountItem from '../models/StockCountItem.js'

export const createSession = (data) => CanteenStockCountSession.create(data)

export const findSessionByIdAndScope = (id, tenantId, branchId) =>
  CanteenStockCountSession.findOne({ _id: id, tenantId, branchId })

export const closeSessionByIdAndScope = (id, tenantId, branchId, update, options = {}) =>
  CanteenStockCountSession.findOneAndUpdate({ _id: id, tenantId, branchId }, update, { new: true, ...(options || {}) })

export const upsertCountItem = async ({
  tenantId,
  branchId,
  sessionId,
  productId,
  barcode,
  qty,
  productSnapshot,
  currentStockAtStart
}) => {
  const n = Number(qty || 1)
  const incQty = Number.isFinite(n) && n > 0 ? n : 1

  const filter = {
    tenantId,
    branchId,
    sessionId,
    productId,
  }

  const now = new Date()
  const update = {
    $inc: { countedQty: incQty },
    $set: { updatedAt: now },
    $setOnInsert: {
      tenantId,
      branchId,
      sessionId,
      productId,
      barcode: String(barcode || '').trim(),
      productSnapshot: productSnapshot || null,
      currentStockAtStart: Number(currentStockAtStart || 0),
      createdAt: now,
    },
  }

  const options = { upsert: true, new: true }
  return await CanteenStockCountItem.findOneAndUpdate(filter, update, options).lean()
}

export const listItemsBySession = (tenantId, branchId, sessionId) =>
  CanteenStockCountItem.find({ tenantId, branchId, sessionId }).sort({ updatedAt: -1 })

export const updateItemCountedQtyByIdAndScope = async ({ tenantId, branchId, sessionId, itemId, countedQty }) => {
  const qty = Number(countedQty)
  if (!Number.isFinite(qty) || qty < 0) return null
  return await CanteenStockCountItem.findOneAndUpdate(
    { _id: itemId, tenantId, branchId, sessionId },
    { $set: { countedQty: qty, updatedAt: new Date() } },
    { new: true }
  ).lean()
}

export const listSessionsByScope = (tenantId, branchId, { limit = 20, skip = 0, from = null, to = null } = {}) => {
  const filter = { tenantId, branchId }
  if (from || to) {
    filter.startedAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {})
    }
  }
  return CanteenStockCountSession
    .find(filter)
    .sort({ startedAt: -1 })
    .skip(Number(skip || 0))
    .limit(Number(limit || 20))
    .populate('createdBy', 'name')
    .lean()
}

export const getSessionStatsByIds = async (tenantId, branchId, sessionIds) => {
  const ids = Array.isArray(sessionIds) ? sessionIds.filter(Boolean) : []
  if (ids.length === 0) return []
  return CanteenStockCountItem.aggregate([
    { $match: { tenantId, branchId, sessionId: { $in: ids } } },
    {
      $group: {
        _id: '$sessionId',
        lineCount: { $sum: 1 },
        totalDiff: { $sum: { $subtract: ['$countedQty', '$currentStockAtStart'] } }
      }
    }
  ])
}

export const findSessionByIdAndScopeLean = (id, tenantId, branchId) =>
  CanteenStockCountSession.findOne({ _id: id, tenantId, branchId }).populate('createdBy', 'name').lean()
