import CanteenStockMovement from '../models/StockMovement.js'

export const create = (data) => CanteenStockMovement.create(data)

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
