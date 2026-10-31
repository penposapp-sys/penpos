import crypto from 'crypto'
import mongoose from 'mongoose'
import Branch from '../models/Branch.js'
import Category from '../models/Category.js'
import CustomerAccount from '../models/CustomerAccount.js'
import AccountTransaction from '../models/AccountTransaction.js'
import MenuItem from '../models/MenuItem.js'
import Order from '../models/Order.js'
import { isMongoTransactionsSupported } from '../config/db.js'
import { getNextOrderSequence } from './orderService.js'
import { getPaymentMethodsService, resolvePaymentMethodSelection } from './paymentSettingsService.js'
import { isVisibleInBranch } from '../utils/branchVisibility.js'
import { applyBranchFilter } from '../utils/branchFilter.js'
import { error } from '../utils/errors.js'
import { computePaymentSummary } from '../utils/orderFinancial.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { mergeBusinessSettings } from '../utils/businessSettings.js'

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

const portionOptions = (item) => {
  const settings = item?.settings && typeof item.settings === 'object' ? item.settings : {}
  const options = [{ key: 'full', label: '', price: Number(item?.price) }]
  if (settings.halfPortionEnabled === true || item?.halfPortionEnabled === true) {
    options.push({
      key: 'half',
      label: 'Yarim Porsiyon',
      price: Number(settings.halfPortionPrice ?? item?.halfPortionPrice ?? item?.price)
    })
  }
  if (settings.oneAndHalfPortionEnabled === true || item?.oneAndHalfPortionEnabled === true) {
    options.push({
      key: 'one_and_half',
      label: 'Bir Bucuk Porsiyon',
      price: Number(settings.oneAndHalfPortionPrice ?? item?.oneAndHalfPortionPrice ?? item?.price)
    })
  }
  return options
}

const normalizeQuickSaleLines = async ({ tenantId, branchId, inputItems, servingType = 'plate' }) => {
  if (!Array.isArray(inputItems) || inputItems.length === 0 || inputItems.length > 100) {
    throw error('invalid_items', 'Sepette en az bir ürün bulunmalı.', 400)
  }

  const ids = inputItems.map((line) => String(line?.menuItemId || '').trim())
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw error('invalid_items', 'Sepette geçersiz ürün var.', 400)
  }

  const products = await MenuItem.find({
    _id: { $in: ids },
    tenantId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    active: { $ne: false },
    status: { $nin: ['deleted', 'inactive'] }
  }).lean()
  const productById = new Map(products.map((product) => [String(product._id), product]))
  const categoryIds = [...new Set(products.map((product) => String(product.categoryId || '')).filter(Boolean))]
  const categories = await Category.find({ _id: { $in: categoryIds }, tenantId }).select('_id name branchIds').lean()
  const categoryById = new Map(categories.map((category) => [String(category._id), category]))

  return inputItems.map((line) => {
    const menuItemId = String(line.menuItemId)
    const product = productById.get(menuItemId)
    if (!product) throw error('product_unavailable', 'Sepetteki bir ürün artık kullanılamıyor.', 409)
    if (!isVisibleInBranch(product, branchId)) {
      throw error('branch_not_allowed', 'Ürün bu şubede satışa açık değil.', 403)
    }

    const category = categoryById.get(String(product.categoryId || ''))
    if (category && !isVisibleInBranch(category, branchId)) {
      throw error('branch_not_allowed', 'Ürünün kategorisi bu şubede satışa açık değil.', 403)
    }

    const quantity = Number(line.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      throw error('invalid_quantity', 'Ürün adedi geçersiz.', 400)
    }
    const portionKey = String(line.portionKey || 'full')
    const option = portionOptions(product).find((candidate) => candidate.key === portionKey)
    if (!option) throw error('invalid_portion', 'Ürün porsiyon seçimi geçersiz.', 400)
    if (!Number.isFinite(option.price) || option.price < 0) {
      throw error('invalid_product_price', 'Ürünün satış fiyatı geçersiz.', 409)
    }

    const isWeightBased = product.isWeightBased === true
    const weightGrams = isWeightBased ? Number(line.weightGrams) : null
    if (isWeightBased && (!Number.isInteger(weightGrams) || weightGrams < 1 || weightGrams > 100000)) {
      throw error('invalid_weight', 'Gram bilgisi geçersiz.', 400)
    }

    const nameSnapshot = option.label ? `${product.name} (${option.label})` : product.name
    const subtotal = money(isWeightBased
      ? (weightGrams / 1000) * option.price
      : quantity * option.price)
    return {
      menuItemId: product._id,
      productId: product._id,
      productName: String(product.name || ''),
      categoryId: product.categoryId || null,
      categoryName: String(category?.name || ''),
      imageUrl: String(product.imageUrl || ''),
      nameSnapshot: String(nameSnapshot || 'Ürün'),
      priceSnapshot: money(option.price),
      qty: isWeightBased ? 1 : quantity,
      subtotal,
      isWeightBased,
      weightGrams: isWeightBased ? Math.round(weightGrams) : null,
      note: String(line.note || '').trim().slice(0, 500),
      status: 'open',
      servingType
    }
  })
}

