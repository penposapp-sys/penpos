import mongoose from 'mongoose'
import { getLocalRangeExclusive } from '../../../utils/dateRange.js'
import CanteenSale from '../models/CanteenSale.js'
import CanteenBranch from '../models/CanteenBranch.js'
import CanteenCustomer from '../models/CanteenCustomer.js'
import CanteenTenantSettings from '../models/CanteenTenantSettings.js'
import CanteenProduct from '../models/CanteenProduct.js'
import CanteenStockMovement from '../models/StockMovement.js'
import * as customerRepo from '../repositories/canteenCustomerRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import * as collectionRepo from '../repositories/canteenCustomerCollectionRepository.js'
import { normalizePaymentMethod } from '../../../services/paymentSettingsService.js'
import { getCanteenPaymentMethods } from './canteenPaymentMethodsService.js'
import { buildZReportThermalPayload } from '../../../utils/zReportFormatter.js'
import { addDaysLocal, startOfDayLocal } from '../../../utils/dateRange.js'
import { parseBranchIds } from '../../../utils/branchIds.js'
import User from '../../../models/User.js'
import Tenant from '../../../models/Tenant.js'

const mapReportMethodType = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'card' || raw === 'pos') return 'pos'
  if (raw === 'credit' || raw === 'account') return 'account'
  if (raw === 'cash') return 'cash'
  if (raw === 'bank') return 'bank'
  return raw || 'other'
}

const buildMethodCatalog = async (tenantId, totals = new Map()) => {
  const visible = await getCanteenPaymentMethods(tenantId, { includeDeleted: false })
  const catalog = []
  const seen = new Set()

  for (const method of visible) {
    const id = String(method?.id || '').trim()
    if (!id) continue
    seen.add(id)
    catalog.push({
      id,
      name: String(method?.name || id),
      type: mapReportMethodType(method?.type),
      enabled: method?.enabled === true,
      isDefault: method?.isDefault === true,
      total: Number(totals.get(id)?.total || 0),
    })
  }

  for (const [id, meta] of totals.entries()) {
    if (seen.has(id)) continue
    const normalized = normalizePaymentMethod({ methodId: id, methodName: meta?.name, methodType: meta?.type })
    catalog.push({
      id,
      name: String(normalized.methodName || meta?.name || id),
      type: mapReportMethodType(normalized.methodType || meta?.type),
      enabled: false,
      isDefault: false,
      total: Number(meta?.total || 0),
    })
  }

  return catalog
}

const computeBalanceForCustomer = async (tenantId, customerId) => {
  const sales = await saleRepo.listByTenantAndCustomer(tenantId, customerId, { limit: 10000 })
  const debt = (sales || []).reduce((sum, s) => sum + ((s.payment?.methodType === 'account' || s.payment?.method === 'account' || s.payment?.method === 'credit') ? Number(s.total || 0) : 0), 0)
  const paid = await collectionRepo.sumByCustomerAllBranches(tenantId, customerId)
  return Number(debt - paid)
}

const buildBranchScopeMatch = (branchIds = []) => {
  const ids = (Array.isArray(branchIds) ? branchIds : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => mongoose.isValidObjectId(value))
    .map((value) => new mongoose.Types.ObjectId(value))

  if (ids.length === 0) return null
  return {
    sale: { branchId: { $in: ids } },
    collection: {
      $or: [
        { branchId: { $in: ids } },
        { branchId: null },
        { branchId: { $exists: false } }
      ]
    }
  }
}

const safeToLowerStringExpr = (path) => ({
  $toLower: {
    $convert: {
      input: { $ifNull: [path, ''] },
      to: 'string',
      onError: '',
      onNull: ''
    }
  }
})

const computeCustomerBalanceTotalAt = async (tenantId, branchIds = [], toExclusive) => {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId)
  const saleMatch = {
    tenantId: tenantObjectId,
    isActive: true,
    $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }]
  }
  const collectionMatch = {
    tenantId: tenantObjectId,
    isActive: true,
    isDeleted: { $ne: true }
  }

  if (toExclusive instanceof Date) {
    saleMatch.createdAt = { $lt: toExclusive }
    collectionMatch.createdAt = { $lt: toExclusive }
  }

  const branchScope = buildBranchScopeMatch(branchIds)
  if (branchScope?.sale) Object.assign(saleMatch, branchScope.sale)
  if (branchScope?.collection) Object.assign(collectionMatch, branchScope.collection)

  const [debtRows, collectionRows] = await Promise.all([
    CanteenSale.aggregate([
      { $match: saleMatch },
      {
        $addFields: {
          paymentMethod: safeToLowerStringExpr('$payment.method'),
          paymentMethodType: safeToLowerStringExpr('$payment.methodType'),
          paymentMethodName: safeToLowerStringExpr('$payment.methodName')
        }
      },
      {
        $match: {
          $or: [
            { paymentMethod: { $in: ['account', 'credit'] } },
            { paymentMethodType: { $in: ['account', 'credit'] } },
            { paymentMethodName: /veresiye|cari/i }
          ]
        }
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    CanteenCustomerCollection.aggregate([
      { $match: collectionMatch },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: ['$direction', 'debit'] },
                { $multiply: ['$amount', -1] },
                '$amount'
              ]
            }
          }
        }
      }
    ])
  ])

  const debt = Number(debtRows?.[0]?.total || 0)
  const paid = Number(collectionRows?.[0]?.total || 0)
  return Number(debt - paid)
}

