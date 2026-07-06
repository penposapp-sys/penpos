import { sendError, error } from '../utils/errors.js'
import { createOrderService, getOrderService, addItemService, removeItemService, setNoteService, setCustomerNameService, cancelOrderService, sendOrderService, payOrderService, transferOrderService, closeOrderService, reopenOrderService, splitOrderService, setItemQuantityService, setItemQuantityByItemIdService, setItemWeightByItemIdService, setItemNoteByItemIdService, createWalkInOrderService, createDeliveryOrderService, updateDeliveryStatusService, updateDeliveryCustomerService, getDeliveryOrdersService, addOrderPaymentService, deleteOrderPaymentService, setOrderDiscountService, setOrderVeresiyeService, deleteOrderVeresiyeEntryService, deleteOrderCollectionTransactionService, getWalkInOrdersService, setKitchenModeService, completeItemByItemIdService } from '../services/orderService.js'
import { mergeOrdersService } from '../services/orderService.js'
import { startOrderForTableService, getActiveOrderForTableService, getTablesOverviewService, closeTableService, abandonIfEmpty } from '../services/tableService.js'
import Order from '../models/Order.js'
import Table from '../models/Table.js'
import mongoose from 'mongoose'
import { log as auditLog } from '../services/auditService.js'
import * as logger from '../utils/logger.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { applyBranchFilter } from '../utils/branchFilter.js'

const getStaffAllowedBranchIds = (req) => {
  if (String(req.user?.role || '') !== 'staff') return null
  const ids = Array.isArray(req.user?.branchIds) && req.user.branchIds.length > 0
    ? req.user.branchIds.map(String)
    : (req.user?.branchId ? [String(req.user.branchId)] : [])
  return ids.filter(Boolean)
}

const assertTablesWithinStaffBranches = async (req, tableIds = []) => {
  const allowedBranchIds = getStaffAllowedBranchIds(req)
  if (!allowedBranchIds || allowedBranchIds.length === 0) return

  const normalizedTableIds = Array.isArray(tableIds)
    ? tableIds.map(String).filter(id => mongoose.Types.ObjectId.isValid(id))
    : []
  if (normalizedTableIds.length === 0) return

  const tables = await Table.find({
    _id: { $in: normalizedTableIds },
    tenantId: req.user.tenantId,
    isActive: true
  }).select('_id branchId').lean()

  const tableById = new Map((tables || []).map(t => [String(t._id), String(t.branchId || '')]))
  for (const tableId of normalizedTableIds) {
    const branchId = tableById.get(String(tableId))
    if (!branchId || !allowedBranchIds.includes(branchId)) {
      throw error('branch_not_allowed', 'Bu şubeye taşıma yetkin yok', 403)
    }
  }
}

export const getTableMeta = async (req, res) => {
  try {
    const tableId = req.params.tableId
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Invalid table id' })
    }
    const result = await (await import('../services/tableService.js')).getTableMetaService(req.user.tenantId, tableId)
    res.json({ success: true, data: result })
  } catch (err) {
    sendError(res, err)
  }
}

export const createOrder = async (req, res) => {
  try {
    const order = await createOrderService(req.user.tenantId, req.user.id, req.branch?.id || null, { createdByName: req.user?.name })
    res.json({ order })
  } catch (err) {
    sendError(res, err)
  }
}

export const getOrder = async (req, res) => {
  try {
    const order = await getOrderService(req.user.tenantId, req.params.id)
    res.json({ order })
  } catch (err) {
    sendError(res, err)
  }
}

