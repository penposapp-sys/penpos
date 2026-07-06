import { error } from '../utils/errors.js'
import { createOrder, findByIdAndTenant, updateById } from '../repositories/orderRepository.js'
import { findByIdAndTenant as findMenuItem } from '../repositories/menuItemRepository.js'
import Order from '../models/Order.js'
import MenuItem from '../models/MenuItem.js'
import mongoose from 'mongoose'
import CustomerAccount from '../models/CustomerAccount.js'
import AccountTransaction from '../models/AccountTransaction.js'
import Table from '../models/Table.js'
import OrderCounter from '../models/OrderCounter.js'
import Branch from '../models/Branch.js'
import Category from '../models/Category.js'
import { isMongoTransactionsSupported } from '../config/db.js'
import * as logger from '../utils/logger.js'
import User from '../models/User.js'
import { applyBranchFilter } from '../utils/branchFilter.js'
import { computePaymentSummary } from '../utils/orderFinancial.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { mergeBusinessSettings } from '../utils/businessSettings.js'
import { resolvePaymentMethodSelection } from './paymentSettingsService.js'
import { isVisibleInBranch } from '../utils/branchVisibility.js'
import { buildKitchenReceiptRaw } from '../utils/kitchenReceiptRaw.js'
import { upsertDeliveryCustomerProfile } from './deliveryCustomerService.js'

const toMoney = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const normalizeReceiptUsage = (entry = {}) => {
  const rawCashier = entry?.useForCashierReceipt
  const rawKitchen = entry?.useForKitchenReceipt
  if (typeof rawCashier === 'boolean' || typeof rawKitchen === 'boolean') {
    return {
      useForCashierReceipt: rawCashier === true,
      useForKitchenReceipt: rawKitchen === true
    }
  }
  const receiptRole = String(entry?.receiptRole || '').trim().toLowerCase()
  if (receiptRole === 'kitchen') return { useForCashierReceipt: false, useForKitchenReceipt: true }
  return { useForCashierReceipt: true, useForKitchenReceipt: false }
}

const getDeliveryPaymentLine = (order) => {
  const actualPaid = String(order?.paymentStatus || '') === 'paid'
  if (actualPaid) return 'ODEMESI ALINDI'
  const plannedStatus = String(order?.deliveryPaymentStatus || '').trim()
  if (plannedStatus === 'already_paid') return 'ODEMESI ALINDI'
  const plannedLabel = String(order?.deliveryPaymentMethodLabel || order?.deliveryPaymentMethod || '').trim()
  if (plannedStatus === 'pay_on_delivery' && plannedLabel) return `${plannedLabel} - KAPI DA ODEME`
  return ''
}

const computeCustomerAccountBalance = async (tenantId, accountId, session = null) => {
  const cursor = AccountTransaction.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(String(tenantId)),
        accountId: new mongoose.Types.ObjectId(String(accountId)),
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$type',
        sum: { $sum: '$amount' }
      }
    }
  ])
  if (session) cursor.session(session)
  const rows = await cursor
  const debit = rows.find((row) => row._id === 'debit')?.sum || 0
  const credit = rows.find((row) => row._id === 'credit')?.sum || 0
  return toMoney(debit) - toMoney(credit)
}

const computeOrderAccountChargeTotal = async (tenantId, orderId, accountId = null) => {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) return 0
  const filter = {
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    orderId: new mongoose.Types.ObjectId(String(orderId)),
    source: 'order_veresiye',
    type: 'debit',
    isDeleted: { $ne: true }
  }
  if (accountId && mongoose.Types.ObjectId.isValid(String(accountId))) {
    filter.accountId = new mongoose.Types.ObjectId(String(accountId))
  }
  const rows = await AccountTransaction.aggregate([
    { $match: filter },
    { $group: { _id: null, sum: { $sum: '$amount' } } }
  ])
  return toMoney(rows?.[0]?.sum || 0)
}

const computeOrderCollectionTotal = async (tenantId, orderId, accountId = null) => {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) return 0
  const filter = {
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    orderId: new mongoose.Types.ObjectId(String(orderId)),
    source: 'collection',
    type: 'credit',
    isDeleted: { $ne: true }
  }
  if (accountId && mongoose.Types.ObjectId.isValid(String(accountId))) {
    filter.accountId = new mongoose.Types.ObjectId(String(accountId))
  }
  const rows = await AccountTransaction.aggregate([
    { $match: filter },
    { $group: { _id: null, sum: { $sum: '$amount' } } }
  ])
  return toMoney(rows?.[0]?.sum || 0)
}

const computePersistedPaymentState = async (tenantId, order) => {
  const summary = computePaymentSummary(order)
  const collectionsTotal = await computeOrderCollectionTotal(tenantId, order?._id || order?.id || '', order?.publicCustomerAccountId || null)
  const paidTotal = toMoney((summary.paymentsTotal || 0) + (summary.veresiyeTotal || 0) + collectionsTotal)
  const balanceDue = toMoney(Math.max(0, toMoney(summary.netTotal) - paidTotal))
  const isPaid = toMoney(summary.netTotal) > 0 && balanceDue <= 0.01
  return {
    netTotal: toMoney(summary.netTotal),
    paidTotal,
    balanceDue,
    collectionsTotal,
    isPaid
  }
}

const syncPublicOnlineAccountChargeForOrder = async ({ tenantId, branchId, actorUserId, order }) => {
  if (!order) return
  if (String(order?.orderChannel || '').trim() !== 'online') return

  const accountId = String(order?.publicCustomerAccountId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(accountId)) return

  const desiredAmount = toMoney(computePaymentSummary(order).netTotal)
  const existingTx = await AccountTransaction.findOne({
    tenantId,
    orderId: order._id || order.id,
    accountId,
    source: 'order_veresiye',
    type: 'debit',
    isDeleted: { $ne: true }
  }).sort({ createdAt: 1 })
  const currentAmount = await computeOrderAccountChargeTotal(tenantId, order._id || order.id, accountId)
  const delta = toMoney(desiredAmount - currentAmount)
  if (Math.abs(delta) <= 0.009) return

  const account = await CustomerAccount.findOne({ _id: accountId, tenantId, isActive: true })
  if (!account) return

  await CustomerAccount.updateOne(
    { _id: account._id, tenantId },
    { $inc: { balance: delta } }
  )

  if (!existingTx && desiredAmount > 0) {
    await AccountTransaction.create({
      tenantId,
      branchId,
      accountId: account._id,
      type: 'debit',
      amount: desiredAmount,
      method: 'other',
      note: 'Online siparis otomatik cari borcu',
      source: 'order_veresiye',
      orderId: order._id || order.id
    })
  } else if (existingTx) {
    const nextAmount = toMoney((Number(existingTx.amount || 0) + delta))
    if (nextAmount <= 0.009) {
      existingTx.amount = 0
      existingTx.isDeleted = true
      existingTx.deletedAt = new Date()
      await existingTx.save()
    } else {
      existingTx.amount = nextAmount
      await existingTx.save()
    }
  }
  await (await import('./auditService.js')).log(tenantId, actorUserId || order?.createdBy || null, 'online_order_account_sync', 'Order', String(order?._id || order?.id || ''), { accountId, desiredAmount, delta })
}

const resolveVeresiyeTransactionFilter = (tenantId, orderId, removedEntry) => {
  const accountId = removedEntry?.accountId ? String(removedEntry.accountId) : ''
  const transactionId = removedEntry?.transactionId ? String(removedEntry.transactionId) : ''
  if (transactionId && mongoose.Types.ObjectId.isValid(transactionId)) {
    return {
      _id: new mongoose.Types.ObjectId(transactionId),
      tenantId,
      source: 'order_veresiye',
      type: 'debit',
      isDeleted: { $ne: true }
    }
  }

  const filter = {
    tenantId,
    orderId,
    accountId,
    source: 'order_veresiye',
    type: 'debit',
    isDeleted: { $ne: true }
  }
  const amount = Number(removedEntry?.amount || 0)
  if (amount > 0) filter.amount = amount
  const note = String(removedEntry?.note || '').trim()
  if (note) filter.note = note
  return filter
}

const getTenantBusinessSettings = async (tenantId) => {
  const tenant = await findTenantById(tenantId)
  return mergeBusinessSettings({
    ...(tenant?.settings || {}),
    logo: {
      ...(tenant?.settings?.logo || {}),
      url: tenant?.settings?.logo?.url || tenant?.logoUrl || '',
    },
  })
}

const maybeAutoClosePaidOrder = async (tenantId, order) => {
  const settings = await getTenantBusinessSettings(tenantId)
  const isPaid = String(order?.paymentStatus || '') === 'paid'
  if (!isPaid) return

  if (order?.saleType === 'delivery' && settings.automation.autoClosePackageOrdersAfterPayment === true) {
    const updates = {
      status: order.status === 'cancelled' ? 'closed' : 'completed',
      closedAt: order.closedAt || new Date(),
      deliveryStatus: order.deliveryStatus === 'cancelled' ? 'cancelled' : (order.deliveryStatus === 'delivered' ? 'delivered' : 'ready'),
    }
    await updateById(order.id || order._id, updates)
  }

  if (order?.tableId && settings.automation.autoClosePaidTables === true) {
    await updateById(order.id || order._id, { status: 'closed', closedAt: order.closedAt || new Date() })
    await Table.updateOne({ _id: order.tableId, tenantId }, { $set: { status: 'empty', activeOrderId: null } })
  }
}

const computeTotals = (items) => {
  const safeItems = Array.isArray(items) ? items : []
  const subtotal = safeItems
    .filter(it => it && it.status !== 'cancelled')
    .reduce((sum, it) => {
      const rawSubtotal = Number(it.subtotal)
      if (Number.isFinite(rawSubtotal)) {
        return sum + rawSubtotal
      }
      const qty = toMoney(it.qty ?? it.quantity)
      const price = toMoney(it.priceSnapshot ?? it.price)
      const fallbackSubtotal = qty * price
      return sum + toMoney(fallbackSubtotal)
    }, 0)
  const safeSubtotal = toMoney(subtotal)
  const grandTotal = toMoney(safeSubtotal)
  return { subtotal: safeSubtotal, grandTotal }
}

const splitQtyItemSnapshot = (item, overrides = {}) => {
  const base = typeof item?.toObject === 'function' ? item.toObject() : { ...item }
  return {
    ...base,
    ...overrides
  }
}

const insertSplitItemAtSourcePosition = (order, sourceItemId, nextItem) => {
  if (!order || !Array.isArray(order.items)) return
  const sourceId = String(sourceItemId || '').trim()
  const sourceIndex = order.items.findIndex((entry) => String(entry?._id || '') === sourceId)
  if (sourceIndex === -1) {
    order.items.push(nextItem)
    return
  }
  order.items.splice(sourceIndex, 0, nextItem)
}

const splitItemAroundUnitSelection = ({ order, item, selectedUnitIndex, selectedOverrides = {} }) => {
  const totalQty = Math.max(1, Number(item?.qty || 1))
  const unitIndex = Math.max(0, Math.min(totalQty - 1, Number(selectedUnitIndex || 0)))
  const unitPrice = toMoney(item?.priceSnapshot || 0)
  const sourceIndex = Array.isArray(order?.items)
    ? order.items.findIndex((entry) => String(entry?._id || '') === String(item?._id || ''))
    : -1

  if (sourceIndex === -1 || totalQty <= 1 || item?.isWeightBased) {
    Object.assign(item, selectedOverrides)
    if (selectedOverrides.qty !== undefined) item.qty = selectedOverrides.qty
    if (selectedOverrides.subtotal !== undefined) item.subtotal = selectedOverrides.subtotal
    return item
  }

  const beforeQty = unitIndex
  const afterQty = Math.max(0, totalQty - unitIndex - 1)
  const originalStatus = item.status
  const originalNote = item.note
  const originalCancelledAt = item.cancelledAt || null

  const selectedItem = splitQtyItemSnapshot(item, {
    _id: item._id,
    qty: 1,
    subtotal: unitPrice,
    status: selectedOverrides.status ?? item.status,
    note: selectedOverrides.note !== undefined ? selectedOverrides.note : originalNote,
    cancelledAt: selectedOverrides.cancelledAt !== undefined ? selectedOverrides.cancelledAt : originalCancelledAt
  })

  const replacements = []
  if (beforeQty > 0) {
    replacements.push(splitQtyItemSnapshot(item, {
      _id: new mongoose.Types.ObjectId(),
      qty: beforeQty,
      subtotal: toMoney(beforeQty * unitPrice),
      status: originalStatus,
      note: originalNote,
      cancelledAt: originalCancelledAt
    }))
  }
  replacements.push(selectedItem)
  if (afterQty > 0) {
    replacements.push(splitQtyItemSnapshot(item, {
      _id: new mongoose.Types.ObjectId(),
      qty: afterQty,
      subtotal: toMoney(afterQty * unitPrice),
      status: originalStatus,
      note: originalNote,
      cancelledAt: originalCancelledAt
    }))
  }

  order.items.splice(sourceIndex, 1, ...replacements)
  return order.items[sourceIndex + (beforeQty > 0 ? 1 : 0)] || selectedItem
}

const normalizeLegacyItemStatuses = (order) => {
  if (!order || !Array.isArray(order.items)) return
  order.items = order.items.map(it => {
    const s = it.status
    const normalized = s === 'preparing' ? 'sent' : (s === 'ready' ? 'completed' : s)
    return { ...it, status: normalized }
  })
}

