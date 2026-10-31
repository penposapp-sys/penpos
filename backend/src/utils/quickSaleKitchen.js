export const completeQuickSaleOrderWhenKitchenReady = (order, completedAt = new Date()) => {
  if (order?.saleSource !== 'quick-sale') return false
  const activeItems = (Array.isArray(order.items) ? order.items : [])
    .filter(item => item && item.status !== 'cancelled')
  if (activeItems.length === 0 || activeItems.some(item => item.status !== 'completed')) return false

  order.status = 'completed'
  order.closedAt = order.closedAt || completedAt
  order.currentKitchenBatchId = null
  if (Array.isArray(order.kitchenBatches)) {
    order.kitchenBatches = order.kitchenBatches.map(batch => ({
      ...(typeof batch?.toObject === 'function' ? batch.toObject() : batch),
      completedAt: batch?.completedAt || completedAt
    }))
  }
  return true
}