export const addItem = async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'null') {
      throw error('order_required', 'Sipariş başlatılmadan ürün eklenemez', 400)
    }
    console.log('ADD_ITEM', req.params.id, req.body)
    const menuItemId = req.body?.menuItemId
    if (!menuItemId) {
      const e = new Error('menuItemId required')
      e.status = 400
      e.payload = { error: 'invalid_request', message: 'menuItemId required' }
      throw e
    }
    const quantity = Number(req.body?.quantity || 1)
    const weightGramsRaw = req.body?.weightGrams
    const weightGrams = weightGramsRaw === undefined || weightGramsRaw === null || weightGramsRaw === ''
      ? null
      : Number(weightGramsRaw)
    const portionKey = String(req.body?.portionKey || '').trim()
    const nameOverride = String(req.body?.nameOverride || '').trim()
    const rawPriceOverride = req.body?.priceOverride
    const priceOverride = rawPriceOverride === undefined || rawPriceOverride === null || rawPriceOverride === ''
      ? null
      : Number(rawPriceOverride)
    const { order } = await addItemService(req.user.tenantId, req.params.id, menuItemId, {
      quantity,
      weightGrams,
      portionKey,
      nameOverride,
      priceOverride
    })
    try {
      await auditLog(req.user.tenantId, req.user.id, 'hızlı_urun_ekleme', 'order', order._id, { menuItemId: req.body?.menuItemId })
    } catch (e) {
      console.error('Controller audit log failed', e)
    }
    res.json({ success: true, order })
  } catch (err) {
    console.log('ADD_ITEM_ERR', err?.payload?.error || err?.code || 'error', err?.message || '')
    const status = err.status || 400
    const code = (err.payload && err.payload.error) || err.code || 'bad_request'
    const message = err.message || (err.payload && err.payload.message) || 'Bad Request'
    res.status(status).json({ success: false, code, error: code, message })
  }
}

