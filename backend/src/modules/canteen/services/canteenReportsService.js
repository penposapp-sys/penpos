import mongoose from 'mongoose'
import { getLocalRangeExclusive } from '../../../utils/dateRange.js'
import CanteenSale from '../models/CanteenSale.js'
import CanteenBranch from '../models/CanteenBranch.js'
import CanteenTenantSettings from '../models/CanteenTenantSettings.js'
import CanteenProduct from '../models/CanteenProduct.js'
import * as customerRepo from '../repositories/canteenCustomerRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import * as collectionRepo from '../repositories/canteenCustomerCollectionRepository.js'
import { getPaymentMethodsService, normalizePaymentMethod } from '../../../services/paymentSettingsService.js'
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
  const settings = await getPaymentMethodsService(tenantId, { includeDeleted: false })
  const visible = Array.isArray(settings?.paymentMethods) ? settings.paymentMethods : []
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

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100

const buildEmptyPaymentSummary = () => ({
  cash: 0,
  card: 0,
  mealCard: 0,
  online: 0,
  credit: 0
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

const isReportableCollection = (collection = {}) => {
  const direction = String(collection?.direction || 'credit').trim()
  const method = String(collection?.method || '').trim()
  return direction !== 'debit' && method !== 'manual'
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

  const [sales, branches, settings, tenant, collections] = await Promise.all([
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
    collectionRepo.listRangeByTenantAndBranches(tenantId, finalBranchIds, from, to)
  ])

  const productIds = Array.from(new Set(
    (sales || [])
      .flatMap((sale) => Array.isArray(sale?.items) ? sale.items : [])
      .map((item) => String(item?.productId || ''))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  ))
  const productVatRateMap = productIds.length > 0
    ? new Map(
        (await CanteenProduct.find({ tenantId, _id: { $in: productIds } })
          .select({ _id: 1, vatRate: 1 })
          .lean())
          .map((product) => [String(product._id), Number(product.vatRate || 0)])
      )
    : new Map()

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
    payments: buildEmptyPaymentSummary(),
    collectionsTotal: 0,
    salesChannels: buildEmptyChannelSummary(),
    vatBreakdown: []
  }
  const paymentBreakdownMap = new Map()
  const collectionBreakdownMap = new Map()
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

  const topProducts = Array.from(topProductMap.values())
    .map((row) => ({
      name: String(row.name || '-'),
      quantity: Number(row.quantity || 0),
      total: roundMoney(row.total)
    }))
    .sort((a, b) => (b.total - a.total) || (b.quantity - a.quantity))
    .slice(0, 20)

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
  summary.payments = {
    cash: roundMoney(summary.payments.cash),
    card: roundMoney(summary.payments.card),
    mealCard: roundMoney(summary.payments.mealCard),
    online: roundMoney(summary.payments.online),
    credit: roundMoney(summary.payments.credit)
  }
  summary.collectionsTotal = roundMoney(summary.collectionsTotal)
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
      collectionBreakdown
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

  const totals = await CanteenSale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$total' },
        saleCount: { $sum: 1 }
      }
    }
  ])
  const totalRevenue = Number(totals?.[0]?.totalRevenue || 0)
  const saleCount = Number(totals?.[0]?.saleCount || 0)
  const avgBasket = saleCount > 0 ? totalRevenue / saleCount : 0

  const by = await CanteenSale.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$payment.method',
        total: { $sum: '$total' },
        methodName: { $first: '$payment.methodName' },
        methodType: { $first: '$payment.methodType' }
      }
    }
  ])
  const methodTotals = new Map()
  const byMethod = {}
  for (const r of by) {
    const id = String(r?._id || '').trim()
    if (!id) continue
    const total = Number(r?.total || 0)
    methodTotals.set(id, { total, name: String(r?.methodName || '').trim(), type: String(r?.methodType || '').trim() })
    byMethod[id] = total
  }
  const methodBreakdown = await buildMethodCatalog(tenantId, methodTotals)
  return { totalRevenue, saleCount, avgBasket, byMethod, methodBreakdown }
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