const payloadHash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

const normalizeRequestItemsForHash = (items) => Array.isArray(items) ? items.map((line) => ({
  menuItemId: String(line?.menuItemId || '').trim(),
  quantity: Number(line?.quantity),
  portionKey: String(line?.portionKey || 'full'),
  weightGrams: line?.weightGrams === null || line?.weightGrams === undefined || line?.weightGrams === ''
    ? null
    : Number(line.weightGrams),
  note: String(line?.note || '').trim().slice(0, 500),
  servingType: String(line?.servingType || 'plate')
})) : items

const resolveQuickSaleMethod = async (tenantId, branchId, paymentMethod) => {
  const paymentSettings = await getPaymentMethodsService(tenantId, { includeDeleted: false })
  const enabledMethods = (paymentSettings.paymentMethods || []).filter((method) => method.enabled === true && method.isDeleted !== true)
  const requestedMethod = String(paymentMethod || '').trim()
  const configuredMethod = enabledMethods.find((method) => (
    String(method.id || '') === requestedMethod
    || String(method.key || '') === requestedMethod
    || String(method.name || '').toLocaleLowerCase('tr-TR') === requestedMethod.toLocaleLowerCase('tr-TR')
  ))
  if (!configuredMethod) throw error('invalid_payment_method', 'Geçerli ve etkin bir ödeme türü seçin.', 400)
  const resolvedMethod = await resolvePaymentMethodSelection(tenantId, branchId, configuredMethod.id)
  if (resolvedMethod.methodBucket === 'account' || resolvedMethod.methodType === 'account') {
    throw error('invalid_payment_method', 'Hızlı Satışta veresiye ödeme kullanılamaz.', 400)
  }
  return resolvedMethod
}