const safeComputeCustomerBalanceTotalAt = async (tenantId, branchIds = [], toExclusive) => {
  try {
    return await computeCustomerBalanceTotalAt(tenantId, branchIds, toExclusive)
  } catch (err) {
    try {
      console.error('[CANTEEN_REPORTS_BALANCE_TOTAL_ERR]', {
        tenantId: String(tenantId || ''),
        branchIds: Array.isArray(branchIds) ? branchIds.map(String) : [],
        toExclusive: toExclusive instanceof Date ? toExclusive.toISOString() : null,
        message: String(err?.message || err)
      })
    } catch {}
    return 0
  }
}

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100

const buildEmptyPaymentSummary = () => ({
  cash: 0,
  card: 0,
  mealCard: 0,
  online: 0,
  credit: 0
})

const buildEmptyCashInSummary = () => ({
  total: 0,
  cash: 0
})

const buildEmptyChannelSummary = () => ({
  qr: 0,
  cashier: 0
})

const detectSaleChannel = (sale = {}) => {
  const raw = String(sale?.channel || '').trim().toLowerCase()
  if (raw === 'qr') return 'qr'
  const note = String(sale?.note || '').trim().toLowerCase()
  if (note.includes('qr siparisi')) return 'qr'
  return 'cashier'
}

const resolveVatRate = (item = {}, productVatRateMap = new Map()) => {
  const directRate = Number(item?.vatRate)
  const productId = String(item?.productId || '')
  const fallbackRate = Number(productVatRateMap.get(productId))
  if (Number.isFinite(directRate) && directRate > 0) return directRate
  if (Number.isFinite(fallbackRate) && fallbackRate > 0) return fallbackRate
  if (Number.isFinite(directRate)) return directRate
  return Number.isFinite(fallbackRate) ? fallbackRate : 0
}

const resolveVatIncluded = (item = {}, productVatIncludedMap = new Map()) => {
  if (item?.vatIncluded !== undefined) return item?.vatIncluded !== false
  const productId = String(item?.productId || '')
  if (!productId) return true
  return productVatIncludedMap.get(productId) !== false
}

const toReportPaymentName = (payment = {}) => {
  const normalized = normalizePaymentMethod({
    methodId: payment?.method,
    methodName: payment?.methodName,
    methodType: payment?.methodType
  })
  const methodId = String(normalized.methodId || payment?.method || '').trim().toLowerCase()
  const methodType = String(normalized.methodType || payment?.methodType || '').trim().toLowerCase()
  const rawName = String(payment?.methodName || normalized.methodName || payment?.method || '').trim()
  const rawNameKey = rawName.toLocaleLowerCase('tr-TR')

  if (methodType === 'credit' || methodType === 'account' || ['account', 'credit', 'veresiye', 'cari'].includes(methodId) || ['account', 'credit'].includes(rawNameKey)) {
    return 'Veresiye / Cari'
  }
  if (methodType === 'cash' || methodId === 'cash' || rawNameKey === 'cash') return 'Nakit'
  if (methodType === 'card' || methodType === 'pos' || ['card', 'pos'].includes(methodId) || ['card', 'pos'].includes(rawNameKey)) return 'Kart'
  if (methodType === 'bank' || methodId === 'bank' || rawNameKey === 'bank') return 'Banka'
  if (rawName) return rawName
  return String(normalized.methodName || 'Diger')
}

const classifyPaymentBucket = (payment = {}) => {
  const method = String(payment?.method || '').trim().toLowerCase()
  const methodType = String(payment?.methodType || '').trim().toLowerCase()
  const methodName = String(payment?.methodName || '').trim().toLowerCase()
  const merged = `${method} ${methodType} ${methodName}`

  if (merged.includes('veresiye') || merged.includes('cari') || method === 'credit' || method === 'account' || methodType === 'account' || methodType === 'credit') return 'credit'
  if (merged.includes('yemek') || merged.includes('ticket') || merged.includes('multinet') || merged.includes('setcard') || merged.includes('metropol') || merged.includes('sodexo') || merged.includes('pluxee')) return 'mealCard'
  if (method === 'online' || methodType === 'online') return 'online'
  if (method === 'bank' || methodType === 'bank' || merged.includes('havale') || merged.includes('eft') || merged.includes('banka')) return 'online'
  if (method === 'card' || method === 'pos' || methodType === 'pos' || methodType === 'card' || merged.includes('kart')) return 'card'
  return 'cash'
}

const pushPaymentBreakdown = (map, payment = {}, amount) => {
  const normalized = normalizePaymentMethod({
    methodId: payment?.method,
    methodName: payment?.methodName,
    methodType: payment?.methodType
  })
  const methodId = String(normalized.methodId || payment?.method || 'other').trim() || 'other'
  const current = map.get(methodId) || {
    methodId,
    methodName: toReportPaymentName(payment),
    methodType: String(normalized.methodType || payment?.methodType || ''),
    totalAmount: 0,
    count: 0
  }
  current.totalAmount += Number(amount || 0)
  current.count += 1
  map.set(methodId, current)
}

const toDisplayBusinessName = (tenant, settings) => {
  const receiptHeader = String(settings?.receiptHeader || '').trim()
  const fromReceipt = receiptHeader
    .split(/\r?\n/g)
    .map((line) => String(line || '').trim())
    .find(Boolean)
  return String(fromReceipt || tenant?.settings?.general?.companyName || tenant?.name || 'PENPOS')
}

const buildDateRangeForReportDate = (reportDate) => {
  const from = startOfDayLocal(reportDate)
  if (!from) {
    const err = new Error('Invalid date')
    err.status = 400
    err.payload = { error: 'invalid_request', code: 'invalid_request', message: 'date required (YYYY-MM-DD)' }
    throw err
  }
  const to = addDaysLocal(from, 1)
  return { from, to }
}