const normalizeServingType = (value) => {
  if (value === undefined || value === null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const simplified = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (simplified === 'tray' || simplified === 'plate' || simplified === 'package') return simplified
  if (simplified === 'tepside') return 'tray'
  if (simplified === 'tabakta') return 'plate'
  if (simplified === 'paket') return 'package'
  return null
}

const getDefaultServingTypeForOrder = (order) => {
  return String(order?.saleType || '').trim() === 'delivery' ? 'package' : 'plate'
}

const getEffectiveServingTypeForOrder = (order) => {
  const saleType = String(order?.saleType || '').trim()
  if (saleType === 'delivery') return 'package'
  return normalizeServingType(order?.servingType) || 'plate'
}

const buildLabelTopLine = async (order) => {
  const tableName = order?.tableId
    ? String((await Table.findById(order.tableId).select('name').lean())?.name || '')
    : ''
  const customerName = String(order?.customerName || '').trim()

  if (tableName) return tableName
  if (order?.saleType === 'delivery') return customerName ? `PAKET - ${customerName}` : 'PAKET'
  if (order?.saleType === 'walkin') return customerName || 'HIZLI'
  return 'SIPARIS'
}

const enqueueOrderItemLabels = async ({ tenantId, order, items, mode, batchId = null }) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (!order || safeItems.length === 0) return

  const { findByCodeAndScope } = await import('../repositories/printProfileRepository.js')
  const { createJob, resolveActiveStationForJob, resolveStationPrinterConfig } = await import('./printingService.js')

  const labelProfile = await findByCodeAndScope('label', tenantId, 'kermes')
  const options = labelProfile?.options && typeof labelProfile.options === 'object' ? labelProfile.options : {}
  const autoPrintOnOrder = options.autoPrintOnOrder === true
  const printOnReady = options.printOnReady === true

  if (mode === 'order_send' && !autoPrintOnOrder) {
    const activeStation = await resolveActiveStationForJob({ tenantId, system: 'kermes', jobType: 'label', jobMeta: { triggerMode: 'order_send' } })
    const hasStationLabelRule = Array.isArray(activeStation?.printers) && activeStation.printers.some((entry) => entry?.printerType === 'label' && entry?.isActive !== false && entry?.autoPrintOnOrder === true)
    if (!hasStationLabelRule) return
  }
  if (mode === 'item_ready' && !printOnReady) {
    const activeStation = await resolveActiveStationForJob({ tenantId, system: 'kermes', jobType: 'label', jobMeta: { triggerMode: 'item_ready' } })
    const hasStationLabelRule = Array.isArray(activeStation?.printers) && activeStation.printers.some((entry) => entry?.printerType === 'label' && entry?.isActive !== false && entry?.printOnReady === true)
    if (!hasStationLabelRule) return
  }

  const menuItemIds = safeItems
    .map((it) => String(it?.menuItemId || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))

  const labelCandidateDocs = menuItemIds.length > 0
    ? await MenuItem.find({ tenantId, _id: { $in: menuItemIds } }).select('_id categoryId printLabelEnabled').lean()
    : []

  const labelCandidateMap = new Map((labelCandidateDocs || []).map((doc) => [
    String(doc?._id || ''),
    {
      categoryId: String(doc?.categoryId || ''),
      printLabelEnabled: doc?.printLabelEnabled === true
    }
  ]))
  const labelItems = safeItems.filter((it) => labelCandidateMap.has(String(it?.menuItemId || '')))
  if (labelItems.length === 0) return

  const top = await buildLabelTopLine(order)
  for (const it of labelItems) {
    const itemConfig = labelCandidateMap.get(String(it?.menuItemId || '')) || { categoryId: '', printLabelEnabled: false }
    const categoryId = String(itemConfig.categoryId || '')
    const activeStation = await resolveActiveStationForJob({
      tenantId,
      system: 'kermes',
      jobType: 'label',
      jobMeta: { categoryId, triggerMode: mode }
    })
    const stationPrinter = activeStation
      ? resolveStationPrinterConfig({
          station: activeStation,
          jobType: 'label',
          jobMeta: { categoryId },
          triggerMode: mode
        })
      : null
    if (itemConfig.printLabelEnabled !== true && !stationPrinter) continue
    if (activeStation && !stationPrinter) continue
    const name = String(it?.nameSnapshot || '').trim() || '-'
    const qty = Math.max(1, Number(it?.qty || 1))
    const weightGrams = Math.max(0, Number(it?.weightGrams || 0))
    const isWeightBased = it?.isWeightBased === true || weightGrams > 0
    const amountLine = isWeightBased && weightGrams > 0 ? `${weightGrams} GR` : `${qty} ADET`
    const noteLine = String(it?.note || '').trim()
    const payload = `${top}\n${name}\n${amountLine}\n${noteLine ? `${noteLine}` : ''}\n`

    await createJob(tenantId, 'kermes', order.createdByUserId || order.createdBy, {
      type: 'label',
      profileId: labelProfile && labelProfile.isActive !== false ? String(labelProfile.id) : undefined,
      payload: { type: 'raw', content: payload },
      meta: {
        orderId: String(order.id),
        tableId: order.tableId ? String(order.tableId) : null,
        kitchenBatchId: batchId ? String(batchId) : (it?.kitchenBatchId ? String(it.kitchenBatchId) : null),
        menuItemId: it?.menuItemId ? String(it.menuItemId) : null,
        categoryId: categoryId || null,
        itemId: it?._id ? String(it._id) : null,
        qty,
        triggerMode: mode
      }
    })
  }
}

const normalizePrinterCategoryIds = (value) => Array.isArray(value)
  ? value.map(String).filter(Boolean)
  : []

const enqueueKitchenReceiptJobs = async ({ tenantId, order, items, batchId }) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (!order || safeItems.length === 0) return

  try {
    const { listActiveByTenantAndSystem } = await import('../repositories/printStationRepository.js')
    const { createJob } = await import('./printingService.js')
    const stations = await listActiveByTenantAndSystem(tenantId, 'kermes')
    const kitchenPrinters = []

    for (const station of (stations || [])) {
      const stationPrinters = Array.isArray(station?.printers) ? station.printers : []
      for (const printer of stationPrinters) {
        if (!printer || printer.isActive === false) continue
        if (String(printer.printerType || '') !== 'receipt') continue
        const receiptUsage = normalizeReceiptUsage(printer)
        if (receiptUsage.useForKitchenReceipt !== true) continue
        kitchenPrinters.push({
          stationId: String(station.id || station._id || ''),
          stationName: String(station.name || ''),
          printerId: String(printer._id || printer.id || ''),
          printerName: String(printer.name || ''),
          copies: Math.max(1, Math.min(10, Number(printer.copies || 1) || 1)),
          receiptWidthMm: Math.max(58, Number(printer.receiptWidthMm || 80) || 80),
          categoryIds: normalizePrinterCategoryIds(printer.categoryIds)
        })
      }
    }

    if (kitchenPrinters.length === 0) return

    const specificPrinters = kitchenPrinters.filter((printer) => printer.categoryIds.length > 0)
    const wildcardPrinters = kitchenPrinters.filter((printer) => printer.categoryIds.length === 0)
    const groupedByPrinterKey = new Map()
    const specificallyAssignedItemIds = new Set()

    const pushPrinterItems = (printer, selectedItems) => {
      if (!printer?.printerId || !Array.isArray(selectedItems) || selectedItems.length === 0) return
      const key = `${printer.stationId}:${printer.printerId}`
      const prev = groupedByPrinterKey.get(key) || { printer, items: [] }
      prev.items.push(...selectedItems)
      groupedByPrinterKey.set(key, prev)
    }

    for (const item of safeItems) {
      const categoryId = String(item?.categoryId || '').trim()
      const matchingPrinter = specificPrinters.find((printer) => categoryId && printer.categoryIds.includes(categoryId))
      if (!matchingPrinter) continue
      specificallyAssignedItemIds.add(String(item?._id || ''))
      pushPrinterItems(matchingPrinter, [item])
    }

    const wildcardItems = safeItems.filter((item) => !specificallyAssignedItemIds.has(String(item?._id || '')))
    if (wildcardItems.length > 0) {
      for (const printer of wildcardPrinters) {
        pushPrinterItems(printer, wildcardItems)
      }
    }

    if (groupedByPrinterKey.size === 0) return

    const tableName = order?.tableId
      ? String((await Table.findById(order.tableId).select('name').lean())?.name || '')
      : ''
    const printedItemIds = new Set()

    for (const { printer, items: groupedItems } of groupedByPrinterKey.values()) {
      if (!Array.isArray(groupedItems) || groupedItems.length === 0) continue
      try {
        const payload = buildKitchenReceiptRaw(order, groupedItems, {
          tableName,
          createdByName: order?.createdByName || order?.createdByUserName || '',
          orderNote: order?.note || '',
          createdAt: order?.updatedAt || order?.createdAt,
          customerName: order?.customerName || '',
          customerPhone: order?.customerPhone || '',
          customerAddress: order?.customerAddress || '',
          paymentLine: getDeliveryPaymentLine(order)
        })
        await createJob(tenantId, 'kermes', order.createdByUserId || order.createdBy, {
          type: 'receipt',
          stationId: printer.stationId,
          payload: { type: 'raw', content: payload.raw },
          meta: {
            orderId: String(order.id),
            tableId: order.tableId ? String(order.tableId) : null,
            kitchenBatchId: batchId ? String(batchId) : null,
            receiptRole: 'kitchen',
            stationPrinterId: printer.printerId,
            categoryIds: printer.categoryIds,
            itemIds: groupedItems.map((item) => String(item?._id || '')).filter(Boolean),
            copies: printer.copies,
            thermalVariants: payload.thermalVariants,
            triggerMode: 'order_send',
            kitchenReceipt: true
          }
        })
        for (const item of groupedItems) {
          const itemId = String(item?._id || '')
          if (itemId) printedItemIds.add(itemId)
        }
      } catch (jobError) {
        logger.error('[KITCHEN_RECEIPT_QUEUE_FAILED]', {
          orderId: String(order.id || ''),
          batchId: String(batchId || ''),
          stationId: printer.stationId,
          stationPrinterId: printer.printerId,
          printerName: printer.printerName,
          message: String(jobError?.message || jobError || '')
        })
      }
    }

    if (printedItemIds.size === 0) return
    const now = new Date()
    let changed = false
    for (const item of order.items || []) {
      const itemId = String(item?._id || '')
      if (!itemId || !printedItemIds.has(itemId)) continue
      item.kitchenPrintedAt = now
      changed = true
    }
    if (changed) await order.save()
  } catch (err) {
    logger.error('[KITCHEN_RECEIPT_AUTO_PRINT_FAILED]', {
      orderId: String(order?.id || ''),
      batchId: String(batchId || ''),
      message: String(err?.message || err || '')
    })
  }
}

const normalizeKitchenItemIds = (itemIds = []) => Array.isArray(itemIds)
  ? itemIds.map((id) => String(id || '').trim()).filter((id) => mongoose.Types.ObjectId.isValid(id))
  : []