const saveQuickSale = async ({ orderData, creditAccount, creditAmount, actorUserId, branchId, tenantId, note }) => {
  if (!creditAccount) {
    const [order] = await Order.create([orderData])
    return order
  }

  const now = new Date()
  const creditNote = note || `Hızlı Satış ${orderData.orderNo}`
  const orderId = new mongoose.Types.ObjectId()
  orderData._id = orderId
  const entry = {
    accountId: creditAccount._id,
    accountName: String(creditAccount.name || '').trim(),
    amount: creditAmount,
    note: creditNote,
    createdBy: actorUserId,
    createdAt: now
  }
  const transactionData = {
    tenantId,
    branchId,
    accountId: creditAccount._id,
    type: 'debit',
    amount: creditAmount,
    method: 'other',
    note: creditNote,
    source: 'order_veresiye',
    orderId
  }

  if (isMongoTransactionsSupported()) {
    const session = await mongoose.startSession()
    try {
      let order
      await session.withTransaction(async () => {
        const [transaction] = await AccountTransaction.create([transactionData], { session })
        const accountUpdate = await CustomerAccount.updateOne(
          { _id: creditAccount._id, tenantId, isActive: true },
          { $inc: { balance: creditAmount } },
          { session }
        )
        if (accountUpdate.matchedCount === 0) {
          throw error('invalid_account', 'Cari bulunamadı veya pasif.', 409)
        }
        orderData.veresiyeEntries = [{ ...entry, transactionId: transaction._id }]
        const [createdOrder] = await Order.create([orderData], { session })
        order = createdOrder
      })
      return order
    } finally {
      await session.endSession()
    }
  }

  let accountCredited = false
  let transaction = null
  try {
    const accountUpdate = await CustomerAccount.updateOne(
      { _id: creditAccount._id, tenantId, isActive: true },
      { $inc: { balance: creditAmount } }
    )
    if (accountUpdate.matchedCount === 0) {
      throw error('invalid_account', 'Cari bulunamadı veya pasif.', 409)
    }
    accountCredited = true
    transaction = await AccountTransaction.create(transactionData)
    orderData.veresiyeEntries = [{ ...entry, transactionId: transaction._id }]
    const [order] = await Order.create([orderData])
    return order
  } catch (err) {
    const rollbackErrors = []
    if (transaction) {
      try {
        await AccountTransaction.deleteOne({ _id: transaction._id, tenantId, branchId })
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (accountCredited) {
      try {
        await CustomerAccount.updateOne(
          { _id: creditAccount._id, tenantId },
          { $inc: { balance: -creditAmount } }
        )
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([err, ...rollbackErrors], 'Hızlı satış veresiye işlemi geri alınamadı.')
    }
    throw err
  }
}

export const createQuickSaleService = async (tenantId, userId, branchId, {
  requestId,
  items,
  note,
  paymentMethod,
  discountPercent = 0,
  creditAccountId,
  servingType = 'plate',
  sendToKitchen = true,
  createdByName
} = {}) => {
  const safeRequestId = String(requestId || '').trim()
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(safeRequestId)) {
    throw error('invalid_request_id', 'Satış isteği anahtarı geçersiz.', 400)
  }
  if (!branchId || !mongoose.Types.ObjectId.isValid(String(branchId))) {
    throw error('branch_required', 'Şube gerekli.', 400)
  }
  const safeServingType = String(servingType || 'plate')
  if (!['tray', 'plate', 'package'].includes(safeServingType)) {
    throw error('invalid_serving_type', 'Servis türü geçersiz.', 400)
  }
  if (typeof sendToKitchen !== 'boolean') {
    throw error('invalid_kitchen_setting', 'Mutfak tercihi geçersiz.', 400)
  }

  const safeNote = String(note || '').trim().slice(0, 1000)
  const safeDiscountPercent = Number(discountPercent)
  if (!Number.isFinite(safeDiscountPercent) || safeDiscountPercent < 0 || safeDiscountPercent > 100) {
    throw error('invalid_discount', 'İndirim oranı 0 ile 100 arasında olmalı.', 400)
  }
  const safeCreditAccountId = String(creditAccountId || '').trim()
  if (safeCreditAccountId && !mongoose.Types.ObjectId.isValid(safeCreditAccountId)) {
    throw error('invalid_account', 'Cari seçimi geçersiz.', 400)
  }
  if (safeCreditAccountId && String(paymentMethod || '').trim()) {
    throw error('invalid_payment_selection', 'Ödeme türü ve veresiye aynı satışta birlikte seçilemez.', 400)
  }
  const hash = payloadHash({
    items: normalizeRequestItemsForHash(items),
    note: safeNote,
    paymentMethod: String(paymentMethod || '').trim(),
    discountPercent: safeDiscountPercent,
    creditAccountId: safeCreditAccountId,
    servingType: safeServingType,
    sendToKitchen
  })
  const existing = await Order.findOne({ tenantId, branchId, quickSaleRequestId: safeRequestId })
  if (existing) {
    if (String(existing.quickSalePayloadHash || '') !== hash) {
      throw error('request_id_conflict', 'Satış isteği anahtarı farklı bir satışta kullanılmış.', 409)
    }
    return { order: existing, duplicate: true }
  }

  const normalizedItems = await normalizeQuickSaleLines({
    tenantId,
    branchId,
    inputItems: items,
    servingType: safeServingType
  })
  const subtotal = money(normalizedItems.reduce((sum, item) => sum + item.subtotal, 0))
  if (subtotal <= 0) throw error('invalid_total', 'Satış toplamı sıfırdan büyük olmalı.', 400)

  const netTotal = money(Math.max(0, subtotal - (subtotal * safeDiscountPercent / 100)))
  let resolvedMethod = null
  let creditAccount = null
  if (safeCreditAccountId) {
    if (netTotal <= 0) {
      throw error('invalid_credit_amount', 'İndirim sonrası veresiye tutarı sıfır olamaz.', 400)
    }
    const tenant = await findTenantById(tenantId)
    const settings = mergeBusinessSettings(tenant?.settings || {})
    if (settings.general.disableCreditAccounts === true) {
      throw error('credit_accounts_disabled', 'Cari hesap kullanımı kapalı.', 403)
    }
    creditAccount = await CustomerAccount.findOne({
      _id: safeCreditAccountId,
      tenantId,
      branchId,
      isActive: true
    }).select('_id name branchId').lean()
    if (!creditAccount) throw error('invalid_account', 'Cari bulunamadı veya pasif.', 409)
  } else if (netTotal > 0) {
    resolvedMethod = await resolveQuickSaleMethod(tenantId, branchId, paymentMethod)
  }

  const branch = await Branch.findOne({ _id: branchId, tenantId, isActive: true }).select('name').lean()
  if (!branch) throw error('branch_not_allowed', 'Şube aktif değil veya erişilemiyor.', 403)
  const now = new Date()
  const sequence = await getNextOrderSequence(tenantId, branchId, now)
  const creditAmount = creditAccount ? netTotal : 0
  const quickSaleHistoryDetails = {
    total: netTotal,
    subtotal,
    discountPercent: safeDiscountPercent,
    paymentMethod: resolvedMethod?.methodId || (creditAccount ? 'veresiye' : ''),
    creditAccountId: creditAccount ? String(creditAccount._id) : '',
    servingType: safeServingType,
    sendToKitchen
  }
  const orderData = {
    tenantId,
    branchId,
    branchName: String(branch.name || ''),
    createdBy: userId,
    createdByUserId: userId,
    createdByUserName: String(createdByName || ''),
    createdByName: String(createdByName || ''),
    orderNo: sequence.orderNo,
    orderDayKey: sequence.orderDayKey,
    saleType: 'walkin',
    saleSource: 'quick-sale',
    customerName: safeNote || 'Misafir',
    tableName: safeNote,
    quickSaleRequestId: safeRequestId,
    quickSalePayloadHash: hash,
    quickSaleHistory: [{
      action: 'sale_created',
      actorUserId: userId,
      actorUserName: String(createdByName || ''),
      details: quickSaleHistoryDetails,
      createdAt: now
    }],
    status: 'open',
    kitchenEnabled: sendToKitchen,
    sendToKitchen,
    servingType: safeServingType,
    items: normalizedItems,
    totals: { subtotal, grandTotal: subtotal },
    discountPercent: safeDiscountPercent,
    payments: resolvedMethod ? [{
      method: resolvedMethod.method,
      methodId: resolvedMethod.methodId,
      methodLabel: resolvedMethod.methodLabel,
      methodName: resolvedMethod.methodName,
      methodBucket: resolvedMethod.methodBucket,
      methodType: resolvedMethod.methodType,
      amount: netTotal,
      note: '',
      createdAt: now
    }] : [],
    note: safeNote,
    paymentMethod: resolvedMethod?.methodLabel || (creditAccount ? 'Veresiye' : ''),
    paymentStatus: netTotal <= 0 || creditAccount ? 'paid' : 'unpaid',
    paidAt: netTotal <= 0 || creditAccount ? now : null,
    ...(creditAccount ? {
      settlementType: 'veresiye',
      veresiyeAccountId: creditAccount._id,
      veresiyeAmount: creditAmount,
      veresiyeNote: safeNote,
      veresiyeAt: now
    } : {}),
    createdAt: now,
    updatedAt: now
  }

  try {
    const order = await saveQuickSale({
      orderData,
      creditAccount,
      creditAmount,
      actorUserId: userId,
      branchId,
      tenantId,
      note: safeNote
    })
    return { order, duplicate: false }
  } catch (err) {
    if (err?.code !== 11000) throw err
    const duplicate = await Order.findOne({ tenantId, branchId, quickSaleRequestId: safeRequestId })
    if (!duplicate) throw err
    if (String(duplicate.quickSalePayloadHash || '') !== hash) {
      throw error('request_id_conflict', 'Satış isteği anahtarı farklı bir satışta kullanılmış.', 409)
    }
    return { order: duplicate, duplicate: true }
  }
}

export const getQuickSalesService = async (tenantId, branchIds, limit = 100) => {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100))
  let filter = {
    tenantId,
    saleType: 'walkin',
    saleSource: 'quick-sale',
    paymentStatus: 'paid',
    status: { $nin: ['cancelled', 'merged'] }
  }
  filter = applyBranchFilter(filter, Array.isArray(branchIds) ? branchIds : [])
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean()
  return orders.map((order) => {
    const summary = computePaymentSummary(order)
    return {
      ...order,
      total: summary.total,
      discountTotal: summary.discountTotal,
      netTotal: summary.netTotal,
      paidTotal: summary.paidTotal,
      balanceDue: summary.balanceDue,
      paymentStatus: summary.balanceDue <= 0.01 ? 'paid' : 'unpaid'
    }
  })
}