const buildDateRangeForZReport = (query = {}) => {
  const hasPeriod = String(query?.period || '').trim()
  if (hasPeriod) {
    const { from, to, startYmd, endYmd } = getLocalRangeExclusive(query?.period, query?.start, query?.end)
    const isSingleDay = startYmd === endYmd
    return {
      from,
      to,
      label: isSingleDay ? startYmd : `${startYmd} - ${endYmd}`,
      startYmd,
      endYmd
    }
  }

  const reportDate = String(query?.date || '').trim()
  const { from, to } = buildDateRangeForReportDate(reportDate)
  return {
    from,
    to,
    label: reportDate,
    startYmd: reportDate,
    endYmd: reportDate
  }
}

const mapCollectionMethodName = (method) => {
  const key = String(method || '').trim().toLocaleLowerCase('tr-TR')
  if (key === 'cash' || key === 'nakit') return 'Nakit Tahsilat'
  if (['pos', 'card', 'kart'].includes(key)) return 'Kart Tahsilat'
  if (['bank', 'banka', 'eft', 'havale'].includes(key)) return 'Banka Tahsilat'
  if (key === 'discount' || key === 'indirim') return 'Indirim Mahsup'
  return String(method || 'Diger Tahsilat')
}

const pushCollectionBreakdown = (map, collection = {}) => {
  const methodId = String(collection?.method || 'other').trim() || 'other'
  const current = map.get(methodId) || {
    methodId,
    methodName: mapCollectionMethodName(collection?.method),
    totalAmount: 0,
    count: 0
  }
  current.totalAmount += Number(collection?.amount || 0)
  current.count += 1
  map.set(methodId, current)
}

const resolveCashInMethodMeta = ({ method, methodName, methodType } = {}) => {
  const normalized = normalizePaymentMethod({
    methodId: method,
    methodName,
    methodType
  })
  const methodId = String(normalized.methodId || method || 'other').trim() || 'other'
  const payment = {
    method: methodId,
    methodName: String(normalized.methodName || methodName || methodId),
    methodType: String(normalized.methodType || methodType || '')
  }
  const bucket = classifyPaymentBucket(payment)
  return {
    methodId,
    methodName: toReportPaymentName(payment),
    methodType: String(payment.methodType || ''),
    bucket
  }
}

const pushCashInBreakdown = (map, meta = {}, amount) => {
  const totalAmount = Number(amount || 0)
  if (totalAmount <= 0) return
  const current = map.get(meta.methodId) || {
    methodId: String(meta.methodId || 'other'),
    methodName: String(meta.methodName || 'Diger'),
    methodType: String(meta.methodType || ''),
    totalAmount: 0,
    count: 0
  }
  current.totalAmount += totalAmount
  current.count += 1
  map.set(meta.methodId, current)
}

const isReportableCollection = (collection = {}) => {
  const direction = String(collection?.direction || 'credit').trim()
  const method = String(collection?.method || '').trim()
  return direction !== 'debit' && method !== 'manual'
}

const isCashInCollection = (collection = {}) => {
  if (!isReportableCollection(collection)) return false
  const key = String(collection?.method || '').trim().toLocaleLowerCase('tr-TR')
  return key !== 'discount' && key !== 'indirim'
}

const buildCashMovementDescription = (sale = {}, barcodeMap = new Map()) => {
  const items = Array.isArray(sale?.items) ? sale.items : []
  const itemNames = items
    .map((item) => String(item?.name || '').trim())
    .filter(Boolean)
  const uniqueNames = Array.from(new Set(itemNames))
  const firstNames = uniqueNames.slice(0, 2)
  const moreCount = Math.max(0, uniqueNames.length - firstNames.length)
  const itemSummary = firstNames.length > 0
    ? `${firstNames.join(', ')}${moreCount > 0 ? ` +${moreCount}` : ''}`
    : 'Satis islemi'
  const note = String(sale?.note || '').trim()
  const barcode = Array.from(new Set(
    items
      .map((item) => barcodeMap.get(String(item?.productId || '')))
      .filter(Boolean)
  )).slice(0, 3).join(', ')

  return {
    description: note ? `${itemSummary} - ${note}` : itemSummary,
    barcode: barcode || '-'
  }
}

const isStockCountMovementNote = (note = '') => String(note || '').trim().toLowerCase().startsWith('stock_count:')

const resolveStockMovementAmount = (movement = {}, productMap = new Map()) => {
  const directAmount = Number(movement?.totalAmount || 0)
  if (directAmount > 0) return roundMoney(directAmount)
  const product = productMap.get(String(movement?.productId || '')) || {}
  const unitCost = Number(movement?.unitCost || product?.costPrice || 0)
  const deltaQty = movement?.deltaQty === null || movement?.deltaQty === undefined
    ? null
    : Number(movement?.deltaQty || 0)
  if (deltaQty !== null) return roundMoney(Math.abs(deltaQty) * unitCost)
  return roundMoney(Math.abs(Number(movement?.qty || 0)) * unitCost)
}

const resolveStockMovementCashEffect = (movement = {}) => {
  const direct = String(movement?.cashEffect || '').trim().toLowerCase()
  if (direct === 'income' || direct === 'expense') return direct
  const type = String(movement?.type || '').trim().toLowerCase()
  if (type === 'in') return 'expense'
  if (type === 'adjust' && isStockCountMovementNote(movement?.note)) {
    const deltaQty = movement?.deltaQty === null || movement?.deltaQty === undefined
      ? null
      : Number(movement?.deltaQty || 0)
    if (deltaQty !== null) {
      if (deltaQty < -0.0001) return 'expense'
      if (deltaQty > 0.0001) return 'income'
    }
  }
  return ''
}