export const removeItem = async (req, res) => {
  try {
    const { order } = await removeItemService(req.user.tenantId, req.params.id, req.params.menuItemId)
    try {
      await auditLog(req.user.tenantId, req.user.id, 'urun_silme', 'order', order._id, { menuItemId: req.params.menuItemId })
    } catch (e) {
      console.error('Controller audit log failed', e)
    }
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setNote = async (req, res) => {
  try {
    const { order } = await setNoteService(req.user.tenantId, req.params.id, req.body?.note)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setCustomerName = async (req, res) => {
  try {
    const { order } = await setCustomerNameService(req.user.tenantId, req.params.id, req.body?.customerName)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setItemNote = async (req, res) => {
  try {
    try {
      console.warn('[DEPRECATED_NOTE_ENDPOINT_HIT]', {
        orderId: req.params.id,
        menuItemId: req.params.menuItemId,
        userId: req.user?.id || null,
        tenantId: req.user?.tenantId || null
      })
    } catch {}

    return res.status(400).json({
      success: false,
      code: 'deprecated_endpoint_use_itemId',
      error: 'deprecated_endpoint_use_itemId',
      message: 'Deprecated endpoint. Use /api/pos/orders/:orderId/items/:itemId/note'
    })

    const { order } = await (await import('../services/orderService.js')).setItemNoteService(req.user.tenantId, req.params.id, req.params.menuItemId, req.body?.note || '')
    try {
      await auditLog(req.user.tenantId, req.user.id, 'urun_notu_ekleme', 'order', order._id || order.id, { menuItemId: req.params.menuItemId, note: req.body?.note })
    } catch (e) {
      console.error('Controller audit log failed', e)
    }
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setItemQuantity = async (req, res) => {
  try {
    const quantity = Number(req.body?.quantity)
    if (Number.isNaN(quantity) || quantity < 0) {
      const e = new Error('Invalid quantity')
      e.status = 400
      e.payload = { error: 'invalid_request', message: 'Invalid quantity' }
      throw e
    }
    const { order } = await setItemQuantityService(req.user.tenantId, req.params.id, req.params.menuItemId, quantity)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const itemCancel = async (req, res) => {
  try {
    const { order } = await (await import('../services/orderService.js')).cancelItemService(req.user.tenantId, req.params.id, req.params.menuItemId, req.body?.reason || '')
    try {
      await auditLog(req.user.tenantId, req.user.id, 'urun_iptal', 'order', order._id || order.id, { menuItemId: req.params.menuItemId, reason: req.body?.reason || '' })
    } catch (e) {
      console.error('Controller audit log failed', e)
    }
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const cancelItem = async (req, res) => {
  try {
    console.log('CANCEL_ITEM HIT', req.params)
    const orderId = req.params.orderId
    const itemId = req.params.itemId
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw error('invalid_request', 'Invalid id', 400)
    }
    const { order } = await (await import('../services/orderService.js')).cancelItemByItemIdService({
        orderId,
        itemId,
        reason: req.body?.reason || '',
        user: req.user
    })
    try {
      await auditLog(req.user.tenantId, req.user.id, 'urun_iptal', 'order', order._id || order.id, { itemId, reason: req.body?.reason || '' })
    } catch (e) {
      console.error('Controller audit log failed', e)
    }
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const completeItem = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const itemId = req.params.itemId
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw error('invalid_request', 'Invalid id', 400)
    }
    const { order } = await completeItemByItemIdService(req.user.tenantId, orderId, itemId)
    try {
      await auditLog(req.user.tenantId, req.user.id, 'urun_hazir', 'order', order._id || order.id, { itemId })
    } catch (e) {
      console.error('Controller audit log failed', e)
    }
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setItemQuantityByItemId = async (req, res) => {
  try {
    const quantity = Number(req.body?.quantity)
    if (Number.isNaN(quantity)) {
      const e = new Error('Invalid quantity')
      e.status = 400
      e.payload = { code: 'invalid_quantity', message: 'Invalid quantity' }
      throw e
    }

    if (quantity <= 0) {
      const { order } = await (await import('../services/orderService.js')).removeItemByItemIdService({
        tenantId: req.user.tenantId,
        orderId: req.params.orderId,
        itemId: req.params.itemId
      })
      return res.json({ success: true, order })
    }

    const { order } = await setItemQuantityByItemIdService(req.user.tenantId, req.params.orderId, req.params.itemId, quantity)
    return res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setItemWeightByItemId = async (req, res) => {
  try {
    const weightGrams = Number(req.body?.weightGrams)
    if (Number.isNaN(weightGrams)) {
      const e = new Error('Invalid weight')
      e.status = 400
      e.payload = { code: 'invalid_weight', message: 'Invalid weight' }
      throw e
    }
    const { order } = await setItemWeightByItemIdService(req.user.tenantId, req.params.orderId, req.params.itemId, weightGrams)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setItemNoteByItemId = async (req, res) => {
  try {
    const note = String(req.body?.note || '')
    const { order } = await setItemNoteByItemIdService(req.user.tenantId, req.params.orderId, req.params.itemId, note)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const cancel = async (req, res) => {
  try {
    const result = await cancelOrderService(req.user.tenantId, req.params.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const send = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw error('invalid_request', 'Invalid order id', 400)
    }
    const servingType = req.body?.servingType
    const kitchenEnabled = req.body?.kitchenEnabled
    const result = await sendOrderService(req.user.tenantId, req.params.id, { servingType, kitchenEnabled })
    res.json({ success: true, order: result.order })
  } catch (err) {
    sendError(res, err)
  }
}

export const setKitchenMode = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw error('invalid_request', 'Invalid order id', 400)
    }
    const hasKitchenEnabled = req.body && Object.prototype.hasOwnProperty.call(req.body, 'kitchenEnabled')
    const kitchenEnabled = hasKitchenEnabled ? Boolean(req.body?.kitchenEnabled) : undefined
    const sendToKitchen = req.body && Object.prototype.hasOwnProperty.call(req.body, 'sendToKitchen')
      ? Boolean(req.body?.sendToKitchen)
      : (kitchenEnabled !== undefined ? kitchenEnabled : undefined)

    const { order } = await setKitchenModeService(req.user.tenantId, req.params.id, { kitchenEnabled, sendToKitchen })
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const pay = async (req, res) => {
  try {
    try {
      console.log('[PAY HIT]', { orderId: req.params.id, tenantId: req.user?.tenantId || null, userId: req.user?.id || null, amount: req.body?.amount })
    } catch {}
    const result = await payOrderService(req.user.tenantId, req.params.id, req.body?.paymentMethod, req.body?.amount)
    try {
      await auditLog(req.user.tenantId, req.user.id, 'ödeme_tamamlandi', 'order', result.order?.id || req.params.id, { paymentMethod: req.body?.paymentMethod, amount: req.body?.amount })
    } catch {}
    res.json({ success: true, order: result.order })
  } catch (err) {
    sendError(res, err)
  }
}

export const addPayment = async (req, res) => {
  try {
    const { id } = req.params
    const { method, amount, note } = req.body || {}
    const { order } = await addOrderPaymentService(req.user.tenantId, id, { method, amount, note, cashierId: req.user.id })
    try {
      await auditLog(req.user.tenantId, req.user.id, 'odeme_ekle', 'order', order._id || order.id || id, { method, amount })
    } catch {}
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const deletePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params
    const { order } = await deleteOrderPaymentService(req.user.tenantId, id, paymentId)
    try {
      await auditLog(req.user.tenantId, req.user.id, 'odeme_sil', 'order', order._id || order.id || id, { paymentId })
    } catch {}
    res.json({ success: true, order })
  } catch (err) {
    try {
      console.error('[DELETE_PAYMENT_ERR]', err?.stack || err)
    } catch {}
    sendError(res, err)
  }
}

export const setDiscount = async (req, res) => {
  try {
    const { id } = req.params
    const { discountPercent } = req.body || {}
    const { order } = await setOrderDiscountService(req.user.tenantId, id, discountPercent)
    try {
      await auditLog(req.user.tenantId, req.user.id, 'indirim_guncelle', 'order', order._id || order.id || id, { discountPercent })
    } catch {}
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const veresiye = async (req, res) => {
  try {
    const branchId = req.branch?.id || req.branchId || req.user?.branchId
    if (!branchId) {
      try {
        logger.warn('MISSING_BRANCH', { userId: req.user?.id || null, tenantId: req.user?.tenantId || null, route: req.path })
      } catch {}
      try {
        console.error('[MISSING_BRANCH_SOURCE]', { route: req.originalUrl, stack: new Error('MISSING_BRANCH_HIT').stack })
      } catch {}
      return res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required' })
    }
    const { id } = req.params
    const { accountId, amount, note } = req.body || {}
    const { order } = await setOrderVeresiyeService(req.user.tenantId, branchId, req.user.id, id, { accountId, amount, note })
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const deleteVeresiye = async (req, res) => {
  try {
    const branchId = req.branch?.id || req.branchId || req.user?.branchId
    if (!branchId) {
      return res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required' })
    }
    const { id, entryId } = req.params
    const { order } = await deleteOrderVeresiyeEntryService(req.user.tenantId, branchId, req.user.id, id, entryId)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const deleteCollection = async (req, res) => {
  try {
    const { id, txId } = req.params
    const result = await deleteOrderCollectionTransactionService(req.user.tenantId, id, txId)
    res.json({ success: true, order: result?.order || null })
  } catch (err) {
    sendError(res, err)
  }
}

export const startForTable = async (req, res) => {
  try {
    const branchId = req.branch?.id || req.branchId || req.user?.branchId
    if (!branchId) {
      return res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required' })
    }
    const result = await startOrderForTableService(req.user.tenantId, req.user.id, req.params.tableId, branchId, { createdByName: req.user?.name })
    res.json({ success: true, orderId: result.orderId })
  } catch (err) {
    sendError(res, err)
  }
}

export const getTableOrder = async (req, res) => {
  try {
    const branchId = req.branch?.id || req.branchId || req.user?.branchId || null
    const result = await getActiveOrderForTableService(req.user.tenantId, req.params.tableId, branchId)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const tablesOverview = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) {
      return res.status(403).json({ success: false, code: 'missing_tenant', error: 'missing_tenant', message: 'Tenant required' })
    }

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
        const finalQuery = applyBranchFilter({ tenantId }, branchIds)
        console.debug('[BRANCH_FILTER]', { route: req.originalUrl, branchIds, finalQuery })
      } catch {}
    }
    const result = await getTablesOverviewService(tenantId, { branchIds })
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const close = async (req, res) => {
  try {
    const { id } = req.params
    if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        code: 'invalid_order_id',
        message: 'Geçersiz sipariş id'
      })
    }
    const { order } = await closeOrderService(req.user.tenantId, id)
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const reopen = async (req, res) => {
  try {
    const { id } = req.params
    if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, code: 'invalid_order_id', message: 'Geçersiz sipariş id' })
    }
    const result = await reopenOrderService(req.user.tenantId, id)
    return res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const closeTable = async (req, res) => {
  try {
    const branchId = req.branch?.id || req.branchId || req.user?.branchId || null
    const result = await closeTableService(req.user.tenantId, req.params.tableId, branchId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const abandonTable = async (req, res) => {
  try {
    const { tableId } = req.params
    const tenantId = req.user?.tenantId
    const branchId = req.branchId || req.branch?.id || null
    const result = await abandonIfEmpty({ tenantId, branchId, tableId })
    return res.json({ success: true, tableId, cleared: !!result?.cleared })
  } catch (err) {
    sendError(res, err)
  }
}

export const mergeTables = async (req, res) => {
  try {
    const targetTableId = String(req.params.targetTableId || '').trim()
    const sourceTableIds = Array.isArray(req.body?.sourceTableIds) ? req.body.sourceTableIds : []
    await assertTablesWithinStaffBranches(req, [targetTableId, ...sourceTableIds])
    const result = await mergeOrdersService(req.user.tenantId, req.params.targetTableId, req.body?.sourceTableIds || [])
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const transfer = async (req, res) => {
  try {
    const targetTableId = String(req.body?.targetTableId || '').trim()
    await assertTablesWithinStaffBranches(req, [targetTableId])
    try {
      logger.info('[TRANSFER_ENTRY]', {
        controller: 'posController.transfer',
        orderId: req.params.id,
        targetTableId: req.body?.targetTableId || null
      })
    } catch {}
    const result = await transferOrderService(req.user.tenantId, req.params.id, req.body?.targetTableId)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const split = async (req, res) => {
  try {
    const targetTableId = String(req.body?.targetTableId || '').trim()
    await assertTablesWithinStaffBranches(req, targetTableId ? [targetTableId] : [])
    const result = await splitOrderService(req.user.tenantId, req.params.id, req.body?.items || [], req.body?.targetTableId)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const receipt = async (req, res) => {
  try {
    const o = await Order.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
    if (!o) throw (await import('../utils/errors.js')).error('not_found', 'Order not found', 404)
    const [table, tenant] = await Promise.all([
      o.tableId ? Table.findOne({ _id: o.tableId, tenantId: req.user.tenantId }).select('name').lean() : Promise.resolve(null),
      req.tenant?.name ? Promise.resolve({ name: req.tenant.name }) : findTenantById(req.user.tenantId)
    ])
    const subtotal = Number(o.total ?? o.totals?.subtotal ?? 0)
    const discountTotal = Number(o.discountTotal ?? 0)
    const grandTotal = Number(o.netTotal ?? o.totals?.grandTotal ?? 0)
    const paidTotal = Number(o.paidTotal ?? 0)
    const balanceDue = Number(o.balanceDue ?? 0)
    const dto = {
      id: o.id,
      receiptNo: String(o.id || '').slice(-8).toUpperCase(),
      status: o.status,
      orderNo: o.orderNo ?? null,
      tableName: String(table?.name || ''),
      saleType: String(o.saleType || ''),
      customerName: String(o.customerName || ''),
      customerPhone: String(o.customerPhone || ''),
      customerAddress: String(o.customerAddress || ''),
      deliveryPaymentStatus: String(o.deliveryPaymentStatus || ''),
      deliveryPaymentMethod: String(o.deliveryPaymentMethod || ''),
      deliveryPaymentMethodLabel: String(o.deliveryPaymentMethodLabel || ''),
      createdByName: String(o.createdByName || ''),
      businessName: String(tenant?.name || 'PENPOS'),
      items: o.items,
      totals: {
        subtotal,
        discountTotal,
        grandTotal,
        paidTotal,
        balanceDue
      },
      discountPercent: Number(o.discountPercent || 0),
      discountTotal,
      paidTotal,
      balanceDue,
      netTotal: grandTotal,
      payments: Array.isArray(o.payments) ? o.payments : [],
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      note: o.note,
      createdAt: o.createdAt
    }
    res.json({ receipt: dto })
  } catch (err) {
    sendError(res, err)
  }
}

export const createWalkInOrder = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    const branchId = req.user?.branchId
    if (!tenantId) {
      return res.status(403).json({ success: false, code: 'missing_tenant', error: 'missing_tenant', message: 'Tenant required' })
    }
    if (!branchId) {
      try {
        logger.warn('MISSING_BRANCH', { userId: req.user?.id || null, tenantId: tenantId || null, route: req.path })
      } catch {}
      try {
        console.error('[MISSING_BRANCH_SOURCE]', { route: req.originalUrl, stack: new Error('MISSING_BRANCH_HIT').stack })
      } catch {}
      return res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required' })
    }

    const customerName = String(req.body?.customerName || '').trim() || 'Misafir'
    const note = String(req.body?.note || '').trim()

    const order = await createWalkInOrderService(tenantId, req.user.id, branchId, { customerName, note, createdByName: req.user?.name })
    res.json({ success: true, order })
  } catch (err) {
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ success: false, code: 'validation_error', error: 'validation_error', message: err.message })
    }
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, code: 'duplicate_key', error: 'duplicate_key', message: 'Duplicate key' })
    }
    logger.error('WALKIN_CREATE_FAIL', err?.stack || err)
    return res.status(500).json({ success: false, code: 'internal_error', error: 'internal_error', message: 'Internal Server Error' })
  }
}

export const listWalkInOrders = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) {
      return res.status(403).json({ success: false, code: 'missing_tenant', error: 'missing_tenant', message: 'Tenant required' })
    }

    const status = 'active'
    const limit = req.query?.limit
    const finalIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []

    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('[BRANCH_FILTER]', { branchIds: finalIds, query: { status, limit } })
      } catch {}
    }

    const result = await getWalkInOrdersService(tenantId, { branchIds: finalIds }, { status, limit })
    res.json({ success: true, orders: result.orders || [] })
  } catch (err) {
    sendError(res, err)
  }
}

export const createDeliveryOrder = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    const branchId = req.user?.branchId
    if (!tenantId) {
      return res.status(403).json({ success: false, code: 'missing_tenant', error: 'missing_tenant', message: 'Tenant required' })
    }
    if (!branchId) {
      try {
        logger.warn('MISSING_BRANCH', { userId: req.user?.id || null, tenantId: tenantId || null, route: req.path })
      } catch {}
      return res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required' })
    }

    const customerId = String(req.body?.customerId || '').trim()
    const customerName = String(req.body?.customerName || '').trim()
    const phone = String(req.body?.phone ?? req.body?.customerPhone ?? '').trim()
    const address = String(req.body?.address ?? req.body?.customerAddress ?? '').trim()
    const note = String(req.body?.note ?? req.body?.deliveryNote ?? '').trim()
    const deliveryPaymentStatus = String(req.body?.deliveryPaymentStatus || '').trim()
    const deliveryPaymentMethod = String(req.body?.deliveryPaymentMethod || req.body?.paymentMethod || '').trim()

    if (!customerName) {
      return res.status(400).json({ success: false, code: 'customer_name_required', error: 'customer_name_required', message: 'Customer name required' })
    }

    const order = await createDeliveryOrderService(tenantId, req.user.id, branchId, {
      customerId,
      customerName,
      phone,
      address,
      note,
      createdByName: req.user?.name,
      deliveryPaymentStatus,
      deliveryPaymentMethod
    })
    res.json({ success: true, order })
  } catch (err) {
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ success: false, code: 'validation_error', error: 'validation_error', message: err.message })
    }
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, code: 'duplicate_key', error: 'duplicate_key', message: 'Duplicate key' })
    }
    logger.error('DELIVERY_CREATE_FAIL', err?.stack || err)
    return res.status(500).json({ success: false, code: 'internal_error', error: 'internal_error', message: 'Internal Server Error' })
  }
}

export const updateDeliveryStatus = async (req, res) => {
  try {
    const body = req.body || {}
    const raw = body.deliveryStatus ?? body.status
    const next = String(raw || '').trim()
    const { order } = await updateDeliveryStatusService(
      req.user.tenantId,
      req.params.id,
      next
    )
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateDeliveryCustomer = async (req, res) => {
  try {
    const customerName = String(req.body?.customerName ?? '').trim()
    const phone = String(req.body?.phone ?? req.body?.customerPhone ?? '').trim()
    const address = String(req.body?.address ?? req.body?.customerAddress ?? '').trim()
    const deliveryPaymentStatus = String(req.body?.deliveryPaymentStatus || '').trim()
    const deliveryPaymentMethod = String(req.body?.deliveryPaymentMethod || req.body?.paymentMethod || '').trim()
    const customerId = String(req.body?.customerId || '').trim()
    const { order } = await updateDeliveryCustomerService(req.user.tenantId, req.params.id, {
      customerId,
      customerName,
      phone,
      address,
      deliveryPaymentStatus,
      deliveryPaymentMethod
    })
    res.json({ success: true, order })
  } catch (err) {
    sendError(res, err)
  }
}

export const listDeliveryOrders = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) {
      return res.status(403).json({ success: false, code: 'missing_tenant', error: 'missing_tenant', message: 'Tenant required' })
    }

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
        const finalQuery = applyBranchFilter({ tenantId }, branchIds)
        console.debug('[BRANCH_FILTER]', { route: req.originalUrl, branchIds, finalQuery })
      } catch {}
    }

    const { orders, total } = await getDeliveryOrdersService(
      tenantId,
      { branchIds },
      {
        status: req.query.status,
        from: req.query.from,
        to: req.query.to,
        page: req.query.page,
        limit: req.query.limit,
        onlyLastHours: req.query.onlyLastHours
      }
    )
    res.json({ orders, total })
  } catch (err) {
    sendError(res, err)
  }
}
