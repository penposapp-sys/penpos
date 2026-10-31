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

export const completeQuickSaleOrderWithoutKitchen = (order, completedAt = new Date()) => {
  if (
    order?.saleSource !== 'quick-sale'
    || order.kitchenEnabled !== false
    || order.sendToKitchen !== false
    || ['closed', 'cancelled', 'merged', 'completed'].includes(String(order.status || ''))
  ) return false

  const items = Array.isArray(order.items) ? order.items : []
  if (
    items.length === 0
    || (Array.isArray(order.kitchenBatches) && order.kitchenBatches.length > 0)
    || items.some(item => item && ['sent', 'cooking'].includes(String(item.status || '')))
  ) return false

  for (const item of items) {
    if (item && item.status !== 'cancelled') item.status = 'completed'
  }
  order.status = 'completed'
  order.closedAt = order.closedAt || completedAt
  order.currentKitchenBatchId = null
  return true
}