const resolveStockMovementReason = (movement = {}) => {
  const type = String(movement?.type || '').trim().toLowerCase()
  if (type === 'in') return 'Urun Girisi'
  if (type === 'adjust' && isStockCountMovementNote(movement?.note)) {
    const deltaQty = movement?.deltaQty === null || movement?.deltaQty === undefined
      ? null
      : Number(movement?.deltaQty || 0)
    if (deltaQty !== null && deltaQty < -0.0001) return 'Sayim Eksigi'
    if (deltaQty !== null && deltaQty > 0.0001) return 'Sayim Fazlasi'
    return 'Sayim Duzeltmesi'
  }
  return ''
}

const normalizeCashMethodFilter = (value) => {
  const raw = String(value || 'all').trim().toLocaleLowerCase('tr-TR')
  if (['all', 'cash', 'pos', 'bank', 'sales', 'collection', 'stock'].includes(raw)) return raw
  return 'all'
}

const normalizeCashMovementType = (value) => {
  const raw = String(value || 'all').trim().toLocaleLowerCase('tr-TR')
  if (['all', 'income', 'expense'].includes(raw)) return raw
  return 'all'
}

const matchesCashFilter = ({ movementType, filterType, source, methodId, rowType = 'income' }) => {
  const normalizedSource = String(source || '').trim().toLocaleLowerCase('tr-TR')
  const normalizedMethod = String(methodId || '').trim().toLocaleLowerCase('tr-TR')
  if (filterType === 'sales' && normalizedSource !== 'sale') return false
  if (filterType === 'collection' && normalizedSource !== 'collection') return false
  if (filterType === 'stock' && normalizedSource !== 'stock') return false
  if (['cash', 'pos', 'bank'].includes(filterType) && normalizedMethod !== filterType) return false
  if (movementType === 'income' && rowType === 'expense') return false
  if (movementType === 'expense' && rowType !== 'expense') return false
  return true
}

