import mongoose from 'mongoose'

export const resolveBranchFromTable = async (req, res, next) => {
  try {
    const tableId = req.params.tableId || req.params.targetTableId
    if (!tableId || !mongoose.Types.ObjectId.isValid(tableId)) {
      return next() // Let controller or validator handle invalid ID
    }
    
    // Check if we already have branch info
    if (req.branchId || req.branchSource) return next()

    const tenantId = req.user?.tenantId
    if (!tenantId) return next()

    const Table = (await import('../models/Table.js')).default
    const table = await Table.findOne({ _id: tableId, tenantId }).select('branchId name status isActive').lean()
    if (table && table.branchId) {
      req.branchId = String(table.branchId)
      req.branchSource = 'table'
      // Optional: Store table for controller reuse
      req.resolvedTable = table
    }
    next()
  } catch (err) {
    console.error('[RESOLVE_BRANCH_TABLE_ERR]', err)
    next()
  }
}

export const resolveBranchFromOrder = async (req, res, next) => {
  try {
    // Usually param is :id or :orderId. Check both.
    const orderId = req.params.id || req.params.orderId
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return next()
    }

    if (req.branchId || req.branchSource) return next()

    const tenantId = req.user?.tenantId
    if (!tenantId) return next()

    const Order = (await import('../models/Order.js')).default
    const order = await Order.findOne({ _id: orderId, tenantId }).select('branchId').lean()
    
    if (order && order.branchId) {
      req.branchId = String(order.branchId)
      req.branchSource = 'order'
    }
    next()
  } catch (err) {
    console.error('[RESOLVE_BRANCH_ORDER_ERR]', err)
    next()
  }
}