const normalizeOpenDuplicatesForResponse = (items) => {
  const src = Array.isArray(items) ? items : []
  const map = new Map()
  for (const it of src) {
    if (!it || it.status !== 'open') continue
    const key = `${String(it.menuItemId)}|${String(it.note || '')}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...it, qty: Number(it.qty) || 0, subtotal: Number(it.subtotal) || 0 })
    } else {
      prev.qty += Number(it.qty) || 0
      prev.subtotal += Number(it.subtotal) || 0
      map.set(key, prev)
    }
  }

  const used = new Set()
  const out = []
  for (const it of src) {
    if (!it) continue
    if (it.status !== 'open') {
      out.push(it)
      continue
    }
    const key = `${String(it.menuItemId)}|${String(it.note || '')}`
    if (used.has(key)) continue
    used.add(key)
    out.push(map.get(key))
  }
  return out
}

export const buildOrderDayKey = (date) => {
  const d = date instanceof Date ? date : new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const getNextOrderSequence = async (tenantId, branchId) => {
  const now = new Date()
  const dayKey = buildOrderDayKey(now)
  if (!branchId) {
    const e = new Error('Branch required')
    e.status = 400
    e.payload = { error: 'branch_required', code: 'branch_required', message: 'Branch required' }
    throw e
  }

  const run = async () => {
    const counter = await OrderCounter.findOneAndUpdate(
      { tenantId, dayKey },
      { $inc: { seq: 1 }, $setOnInsert: { tenantId, dayKey, branchId, createdAt: now } },
      { upsert: true, new: true }
    ).lean()
    return { orderDayKey: dayKey, orderNo: Number(counter?.seq) || 1 }
  }

  try {
    return await run()
  } catch (e) {
    if (e && e.code === 11000) {
      return await run()
    }
    throw e
  }
}

const decorateOrder = (order) => {
  if (!order) return order
  const base = typeof order.toObject === 'function' ? order.toObject({ virtuals: true }) : { ...order }
  const summary = computePaymentSummary(base)
  const totals = base.totals || {}
  const paymentStatus = summary.netTotal > 0 && summary.balanceDue <= 0.01 ? 'paid' : 'unpaid'
  return {
    ...base,
    totals: {
      ...totals,
      total: summary.total,
      discountTotal: summary.discountTotal,
      netTotal: summary.netTotal,
      paidTotal: summary.paidTotal,
      balanceDue: summary.balanceDue,
      grandTotal: summary.netTotal
    },
    total: summary.total,
    discountTotal: summary.discountTotal,
    netTotal: summary.netTotal,
    paidTotal: summary.paidTotal,
    balanceDue: summary.balanceDue,
    paymentStatus
  }
}

export const createOrderService = async (tenantId, userId, branchId, { createdByName } = {}) => {
  const safeCreatedByName = String(createdByName || '').trim()
  const branchDoc = branchId ? await Branch.findOne({ _id: branchId, tenantId }).select('name').lean() : null
  const order = await createOrder({
    tenantId,
    branchId: branchId || null,
    branchName: String(branchDoc?.name || ''),
    createdBy: userId,
    createdByUserId: userId,
    createdByUserName: safeCreatedByName,
    createdByName: safeCreatedByName,
    items: [],
    status: 'open',
    totals: { subtotal: 0, grandTotal: 0 }
  })
  await (await import('./auditService.js')).log(tenantId, userId, 'order_create', 'Order', order.id, {})
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    totals: order.totals,
    note: order.note,
    orderNo: order.orderNo,
    orderDayKey: order.orderDayKey
  }
}

export const createWalkInOrderService = async (tenantId, userId, branchId, { customerName, note, createdByName } = {}) => {
  const safeCustomerName = (String(customerName || '').trim().slice(0, 40)) || 'Misafir'
  const safeNote = String(note || '').trim()
  const safeCreatedByName = String(createdByName || '').trim()
  const branchDoc = branchId ? await Branch.findOne({ _id: branchId, tenantId }).select('name').lean() : null
  const order = await createOrder({
    tenantId,
    branchId,
    branchName: String(branchDoc?.name || ''),
    createdBy: userId,
    createdByUserId: userId,
    createdByUserName: safeCreatedByName,
    createdByName: safeCreatedByName,
    items: [],
    status: 'open',
    totals: { subtotal: 0, grandTotal: 0 },
    saleType: 'walkin',
    customerName: safeCustomerName,
    note: safeNote,
    paymentStatus: 'unpaid'
  })
  await (await import('./auditService.js')).log(tenantId, userId, 'order_create_walkin', 'Order', order.id, { customerName: safeCustomerName })
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    totals: order.totals,
    note: order.note,
    saleType: order.saleType,
    customerName: order.customerName,
    orderNo: order.orderNo,
    orderDayKey: order.orderDayKey
  }
}

export const getWalkInOrdersService = async (tenantId, branchFilter, { status = 'active', limit = 50 } = {}) => {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50))
  let branchId = null
  let branchIds = []
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    branchId = branchFilter.branchId || null
    branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
  } else {
    branchId = branchFilter || null
  }
  let filter = {
    tenantId,
    saleType: 'walkin',
  }
  filter = applyBranchFilter(filter, branchIds.length > 0 ? branchIds : (branchId ? [branchId] : []))

  if (status === 'active') {
    filter.status = { $in: ['open', 'sent'] }
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean()
  const dto = (orders || []).map(o => {
    const items = Array.isArray(o?.items) ? o.items : []
    const hasSent = items.some(it => it?.status === 'sent')
    const hasCompleted = items.some(it => it?.status === 'completed')
    const hasOpen = items.some(it => it?.status === 'open')
    let uiStatus = 'open'
    if (hasSent) uiStatus = 'sent'
    else if (hasCompleted) uiStatus = 'ready'
    else if (hasOpen) uiStatus = 'open'
    else uiStatus = 'open'
    const uiStatusLabel = uiStatus === 'sent' ? 'Hazırlanıyor' : uiStatus === 'ready' ? 'Hazır' : 'Bekliyor'
    const d = decorateOrder(o)
    return {
      _id: d._id || d.id,
      customerName: d.customerName || '',
      orderNo: d.orderNo ?? null,
      orderDayKey: d.orderDayKey || '',
      createdAt: d.createdAt,
      status: d.status,
      uiStatus,
      uiStatusLabel,
      paymentStatus: d.paymentStatus,
      totals: {
        total: Number(d.total ?? d.totals?.total ?? 0),
        grandTotal: Number(d.totals?.grandTotal ?? d.netTotal ?? 0),
        netTotal: Number(d.netTotal ?? d.totals?.netTotal ?? 0),
        paidTotal: Number(d.paidTotal ?? d.totals?.paidTotal ?? 0),
        balanceDue: Number(d.balanceDue ?? d.totals?.balanceDue ?? 0),
      }
    }
  })
  return { orders: dto }
}

export const createDeliveryOrderService = async (tenantId, userId, branchId, { customerId, customerName, phone, address, note, createdByName, deliveryPaymentStatus, deliveryPaymentMethod } = {}) => {
  const safeCustomerName = String(customerName || '').trim()
  const safePhone = String(phone || '').trim()
  const safeAddress = String(address || '').trim()
  const safeNote = String(note || '').trim()
  const safeCreatedByName = String(createdByName || '').trim()
  const safeDeliveryPaymentStatus = String(deliveryPaymentStatus || '').trim() === 'already_paid'
    ? 'already_paid'
    : (String(deliveryPaymentStatus || '').trim() === 'pay_on_delivery' ? 'pay_on_delivery' : 'unknown')
  const resolvedPlannedMethod = safeDeliveryPaymentStatus === 'pay_on_delivery' && String(deliveryPaymentMethod || '').trim()
    ? await resolvePaymentMethodSelection(tenantId, branchId, deliveryPaymentMethod)
    : null
  const deliveryCustomer = await upsertDeliveryCustomerProfile(tenantId, {
    customerId,
    branchId,
    name: safeCustomerName,
    phone: safePhone,
    address: safeAddress,
    note: safeNote,
    lastOrderAt: new Date()
  })
  const branchDoc = branchId ? await Branch.findOne({ _id: branchId, tenantId }).select('name').lean() : null
  const order = await createOrder({
    tenantId,
    branchId,
    branchName: String(branchDoc?.name || ''),
    createdBy: userId,
    createdByUserId: userId,
    createdByUserName: safeCreatedByName,
    createdByName: safeCreatedByName,
    items: [],
    status: 'open',
    totals: { subtotal: 0, grandTotal: 0 },
    saleType: 'delivery',
    deliveryType: 'package',
    deliveryCustomerId: deliveryCustomer?._id || null,
    customerName: safeCustomerName,
    customerPhone: safePhone,
    customerAddress: safeAddress,
    deliveryNote: safeNote,
    note: safeNote,
    deliveryAddress: {
      fullName: safeCustomerName,
      phone: safePhone,
      addressText: safeAddress,
      note: safeNote
    },
    deliveryPaymentStatus: safeDeliveryPaymentStatus,
    deliveryPaymentMethod: resolvedPlannedMethod?.methodId || '',
    deliveryPaymentMethodLabel: resolvedPlannedMethod?.methodLabel || '',
    deliveryStatus: 'pending',
    paymentStatus: 'unpaid'
  })
  await (await import('./auditService.js')).log(tenantId, userId, 'order_create_delivery', 'Order', order.id, { customerName: safeCustomerName })
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    totals: order.totals,
    note: order.note,
    saleType: order.saleType,
    deliveryCustomerId: order.deliveryCustomerId ? String(order.deliveryCustomerId) : null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    deliveryNote: order.deliveryNote,
    deliveryPaymentStatus: order.deliveryPaymentStatus,
    deliveryPaymentMethod: order.deliveryPaymentMethod,
    deliveryPaymentMethodLabel: order.deliveryPaymentMethodLabel,
    deliveryStatus: order.deliveryStatus,
    orderNo: order.orderNo,
    orderDayKey: order.orderDayKey
  }
}

const resolvePublicOrderActor = async (tenantId, branchId) => {
  const safeBranchId = String(branchId || '').trim()
  const users = await User.find({
    tenantId,
    isDeleted: { $ne: true },
    isActive: true,
    role: { $in: ['tenant_admin', 'staff'] }
  })
    .select('_id role name branchId branchIds accessibleBranchIds')
    .sort({ role: 1, createdAt: 1 })
    .lean()

  if (!Array.isArray(users) || users.length === 0) {
    throw error('public_order_actor_missing', 'Public siparis icin aktif kullanici bulunamadi', 400)
  }

  const branchMatched = safeBranchId
    ? users.find((user) => {
        if (String(user?.role || '') === 'tenant_admin') return true
        const userBranchIds = [
          ...(Array.isArray(user?.accessibleBranchIds) ? user.accessibleBranchIds : []),
          ...(Array.isArray(user?.branchIds) ? user.branchIds : []),
          user?.branchId,
        ].map(String).filter(Boolean)
        return userBranchIds.includes(safeBranchId)
      })
    : null

  const actor = branchMatched || users[0]
  return {
    userId: String(actor?._id || ''),
    userName: String(actor?.name || 'Online Siparis').trim() || 'Online Siparis'
  }
}

export const createPublicOnlineOrderService = async (
  tenantId,
  {
    branchId,
    customerId,
    customerName,
    customerLocation,
    phone,
    address,
    note,
    items,
    deliveryPaymentStatus,
    deliveryPaymentMethod
  } = {}
) => {
  const resolvePortionSelection = (menuItem, portionKeyRaw) => {
    const portionKey = String(portionKeyRaw || 'full').trim().toLowerCase()
    const settings = menuItem?.settings && typeof menuItem.settings === 'object' && !Array.isArray(menuItem.settings)
      ? menuItem.settings
      : {}
    if (!portionKey || portionKey === 'full') {
      return {
        portionKey: 'full',
        nameOverride: String(menuItem?.name || ''),
        priceOverride: Number(menuItem?.price || 0)
      }
    }
    if (portionKey === 'half') {
      if (settings.halfPortionEnabled !== true) throw error('invalid_portion', 'Secilen porsiyon bu urun icin kullanilamiyor', 400)
      return {
        portionKey,
        nameOverride: `${String(menuItem?.name || '')} (Yarim Porsiyon)`,
        priceOverride: Number(settings.halfPortionPrice || 0)
      }
    }
    if (portionKey === 'one_and_half') {
      if (settings.oneAndHalfPortionEnabled !== true) throw error('invalid_portion', 'Secilen porsiyon bu urun icin kullanilamiyor', 400)
      return {
        portionKey,
        nameOverride: `${String(menuItem?.name || '')} (Bir Bucuk Porsiyon)`,
        priceOverride: Number(settings.oneAndHalfPortionPrice || 0)
      }
    }
    throw error('invalid_portion', 'Secilen porsiyon gecersiz', 400)
  }

  const safeItems = Array.isArray(items) ? items : []
  if (safeItems.length === 0) throw error('items_required', 'Sipariste en az bir urun olmali', 400)

  const normalizedItems = []
  for (const row of safeItems) {
    const menuItemId = String(row?.menuItemId || '').trim()
    const quantity = Math.max(1, Number(row?.quantity || 1))
    const note = String(row?.note || '').trim()
    const rawWeightGrams = row?.weightGrams
    if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
      throw error('invalid_menu_item', 'Gecersiz urun secimi', 400)
    }
    const menuItem = await findMenuItem(menuItemId, tenantId)
    if (!menuItem || menuItem.isDeleted === true || menuItem.isActive === false || menuItem.active === false) {
      throw error('menu_item_not_found', 'Secilen urun aktif degil', 404)
    }
    if (branchId && isVisibleInBranch(menuItem, branchId) === false) {
      throw error('menu_item_branch_hidden', 'Secilen urun bu subede kullanilamiyor', 400)
    }
    const portion = resolvePortionSelection(menuItem, row?.portionKey)
    const weightGrams = rawWeightGrams === undefined || rawWeightGrams === null || rawWeightGrams === ''
      ? null
      : Math.round(Number(rawWeightGrams))
    if (menuItem?.isWeightBased === true && (!Number.isFinite(weightGrams) || weightGrams <= 0)) {
      throw error('invalid_weight', 'Gram bilgisi gerekli', 400)
    }
    normalizedItems.push({
      menuItemId,
      quantity,
      note,
      weightGrams,
      portionKey: portion.portionKey,
      nameOverride: portion.nameOverride,
      priceOverride: portion.priceOverride
    })
  }

  const actor = await resolvePublicOrderActor(tenantId, branchId)
  const safeCustomerId = String(customerId || '').trim()
  const publicCustomer = safeCustomerId && mongoose.Types.ObjectId.isValid(safeCustomerId)
    ? await CustomerAccount.findOne({ _id: safeCustomerId, tenantId, branchId, isActive: true }).lean()
    : null
  const safeCustomerName = String(customerName || publicCustomer?.name || '').trim()
  const safePhone = String(phone || publicCustomer?.phone || '').trim()
  const safeAddress = String(address || publicCustomer?.address || '').trim()
  const safeCustomerLocation = String(customerLocation || publicCustomer?.publicLocation || '').trim()
  const baseOrder = await createDeliveryOrderService(tenantId, actor.userId, branchId, {
    customerName: safeCustomerName,
    phone: safePhone,
    address: safeAddress,
    note,
    createdByName: actor.userName,
    deliveryPaymentStatus,
    deliveryPaymentMethod
  })

  let lastOrder = null
  for (const row of normalizedItems) {
    const menuItemId = String(row?.menuItemId || '').trim()
    const quantity = Math.max(1, Number(row?.quantity || 1))
    const shouldCreateSeparately = !!(row?.weightGrams || row?.note || row?.portionKey !== 'full')
    if (shouldCreateSeparately) {
      for (let index = 0; index < quantity; index += 1) {
        const result = await addItemService(tenantId, baseOrder.id, menuItemId, {
          quantity: 1,
          weightGrams: row?.weightGrams,
          note: row?.note,
          nameOverride: row?.nameOverride,
          priceOverride: row?.priceOverride
        })
        lastOrder = result?.order || lastOrder
      }
      continue
    }
    const result = await addItemService(tenantId, baseOrder.id, menuItemId, {
      quantity,
      note: row?.note,
      nameOverride: row?.nameOverride,
      priceOverride: row?.priceOverride
    })
    lastOrder = result?.order || lastOrder
  }

  await Order.updateOne(
    { _id: baseOrder.id, tenantId },
    {
      $set: {
        orderChannel: 'online',
        approvalStatus: 'pending',
        publicCustomerAccountId: publicCustomer?._id || null,
        publicCustomerLocation: safeCustomerLocation,
        customerName: safeCustomerName,
        customerPhone: safePhone,
        customerAddress: safeAddress,
        deliveryStatus: 'pending',
        deliveryPaymentStatus: publicCustomer?._id ? 'veresiye' : 'odeme_bekliyor',
        kitchenEnabled: false,
        sendToKitchen: false
      }
    }
  )

  const fresh = await Order.findById(baseOrder.id).lean()
  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId,
    actorUserId: actor.userId,
    order: fresh
  })
  const finalOrder = await Order.findById(baseOrder.id).lean()
  lastOrder = decorateOrder(finalOrder)

  return { order: lastOrder }
}

export const updateDeliveryStatusService = async (tenantId, id, deliveryStatus) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (order.saleType !== 'delivery') throw error('invalid_request', 'Not a delivery order', 400)

  const next = String(deliveryStatus || '').trim()
  const allowed = new Set(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'])
  if (!allowed.has(next)) {
    throw error('invalid_request', 'Invalid delivery status', 400)
  }

  const updates = { deliveryStatus: next }
  if (next === 'delivered') {
    const now = new Date()
    updates.deliveryAt = now
    updates.deliveredAt = now

    const fin = computePaymentSummary(order)
    const canClose = fin.netTotal <= 0 || fin.balanceDue <= 0.01
    if (canClose) {
      updates.status = order.status === 'cancelled' ? 'closed' : 'completed'
      updates.closedAt = order.closedAt || now
      updates.paymentStatus = 'paid'
      updates.paidAt = order.paidAt || now
    }
  }

  const updated = await updateById(id, updates)
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_delivery_status', 'Order', updated.id, { deliveryStatus: next })
  const fresh = await Order.findById(updated.id).lean()
  const dto = decorateOrder(fresh)
  return { order: dto }
}

export const updateDeliveryCustomerService = async (tenantId, id, { customerId, customerName, phone, address, deliveryPaymentStatus, deliveryPaymentMethod } = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (order.saleType !== 'delivery') throw error('invalid_request', 'Not a delivery order', 400)

  const safeCustomerName = (String(customerName || '').trim().slice(0, 40))
  if (!safeCustomerName) throw error('invalid_request', 'Customer name required', 400)
  const safePhone = String(phone ?? '').trim().slice(0, 30)
  const safeAddress = String(address ?? '').trim().slice(0, 200)

  order.customerName = safeCustomerName
  order.customerPhone = safePhone
  order.customerAddress = safeAddress
  order.deliveryType = 'package'
  order.deliveryAddress = {
    ...(order.deliveryAddress && typeof order.deliveryAddress === 'object' ? order.deliveryAddress.toObject?.() || order.deliveryAddress : {}),
    fullName: safeCustomerName,
    phone: safePhone,
    addressText: safeAddress,
    note: order.deliveryNote || order.note || ''
  }
  const safeDeliveryPaymentStatus = String(deliveryPaymentStatus || '').trim()
  if (safeDeliveryPaymentStatus === 'already_paid' || safeDeliveryPaymentStatus === 'pay_on_delivery' || safeDeliveryPaymentStatus === 'unknown') {
    order.deliveryPaymentStatus = safeDeliveryPaymentStatus
    if (safeDeliveryPaymentStatus === 'pay_on_delivery' && String(deliveryPaymentMethod || '').trim()) {
      const resolvedMethod = await resolvePaymentMethodSelection(tenantId, order.branchId, deliveryPaymentMethod)
      order.deliveryPaymentMethod = resolvedMethod.methodId
      order.deliveryPaymentMethodLabel = resolvedMethod.methodLabel
    } else if (safeDeliveryPaymentStatus !== 'pay_on_delivery') {
      order.deliveryPaymentMethod = ''
      order.deliveryPaymentMethodLabel = ''
    }
  }
  const deliveryCustomer = await upsertDeliveryCustomerProfile(tenantId, {
    customerId: customerId || order.deliveryCustomerId,
    branchId: order.branchId,
    name: safeCustomerName,
    phone: safePhone,
    address: safeAddress,
    note: order.deliveryNote || order.note || '',
    lastOrderAt: order.createdAt || new Date()
  })
  order.deliveryCustomerId = deliveryCustomer?._id || order.deliveryCustomerId || null
  await order.save()

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_delivery_customer_update', 'Order', order.id, { customerName: safeCustomerName })

  const fresh = await Order.findById(order.id).lean()
  const dto = decorateOrder(fresh)
  return { order: dto }
}

export const getDeliveryOrdersService = async (tenantId, branchFilter, { status, from, to, page = 1, limit, onlyLastHours } = {}) => {
  let branchId = null
  let branchIds = []
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    branchId = branchFilter.branchId || null
    branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
  } else {
    branchId = branchFilter || null
  }
  let filter = {
    tenantId,
    saleType: 'delivery',
  }
  filter = applyBranchFilter(filter, branchIds.length > 0 ? branchIds : (branchId ? [branchId] : []))

  const s = String(status || '').trim()
  if (!s || s === 'active') {
    filter.deliveryStatus = { $in: ['pending', 'accepted', 'preparing', 'ready', 'yeni', 'hazirlaniyor', 'kuryeye_atandi', 'yola_cikti'] }
    filter.status = { $nin: ['cancelled', 'closed'] }
  } else if (s === 'delivered') {
    filter.deliveryStatus = { $in: ['delivered', 'teslim_edildi'] }
  } else if (s === 'cancelled') {
    filter.deliveryStatus = { $in: ['cancelled', 'iptal_edildi', 'musteriyi_bulamadi', 'adreste_yok', 'geri_dondu'] }
  } else {
    filter.deliveryStatus = s
  }

  const safeOnlyLastHours = Math.max(0, Math.min(24 * 14, Number(onlyLastHours) || 0))
  if (safeOnlyLastHours > 0 && (s === 'delivered')) {
    const cutoff = new Date(Date.now() - safeOnlyLastHours * 60 * 60 * 1000)
    filter.$or = [
      { deliveredAt: { $gte: cutoff } },
      { deliveredAt: null, deliveryAt: { $gte: cutoff } }
    ]
  }

  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }

  const defaultLimit = s === 'delivered' ? 50 : 20
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || defaultLimit))
  const safePage = Math.max(1, Number(page) || 1)
  const skip = (safePage - 1) * safeLimit

  const sort = s === 'delivered'
    ? { deliveredAt: -1, deliveryAt: -1, updatedAt: -1 }
    : { createdAt: -1 }

  const [rawOrders, total] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(safeLimit).lean(),
    Order.countDocuments(filter)
  ])

  const orderIds = rawOrders
    .map((order) => String(order?._id || order?.id || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))

  let collectionsByOrderId = new Map()
  if (orderIds.length > 0) {
    const collectionRows = await AccountTransaction.find({
      tenantId,
      orderId: { $in: orderIds.map((id) => new mongoose.Types.ObjectId(id)) },
      source: 'collection',
      type: 'credit',
      isDeleted: { $ne: true }
    })
      .select('_id orderId amount method methodId methodLabel methodName methodBucket methodType note createdAt')
      .lean()

    collectionsByOrderId = new Map()
    for (const row of collectionRows) {
      const key = String(row?.orderId || '').trim()
      if (!key) continue
      const current = collectionsByOrderId.get(key) || []
      current.push({
        id: String(row?._id || ''),
        amount: Number(row?.amount || 0) || 0,
        method: String(row?.method || 'other'),
        methodId: String(row?.methodId || ''),
        methodLabel: String(row?.methodLabel || row?.method || ''),
        methodName: String(row?.methodName || ''),
        methodBucket: String(row?.methodBucket || ''),
        methodType: String(row?.methodType || ''),
        note: String(row?.note || ''),
        createdAt: row?.createdAt || null,
        source: 'collection'
      })
      collectionsByOrderId.set(key, current)
    }
  }

  const orders = rawOrders.map((order) => {
    const decorated = decorateOrder({
      ...order,
      collectionEntries: collectionsByOrderId.get(String(order?._id || order?.id || '').trim()) || []
    })
    return {
      ...decorated,
      paidTotal: Number(decorated?.paidTotal ?? decorated?.totals?.paidTotal ?? 0),
      balanceDue: Number(decorated?.balanceDue ?? decorated?.totals?.balanceDue ?? 0)
    }
  })

  return { orders, total }
}

export const getOrderService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (order.cancelAlertActive === true) {
    order.cancelAlertActive = false
    await order.save()
  }
  const rawCollections = await AccountTransaction.find({
    tenantId,
    orderId: order._id,
    source: 'collection',
    type: 'credit',
    isDeleted: { $ne: true }
  }).sort({ createdAt: -1 }).lean()

  const accountIds = Array.from(new Set((rawCollections || []).map(t => String(t?.accountId || '')).filter(Boolean)))
  const accounts = accountIds.length > 0
    ? await CustomerAccount.find({ tenantId, _id: { $in: accountIds } }).select('_id name').lean()
    : []
  const accountNameById = new Map((accounts || []).map(a => [String(a?._id), String(a?.name || '').trim()]))

  const linkedCollections = (rawCollections || []).map((t) => ({
    id: String(t?._id),
    amount: Number(t?.amount) || 0,
    method: String(t?.method || 'other'),
    methodLabel: String(t?.methodLabel || t?.method || ''),
    methodBucket: String(t?.methodBucket || ''),
    note: String(t?.note || ''),
    accountId: String(t?.accountId || ''),
    accountName: accountNameById.get(String(t?.accountId || '')) || '',
    createdAt: t?.createdAt || null,
    source: 'collection'
  }))

  const obj = decorateOrder({
    ...(typeof order.toObject === 'function' ? order.toObject({ virtuals: true }) : { ...order }),
    collectionEntries: linkedCollections
  })
  const actor = await User.findById(obj.createdBy).select('name').lean()
  const createdByUser = actor ? { id: String(obj.createdBy), name: actor.name } : { id: String(obj.createdBy), name: '' }
  const normalizedItems = normalizeOpenDuplicatesForResponse(obj.items)
  return {
    id: obj.id,
    tableId: obj.tableId,
    status: obj.status,
    items: normalizedItems,
    totals: obj.totals,
    note: obj.note,
    mergeSourceOrderIds: obj.mergeSourceOrderIds || [],
    saleType: obj.saleType,
    deliveryCustomerId: obj.deliveryCustomerId ? String(obj.deliveryCustomerId) : null,
    customerName: obj.customerName,
    kitchenEnabled: obj.kitchenEnabled,
    sendToKitchen: obj.sendToKitchen,
    customerPhone: obj.customerPhone,
    customerAddress: obj.customerAddress,
    deliveryNote: obj.deliveryNote,
    deliveryPaymentStatus: obj.deliveryPaymentStatus || 'unknown',
    deliveryPaymentMethod: obj.deliveryPaymentMethod || '',
    deliveryPaymentMethodLabel: obj.deliveryPaymentMethodLabel || '',
    deliveryStatus: obj.deliveryStatus,
    deliveryAt: obj.deliveryAt,
    servingType: getEffectiveServingTypeForOrder(obj),
    servingTypeUpdatedAt: obj.servingTypeUpdatedAt ?? null,
    discountPercent: obj.discountPercent || 0,
    payments: obj.payments || [],
    paymentStatus: obj.paymentStatus,
    paidAt: obj.paidAt,
    settlementType: obj.settlementType,
    veresiyeAccountId: obj.veresiyeAccountId,
    veresiyeAmount: obj.veresiyeAmount,
    veresiyeNote: obj.veresiyeNote,
    veresiyeAt: obj.veresiyeAt,
    veresiyeEntries: obj.veresiyeEntries || [],
    linkedCollections,
    orderNo: obj.orderNo ?? null,
    orderDayKey: obj.orderDayKey || '',
    orderChannel: String(obj.orderChannel || ''),
    approvalStatus: String(obj.approvalStatus || ''),
    cancelRequestStatus: String(obj.cancelRequestStatus || ''),
    createdBy: obj.createdBy,
    createdByUser,
    createdByName: createdByUser?.name || '',
    total: obj.total,
    discountTotal: obj.discountTotal,
    netTotal: obj.netTotal,
    paidTotal: obj.paidTotal,
    balanceDue: obj.balanceDue
  }
}

const isEditableStatus = (status) => ['open', 'sent', 'paid'].includes(status)
const isNotEditableStatus = (status) => ['closed', 'cancelled'].includes(status)

export const addItemService = async (tenantId, id, menuItemId, input = 1) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  if (!mongoose.Types.ObjectId.isValid(menuItemId)) throw error('invalid_request', 'Invalid menü item', 400)

  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  if (order.orderNo == null) {
    const seq = await getNextOrderSequence(tenantId, order.branchId)
    const updated = await Order.updateOne(
      { _id: order.id, tenantId, $or: [{ orderNo: null }, { orderNo: { $exists: false } }] },
      { $set: { orderNo: seq.orderNo, orderDayKey: seq.orderDayKey } }
    )
    if (updated && (updated.modifiedCount > 0 || updated.nModified > 0)) {
      order.orderNo = seq.orderNo
      order.orderDayKey = seq.orderDayKey
    } else {
      const fresh = await Order.findOne({ _id: order.id, tenantId }).select('orderNo orderDayKey').lean()
      order.orderNo = fresh?.orderNo ?? null
      order.orderDayKey = fresh?.orderDayKey || ''
    }
  }

  const rawQuantity = typeof input === 'object' && input !== null ? input.quantity : input
  const qty = Math.max(1, Number(rawQuantity) || 1)
  const item = await findMenuItem(menuItemId, tenantId)
  if (!item || !item.isActive) throw error('not_found', 'Menü item not found', 404)
  if (order.branchId && !isVisibleInBranch(item, order.branchId)) {
    throw error('branch_not_allowed', 'Item is not available in this branch', 403)
  }
  const categoryDoc = item?.categoryId
    ? await Category.findOne({ _id: item.categoryId, tenantId }).select('name branchIds').lean()
    : null
  if (order.branchId && categoryDoc && !isVisibleInBranch(categoryDoc, order.branchId)) {
    throw error('branch_not_allowed', 'Category is not available in this branch', 403)
  }
  const price = typeof item.price === 'number' ? item.price : 0
  const isWeightBased = !!item.isWeightBased
  const incomingNote = typeof input === 'object' && input !== null ? String(input.note || '').trim() : ''
  const incomingNameOverride = typeof input === 'object' && input !== null ? String(input.nameOverride || '').trim() : ''
  const rawPriceOverride = typeof input === 'object' && input !== null ? input.priceOverride : null
  const priceSnapshot = rawPriceOverride === undefined || rawPriceOverride === null || rawPriceOverride === ''
    ? price
    : Math.max(0, Number(rawPriceOverride) || 0)
  const nameSnapshot = incomingNameOverride || item.name || 'Unknown'
  const rawWeightGrams = typeof input === 'object' && input !== null ? input.weightGrams : null
  const weightGrams = rawWeightGrams === undefined || rawWeightGrams === null || rawWeightGrams === ''
    ? null
    : Number(rawWeightGrams)

  if (isWeightBased) {
    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
      throw error('invalid_weight', 'Gram bilgisi gerekli', 400)
    }
  }

  const existingOpen = isWeightBased
    ? null
    : order.items.find(it =>
      String(it.menuItemId) === String(menuItemId) &&
      it.status === 'open' &&
      String(it.nameSnapshot || '') === String(nameSnapshot) &&
      Number(it.priceSnapshot || 0) === Number(priceSnapshot || 0) &&
      String(it.note || '') === String(incomingNote)
    )

  const wasCompleted = order.status === 'completed'
  if (existingOpen) {
    existingOpen.qty += qty
    existingOpen.subtotal = existingOpen.qty * (existingOpen.priceSnapshot || 0)
  } else {
    const lineSubtotal = isWeightBased
      ? toMoney((toMoney(weightGrams) / 1000) * priceSnapshot)
      : toMoney(qty * priceSnapshot)
    // const now = new Date() // Not needed for open item
    const newItem = {
      menuItemId: item.id,
      productId: item.id,
      productName: String(item.name || ''),
      categoryId: item.categoryId || null,
      categoryName: String(categoryDoc?.name || ''),
      imageUrl: String(item.imageUrl || ''),
      nameSnapshot,
      priceSnapshot,
      qty: isWeightBased ? 1 : qty,
      subtotal: lineSubtotal,
      isWeightBased,
      weightGrams: isWeightBased ? Math.round(weightGrams) : null,
      note: incomingNote,
      status: 'open',
      sentAt: null
    }
    if (order.status === 'sent' || order.status === 'completed') {
      order.items.unshift(newItem)
    } else {
      order.items.push(newItem)
    }
    if (order.status === 'completed') {
      order.status = 'sent'
    }
  }

  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)

  const paymentState = await computePersistedPaymentState(tenantId, order)
  order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
  order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null

  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId: order.branchId,
    actorUserId: order.createdBy,
    order
  })

  await order.save()
  if (wasCompleted && order.tableId) {
    try {
      await (await import('../repositories/tableRepository.js')).updateById(order.tableId, { status: 'occupied', activeOrderId: order.id })
    } catch {}
  }

  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setItemNoteService = async (tenantId, id, menuItemId, note) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const it = order.items.find(x => String(x.menuItemId) === String(menuItemId))
  if (!it) throw error('not_found', 'Item not in order', 404)
  it.note = String(note || '')
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_note', 'Order', order.id, { menuItemId })
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const completeItemService = async (tenantId, id, menuItemId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  const it = order.items.find(x => String(x.menuItemId) === String(menuItemId))
  if (!it) throw error('not_found', 'Item not in order', 404)
  it.status = 'completed'
  normalizeLegacyItemStatuses(order)
  const updated = await updateById(id, { items: order.items })
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_complete', 'Order', updated.id, { menuItemId })
  const dto = await getOrderService(tenantId, updated.id)
  return { order: dto }
}

export const completeItemByItemIdService = async (tenantId, id, itemId, options = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const it = order.items.id(itemId)
  if (!it) throw error('not_found', 'Item not found', 404)
  if (it.status === 'cancelled') {
    const e = new Error('Item cancelled')
    e.status = 409
    e.payload = { code: 'item_cancelled', message: 'Item cancelled' }
    throw e
  }
  if (it.status === 'completed') {
    const e = new Error('Item already completed')
    e.status = 409
    e.payload = { code: 'item_already_completed', message: 'Item already completed' }
    throw e
  }
  if (!['sent', 'cooking'].includes(it.status)) {
    const e = new Error('Item not in sent/cooking state')
    e.status = 400
    e.payload = { code: 'invalid_state', message: 'Item not in sent/cooking state', details: { currentStatus: it.status, allowed: ['sent', 'cooking'] } }
    throw e
  }

  let readyItem = it
  if ((Number(it.qty) || 0) > 1 && !it.isWeightBased) {
    readyItem = splitItemAroundUnitSelection({
      order,
      item: it,
      selectedUnitIndex: options?.unitIndex,
      selectedOverrides: {
        status: 'completed'
      }
    })
  } else {
    it.status = 'completed'
  }
  readyItem.status = 'completed'
  normalizeLegacyItemStatuses(order)
  await order.save()

  try {
    await enqueueOrderItemLabels({
      tenantId,
      order,
      items: [{
        _id: readyItem._id,
        menuItemId: readyItem.menuItemId,
        nameSnapshot: readyItem.nameSnapshot,
        qty: readyItem.qty,
        kitchenBatchId: readyItem.kitchenBatchId,
        isWeightBased: readyItem.isWeightBased,
        weightGrams: readyItem.weightGrams
      }],
      mode: 'item_ready',
      batchId: readyItem.kitchenBatchId || null
    })
  } catch {
  }

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const completeKitchenItemGroupService = async (tenantId, orderId, itemIds = []) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const ids = normalizeKitchenItemIds(itemIds)
  if (ids.length === 0) throw error('invalid_request', 'Invalid item ids', 400)

  const readyItems = []
  const now = new Date()
  for (const itemId of ids) {
    const it = order.items.id(itemId)
    if (!it) continue
    if (!['sent', 'cooking'].includes(it.status)) continue
    it.status = 'completed'
    if (!it.sentAt) it.sentAt = order.createdAt || now
    if (!it.kitchenSentAt) it.kitchenSentAt = it.sentAt
    readyItems.push(it)
  }

  if (readyItems.length === 0) {
    throw error('invalid_state', 'No sent/cooking items found for completion', 400)
  }

  normalizeLegacyItemStatuses(order)
  await order.save()

  try {
    const first = readyItems[0]
    const groupedLabelItem = {
      _id: first?._id,
      menuItemId: first?.menuItemId,
      nameSnapshot: first?.nameSnapshot,
      qty: readyItems.reduce((sum, item) => sum + Math.max(1, Number(item?.qty || 1)), 0),
      kitchenBatchId: first?.kitchenBatchId || null,
      isWeightBased: first?.isWeightBased === true,
      weightGrams: Math.max(0, readyItems.reduce((sum, item) => sum + (Number(item?.weightGrams || 0) || 0), 0)),
      note: String(first?.note || '')
    }

    await enqueueOrderItemLabels({
      tenantId,
      order,
      items: [groupedLabelItem],
      mode: 'item_ready',
      batchId: first?.kitchenBatchId || null
    })
  } catch {
  }

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const cancelItemService = async (tenantId, id, menuItemId, reason) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  const tenantSettings = await getTenantBusinessSettings(tenantId)
  const cancelReason = String(reason || '').trim()
  if (tenantSettings.general.requireCancelReasonForProduct === true && !cancelReason) {
    throw error('cancel_reason_required', 'İptal açıklaması zorunlu', 400)
  }
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!['open', 'sent', 'completed'].includes(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open/sent/completed', details: { currentStatus: order.status, allowed: ['open', 'sent', 'completed'] } }
    throw e
  }
  const it = order.items.find(x => String(x.menuItemId) === String(menuItemId))
  if (!it) throw error('not_found', 'Item not in order', 404)
  if (it.status === 'cancelled') {
    const e = new Error('Item already cancelled')
    e.status = 409
    e.payload = { error: 'item_already_cancelled', message: 'Item already cancelled' }
    throw e
  }
  it.status = 'cancelled'
  it.cancelledAt = new Date()
  it.note = cancelReason || it.note
  it.cancelReason = cancelReason || it.cancelReason || ''
  const totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  const fin = computePaymentSummary({ ...order.toObject?.() ?? order, items: order.items, totals })
  const paymentUpdates = (fin.netTotal > 0 && fin.balanceDue <= 0.01)
    ? { paymentStatus: 'paid', paidAt: order.paidAt || new Date() }
    : { paymentStatus: 'unpaid', paidAt: null }
  const updated = await updateById(id, { items: order.items, totals, ...paymentUpdates })
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_cancel', 'Order', updated.id, { menuItemId, reason })
  const dto = await getOrderService(tenantId, updated.id)
  return { order: dto }
}

export const cancelItemByItemIdService = async ({ orderId, itemId, reason, user, unitIndex }) => {
    const order = await findByIdAndTenant(orderId, user.tenantId)
    if (!order) throw error('not_found', 'Order not found', 404)
    const tenantSettings = await getTenantBusinessSettings(user.tenantId)
    const cancelReason = String(reason || '').trim()
    if (tenantSettings.general.requireCancelReasonForProduct === true && !cancelReason) {
      throw error('cancel_reason_required', 'İptal açıklaması zorunlu', 400)
    }
    if (isNotEditableStatus(order.status)) {
      const e = new Error('Order is not editable')
      e.status = 409
      e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
      throw e
    }
    const item = order.items.id(itemId)
    if (!item) throw error('not_found', 'Item not found', 404)
    if (item.status === 'cancelled') {
      const e = new Error('Item already cancelled')
      e.status = 409
      e.payload = { error: 'item_already_cancelled', message: 'Item already cancelled' }
      throw e
    }
    if (!['sent', 'cooking', 'completed'].includes(item.status)) {
      const e = new Error('Item not in cancellable status')
      e.status = 400
      e.payload = { error: 'invalid_state', message: 'Item not sent/cooking/completed', details: { currentStatus: item.status, allowed: ['sent', 'cooking', 'completed'] } }
      throw e
    }
    const cancelAt = new Date()
    if ((Number(item.qty) || 0) > 1 && !item.isWeightBased) {
      splitItemAroundUnitSelection({
        order,
        item,
        selectedUnitIndex: unitIndex,
        selectedOverrides: {
          status: 'cancelled',
          cancelledAt: cancelAt,
          note: cancelReason || item.note || '',
          cancelReason: cancelReason || item.cancelReason || ''
        }
      })
    } else {
      item.status = 'cancelled'
      item.cancelledAt = cancelAt
      if (cancelReason) item.note = cancelReason
      item.cancelReason = cancelReason || item.cancelReason || ''
    }
    if (order.tableId) {
      order.cancelAlertActive = true
    }

    order.totals = computeTotals(order.items)
    normalizeLegacyItemStatuses(order)
  {
    const fin = computePaymentSummary(order)
    if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || new Date()
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
  }
    await syncPublicOnlineAccountChargeForOrder({
      tenantId: user.tenantId,
      branchId: order.branchId,
      actorUserId: user.id || user._id || order.createdBy,
      order
    })
    await order.save()
    const freshOrder = await Order.findById(order.id).lean()
    const dto = decorateOrder(freshOrder)
    return { order: dto }
  }

export const cancelKitchenItemGroupService = async ({ orderId, itemIds = [], reason, user }) => {
  const order = await findByIdAndTenant(orderId, user.tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  const ids = normalizeKitchenItemIds(itemIds)
  if (ids.length === 0) throw error('invalid_request', 'Invalid item ids', 400)

  let changed = 0
  const cancelAt = new Date()
  for (const itemId of ids) {
    const item = order.items.id(itemId)
    if (!item) continue
    if (!['sent', 'cooking', 'completed'].includes(item.status)) continue
    item.status = 'cancelled'
    item.cancelledAt = cancelAt
    if (reason) item.note = reason
    changed += 1
  }

  if (changed === 0) {
    throw error('invalid_state', 'No cancellable items found', 400)
  }

  if (order.tableId) {
    order.cancelAlertActive = true
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  {
    const fin = computePaymentSummary(order)
    if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || new Date()
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
  }
  await syncPublicOnlineAccountChargeForOrder({
    tenantId: user.tenantId,
    branchId: order.branchId,
    actorUserId: user.id || user._id || order.createdBy,
    order
  })
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  return { order: decorateOrder(freshOrder) }
}

export const setItemCookingByItemIdService = async (tenantId, id, itemId, options = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const it = order.items.id(itemId)
  if (!it) throw error('not_found', 'Item not found', 404)
  if (it.status === 'cancelled') throw error('invalid_state', 'Item cancelled', 409)
  if (it.status === 'completed') throw error('invalid_state', 'Item completed', 409)
  if (it.status !== 'sent') {
    throw error('invalid_state', 'Item not sent', 400)
  }

  if ((Number(it.qty) || 0) > 1 && !it.isWeightBased) {
    splitItemAroundUnitSelection({
      order,
      item: it,
      selectedUnitIndex: options?.unitIndex,
      selectedOverrides: {
        status: 'cooking'
      }
    })
  } else {
    it.status = 'cooking'
  }
  normalizeLegacyItemStatuses(order)
  await order.save()

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setKitchenItemGroupCookingService = async (tenantId, orderId, itemIds = []) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const ids = normalizeKitchenItemIds(itemIds)
  if (ids.length === 0) throw error('invalid_request', 'Invalid item ids', 400)

  let changed = 0
  for (const itemId of ids) {
    const it = order.items.id(itemId)
    if (!it) continue
    if (!['sent', 'cooking'].includes(it.status)) continue
    it.status = 'cooking'
    changed += 1
  }

  if (changed === 0) throw error('invalid_state', 'No sent items found for cooking', 400)

  normalizeLegacyItemStatuses(order)
  await order.save()

  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const removeItemService = async (tenantId, id, menuItemId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('Order not in editable status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const key = String(menuItemId)
  let idx = order.items.findIndex(it => String(it?._id || '') === key || String(it?.id || '') === key)
  if (idx === -1) {
    idx = order.items.findIndex(it => String(it.menuItemId) === key)
  }
  if (idx === -1) throw error('not_found', 'Item not in order', 404)
  const existing = order.items[idx]
  if (existing.qty > 1) {
    existing.qty -= 1
    existing.subtotal = existing.qty * (existing.priceSnapshot || 0)
  } else {
    order.items.splice(idx, 1)
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  const paymentState = await computePersistedPaymentState(tenantId, order)
  order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
  order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null
  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId: order.branchId,
    actorUserId: order.createdBy,
    order
  })
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setItemQuantityService = async (tenantId, id, menuItemId, quantity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const idx = order.items.findIndex(it => String(it.menuItemId) === String(menuItemId))
  if (idx === -1) throw error('not_found', 'Item not in order', 404)
  const qty = Math.max(0, Number(quantity) || 0)
  if (qty <= 0) {
    order.items.splice(idx, 1)
  } else {
    const it = order.items[idx]
    it.qty = qty
    it.subtotal = qty * (it.priceSnapshot || 0)
    order.items[idx] = it
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  const paymentState = await computePersistedPaymentState(tenantId, order)
  order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
  order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null
  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId: order.branchId,
    actorUserId: order.createdBy,
    order
  })
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setItemQuantityByItemIdService = async (tenantId, id, itemId, quantity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw error('invalid_request', 'Invalid item id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const it = order.items.id(itemId)
  if (!it) throw error('item_not_found', 'Item not found', 404)
  const qty = Math.max(0, Number(quantity) || 0)
  if (qty <= 0) {
    const idx = order.items.findIndex(x => String(x?._id) === String(itemId))
    if (idx === -1) throw error('item_not_found', 'Item not found', 404)
    order.items.splice(idx, 1)
  } else {
    it.qty = qty
    it.subtotal = qty * (it.priceSnapshot || 0)
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  const paymentState = await computePersistedPaymentState(tenantId, order)
  order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
  order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null
  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId: order.branchId,
    actorUserId: order.createdBy,
    order
  })
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setItemWeightByItemIdService = async (tenantId, id, itemId, weightGramsInput) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw error('invalid_request', 'Invalid item id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const it = order.items.id(itemId)
  if (!it) throw error('item_not_found', 'Item not found', 404)
  if (!it.isWeightBased) {
    const e = new Error('Item is not weight based')
    e.status = 400
    e.payload = { error: 'invalid_weight_item', message: 'Item is not weight based' }
    throw e
  }

  const weightGrams = Math.round(Number(weightGramsInput) || 0)
  if (weightGrams <= 0) {
    const idx = order.items.findIndex(x => String(x?._id) === String(itemId))
    if (idx === -1) throw error('item_not_found', 'Item not found', 404)
    order.items.splice(idx, 1)
  } else {
    it.weightGrams = weightGrams
    it.qty = 1
    it.subtotal = toMoney((toMoney(weightGrams) / 1000) * (it.priceSnapshot || 0))
  }

  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  const paymentState = await computePersistedPaymentState(tenantId, order)
  order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
  order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null
  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId: order.branchId,
    actorUserId: order.createdBy,
    order
  })
  await order.save()
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const removeItemByItemIdService = async ({ tenantId, orderId, itemId }) => {
  return setItemQuantityByItemIdService(tenantId, orderId, itemId, 0)
}

export const setItemNoteByItemIdService = async (tenantId, id, itemId, note) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid order id', 400)
  if (!mongoose.Types.ObjectId.isValid(itemId)) throw error('invalid_request', 'Invalid item id', 400)
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (isNotEditableStatus(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  if (!isEditableStatus(order.status)) {
    const e = new Error('invalid status')
    e.status = 400
    e.payload = { error: 'invalid_state', message: 'Order not open or sent', details: { currentStatus: order.status, allowed: ['open', 'sent'] } }
    throw e
  }
  const it = order.items.id(itemId)
  if (!it) throw error('not_found', 'Item not in order', 404)
  const nextNote = String(note || '')
  if ((Number(it.qty) || 0) > 1 && !it.isWeightBased && String(it.note || '') !== nextNote) {
    const unitPrice = toMoney(it.priceSnapshot || 0)
    it.qty = Math.max(1, (Number(it.qty) || 0) - 1)
    it.subtotal = toMoney(it.qty * unitPrice)

    const notedClone = splitQtyItemSnapshot(it, {
      _id: new mongoose.Types.ObjectId(),
      qty: 1,
      subtotal: unitPrice,
      note: nextNote
    })
    insertSplitItemAtSourcePosition(order, it._id, notedClone)
  } else {
    it.note = nextNote
  }
  order.totals = computeTotals(order.items)
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_item_note', 'Order', order.id, { itemId, menuItemId: String(it.menuItemId) })
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const splitOrderService = async (tenantId, id, itemsToMove = [], targetTableId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('order_not_splitable', 'Order not splitable', 400)
  if (!Array.isArray(itemsToMove) || itemsToMove.length === 0) throw error('invalid_request', 'No items to split', 400)

  let targetTable = null
  if (targetTableId) {
    targetTable = await Table.findOne({ _id: targetTableId, tenantId, isActive: true })
    if (!targetTable || targetTable.status !== 'empty') throw error('target_table_not_empty', 'Target table not empty', 400)
  }

  const session = await mongoose.startSession()
  try {
    const seq = await getNextOrderSequence(tenantId, order.branchId)
    let newOrder = null
    await session.withTransaction(async () => {
      const sourceItemsMap = new Map(order.items.map(it => [String(it.menuItemId), { ...it }]))
      const newOrderItems = []
      for (const m of itemsToMove) {
        const key = String(m.menuItemId)
        const src = sourceItemsMap.get(key)
        if (!src) throw error('not_found', 'Menü item not in order', 404)
        if (m.qty < 1 || m.qty > src.qty) throw error('invalid_qty', 'Invalid qty', 400)
        // reduce from source
        src.qty -= m.qty
        src.subtotal = src.qty * src.priceSnapshot
        sourceItemsMap.set(key, src)
        // add to new order
        newOrderItems.push({
          menuItemId: src.menuItemId,
          productId: src.productId || src.menuItemId,
          productName: src.productName || src.nameSnapshot,
          categoryId: src.categoryId || null,
          categoryName: src.categoryName || '',
          imageUrl: String(src.imageUrl || ''),
          nameSnapshot: src.nameSnapshot,
          priceSnapshot: src.priceSnapshot,
          qty: m.qty,
          subtotal: m.qty * src.priceSnapshot
        })
      }
      const updatedSourceItems = Array.from(sourceItemsMap.values()).filter(it => it.qty > 0)
      const updatedSourceTotals = computeTotals(updatedSourceItems)
      await Order.findByIdAndUpdate(order.id, { items: updatedSourceItems, totals: updatedSourceTotals }, { new: true, session })

      newOrder = await Order.create([{
        tenantId,
        branchId: order.branchId,
        createdBy: order.createdBy,
        orderNo: seq.orderNo,
        orderDayKey: seq.orderDayKey,
        tableId: targetTableId ?? order.tableId,
        status: 'open',
        items: newOrderItems,
        totals: computeTotals(newOrderItems),
        note: ''
      }], { session }).then(res => res[0])

      if (targetTableId) {
        await Table.findByIdAndUpdate(targetTableId, { status: 'occupied', activeOrderId: newOrder.id }, { new: true, session })
      }
    })
    return { newOrderId: newOrder.id }
  } finally {
    await session.endSession()
  }
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_split', 'Order', order.id, { newOrderId: newOrder.id, targetTableId })
}
export const setNoteService = async (tenantId, id, note) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  order.note = note ?? ''
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_set_note', 'Order', order.id, {})
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const setCustomerNameService = async (tenantId, id, customerName) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('order_not_found', 'Order not found', 404)
  if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'closed') {
    throw error('order_not_editable', 'Order not editable', 409)
  }
  order.customerName = (String(customerName || '').trim().slice(0, 40)) || 'Misafir'
  normalizeLegacyItemStatuses(order)
  await order.save()
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_set_customer_name', 'Order', order.id, {})
  const freshOrder = await Order.findById(order.id).lean()
  const dto = decorateOrder(freshOrder)
  return { order: dto }
}

export const cancelOrderService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  const summary = computePaymentSummary(order)
  if (summary.paidTotal > 0) throw error('invalid_state', 'Order paid', 400)

  const now = new Date()
  const isDelivery = String(order.saleType || '') === 'delivery'
  for (const it of order.items || []) {
    if (it && it.status !== 'cancelled') {
      it.status = 'cancelled'
      it.cancelledAt = now
    }
  }
  order.status = 'cancelled'
  if (isDelivery) {
    order.deliveryStatus = 'cancelled'
    order.closedAt = now
  }
  order.totals = computeTotals(order.items)
  order.paymentStatus = 'unpaid'
  order.paidAt = null
  normalizeLegacyItemStatuses(order)
  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId: order.branchId,
    actorUserId: order.createdBy,
    order
  })
  await order.save()
  if (order.tableId) {
    await (await import('../repositories/tableRepository.js')).updateById(order.tableId, { status: 'empty', activeOrderId: null })
  }
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_cancel', 'Order', order.id, {})
  return { id: order.id, status: order.status }
}

export const sendOrderService = async (tenantId, id, { servingType, kitchenEnabled } = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('invalid_state', 'Order not open or sent', 400)
  const now = new Date()
  const batchId = new mongoose.Types.ObjectId().toString()

  const itemsToLabel = []
  const itemsToKitchenReceipt = []

  if (kitchenEnabled !== undefined) {
    order.kitchenEnabled = Boolean(kitchenEnabled)
    order.sendToKitchen = Boolean(kitchenEnabled)
  }

  const incomingServingType = servingType !== undefined ? normalizeServingType(servingType) : undefined
  if (incomingServingType !== undefined) {
    if (incomingServingType === null) {
      // no-op
    } else if (!['tray', 'plate', 'package'].includes(incomingServingType)) {
      throw error('invalid_request', 'Invalid servingType', 400)
    } else {
      order.servingType = incomingServingType
      order.servingTypeUpdatedAt = now
    }
  }

  const baseServingType = getEffectiveServingTypeForOrder(order)
  const itemServingType = (incomingServingType !== undefined && incomingServingType !== null)
    ? incomingServingType
    : baseServingType
  if (!Array.isArray(order.kitchenBatches)) order.kitchenBatches = []
  if (!order.kitchenBatches.some(b => String(b?.batchId || '') === batchId)) {
    order.kitchenBatches.push({ batchId, servingType: baseServingType, sentAt: now, completedAt: null })
  }

  const hasOpenItems = (order.items || []).some(it => it && it.status === 'open')
  if (!hasOpenItems) {
    const e = new Error('No open items to send')
    e.status = 409
    e.payload = { error: 'no_open_items_to_send', message: 'No open items to send' }
    throw e
  }

  for (const it of order.items || []) {
    if (it.status === 'open') {
      it.status = 'sent'
      if (!it.sentAt) {
        it.sentAt = now
      }
      it.kitchenBatchId = batchId
      it.kitchenSentAt = now
      it.servingType = ['tray', 'plate', 'package'].includes(itemServingType) ? itemServingType : baseServingType
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.debug('[SERVINGTYPE_DEBUG]', { orderId: String(order.id), itemId: String(it._id || ''), incoming: incomingServingType ?? null, saved: it.servingType, saleType: order.saleType })
        } catch {}
      }
      itemsToLabel.push({
        _id: it._id,
        menuItemId: it.menuItemId,
        categoryId: it.categoryId || null,
        nameSnapshot: it.nameSnapshot,
        qty: it.qty,
        isWeightBased: it.isWeightBased,
        weightGrams: it.weightGrams,
        note: it.note || ''
      })
      itemsToKitchenReceipt.push({
        _id: it._id,
        menuItemId: it.menuItemId,
        categoryId: it.categoryId || null,
        nameSnapshot: it.nameSnapshot,
        qty: it.qty,
        isWeightBased: it.isWeightBased,
        weightGrams: it.weightGrams,
        note: it.note || '',
        servingType: it.servingType
      })
    }
  }
  order.currentKitchenBatchId = batchId
  order.status = 'sent'
  await order.save()

  try {
    if (order.kitchenEnabled !== false && order.sendToKitchen !== false && itemsToLabel.length > 0) {
      await enqueueOrderItemLabels({ tenantId, order, items: itemsToLabel, mode: 'order_send', batchId })
    }
  } catch {
  }

  await enqueueKitchenReceiptJobs({ tenantId, order, items: itemsToKitchenReceipt, batchId })

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_send', 'Order', order.id, {})
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setKitchenModeService = async (tenantId, id, { kitchenEnabled, sendToKitchen } = {}) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged', 'completed'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const next = kitchenEnabled !== undefined ? Boolean(kitchenEnabled) : (sendToKitchen !== undefined ? Boolean(sendToKitchen) : undefined)
  if (next === undefined) {
    throw error('invalid_request', 'kitchenEnabled or sendToKitchen required', 400)
  }
  const normalized = Boolean(next)
  order.sendToKitchen = normalized
  order.kitchenEnabled = normalized
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const addOrderPaymentService = async (tenantId, id, { method, amount, note, cashierId }) => {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw error('invalid_request', 'Invalid orderId', 400)
  }
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const payAmount = Number(amount)
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw error('invalid_amount', 'Invalid payment amount', 400)
  }

  const accountId = String(order?.publicCustomerAccountId || '').trim()
  const shouldUseAccountCollection = String(order?.orderChannel || '').trim() === 'online' && mongoose.Types.ObjectId.isValid(accountId)

  if (shouldUseAccountCollection) {
    const existingCollections = await computeOrderCollectionTotal(tenantId, order.id, accountId)
    const maxCollectable = Math.max(0, toMoney(computePaymentSummary(order).netTotal) - existingCollections)
    const collectAmount = Math.min(maxCollectable, payAmount)
    if (collectAmount <= 0.009) {
      throw error('invalid_amount', 'Kalan tahsilat tutari yok', 400)
    }
    const { collectDebtService } = await import('./accountsService.js')
    await collectDebtService(tenantId, String(order?.branchId || ''), cashierId || order.createdBy || null, accountId, {
      amount: collectAmount,
      discountAmount: 0,
      method,
      note: String(note || 'Siparis uzerinden tahsil edildi'),
      orderId: order.id
    })
    const paymentState = await computePersistedPaymentState(tenantId, order)
    order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
    order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null
    if (String(order?.saleType || '') === 'delivery') {
      order.deliveryPaymentStatus = paymentState.isPaid ? 'odeme_alindi' : 'odeme_bekliyor'
    }
  } else {
    const resolvedMethod = await resolvePaymentMethodSelection(tenantId, order.branchId, method)
    order.payments.push({
      method: resolvedMethod.method,
      methodId: resolvedMethod.methodId,
      methodLabel: resolvedMethod.methodLabel,
      methodName: resolvedMethod.methodName,
      methodBucket: resolvedMethod.methodBucket,
      methodType: resolvedMethod.methodType,
      amount: payAmount,
      note: String(note || '')
    })
    const paymentState = await computePersistedPaymentState(tenantId, order)
    order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
    order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null
  }

  await order.save()
  await maybeAutoClosePaidOrder(tenantId, order)
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const deleteOrderPaymentService = async (tenantId, id, paymentId) => {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw error('invalid_request', 'Invalid orderId', 400)
  }
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  const payments = Array.isArray(order.payments) ? order.payments : []
  const idx = payments.findIndex(p => String(p?._id) === String(paymentId))
  if (idx === -1) throw error('not_found', 'Payment not found', 404)
  payments.splice(idx, 1)
  order.payments = payments

  const fin = computePaymentSummary(order)
  if (fin.netTotal > 0 && fin.balanceDue <= 0.01) {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
  } else {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  }
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setOrderDiscountService = async (tenantId, id, discountPercent) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }
  const pct = Number(discountPercent)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw error('invalid_discount', 'Invalid discount percent', 400)
  }
  order.discountPercent = pct
  const paymentState = await computePersistedPaymentState(tenantId, order)
  order.paymentStatus = paymentState.isPaid ? 'paid' : 'unpaid'
  order.paidAt = paymentState.isPaid ? (order.paidAt || new Date()) : null
  await syncPublicOnlineAccountChargeForOrder({
    tenantId,
    branchId: order.branchId,
    actorUserId: order.createdBy,
    order
  })
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const setOrderVeresiyeService = async (tenantId, branchId, actorUserId, id, { accountId, amount, note }) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  const tenantSettings = await getTenantBusinessSettings(tenantId)
  if (tenantSettings.general.disableCreditAccounts === true) {
    throw error('credit_accounts_disabled', 'Cari hesap kullanımı kapalı', 403)
  }
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order closed')
    e.status = 409
    e.payload = { error: 'conflict', code: 'order_closed', message: 'Sipariş kapalı' }
    throw e
  }

  const finBefore = computePaymentSummary(order)
  if (finBefore.balanceDue <= 0.01) {
    const e = new Error('Remaining is zero')
    e.status = 409
    e.payload = { error: 'conflict', code: 'remaining_zero', message: 'Kalan tutar 0, veresiye yapılamaz.' }
    throw e
  }

  const hasBodyAmount = amount !== undefined && amount !== null && String(amount).trim() !== ''
  const settleAmount = hasBodyAmount ? Number(amount) : finBefore.balanceDue
  if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
    const e = new Error('Invalid amount')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_amount', message: 'Geçersiz tutar' }
    throw e
  }
  if (settleAmount - finBefore.balanceDue > 0.01) {
    const e = new Error('Amount exceeds remaining')
    e.status = 409
    e.payload = { error: 'conflict', code: 'amount_exceeds_remaining', message: 'Girilen tutar kalan tutardan büyük.' }
    throw e
  }
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    const e = new Error('Invalid account')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_account', message: 'Cari seçimi geçersiz.' }
    throw e
  }

  const acc = await CustomerAccount.findOne({ _id: accountId, tenantId, isActive: true })
  if (!acc) {
    const e = new Error('Invalid account')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_account', message: 'Cari bulunamadı veya pasif.' }
    throw e
  }

  const now = new Date()
  const verNote = String(note || '').trim()
  const txnSupported = isMongoTransactionsSupported()

  if (txnSupported) {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        await CustomerAccount.updateOne(
          { _id: acc.id, tenantId },
          { $inc: { balance: settleAmount } },
          { session }
        )
        const createdTransactions = await AccountTransaction.create([
          {
            tenantId,
            branchId,
            accountId: acc.id,
            type: 'debit',
            amount: settleAmount,
            method: 'other',
            note: verNote,
            source: 'order_veresiye',
            orderId: order.id
          }
        ], { session })
        const createdTx = Array.isArray(createdTransactions) ? createdTransactions[0] : null

        const entries = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
        if (entries.length === 0 && order.settlementType === 'veresiye' && Number(order.veresiyeAmount || 0) > 0) {
          const legacyAccId = order.veresiyeAccountId || acc.id
          entries.push({
            accountId: legacyAccId,
            accountName: String(acc?.name || '').trim(),
            amount: Number(order.veresiyeAmount || 0),
            note: String(order.veresiyeNote || '').trim(),
            createdBy: actorUserId,
            createdAt: order.veresiyeAt || now
          })
        }
        entries.push({
          accountId: acc.id,
          accountName: String(acc?.name || '').trim(),
          transactionId: createdTx?._id || null,
          amount: settleAmount,
          note: verNote,
          createdBy: actorUserId,
          createdAt: now
        })
        order.veresiyeEntries = entries
        order.veresiyeAmount = entries.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0)
        order.settlementType = order.veresiyeAmount > 0 ? 'veresiye' : 'none'
        order.veresiyeAccountId = acc.id
        order.veresiyeNote = verNote
        order.veresiyeAt = now

        const finAfter = computePaymentSummary(order)
        if (finAfter.netTotal > 0 && finAfter.balanceDue <= 0.01) {
          order.paymentStatus = 'paid'
          order.paidAt = now
        } else {
          order.paymentStatus = 'unpaid'
          order.paidAt = null
        }

        await order.save({ session })
      })
    } finally {
      await session.endSession()
    }
  } else {
    await CustomerAccount.updateOne({ _id: acc.id, tenantId }, { $inc: { balance: settleAmount } })
    let tx = null
    try {
      tx = await AccountTransaction.create({
        tenantId,
        branchId,
        accountId: acc.id,
        type: 'debit',
        amount: settleAmount,
        method: 'other',
        note: verNote,
        source: 'order_veresiye',
        orderId: order.id
      })

      const entries = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
      if (entries.length === 0 && order.settlementType === 'veresiye' && Number(order.veresiyeAmount || 0) > 0) {
        const legacyAccId = order.veresiyeAccountId || acc.id
        entries.push({
          accountId: legacyAccId,
          accountName: String(acc?.name || '').trim(),
          amount: Number(order.veresiyeAmount || 0),
          note: String(order.veresiyeNote || '').trim(),
          createdBy: actorUserId,
          createdAt: order.veresiyeAt || now
        })
      }
      entries.push({
        accountId: acc.id,
        accountName: String(acc?.name || '').trim(),
        transactionId: tx?._id || null,
        amount: settleAmount,
        note: verNote,
        createdBy: actorUserId,
        createdAt: now
      })
      order.veresiyeEntries = entries
      order.veresiyeAmount = entries.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0)
      order.settlementType = order.veresiyeAmount > 0 ? 'veresiye' : 'none'
      order.veresiyeAccountId = acc.id
      order.veresiyeNote = verNote
      order.veresiyeAt = now

      const finAfter = computePaymentSummary(order)
      if (finAfter.netTotal > 0 && finAfter.balanceDue <= 0.01) {
        order.paymentStatus = 'paid'
        order.paidAt = now
      } else {
        order.paymentStatus = 'unpaid'
        order.paidAt = null
      }

      await order.save()
    } catch (err) {
      try {
        if (tx) {
          await AccountTransaction.deleteOne({ _id: tx.id, tenantId, branchId })
        }
      } catch {}
      try {
        await CustomerAccount.updateOne({ _id: acc.id, tenantId }, { $inc: { balance: -settleAmount } })
      } catch {}
      throw err
    }
  }

  await (await import('./auditService.js')).log(tenantId, actorUserId, 'order_veresiye', 'Order', order.id, { accountId: acc.id, amount: settleAmount })
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const deleteOrderVeresiyeEntryService = async (tenantId, branchId, actorUserId, orderId, entryId) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order closed')
    e.status = 409
    e.payload = { error: 'conflict', code: 'order_closed', message: 'Sipariş kapalı' }
    throw e
  }

  const entries = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
  const idx = entries.findIndex(e => String(e?._id) === String(entryId))
  if (idx === -1) throw error('not_found', 'Veresiye entry not found', 404)

  const removed = entries[idx]
  const amount = Number(removed?.amount) || 0
  const accountId = removed?.accountId
  if (!accountId || !mongoose.Types.ObjectId.isValid(String(accountId)) || amount <= 0) {
    throw error('invalid_request', 'Invalid veresiye entry', 400)
  }

  const acc = await CustomerAccount.findOne({ _id: accountId, tenantId, isActive: true })
  if (!acc) {
    const e = new Error('Invalid account')
    e.status = 409
    e.payload = { error: 'conflict', code: 'invalid_account', message: 'Cari bulunamadı veya pasif.' }
    throw e
  }

  const now = new Date()
  const txnSupported = isMongoTransactionsSupported()
  const txFilter = resolveVeresiyeTransactionFilter(tenantId, order._id, removed)
  const applyOrderUpdate = async (session) => {
    const list = Array.isArray(order.veresiyeEntries) ? order.veresiyeEntries : []
    const i = list.findIndex(e => String(e?._id) === String(entryId))
    if (i === -1) throw error('not_found', 'Veresiye entry not found', 404)
    list.splice(i, 1)
    order.veresiyeEntries = list
    order.veresiyeAmount = list.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0)
    order.settlementType = order.veresiyeAmount > 0 ? 'veresiye' : 'none'
    if (order.veresiyeAmount <= 0) {
      order.veresiyeAccountId = null
      order.veresiyeNote = ''
      order.veresiyeAt = null
    }
    const finAfter = computePaymentSummary(order)
    if (finAfter.netTotal > 0 && finAfter.balanceDue <= 0.01) {
      order.paymentStatus = 'paid'
      order.paidAt = order.paidAt || now
    } else {
      order.paymentStatus = 'unpaid'
      order.paidAt = null
    }
    if (session) await order.save({ session })
    else await order.save()
  }

  if (txnSupported) {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const sourceTx = await AccountTransaction.findOne(txFilter).sort({ createdAt: -1 }).session(session)
        if (!sourceTx) {
          throw error('not_found', 'Veresiye hareketi bulunamadi', 404)
        }
        sourceTx.isDeleted = true
        sourceTx.deletedAt = now
        await sourceTx.save({ session })

        const nextBalance = await computeCustomerAccountBalance(tenantId, acc.id, session)
        await CustomerAccount.updateOne(
          { _id: acc.id, tenantId },
          { $set: { balance: nextBalance } },
          { session }
        )
        await applyOrderUpdate(session)
      })
    } finally {
      await session.endSession().catch(() => {})
    }
  } else {
    const sourceTx = await AccountTransaction.findOne(txFilter).sort({ createdAt: -1 })
    if (!sourceTx) {
      throw error('not_found', 'Veresiye hareketi bulunamadi', 404)
    }
    sourceTx.isDeleted = true
    sourceTx.deletedAt = now
    await sourceTx.save()
    const nextBalance = await computeCustomerAccountBalance(tenantId, acc.id)
    await CustomerAccount.updateOne({ _id: acc.id, tenantId }, { $set: { balance: nextBalance } })
    await applyOrderUpdate(undefined)
  }

  await (await import('./auditService.js')).log(tenantId, actorUserId, 'order_veresiye_delete', 'Order', order.id, { entryId: String(entryId), amount })
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const deleteOrderCollectionTransactionService = async (tenantId, orderId, txId) => {
  if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
    throw error('invalid_request', 'Invalid orderId', 400)
  }
  if (!mongoose.Types.ObjectId.isValid(String(txId))) {
    throw error('invalid_request', 'Invalid transaction id', 400)
  }

  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    const e = new Error('Order is not editable')
    e.status = 409
    e.payload = { error: 'conflict', code: 'order_not_editable', message: 'Order is not editable' }
    throw e
  }

  const branchId = order.branchId
  if (!branchId) throw error('invalid_request', 'Order branch required', 400)

  const computeAccountBalance = async (accountId, session) => {
    const cursor = AccountTransaction.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          accountId: new mongoose.Types.ObjectId(accountId),
          isDeleted: { $ne: true }
        }
      },
      { $group: { _id: '$type', sum: { $sum: '$amount' } } }
    ])
    if (session) cursor.session(session)
    const rows = await cursor
    const debit = rows.find(r => r._id === 'debit')?.sum || 0
    const credit = rows.find(r => r._id === 'credit')?.sum || 0
    return toMoney(debit) - toMoney(credit)
  }

  const runFallback = async () => {
    const tx = await AccountTransaction.findOne({ _id: txId, tenantId })
    if (!tx) throw error('not_found', 'Transaction not found', 404)
    if (tx.isDeleted) throw error('already_deleted', 'Transaction already deleted', 409)
    if (!(tx.source === 'collection' && tx.type === 'credit')) {
      throw error('invalid_request', 'Only collection transactions can be deleted', 409)
    }
    if (String(tx.orderId || '') !== String(order._id)) {
      throw error('payment_locked', 'Bu tahsilat bu siparişe bağlı değil', 409)
    }

    const deletedTx = await AccountTransaction.findOneAndUpdate(
      { _id: txId, tenantId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    )
    if (!deletedTx) throw error('already_deleted', 'Transaction already deleted', 409)

    const nextBalance = await computeAccountBalance(tx.accountId)
    const acc = await CustomerAccount.findOneAndUpdate(
      { _id: tx.accountId, tenantId },
      { $set: { balance: nextBalance } },
      { new: true }
    )
    if (!acc) throw error('account_not_found_after_delete', 'Account not found', 409)

    const dto = await getOrderService(tenantId, orderId)
    return { success: true, order: dto, txId: deletedTx.id, accountId: acc.id }
  }

  const supported = isMongoTransactionsSupported()
  if (!supported) return runFallback()

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const tx = await AccountTransaction.findOne({ _id: txId, tenantId }).session(session)
      if (!tx) throw error('not_found', 'Transaction not found', 404)
      if (tx.isDeleted) throw error('already_deleted', 'Transaction already deleted', 409)
      if (!(tx.source === 'collection' && tx.type === 'credit')) {
        throw error('invalid_request', 'Only collection transactions can be deleted', 409)
      }
      if (String(tx.orderId || '') !== String(order._id)) {
        throw error('payment_locked', 'Bu tahsilat bu siparişe bağlı değil', 409)
      }

      const acc = await CustomerAccount.findOne({ _id: tx.accountId, tenantId }).session(session)
      if (!acc) throw error('not_found', 'Account not found', 404)

      tx.isDeleted = true
      tx.deletedAt = new Date()
      await tx.save({ session })

      acc.balance = await computeAccountBalance(tx.accountId, session)
      await acc.save({ session })
    })
  } catch (err) {
    const msg = String(err?.message || '')
    if (msg.includes('Transaction numbers are only allowed')) {
      return runFallback()
    }
    throw err
  } finally {
    await session.endSession().catch(() => {})
  }

  const dto = await getOrderService(tenantId, orderId)
  return { success: true, order: dto, txId: String(txId) }
}

export const payOrderService = async (tenantId, id, paymentMethod, amount) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  
  if (!['open', 'sent', 'completed', 'paid'].includes(order.status)) {
    const e = new Error('Order not payable')
    e.status = 409
    e.payload = { code: 'order_not_payable', message: 'Order not payable', details: { status: order.status } }
    throw e
  }

  const before = computePaymentSummary(order)
  const payAmount = amount !== undefined && amount !== null ? Number(amount) : before.balanceDue

  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    if (before.balanceDue <= 0.01) {
      const e = new Error('Order already paid')
      e.status = 409
      e.payload = { code: 'order_already_paid', message: 'Order already paid' }
      throw e
    }
    const e = new Error('Invalid payment amount')
    e.status = 400
    e.payload = { code: 'invalid_amount', message: 'Invalid payment amount' }
    throw e
  }

  const resolvedMethod = await resolvePaymentMethodSelection(tenantId, order.branchId, paymentMethod)
  order.payments.push({
    amount: payAmount,
    method: resolvedMethod.method,
    methodId: resolvedMethod.methodId,
    methodLabel: resolvedMethod.methodLabel,
    methodName: resolvedMethod.methodName,
    methodBucket: resolvedMethod.methodBucket,
    methodType: resolvedMethod.methodType,
    note: ''
  })

  const after = computePaymentSummary(order)
  if (after.netTotal > 0 && after.balanceDue <= 0.01) {
    order.paymentStatus = 'paid'
    order.paidAt = order.paidAt || new Date()
  } else {
    order.paymentStatus = 'unpaid'
    order.paidAt = null
  }

  await order.save()
  await maybeAutoClosePaidOrder(tenantId, order)
  
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_pay', 'Order', order.id, { paymentMethod, amount: payAmount })
  
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const closeOrderService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const fin = computePaymentSummary(order)
  if (fin.netTotal > 0 && fin.balanceDue > 0.01) {
    throw error('invalid_state', 'Order not closable (Unpaid balance)', 400)
  }

  const nextStatus = order.status === 'cancelled' ? 'closed' : 'completed'
  const updated = await updateById(id, { status: nextStatus, closedAt: new Date() })
  if (updated.tableId) {
    await (await import('../repositories/tableRepository.js')).updateById(updated.tableId, { status: 'empty', activeOrderId: null })
  }
  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_close', 'Order', updated.id, {})
  const fresh = await Order.findById(updated.id).lean()
  return { order: decorateOrder(fresh) }
}

export const reopenOrderService = async (tenantId, id) => {
  const txnSupported = isMongoTransactionsSupported()

  const baseOrder = await Order.findOne({ _id: id, tenantId })
  if (!baseOrder) throw error('order_not_found', 'Order not found', 404)
  if (!['closed', 'completed'].includes(baseOrder.status)) {
    const e = new Error('Order not closed')
    e.status = 409
    e.payload = { code: 'not_closed', message: 'Sipariş kapalı değil' }
    throw e
  }

  const apply = async (session) => {
    let q = Order.findOne({ _id: id, tenantId })
    if (session) q = q.session(session)
    const order = await q
    if (!order) throw error('order_not_found', 'Order not found', 404)
    if (!['closed', 'completed'].includes(order.status)) {
      const e = new Error('Order not closed')
      e.status = 409
      e.payload = { code: 'not_closed', message: 'Sipariş kapalı değil' }
      throw e
    }

    if (order.tableId) {
      const updatedTable = await Table.findOneAndUpdate(
        { _id: order.tableId, tenantId, isActive: true, $or: [{ activeOrderId: null }, { activeOrderId: order._id }] },
        { $set: { status: 'occupied', activeOrderId: order._id } },
        session ? { new: true, session } : { new: true }
      )
      if (!updatedTable) {
        const e = new Error('Table in use')
        e.status = 409
        e.payload = { code: 'table_in_use', message: 'Masada başka aktif sipariş var' }
        throw e
      }
    }

    order.status = 'sent'
    order.closedAt = null
    if (session) await order.save({ session })
    else await order.save()
    return order
  }

  if (!txnSupported) {
    const updated = await apply(undefined)
    const fresh = await Order.findById(updated._id).lean()
    return { success: true, order: decorateOrder(fresh) }
  }

  const session = await mongoose.startSession()
  try {
    let updated
    await session.withTransaction(async () => {
      updated = await apply(session)
    })
    const fresh = await Order.findById(updated._id).lean()
    return { success: true, order: decorateOrder(fresh) }
  } finally {
    await session.endSession().catch(() => {})
  }
}

export const listKitchenOrdersService = async (tenantId, branchFilter) => {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000)

  let branchId = null
  let branchIds = []
  if (branchFilter && typeof branchFilter === 'object' && !Array.isArray(branchFilter)) {
    branchId = branchFilter.branchId || null
    branchIds = Array.isArray(branchFilter.branchIds) ? branchFilter.branchIds.map(String).filter(Boolean) : []
  } else {
    branchId = branchFilter || null
  }

  const base = {
    tenantId,
    status: { $in: ['open', 'sent'] },
    createdAt: { $gte: cutoff },
    kitchenEnabled: { $ne: false },
    sendToKitchen: { $ne: false }
  }

  let filter = {
    ...base,
    items: { $elemMatch: { status: { $in: ['sent', 'cooking', 'completed', 'cancelled'] } } }
  }
  filter = applyBranchFilter(filter, branchIds.length > 0 ? branchIds : (branchId ? [branchId] : []))

  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean()

  const creatorIdsToLookup = Array.from(new Set(
    (orders || [])
      .filter(o => !String(o?.createdByName || '').trim())
      .map(o => o?.createdByUserId || o?.createdBy)
      .filter(Boolean)
      .map(String)
  ))

  const userNameById = new Map()
  if (creatorIdsToLookup.length > 0) {
    const users = await User.find({ _id: { $in: creatorIdsToLookup } }).select('name').lean()
    for (const u of users || []) {
      userNameById.set(String(u?._id), String(u?.name || '').trim())
    }
  }

  const cleaned = orders
    .filter(o => !o.createdAt || o.createdAt >= cutoff)
    .map(o => {
      const baseCreatedAt = o.createdAt || new Date()
      const rawItems = Array.isArray(o.items) ? o.items : []
      const batchMeta = Array.isArray(o.kitchenBatches) ? o.kitchenBatches : []
      const batchMetaMap = new Map(batchMeta.map(b => [String(b?.batchId || ''), { servingType: b?.servingType ?? null, sentAt: b?.sentAt ?? null, completedAt: b?.completedAt ?? null }]))
      for (const it of rawItems) {
        if (!it) continue
        if ((it.status === 'sent' || it.status === 'cooking') && !it.sentAt) {
          it.sentAt = baseCreatedAt
        }
        if ((it.status === 'sent' || it.status === 'cooking') && !it.kitchenSentAt) {
          it.kitchenSentAt = it.sentAt || baseCreatedAt
        }
      }

      const byBatch = new Map()
      for (const it of rawItems) {
        if (!it) continue
        if (it.status !== 'sent' && it.status !== 'cooking' && it.status !== 'completed' && it.status !== 'cancelled') continue
        const rawBatchId = it.kitchenBatchId ? String(it.kitchenBatchId) : ''
        const key = rawBatchId || '__legacy__'
        const meta = rawBatchId ? batchMetaMap.get(rawBatchId) : null
        const orderServing = getEffectiveServingTypeForOrder(o)
        const fallbackServing = meta?.servingType ? (normalizeServingType(meta.servingType) || orderServing) : orderServing
        it.servingType = normalizeServingType(it.servingType) || fallbackServing
        const entry = byBatch.get(key) || {
          batchId: rawBatchId || null,
          servingType: normalizeServingType(meta?.servingType) || fallbackServing,
          batchSentAt: meta?.sentAt ?? null,
          sentAt: meta?.sentAt ?? null,
          completedAt: meta?.completedAt ?? null,
          items: [],
          hasActiveItems: false
        }
        entry.items.push(it)
        if (it.status === 'sent' || it.status === 'cooking') entry.hasActiveItems = true
        const itSentAt = it.kitchenSentAt || it.sentAt || baseCreatedAt
        if (!entry.batchSentAt || new Date(itSentAt).getTime() < new Date(entry.batchSentAt).getTime()) {
          entry.batchSentAt = itSentAt
        }
        if (!entry.sentAt || new Date(itSentAt).getTime() < new Date(entry.sentAt).getTime()) {
          entry.sentAt = itSentAt
        }
        byBatch.set(key, entry)
      }

      const batches = Array.from(byBatch.values())
        .filter(b => !b?.completedAt && Array.isArray(b?.items) && b.items.length > 0)
        .sort((a, b) => new Date(b.batchSentAt || 0).getTime() - new Date(a.batchSentAt || 0).getTime())

      return {
        id: String(o._id),
        tableId: o.tableId || null,
        orderNo: o.orderNo ?? null,
        orderDayKey: o.orderDayKey || '',
        status: o.status,
        note: o.note || '',
        totals: o.totals,
        createdAt: o.createdAt,
        saleType: o.saleType,
        orderChannel: String(o.orderChannel || ''),
        approvalStatus: String(o.approvalStatus || ''),
        cancelRequestStatus: String(o.cancelRequestStatus || ''),
        servingType: getEffectiveServingTypeForOrder(o),
        createdByName: String(o.createdByName || userNameById.get(String(o.createdByUserId || o.createdBy)) || ''),
        customerName: o.customerName,
        deliveryStatus: o.deliveryStatus,
        batches
      }
    })
    .filter(o => o.status === 'open' || o.status === 'sent')
    .filter(o => Array.isArray(o.batches) && o.batches.length > 0)

  return cleaned
}

export const completeKitchenBatchByIdService = async (tenantId, orderId, batchId) => {
  const order = await findByIdAndTenant(orderId, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('invalid_state', 'Order not open or sent', 400)

  const target = String(batchId || '').trim()
  if (!target) throw error('invalid_request', 'Invalid batchId', 400)

  const items = Array.isArray(order.items) ? order.items : []
  const now = new Date()
  for (const it of items) {
    if (!it) continue
    if (!['sent', 'cooking'].includes(it.status)) continue
    if (String(it.kitchenBatchId || '') !== target) continue
    it.status = 'completed'
    if (!it.sentAt) it.sentAt = order.createdAt || now
    if (!it.kitchenSentAt) it.kitchenSentAt = it.sentAt
  }
  order.items = items
  if (Array.isArray(order.kitchenBatches)) {
    order.kitchenBatches = order.kitchenBatches.map((batch) => {
      if (String(batch?.batchId || '') !== target) return batch
      const plainBatch = typeof batch?.toObject === 'function' ? batch.toObject() : batch
      return { ...plainBatch, completedAt: now }
    })
  }
  if (order.currentKitchenBatchId && String(order.currentKitchenBatchId) === target) {
    order.currentKitchenBatchId = null
  }
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

export const completeKitchenBatchService = async (tenantId, id) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)

  const currentBatchId = order.currentKitchenBatchId ? String(order.currentKitchenBatchId) : null
  if (currentBatchId) {
    return completeKitchenBatchByIdService(tenantId, id, currentBatchId)
  }

  if (!['open', 'sent'].includes(order.status)) throw error('invalid_state', 'Order not open or sent', 400)
  const items = Array.isArray(order.items) ? order.items : []
  const now = new Date()
  for (const it of items) {
    if (!it) continue
    if (it.status !== 'sent') continue
    it.status = 'completed'
    if (!it.sentAt) it.sentAt = order.createdAt || now
    if (!it.kitchenSentAt) it.kitchenSentAt = it.sentAt
  }
  order.items = items
  if (Array.isArray(order.kitchenBatches) && order.kitchenBatches.length > 0) {
    order.kitchenBatches = order.kitchenBatches.map((batch) => {
      const plainBatch = typeof batch?.toObject === 'function' ? batch.toObject() : batch
      return {
        ...plainBatch,
        completedAt: plainBatch?.completedAt || now
      }
    })
  }
  order.currentKitchenBatchId = null
  await order.save()
  const fresh = await Order.findById(order.id).lean()
  return { order: decorateOrder(fresh) }
}

const getErrText = (err) => {
  const parts = [
    err?.message,
    err?.cause?.message,
    err?.errmsg,
    err?.errorResponse?.errmsg,
    err?.errorResponse?.message,
    err?.response?.errmsg,
    err?.response?.message
  ].filter(Boolean)
  return parts.join(' | ')
}

const isTxnNotSupportedError = (err) => {
  const t = getErrText(err)
  return (
    t.includes('Transaction numbers are only allowed') ||
    t.includes('replica set member') ||
    t.includes('mongos') ||
    t.includes('Transaction support') ||
    t.includes('transactions are not supported')
  )
}

const buildTransferContext = async (tenantId, id, targetTableId) => {
  const order = await findByIdAndTenant(id, tenantId)
  if (!order) throw error('not_found', 'Order not found', 404)
  if (!['open', 'sent'].includes(order.status)) throw error('order_not_transferable', 'Order not transferable', 400)
  if (!order.tableId) throw error('order_not_transferable', 'Order not transferable', 400)
  const sourceTable = await Table.findOne({ _id: order.tableId, tenantId, isActive: true })
  if (!sourceTable) throw error('invalid_table', 'Invalid source table', 400)
  const targetTable = await Table.findOne({ _id: targetTableId, tenantId, isActive: true })
  if (!targetTable) throw error('invalid_table', 'Invalid target table', 400)
  return { order, sourceTable, targetTable }
}

const transferOrderWithTransaction = async (tenantId, id, targetTableId) => {
  logger.info('[TRANSFER_TXN_ENTRY]', { orderId: id, targetTableId })
  const { order, sourceTable, targetTable } = await buildTransferContext(tenantId, id, targetTableId)

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const lockedTarget = await Table.findOneAndUpdate(
        { _id: targetTable.id, tenantId, isActive: true, activeOrderId: null },
        { $set: { activeOrderId: order.id, status: 'occupied' } },
        { new: true, session }
      )
      if (!lockedTarget) {
        const e = new Error('Target table in use')
        e.status = 409
        e.payload = { code: 'table_in_use', message: 'Target table in use' }
        throw e
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: order.id, tenantId, tableId: sourceTable.id, status: { $in: ['open', 'sent'] } },
        { $set: { tableId: targetTable.id } },
        { new: true, session }
      )
      if (!updatedOrder) {
        const e = new Error('Invalid transfer source')
        e.status = 409
        e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
        throw e
      }

      const clearedSource = await Table.findOneAndUpdate(
        { _id: sourceTable.id, tenantId, isActive: true, activeOrderId: order.id },
        { $set: { activeOrderId: null, status: 'empty' } },
        { new: true, session }
      )
      if (!clearedSource) {
        const e = new Error('Invalid transfer source')
        e.status = 409
        e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
        throw e
      }
    })
  } finally {
    await session.endSession()
  }

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_transfer', 'Order', order.id, { targetTableId })
  return { success: true, orderId: String(order.id) }
}

const transferOrderFallbackAtomic = async (tenantId, id, targetTableId) => {
  logger.info('[TRANSFER_FALLBACK_ENTRY]', { orderId: id, targetTableId })
  const { order, sourceTable, targetTable } = await buildTransferContext(tenantId, id, targetTableId)

  const updatedTarget = await Table.findOneAndUpdate(
    { _id: targetTable.id, tenantId, isActive: true, activeOrderId: null },
    { $set: { activeOrderId: order.id, status: 'occupied' } },
    { new: true }
  )
  if (!updatedTarget) {
    const e = new Error('Target table in use')
    e.status = 409
    e.payload = { code: 'table_in_use', message: 'Target table in use' }
    throw e
  }

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order.id, tenantId, tableId: sourceTable.id, status: { $in: ['open', 'sent'] } },
    { $set: { tableId: targetTable.id } },
    { new: true }
  )
  if (!updatedOrder) {
    await Table.findByIdAndUpdate(targetTable.id, { $set: { activeOrderId: null, status: 'empty' } }).catch(() => {})
    const e = new Error('Invalid transfer source')
    e.status = 409
    e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
    throw e
  }

  const updatedSource = await Table.findOneAndUpdate(
    { _id: sourceTable.id, tenantId, isActive: true, activeOrderId: order.id },
    { $set: { activeOrderId: null, status: 'empty' } },
    { new: true }
  )
  if (!updatedSource) {
    await Order.findByIdAndUpdate(order.id, { $set: { tableId: sourceTable.id } }).catch(() => {})
    await Table.findByIdAndUpdate(targetTable.id, { $set: { activeOrderId: null, status: 'empty' } }).catch(() => {})
    const e = new Error('Invalid transfer source')
    e.status = 409
    e.payload = { code: 'invalid_transfer', message: 'Invalid transfer source' }
    throw e
  }

  await (await import('./auditService.js')).log(tenantId, order.createdBy, 'order_transfer', 'Order', order.id, { targetTableId })
  return { success: true, orderId: String(order.id) }
}

export const transferOrderService = async (tenantId, id, targetTableId) => {
  const txnSupported = isMongoTransactionsSupported()
  logger.info('[TRANSFER_SERVICE_ENTRY]', {
    service: 'transferOrderService',
    orderId: id,
    targetTableId,
    txnSupported
  })

  if (!txnSupported) {
    logger.info('[TRANSFER_MODE]', {
      mode: 'fallback_force',
      reason: 'transactions_not_supported',
      orderId: id,
      targetTableId,
      tenantId
    })
    return await transferOrderFallbackAtomic(tenantId, id, targetTableId)
  }

  logger.info('[TRANSFER_MODE]', { mode: 'txn', orderId: id, targetTableId, tenantId })
  try {
    return await transferOrderWithTransaction(tenantId, id, targetTableId)
  } catch (err) {
    const txt = getErrText(err)
    if (isTxnNotSupportedError(err)) {
      logger.warn('[TRANSFER_TXN_UNSUPPORTED_FALLBACK]', {
        message: txt,
        orderId: id,
        targetTableId,
        tenantId
      })
      logger.info('[TRANSFER_MODE]', {
        mode: 'fallback_after_txn_error',
        orderId: id,
        targetTableId,
        tenantId
      })
      return await transferOrderFallbackAtomic(tenantId, id, targetTableId)
    }
    logger.error('[TRANSFER_TXN_ERROR]', {
      message: txt,
      orderId: id,
      targetTableId,
      tenantId
    })
    throw err
  }
}

const normalizeMergedItem = (item) => {
  const qty = toMoney(item?.qty ?? item?.quantity)
  const price = toMoney(item?.priceSnapshot ?? item?.price)
  const subtotal = toMoney(qty * price)
  return {
    ...item,
    qty,
    priceSnapshot: price,
    imageUrl: String(item?.imageUrl || ''),
    subtotal
  }
}

const mergeItems = (targetItems, sourceItems) => {
  const targetList = Array.isArray(targetItems) ? targetItems : []
  const sourceList = Array.isArray(sourceItems) ? sourceItems : []
  return [...targetList, ...sourceList].map(normalizeMergedItem)
}

const buildMergedOrderData = (targetOrder, sourceOrders) => {
  const mergedItems = mergeItems(targetOrder.items, sourceOrders.flatMap(o => o.items))
  for (const it of mergedItems) {
    const qtyRaw = it?.qty ?? it?.quantity
    const priceRaw = it?.priceSnapshot ?? it?.price
    const subtotalRaw = it?.subtotal
    const qtyNum = Number(qtyRaw)
    const priceNum = Number(priceRaw)
    const subtotalNum = Number(subtotalRaw)
    const qtyBad = !Number.isFinite(qtyNum) || qtyNum < 0
    const priceBad = !Number.isFinite(priceNum) || priceNum < 0
    const subtotalBad = subtotalRaw !== undefined && subtotalRaw !== null && !Number.isFinite(subtotalNum)
    if (qtyBad || priceBad || subtotalBad) {
      logger.warn('[MERGE_ITEM_BAD_DATA]', {
        qty: qtyRaw,
        price: priceRaw,
        subtotal: subtotalRaw,
        qtyBad,
        priceBad,
        subtotalBad
      })
    }
  }
  const totals = computeTotals(mergedItems)
  const mergeSourceOrderIds = [
    ...(targetOrder.mergeSourceOrderIds || []),
    ...sourceOrders.map(o => o.id)
  ]
  return { mergedItems, totals, mergeSourceOrderIds }
}

const mergeOrdersWithTransaction = async (tenantId, targetOrder, sourceOrders, sourceTables) => {
  const { mergedItems, totals, mergeSourceOrderIds } = buildMergedOrderData(targetOrder, sourceOrders)
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const safeTotals = {
        ...totals,
        subtotal: Number.isFinite(Number(totals?.subtotal)) ? Number(totals.subtotal) : 0,
        grandTotal: Number.isFinite(Number(totals?.grandTotal)) ? Number(totals.grandTotal) : 0
      }
      if (!Number.isFinite(Number(totals?.grandTotal))) {
        logger.error('[MERGE_TOTALS_NAN]', {
          targetOrderId: targetOrder.id,
          grandTotal: totals?.grandTotal,
          subtotal: totals?.subtotal,
          sampleItems: mergedItems.slice(0, 3)
        })
      }
      await Order.findByIdAndUpdate(
        targetOrder.id,
        { items: mergedItems, totals: safeTotals, mergeSourceOrderIds },
        { new: true, session }
      )
      for (const o of sourceOrders) {
        await Order.findByIdAndUpdate(
          o.id,
          { status: 'merged', mergedIntoOrderId: targetOrder.id },
          { new: true, session }
        )
      }
      await Table.updateMany(
        { _id: { $in: sourceTables.map(t => t.id) } },
        { status: 'empty', activeOrderId: null },
        { session }
      )
    })
  } finally {
    await session.endSession()
  }
}

const mergeOrdersFallbackAtomic = async (tenantId, targetOrder, sourceOrders, sourceTables) => {
  const { mergedItems, totals, mergeSourceOrderIds } = buildMergedOrderData(targetOrder, sourceOrders)
  const safeTotals = {
    ...totals,
    subtotal: Number.isFinite(Number(totals?.subtotal)) ? Number(totals.subtotal) : 0,
    grandTotal: Number.isFinite(Number(totals?.grandTotal)) ? Number(totals.grandTotal) : 0
  }
  if (!Number.isFinite(Number(totals?.grandTotal))) {
    logger.error('[MERGE_TOTALS_NAN]', {
      targetOrderId: targetOrder.id,
      grandTotal: totals?.grandTotal,
      subtotal: totals?.subtotal,
      sampleItems: mergedItems.slice(0, 3)
    })
  }
  await Order.findByIdAndUpdate(
    targetOrder.id,
    { items: mergedItems, totals: safeTotals, mergeSourceOrderIds },
    { new: true }
  )
  for (const o of sourceOrders) {
    await Order.findByIdAndUpdate(
      o.id,
      { status: 'merged', mergedIntoOrderId: targetOrder.id },
      { new: true }
    )
  }
  await Table.updateMany(
    { _id: { $in: sourceTables.map(t => t.id) } },
    { status: 'empty', activeOrderId: null }
  )
}

export const mergeOrdersService = async (tenantId, targetTableId, sourceTableIds = []) => {
  if (!Array.isArray(sourceTableIds) || sourceTableIds.length === 0) throw error('invalid_request', 'No source tables', 400)
  const targetTable = await Table.findOne({ _id: targetTableId, tenantId, isActive: true })
  if (!targetTable || targetTable.status !== 'occupied' || !targetTable.activeOrderId) throw error('invalid_table', 'Invalid target table', 400)
  const targetOrder = await Order.findOne({ _id: targetTable.activeOrderId, tenantId })
  if (!targetOrder || !['open', 'sent'].includes(targetOrder.status)) throw error('order_not_mergeable', 'Order not mergeable', 400)

  const sourceTables = await Table.find({ _id: { $in: sourceTableIds }, tenantId, isActive: true })
  if (sourceTables.length !== sourceTableIds.length) throw error('invalid_table', 'Invalid source table', 400)
  const invalidSource = sourceTables.find(t => t.status !== 'occupied' || !t.activeOrderId)
  if (invalidSource) throw error('invalid_table', 'Invalid source table', 400)
  const sourceOrders = await Order.find({ _id: { $in: sourceTables.map(t => t.activeOrderId) }, tenantId })
  const badOrder = sourceOrders.find(o => !['open', 'sent'].includes(o.status))
  if (badOrder) throw error('order_not_mergeable', 'Order not mergeable', 400)

  const txnSupported = isMongoTransactionsSupported()
  if (!txnSupported) {
    logger.info('[MERGE_MODE]', {
      mode: 'fallback_force',
      reason: 'transactions_not_supported',
      tenantId,
      targetTableId,
      targetOrderId: targetOrder.id,
      sourceTableIds
    })
    await mergeOrdersFallbackAtomic(tenantId, targetOrder, sourceOrders, sourceTables)
  } else {
    logger.info('[MERGE_MODE]', {
      mode: 'txn',
      tenantId,
      targetTableId,
      targetOrderId: targetOrder.id,
      sourceTableIds
    })
    await mergeOrdersWithTransaction(tenantId, targetOrder, sourceOrders, sourceTables)
  }

  await (await import('./auditService.js')).log(
    tenantId,
    targetOrder.createdBy,
    'order_merge',
    'Order',
    targetOrder.id,
    { sourceTableIds, targetTableId }
  )
  return { success: true }
}