const toTimeStringTr = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export const cashReport = async (tenantId, branchIds, query = {}) => {
  const { from, to, startYmd, endYmd } = buildDateRangeForZReport(query)
  const allowedIds = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const requestedIds = parseBranchIds(query?.branchId, query?.branchIds)
  const finalBranchIds = requestedIds.length > 0
    ? requestedIds.filter((id) => allowedIds.includes(String(id)))
    : allowedIds

  if (finalBranchIds.length === 0) {
    const err = new Error('Branch not allowed')
    err.status = 403
    err.payload = { error: 'branch_not_allowed', code: 'branch_not_allowed', message: 'Branch not allowed' }
    throw err
  }

  const movementType = normalizeCashMovementType(query?.movementType)
  const filterType = normalizeCashMethodFilter(query?.filterType)
  const branchObjectIds = finalBranchIds.map((id) => new mongoose.Types.ObjectId(id))
  const saleMatch = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    branchId: { $in: branchObjectIds },
    isActive: true,
    $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }],
    createdAt: { $gte: from, $lt: to }
  }

  const [sales, collections, branches, stockMovements] = await Promise.all([
    CanteenSale.find(saleMatch)
      .select({
        branchId: 1,
        customerId: 1,
        items: 1,
        total: 1,
        payment: 1,
        note: 1,
        createdAt: 1
      })
      .sort({ createdAt: -1 })
      .lean(),
    collectionRepo.listRangeByTenantAndBranches(tenantId, finalBranchIds, from, to),
    CanteenBranch.find({ tenantId, _id: { $in: branchObjectIds } }).select({ _id: 1, name: 1 }).lean(),
    CanteenStockMovement.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      branchId: { $in: branchObjectIds },
      createdAt: { $gte: from, $lt: to }
    })
      .select({
        branchId: 1,
        productId: 1,
        productName: 1,
        barcode: 1,
        type: 1,
        qty: 1,
        previousQty: 1,
        deltaQty: 1,
        unitCost: 1,
        totalAmount: 1,
        cashEffect: 1,
        note: 1,
        createdAt: 1
      })
      .sort({ createdAt: -1 })
      .lean()
  ])

  const productIds = Array.from(new Set(
    [
      ...(sales || [])
      .flatMap((sale) => Array.isArray(sale?.items) ? sale.items : [])
      .map((item) => String(item?.productId || ''))
      .filter((id) => mongoose.Types.ObjectId.isValid(id)),
      ...(stockMovements || [])
        .map((movement) => String(movement?.productId || ''))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    ]
  ))
  const customerIds = Array.from(new Set(
    (collections || [])
      .map((collection) => String(collection?.customerId || ''))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  ))

  const [products, customers] = await Promise.all([
    productIds.length > 0
      ? CanteenProduct.find({ tenantId, _id: { $in: productIds } }).select({ _id: 1, barcode: 1, name: 1, costPrice: 1 }).lean()
      : [],
    customerIds.length > 0
      ? CanteenCustomer.find({ tenantId, _id: { $in: customerIds } }).select({ _id: 1, name: 1 }).lean()
      : []
  ])

  const barcodeMap = new Map((products || []).map((product) => [String(product._id), String(product.barcode || '').trim()]))
  const productMap = new Map((products || []).map((product) => [String(product._id), product]))
  const customerMap = new Map((customers || []).map((customer) => [String(customer._id), String(customer.name || '').trim()]))
  const branchMap = new Map((branches || []).map((branch) => [String(branch._id), String(branch.name || '').trim()]))

  const rows = []
  let incomeTotal = 0
  let expenseTotal = 0

  for (const sale of sales || []) {
    const payment = sale?.payment || {}
    const bucket = classifyPaymentBucket(payment)
    if (bucket === 'credit') continue

    const normalized = normalizePaymentMethod({
      methodId: payment?.method,
      methodName: payment?.methodName,
      methodType: payment?.methodType
    })
    const methodId = String(normalized.methodId || payment?.method || '').trim().toLocaleLowerCase('tr-TR')
    if (!matchesCashFilter({ movementType, filterType, source: 'sale', methodId, rowType: 'income' })) continue

    const amount = roundMoney(sale?.total || 0)
    if (amount <= 0) continue
    incomeTotal += amount

    const details = buildCashMovementDescription(sale, barcodeMap)
    rows.push({
      id: `sale:${String(sale?._id || '')}`,
      createdAt: sale?.createdAt ? new Date(sale.createdAt).toISOString() : null,
      date: sale?.createdAt ? new Date(sale.createdAt).toLocaleDateString('tr-TR') : '',
      time: toTimeStringTr(sale?.createdAt),
      type: 'Gelir',
      source: 'sale',
      reason: 'Satis Geliri',
      description: details.description,
      amount,
      methodId,
      methodName: toReportPaymentName(payment),
      branchName: String(branchMap.get(String(sale?.branchId || '')) || ''),
      barcode: details.barcode
    })
  }

  for (const collection of collections || []) {
    const methodKey = String(collection?.method || '').trim().toLocaleLowerCase('tr-TR')
    if (!['cash', 'pos', 'bank'].includes(methodKey)) continue

    const direction = String(collection?.direction || 'credit').trim().toLocaleLowerCase('tr-TR')
    const type = direction === 'debit' ? 'Gider' : 'Gelir'
    if (!matchesCashFilter({ movementType, filterType, source: 'collection', methodId: methodKey, rowType: direction === 'debit' ? 'expense' : 'income' })) continue

    const amount = roundMoney(collection?.amount || 0)
    if (amount <= 0) continue
    if (direction === 'debit') expenseTotal += amount
    else incomeTotal += amount

    const customerName = String(customerMap.get(String(collection?.customerId || '')) || 'Cari')
    const note = String(collection?.note || '').trim()
    rows.push({
      id: `collection:${String(collection?._id || '')}`,
      createdAt: collection?.createdAt ? new Date(collection.createdAt).toISOString() : null,
      date: collection?.createdAt ? new Date(collection.createdAt).toLocaleDateString('tr-TR') : '',
      time: toTimeStringTr(collection?.createdAt),
      type,
      source: 'collection',
      reason: direction === 'debit' ? 'Cari Cikis Hareketi' : 'Cari Tahsilati',
      description: note ? `${customerName} - ${note}` : customerName,
      amount,
      methodId: methodKey,
      methodName: mapCollectionMethodName(collection?.method),
      branchName: String(branchMap.get(String(collection?.branchId || '')) || ''),
      barcode: '-'
    })
  }

  for (const movement of stockMovements || []) {
    const cashEffect = resolveStockMovementCashEffect(movement)
    if (!cashEffect) continue

    const rowType = cashEffect === 'expense' ? 'expense' : 'income'
    const methodId = 'stock'
    if (!matchesCashFilter({ movementType, filterType, source: 'stock', methodId, rowType })) continue

    const amount = resolveStockMovementAmount(movement, productMap)
    if (amount <= 0) continue
    if (cashEffect === 'expense') expenseTotal += amount
    else incomeTotal += amount

    rows.push({
      id: `stock:${String(movement?._id || '')}`,
      createdAt: movement?.createdAt ? new Date(movement.createdAt).toISOString() : null,
      date: movement?.createdAt ? new Date(movement.createdAt).toLocaleDateString('tr-TR') : '',
      time: toTimeStringTr(movement?.createdAt),
      type: cashEffect === 'expense' ? 'Gider' : 'Gelir',
      source: 'stock',
      reason: resolveStockMovementReason(movement) || 'Stok Hareketi',
      description: String(movement?.productName || productMap.get(String(movement?.productId || ''))?.name || 'Urun'),
      amount,
      methodId,
      methodName: 'Stok Maliyeti',
      branchName: String(branchMap.get(String(movement?.branchId || '')) || ''),
      barcode: String(movement?.barcode || productMap.get(String(movement?.productId || ''))?.barcode || '-')
    })
  }

  rows.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bTime - aTime
  })

  return {
    dateRange: {
      start: startYmd,
      end: endYmd
    },
    filters: {
      movementType,
      filterType
    },
    summary: {
      incomeTotal: roundMoney(incomeTotal),
      expenseTotal: roundMoney(expenseTotal),
      netTotal: roundMoney(incomeTotal - expenseTotal),
      count: rows.length
    },
    rows
  }
}

