import CanteenStockMovement from '../models/StockMovement.js'

export const create = (data) => CanteenStockMovement.create(data)

export const listByNote = (tenantId, branchId, note) =>
  CanteenStockMovement.find({ tenantId, branchId, note: String(note || '').trim() }).sort({ createdAt: -1 }).lean()

export const findOneByNote = (tenantId, branchId, note) =>
  CanteenStockMovement.findOne({ tenantId, branchId, note: String(note || '').trim() }).sort({ createdAt: -1 }).lean()

export const listByTenantAndBranchInRange = (tenantId, branchId, from, to, { limit = 200 } = {}) => {
  const q = { tenantId, branchId }
  if (from || to) {
    q.createdAt = {}
    if (from) q.createdAt.$gte = from
    if (to) q.createdAt.$lt = to
  }
  return CanteenStockMovement.find(q)
    .populate('productId', 'name barcode')
    .sort({ createdAt: -1 })
    .limit(Number(limit || 200))
}