export const updateQuickSaleNoteService = async (tenantId, branchId, orderId, actor, note) => {
  if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
    throw error('invalid_request', 'Satış numarası geçersiz.', 400)
  }
  const order = await Order.findOneAndUpdate(
    { _id: orderId, tenantId, branchId, saleType: 'walkin', saleSource: 'quick-sale' },
    {
      $set: {
        note: String(note || '').trim().slice(0, 1000),
        customerName: String(note || '').trim().slice(0, 1000) || 'Misafir',
        tableName: String(note || '').trim().slice(0, 1000)
      },
      $push: {
        quickSaleHistory: {
          action: 'note_updated',
          actorUserId: actor?.id || null,
          actorUserName: String(actor?.name || ''),
          details: {},
          createdAt: new Date()
        }
      }
    },
    { new: true, runValidators: true }
  )
  if (!order) throw error('not_found', 'Hızlı satış bulunamadı.', 404)
  return order
}

export const addQuickSaleItemsService = async (tenantId, branchId, orderId, actor, {
  requestId,
  items,
  paymentMethod
} = {}) => {
  const safeRequestId = String(requestId || '').trim()
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(safeRequestId)) {
    throw error('invalid_request_id', 'Satış düzenleme anahtarı geçersiz.', 400)
  }
  if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
    throw error('invalid_request', 'Satış numarası geçersiz.', 400)
  }

  const hash = payloadHash({
    items: normalizeRequestItemsForHash(items),
    paymentMethod: String(paymentMethod || '').trim()
  })
  const query = { _id: orderId, tenantId, branchId, saleType: 'walkin', saleSource: 'quick-sale' }
  const order = await Order.findOne(query)
  if (!order) throw error('not_found', 'Hızlı satış bulunamadı.', 404)

  const priorRequest = (order.quickSaleAdjustmentRequests || []).find((request) => request.requestId === safeRequestId)
  if (priorRequest) {
    if (priorRequest.payloadHash !== hash) {
      throw error('request_id_conflict', 'Düzenleme isteği anahtarı farklı bir işlemde kullanılmış.', 409)
    }
    return { order, duplicate: true }
  }
  if (['closed', 'cancelled', 'merged'].includes(order.status)) {
    throw error('order_not_editable', 'Kapalı veya iptal edilmiş satış düzenlenemez.', 409)
  }
  if (computePaymentSummary(order).balanceDue > 0.01) {
    throw error('sale_not_paid', 'Ürün eklemek için önce mevcut satışın tahsilatını tamamlayın.', 409)
  }

  const newItems = await normalizeQuickSaleLines({ tenantId, branchId, inputItems: items })
  const addedSubtotal = money(newItems.reduce((sum, item) => sum + item.subtotal, 0))
  const discountPercent = Math.max(0, Math.min(100, Number(order.discountPercent) || 0))
  const resolvedMethod = await resolveQuickSaleMethod(tenantId, branchId, paymentMethod)
  const existingSummary = computePaymentSummary(order)
  const nextSubtotal = money(existingSummary.total + addedSubtotal)
  const nextNetTotal = money(nextSubtotal * (1 - discountPercent / 100))
  const paymentAmount = money(nextNetTotal - existingSummary.netTotal)
  if (paymentAmount <= 0) throw error('invalid_total', 'Ek ürünlerin tahsil edilecek tutarı sıfırdan büyük olmalı.', 400)
  const now = new Date()
  const expectedVersion = Number(order.__v) || 0
  const updateResult = await Order.updateOne(
    {
      ...query,
      __v: expectedVersion,
      quickSaleAdjustmentRequests: { $not: { $elemMatch: { requestId: safeRequestId } } }
    },
    {
      $push: {
        items: { $each: newItems },
        payments: {
          method: resolvedMethod.method,
          methodId: resolvedMethod.methodId,
          methodLabel: resolvedMethod.methodLabel,
          methodName: resolvedMethod.methodName,
          methodBucket: resolvedMethod.methodBucket,
          methodType: resolvedMethod.methodType,
          amount: paymentAmount,
          note: 'Hızlı satış ürün ekleme tahsilatı',
          createdAt: now
        },
        quickSaleHistory: {
          action: 'items_added',
          actorUserId: actor?.id || null,
          actorUserName: String(actor?.name || ''),
          details: { itemCount: newItems.length, amount: paymentAmount, paymentMethod: resolvedMethod.methodId },
          createdAt: now
        },
        quickSaleAdjustmentRequests: { requestId: safeRequestId, payloadHash: hash, createdAt: now }
      },
      $set: {
        totals: { subtotal: nextSubtotal, grandTotal: nextSubtotal },
        status: order.status === 'completed' ? 'sent' : order.status,
        paymentStatus: 'paid',
        paidAt: order.paidAt || now
      },
      $inc: { __v: 1 }
    },
    { runValidators: true }
  )

  if (Number(updateResult?.matchedCount ?? updateResult?.n ?? 0) === 0) {
    const latestOrder = await Order.findOne(query)
    const racedRequest = (latestOrder?.quickSaleAdjustmentRequests || []).find((request) => request.requestId === safeRequestId)
    if (racedRequest && racedRequest.payloadHash === hash) {
      return { order: latestOrder, duplicate: true }
    }
    throw error('concurrent_update', 'Satış başka bir işlemde güncellendi. Yeniden deneyin.', 409)
  }

  const updatedOrder = await Order.findOne(query)
  return { order: updatedOrder, duplicate: false }
}