export const zReport = async (tenantId, branchIds, query = {}) => {
  const { from, to, label: reportDateLabel } = buildDateRangeForZReport(query)
  const allowedIds = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const requestedIds = parseBranchIds(query?.branchId, query?.branchIds)
  const finalBranchIds = requestedIds.length > 0
    ? requestedIds.filter((id) => allowedIds.includes(String(id)))
    : allowedIds

  if (finalBranchIds.length === 0) {
    const err = new Error('Branch not allowed')
    err.status = 403
    err.payload = { error: 'branch_not_allowed', code: 'branch_not_allowed', message: 'Branch not allowed' }
    throw err
  }

  const branchObjectIds = finalBranchIds.map((id) => new mongoose.Types.ObjectId(id))
  const match = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    branchId: { $in: branchObjectIds },
    isActive: true,
    $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }],
    createdAt: { $gte: from, $lt: to }
  }

  const [sales, branches, settings, tenant, collections, customerBalanceTotal] = await Promise.all([
    CanteenSale.find(match)
      .select({
        branchId: 1,
        customerId: 1,
        items: 1,
        subTotal: 1,
        total: 1,
        channel: 1,
        note: 1,
        payment: 1,
        actorUserId: 1,
        createdAt: 1
      })
      .lean(),
    CanteenBranch.find({ tenantId, _id: { $in: branchObjectIds } }).select({ _id: 1, name: 1 }).lean(),
    CanteenTenantSettings.findOne({ tenantId }).lean(),
    Tenant.findById(tenantId).select({ name: 1, settings: 1 }).lean(),
    collectionRepo.listRangeByTenantAndBranches(tenantId, finalBranchIds, from, to),
    safeComputeCustomerBalanceTotalAt(tenantId, finalBranchIds, to)
  ])

  const productIds = Array.from(new Set(
    (sales || [])
      .flatMap((sale) => Array.isArray(sale?.items) ? sale.items : [])
      .map((item) => String(item?.productId || ''))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  ))
  const productMetaMap = productIds.length > 0
    ? new Map(
        (await CanteenProduct.find({ tenantId, _id: { $in: productIds } })
          .select({ _id: 1, vatRate: 1, vatIncluded: 1 })
          .lean())
          .map((product) => [String(product._id), { vatRate: Number(product.vatRate || 0), vatIncluded: product.vatIncluded !== false }])
      )
    : new Map()
  const productVatRateMap = new Map(Array.from(productMetaMap.entries()).map(([id, meta]) => [id, Number(meta?.vatRate || 0)]))
  const productVatIncludedMap = new Map(Array.from(productMetaMap.entries()).map(([id, meta]) => [id, meta?.vatIncluded !== false]))

  const staffIds = Array.from(new Set(
    (sales || [])
      .map((sale) => String(sale?.actorUserId || ''))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  ))
  const users = staffIds.length > 0
    ? await User.find({ tenantId, _id: { $in: staffIds.map((id) => new mongoose.Types.ObjectId(id)) } }).select({ _id: 1, name: 1 }).lean()
    : []

  const branchMap = new Map((branches || []).map((branch) => [String(branch._id), String(branch.name || 'Silinmis Sube')]))
  const userMap = new Map((users || []).map((user) => [String(user._id), String(user.name || 'Silinmis Personel')]))

  const summary = {
    orderCount: 0,
    productCount: 0,
    grossSales: 0,
    discountTotal: 0,
    cancelTotal: 0,
    netSales: 0,
    paidSalesTotal: 0,
    payments: buildEmptyPaymentSummary(),
    cashIn: buildEmptyCashInSummary(),
    collectionsTotal: 0,
    periodCreditBalance: 0,
    customerBalanceTotal: roundMoney(customerBalanceTotal),
    salesChannels: buildEmptyChannelSummary(),
    vatBreakdown: []
  }
  const paymentBreakdownMap = new Map()
  const collectionBreakdownMap = new Map()
  const cashInBreakdownMap = new Map()
  const topProductMap = new Map()
  const staffTotalsMap = new Map()
  const branchTotalsMap = new Map()
  const vatTotalsMap = new Map()

  for (const sale of (sales || [])) {
    const branchId = String(sale?.branchId || '')
    const branchName = String(branchMap.get(branchId) || 'Silinmis Sube')
    const total = Number(sale?.total || 0)
    const subTotal = Number(sale?.subTotal || 0)
    const grossSales = Math.max(subTotal, total)
    const discountTotal = Math.max(0, grossSales - total)
    const items = Array.isArray(sale?.items) ? sale.items : []

    summary.orderCount += 1
    summary.grossSales += grossSales
    summary.discountTotal += discountTotal
    summary.netSales += total
    summary.salesChannels[detectSaleChannel(sale)] += total

    const branchRow = branchTotalsMap.get(branchId) || { branchName, orderCount: 0, netSales: 0 }
    branchRow.orderCount += 1
    branchRow.netSales += total
    branchTotalsMap.set(branchId, branchRow)

    for (const item of items) {
      const productId = String(item?.productId || 'manual')
      const productName = String(item?.name || 'Silinmis Urun')
      const qty = Number(item?.qty || 0)
      const lineTotal = Number(item?.lineTotal || 0)
      const vatRate = resolveVatRate(item, productVatRateMap)
      const vatIncluded = resolveVatIncluded(item, productVatIncludedMap)
      summary.productCount += qty

      if (lineTotal > 0 && vatRate >= 0) {
        const divider = 1 + (vatRate / 100)
        const amount = divider > 0 ? lineTotal / divider : lineTotal
        const vat = Math.max(0, lineTotal - amount)
        const vatKey = vatRate.toFixed(2)
        const currentVat = vatTotalsMap.get(vatKey) || { rate: vatRate, amount: 0, vat: 0 }
        currentVat.amount += amount
        currentVat.vat += vat
        vatTotalsMap.set(vatKey, currentVat)
      }

      const productKey = `${productId}|${productName}`
      const currentProduct = topProductMap.get(productKey) || { name: productName, quantity: 0, total: 0 }
      currentProduct.quantity += qty
      currentProduct.total += lineTotal
      topProductMap.set(productKey, currentProduct)
    }

    const payment = sale?.payment || {}
    const bucket = classifyPaymentBucket(payment)
    summary.payments[bucket] += total
    pushPaymentBreakdown(paymentBreakdownMap, payment, total)
    if (bucket !== 'credit') {
      summary.paidSalesTotal += total
      const cashInMeta = resolveCashInMethodMeta(payment)
      pushCashInBreakdown(cashInBreakdownMap, cashInMeta, total)
      summary.cashIn.total += total
      if (cashInMeta.bucket === 'cash') summary.cashIn.cash += total
    }

    const staffId = String(sale?.actorUserId || '')
    const staffName = String(userMap.get(staffId) || 'Bilinmeyen Personel')
    const staffRow = staffTotalsMap.get(staffName) || { staffName, orderCount: 0, total: 0 }
    staffRow.orderCount += 1
    staffRow.total += total
    staffTotalsMap.set(staffName, staffRow)
  }

  for (const collection of (collections || [])) {
    if (!isReportableCollection(collection)) continue
    const amount = Number(collection?.amount || 0)
    summary.collectionsTotal += amount
    pushCollectionBreakdown(collectionBreakdownMap, collection)
    if (isCashInCollection(collection)) {
      const cashInMeta = resolveCashInMethodMeta({ method: collection?.method, methodName: collection?.method, methodType: collection?.method })
      pushCashInBreakdown(cashInBreakdownMap, cashInMeta, amount)
      summary.cashIn.total += amount
      if (cashInMeta.bucket === 'cash') summary.cashIn.cash += amount
    }
  }

  const paymentBreakdown = Array.from(paymentBreakdownMap.values())
    .map((row) => ({
      methodId: String(row.methodId || ''),
      methodName: String(row.methodName || 'Diger'),
      methodType: String(row.methodType || ''),
      totalAmount: roundMoney(row.totalAmount),
      count: Number(row.count || 0)
    }))
    .sort((a, b) => (b.totalAmount - a.totalAmount) || String(a.methodName).localeCompare(String(b.methodName), 'tr'))

  const collectionBreakdown = Array.from(collectionBreakdownMap.values())
    .map((row) => ({
      methodId: String(row.methodId || ''),
      methodName: String(row.methodName || 'Diger Tahsilat'),
      totalAmount: roundMoney(row.totalAmount),
      count: Number(row.count || 0)
    }))
    .sort((a, b) => (b.totalAmount - a.totalAmount) || String(a.methodName).localeCompare(String(b.methodName), 'tr'))

  const cashInBreakdown = Array.from(cashInBreakdownMap.values())
    .map((row) => ({
      methodId: String(row.methodId || ''),
      methodName: String(row.methodName || 'Diger'),
      methodType: String(row.methodType || ''),
      totalAmount: roundMoney(row.totalAmount),
      count: Number(row.count || 0)
    }))
    .sort((a, b) => (b.totalAmount - a.totalAmount) || String(a.methodName).localeCompare(String(b.methodName), 'tr'))

  const topProducts = Array.from(topProductMap.values())
    .map((row) => ({
      name: String(row.name || '-'),
      quantity: Number(row.quantity || 0),
      total: roundMoney(row.total)
    }))
    .sort((a, b) => (b.total - a.total) || (b.quantity - a.quantity))

  const staffTotals = Array.from(staffTotalsMap.values())
    .map((row) => ({
      staffName: String(row.staffName || 'Bilinmeyen Personel'),
      orderCount: Number(row.orderCount || 0),
      total: roundMoney(row.total)
    }))
    .sort((a, b) => (b.total - a.total) || (b.orderCount - a.orderCount))

  const branchTotals = Array.from(branchTotalsMap.values())
    .map((row) => ({
      branchName: String(row.branchName || 'Silinmis Sube'),
      orderCount: Number(row.orderCount || 0),
      netSales: roundMoney(row.netSales)
    }))
    .sort((a, b) => (b.netSales - a.netSales) || (b.orderCount - a.orderCount))

  summary.grossSales = roundMoney(summary.grossSales)
  summary.discountTotal = roundMoney(summary.discountTotal)
  summary.cancelTotal = roundMoney(summary.cancelTotal)
  summary.netSales = roundMoney(summary.netSales)
  summary.paidSalesTotal = roundMoney(summary.paidSalesTotal)
  summary.payments = {
    cash: roundMoney(summary.payments.cash),
    card: roundMoney(summary.payments.card),
    mealCard: roundMoney(summary.payments.mealCard),
    online: roundMoney(summary.payments.online),
    credit: roundMoney(summary.payments.credit)
  }
  summary.cashIn = {
    total: roundMoney(summary.cashIn.total),
    cash: roundMoney(summary.cashIn.cash)
  }
  summary.collectionsTotal = roundMoney(summary.collectionsTotal)
  summary.periodCreditBalance = roundMoney(summary.payments.credit - summary.collectionsTotal)
  summary.salesChannels = {
    qr: roundMoney(summary.salesChannels.qr),
    cashier: roundMoney(summary.salesChannels.cashier)
  }
  summary.vatBreakdown = Array.from(vatTotalsMap.values())
    .map((row) => ({
      rate: Number(row.rate || 0),
      amount: roundMoney(row.amount),
      vat: roundMoney(row.vat)
    }))
    .sort((a, b) => a.rate - b.rate)

  const singleBranchId = finalBranchIds.length === 1 ? finalBranchIds[0] : 'all'
  const singleBranchName = finalBranchIds.length === 1
    ? String(branchMap.get(finalBranchIds[0]) || 'Silinmis Sube')
    : 'Tum Subeler'

  const report = {
    date: reportDateLabel,
    branchId: singleBranchId,
    branchName: singleBranchName,
    businessName: toDisplayBusinessName(tenant, settings),
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      paymentBreakdown,
      collectionBreakdown,
      cashInBreakdown
    },
    topProducts,
    staffTotals,
    branchTotals
  }

  return {
    ...report,
    thermal: buildZReportThermalPayload(report)
  }
}

export const summary = async (tenantId, branchIds, query) => {
  const { from, to } = getLocalRangeExclusive(query?.period, query?.start, query?.end)
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const match = { tenantId: new mongoose.Types.ObjectId(tenantId), branchId: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }, isActive: true, $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }], createdAt: { $gte: from, $lt: to } }

  const [sales, collections, customerBalanceTotal] = await Promise.all([
    CanteenSale.find(match)
      .select({ total: 1, payment: 1 })
      .lean(),
    collectionRepo.listRangeByTenantAndBranches(tenantId, ids, from, to),
    safeComputeCustomerBalanceTotalAt(tenantId, ids, to)
  ])

  const totalRevenue = (sales || []).reduce((sum, sale) => sum + Number(sale?.total || 0), 0)
  const saleCount = Number((sales || []).length)
  const avgBasket = saleCount > 0 ? totalRevenue / saleCount : 0

  const methodTotals = new Map()
  const byMethod = {}

  const appendMethodTotal = (paymentLike = {}, amount = 0) => {
    const total = Number(amount || 0)
    if (!Number.isFinite(total) || total <= 0) return
    const normalized = normalizePaymentMethod({
      methodId: paymentLike?.method,
      methodName: paymentLike?.methodName,
      methodType: paymentLike?.methodType
    })
    const methodId = String(normalized.methodId || paymentLike?.method || 'other').trim() || 'other'
    const current = methodTotals.get(methodId) || {
      total: 0,
      name: String(normalized.methodName || paymentLike?.methodName || methodId),
      type: String(normalized.methodType || paymentLike?.methodType || '')
    }
    current.total += total
    methodTotals.set(methodId, current)
  }

  for (const sale of (sales || [])) {
    const payment = sale?.payment || {}
    const total = Number(sale?.total || 0)
    const bucket = classifyPaymentBucket(payment)
    if (bucket === 'credit') {
      appendMethodTotal({ method: 'account', methodName: 'Cari / Veresiye', methodType: 'account' }, total)
      continue
    }
    appendMethodTotal(payment, total)
  }

  for (const collection of (collections || [])) {
    if (!isCashInCollection(collection)) continue
    appendMethodTotal({
      method: collection?.method,
      methodName: mapCollectionMethodName(collection?.method),
      methodType: collection?.method
    }, collection?.amount)
  }

  for (const [id, meta] of methodTotals.entries()) {
    byMethod[id] = roundMoney(meta.total)
  }

  const methodBreakdown = await buildMethodCatalog(tenantId, methodTotals)
  return {
    totalRevenue: roundMoney(totalRevenue),
    saleCount,
    avgBasket: roundMoney(avgBasket),
    periodCreditBalance: roundMoney(
      (sales || []).reduce((sum, sale) => {
        const payment = sale?.payment || {}
        const total = Number(sale?.total || 0)
        return classifyPaymentBucket(payment) === 'credit' ? sum + total : sum
      }, 0) - (collections || []).reduce((sum, collection) => (
        isReportableCollection(collection) ? sum + Number(collection?.amount || 0) : sum
      ), 0)
    ),
    customerBalanceTotal: roundMoney(customerBalanceTotal),
    byMethod,
    methodBreakdown
  }
}

export const products = async (tenantId, branchIds, query) => {
  const { from, to } = getLocalRangeExclusive(query?.period, query?.start, query?.end)
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const match = { tenantId: new mongoose.Types.ObjectId(tenantId), branchId: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }, isActive: true, $or: [{ status: { $exists: false } }, { status: { $in: ['completed', 'closed'] } }, { status: null }], createdAt: { $gte: from, $lt: to } }
  const rows = await CanteenSale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        qty: { $sum: '$items.qty' },
        total: { $sum: '$items.lineTotal' }
      }
    },
    { $sort: { total: -1 } },
    { $limit: 100 }
  ])
  return rows.map(r => ({ productId: String(r._id), name: String(r.name || ''), qty: Number(r.qty || 0), total: Number(r.total || 0) }))
}

export const customers = async (tenantId, branchIds) => {
  const items = await customerRepo.listByTenant(tenantId, { includeInactive: true })
  const out = []
  for (const c of items) {
    const balance = await computeBalanceForCustomer(tenantId, c.id)
    out.push({ customerId: c.id, name: c.name, phone: c.phone || '', balance })
  }
  out.sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
  return out.slice(0, 100)
}

export const salesDaily = async (tenantId, branchIds, query) => {
  const { from, to, startYmd, endYmd } = getLocalRangeExclusive(query?.period, query?.start, query?.end)
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const match = { tenantId: new mongoose.Types.ObjectId(tenantId), branchId: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }, isActive: true, createdAt: { $gte: from, $lt: to } }

  const rows = await CanteenSale.aggregate([
    { $match: match },
    {
      $addFields: {
        day: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'Europe/Istanbul'
          }
        },
        method: { $ifNull: ['$payment.method', ''] },
        methodName: { $ifNull: ['$payment.methodName', ''] },
        methodType: { $ifNull: ['$payment.methodType', ''] }
      }
    },
    {
      $group: {
        _id: { day: '$day', method: '$method' },
        totalRevenue: { $sum: '$total' },
        saleCount: { $sum: 1 },
        methodName: { $first: '$methodName' },
        methodType: { $first: '$methodType' }
      }
    },
    {
      $group: {
        _id: '$_id.day',
        totalRevenue: { $sum: '$totalRevenue' },
        saleCount: { $sum: '$saleCount' },
        methods: { $push: { k: '$_id.method', v: '$totalRevenue', name: '$methodName', type: '$methodType' } }
      }
    },
    { $sort: { _id: 1 } }
  ])

  const totals = new Map()
  const items = rows.map(r => {
    const byMethod = {}
    for (const it of (r.methods || [])) {
      const k = String(it?.k || '')
      if (!k) continue
      byMethod[k] = Number(it?.v || 0)
      const current = totals.get(k)
      totals.set(k, {
        total: Number((current?.total || 0) + Number(it?.v || 0)),
        name: String(it?.name || current?.name || '').trim(),
        type: String(it?.type || current?.type || '').trim(),
      })
    }
    const totalRevenue = Number(r.totalRevenue || 0)
    const saleCount = Number(r.saleCount || 0)
    const avgBasket = saleCount > 0 ? totalRevenue / saleCount : 0
    return { day: String(r._id || ''), saleCount, totalRevenue, avgBasket, byMethod }
  })

  const methodColumns = await buildMethodCatalog(tenantId, totals)
  return { startYmd, endYmd, items, methodColumns }
}
