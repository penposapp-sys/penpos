import { sendError } from '../utils/errors.js'
import Order from '../models/Order.js'
import Table from '../models/Table.js'
import AccountTransaction from '../models/AccountTransaction.js'
import CustomerAccount from '../models/CustomerAccount.js'
import mongoose from 'mongoose'
import { ensureFeature, ensureNotExpired } from '../services/planService.js'
import { applyBranchFilter, buildBranchMatch } from '../utils/branchFilter.js'
import { normalizeMethod } from '../utils/paymentMethodMap.js'
import { addDaysLocal, getLocalRangeExclusive, startOfDayLocal } from '../utils/dateRange.js'
import XLSX from 'xlsx'

const toYmd = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const buildNetTotalExpr = () => {
  const itemsTotal = {
    $sum: {
      $map: {
        input: {
          $filter: {
            input: { $ifNull: ['$items', []] },
            as: 'it',
            cond: { $ne: ['$$it.status', 'cancelled'] }
          }
        },
        as: 'it',
        in: { $ifNull: ['$$it.subtotal', 0] }
      }
    }
  }
  const pct = { $divide: [{ $ifNull: ['$discountPercent', 0] }, 100] }
  const discounted = { $subtract: [itemsTotal, { $multiply: [itemsTotal, pct] }] }
  return { $max: [0, discounted] }
}

const toMoneySafe = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const buildScopedMatches = (tenantId, branchIds = []) => {
  const tenantIdStr = String(tenantId || '')
  const tenantIdObj = mongoose.Types.ObjectId.isValid(tenantIdStr) ? new mongoose.Types.ObjectId(tenantIdStr) : null
  const tenantMatch = tenantIdObj
    ? { $or: [{ tenantId: tenantIdObj }, { tenantId: tenantIdStr }] }
    : { tenantId: tenantIdStr }
  const branchMatch = buildBranchMatch(branchIds)
  return { tenantMatch, branchMatch }
}

const mergeProductRows = (...groups) => {
  const map = new Map()
  for (const group of groups) {
    for (const row of group || []) {
      const id = row?.menuItemId ? String(row.menuItemId) : null
      const name = String(row?.name || 'Bilinmeyen Ürün').trim() || 'Bilinmeyen Ürün'
      const key = `${id || 'null'}|${name}`
      const prev = map.get(key) || { productId: id, menuItemId: id, name, qty: 0, revenue: 0 }
      prev.qty += toMoneySafe(row?.qty)
      prev.revenue += toMoneySafe(row?.revenue)
      map.set(key, prev)
    }
  }
  return Array.from(map.values())
    .map((row) => ({
      productId: row.productId,
      menuItemId: row.menuItemId,
      name: row.name,
      qty: toMoneySafe(row.qty),
      revenue: toMoneySafe(row.revenue)
    }))
    .filter((row) => row.qty > 0 || row.revenue > 0)
    .sort((a, b) => (b.revenue - a.revenue) || (b.qty - a.qty) || String(a.name).localeCompare(String(b.name), 'tr'))
}

const parseLegacyManualProductNote = (note, amount) => {
  const raw = String(note || '').trim()
  if (!raw) return null

  const [head] = raw.split(' - ')
  const match = /^(.*)\sx([0-9]+(?:[.,][0-9]+)?)$/i.exec(String(head || '').trim())
  if (!match) return null

  const name = String(match[1] || '').trim()
  const qty = Number(String(match[2] || '').replace(',', '.'))
  const revenue = toMoneySafe(amount)
  if (!name || !Number.isFinite(qty) || qty <= 0 || revenue <= 0) return null

  return {
    productId: null,
    menuItemId: null,
    name,
    qty,
    revenue
  }
}

const aggregateOrderProducts = async ({ tenantId, branchIds, fromDate, toDate }) => {
  const { tenantMatch, branchMatch } = buildScopedMatches(tenantId, branchIds)
  const menuItemIdExpr = {
    $cond: [
      { $eq: [{ $type: '$items.menuItemId' }, 'objectId'] },
      '$items.menuItemId',
      { $convert: { input: '$items.menuItemId', to: 'objectId', onError: null, onNull: null } }
    ]
  }
  const qtyRawExpr = {
    $convert: {
      input: { $ifNull: ['$items.qty', '$items.quantity'] },
      to: 'double',
      onError: null,
      onNull: null
    }
  }
  const qtyExpr = {
    $cond: [
      {
        $or: [
          { $eq: [qtyRawExpr, null] },
          { $lte: [qtyRawExpr, 0] }
        ]
      },
      1,
      qtyRawExpr
    ]
  }
  const priceExpr = {
    $convert: {
      input: { $ifNull: ['$items.priceSnapshot', { $ifNull: ['$items.price', '$mi.price'] }] },
      to: 'double',
      onError: 0,
      onNull: 0
    }
  }
  const revenueExpr = {
    $let: {
      vars: {
        subtotalValue: {
          $convert: {
            input: '$items.subtotal',
            to: 'double',
            onError: null,
            onNull: null
          }
        }
      },
      in: {
        $cond: [
          { $and: [{ $ne: ['$$subtotalValue', null] }, { $gt: ['$$subtotalValue', 0] }] },
          '$$subtotalValue',
          { $multiply: [priceExpr, qtyExpr] }
        ]
      }
    }
  }
  const itemReportAtExpr = {
    $convert: {
      input: {
        $ifNull: [
          '$items.kitchenSentAt',
          {
            $ifNull: [
              '$items.sentAt',
              {
                $ifNull: [
                  '$paidAt',
                  { $ifNull: ['$closedAt', { $ifNull: ['$updatedAt', '$createdAt'] }] }
                ]
              }
            ]
          }
        ]
      },
      to: 'date',
      onError: null,
      onNull: null
    }
  }

  const agg = await Order.aggregate([
    { $match: tenantMatch },
    ...(branchMatch ? [{ $match: branchMatch }] : []),
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    {
      $match: {
        $and: [
          {
            $or: [
              { 'items.status': { $ne: 'cancelled' } },
              { 'items.status': { $exists: false } }
            ]
          },
          {
            $or: [
              { 'items.cancelledAt': null },
              { 'items.cancelledAt': { $exists: false } }
            ]
          }
        ]
      }
    },
    {
      $addFields: {
        menuItemIdObj: menuItemIdExpr,
        itemReportAt: itemReportAtExpr
      }
    },
    {
      $match: {
        itemReportAt: { $ne: null, $gte: fromDate, $lt: toDate },
        $or: [
          { 'items.status': { $in: ['sent', 'completed'] } },
          {
            $and: [
              {
                $or: [
                  { 'items.status': { $exists: false } },
                  { 'items.status': null },
                  { 'items.status': 'open' }
                ]
              },
              {
                $or: [
                  { status: { $in: ['closed', 'completed'] } },
                  { paymentStatus: 'paid' },
                  { settlementType: 'veresiye' },
                  { 'payments.0': { $exists: true } }
                ]
              }
            ]
          }
        ]
      }
    },
    { $match: { menuItemIdObj: { $ne: null } } },
    {
      $lookup: {
        from: 'menuitems',
        localField: 'menuItemIdObj',
        foreignField: '_id',
        as: 'mi'
      }
    },
    { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$menuItemIdObj',
        productId: { $first: '$menuItemIdObj' },
        menuItemId: { $first: '$menuItemIdObj' },
        name: { $first: { $ifNull: ['$items.nameSnapshot', { $ifNull: ['$mi.name', 'Bilinmeyen Ürün'] }] } },
        qty: { $sum: qtyExpr },
        revenue: { $sum: revenueExpr }
      }
    },
    { $match: { revenue: { $gt: 0 } } },
    { $sort: { revenue: -1, qty: -1 } }
  ])

  return (agg || []).map((r) => {
    const rawId = r?.menuItemId ?? r?.productId ?? r?._id
    const id = rawId != null ? String(rawId) : null
    return {
      productId: id,
      menuItemId: id,
      name: String(r?.name || 'Bilinmeyen Ürün'),
      qty: toMoneySafe(r?.qty),
      revenue: toMoneySafe(r?.revenue)
    }
  })
}

const aggregateManualAccountProducts = async ({ tenantId, branchIds, fromDate, toDate }) => {
  const { tenantMatch, branchMatch } = buildScopedMatches(tenantId, branchIds)
  const menuItemIdExpr = {
    $cond: [
      { $eq: [{ $type: '$lines.menuItemId' }, 'objectId'] },
      '$lines.menuItemId',
      { $convert: { input: '$lines.menuItemId', to: 'objectId', onError: null, onNull: null } }
    ]
  }
  const qtyExpr = {
    $convert: {
      input: '$lines.qty',
      to: 'double',
      onError: 0,
      onNull: 0
    }
  }
  const revenueExpr = {
    $let: {
      vars: {
        lineTotalValue: {
          $convert: {
            input: '$lines.lineTotal',
            to: 'double',
            onError: null,
            onNull: null
          }
        },
        priceValue: {
          $convert: {
            input: '$lines.price',
            to: 'double',
            onError: 0,
            onNull: 0
          }
        }
      },
      in: {
        $cond: [
          { $and: [{ $ne: ['$$lineTotalValue', null] }, { $gt: ['$$lineTotalValue', 0] }] },
          '$$lineTotalValue',
          { $multiply: ['$$priceValue', qtyExpr] }
        ]
      }
    }
  }

  const agg = await AccountTransaction.aggregate([
    { $match: tenantMatch },
    ...(branchMatch ? [{ $match: branchMatch }] : []),
    {
      $match: {
        source: 'manual',
        type: 'debit',
        isDeleted: { $ne: true },
        createdAt: { $gte: fromDate, $lt: toDate },
        'lines.0': { $exists: true }
      }
    },
    { $unwind: { path: '$lines', preserveNullAndEmptyArrays: false } },
    { $addFields: { menuItemIdObj: menuItemIdExpr } },
    { $match: { menuItemIdObj: { $ne: null } } },
    {
      $group: {
        _id: '$menuItemIdObj',
        productId: { $first: '$menuItemIdObj' },
        menuItemId: { $first: '$menuItemIdObj' },
        name: { $first: { $ifNull: ['$lines.name', 'Bilinmeyen Ürün'] } },
        qty: { $sum: qtyExpr },
        revenue: { $sum: revenueExpr }
      }
    },
    { $match: { revenue: { $gt: 0 } } },
    { $sort: { revenue: -1, qty: -1 } }
  ])

  return (agg || []).map((r) => {
    const rawId = r?.menuItemId ?? r?.productId ?? r?._id
    const id = rawId != null ? String(rawId) : null
    return {
      productId: id,
      menuItemId: id,
      name: String(r?.name || 'Bilinmeyen Ürün'),
      qty: toMoneySafe(r?.qty),
      revenue: toMoneySafe(r?.revenue)
    }
  })
}

const aggregateLegacyManualAccountProducts = async ({ tenantId, branchIds, fromDate, toDate }) => {
  let filter = {
    tenantId,
    source: 'manual',
    type: 'debit',
    isDeleted: { $ne: true },
    createdAt: { $gte: fromDate, $lt: toDate },
    $or: [
      { lines: { $exists: false } },
      { lines: { $size: 0 } }
    ]
  }
  filter = applyBranchFilter(filter, branchIds)

  const rows = await AccountTransaction.find(filter)
    .select({ note: 1, amount: 1 })
    .lean()

  return (rows || [])
    .map((row) => parseLegacyManualProductNote(row?.note, row?.amount))
    .filter(Boolean)
}

const aggregateCancelledOrderProducts = async ({ tenantId, branchIds, fromDate, toDate }) => {
  const { tenantMatch, branchMatch } = buildScopedMatches(tenantId, branchIds)
  const menuItemIdExpr = {
    $cond: [
      { $eq: [{ $type: '$items.menuItemId' }, 'objectId'] },
      '$items.menuItemId',
      { $convert: { input: '$items.menuItemId', to: 'objectId', onError: null, onNull: null } }
    ]
  }
  const qtyRawExpr = {
    $convert: {
      input: { $ifNull: ['$items.qty', '$items.quantity'] },
      to: 'double',
      onError: null,
      onNull: null
    }
  }
  const qtyExpr = {
    $cond: [
      {
        $or: [
          { $eq: [qtyRawExpr, null] },
          { $lte: [qtyRawExpr, 0] }
        ]
      },
      1,
      qtyRawExpr
    ]
  }
  const priceExpr = {
    $convert: {
      input: { $ifNull: ['$items.priceSnapshot', { $ifNull: ['$items.price', '$mi.price'] }] },
      to: 'double',
      onError: 0,
      onNull: 0
    }
  }
  const revenueExpr = {
    $let: {
      vars: {
        subtotalValue: {
          $convert: {
            input: '$items.subtotal',
            to: 'double',
            onError: null,
            onNull: null
          }
        }
      },
      in: {
        $cond: [
          { $and: [{ $ne: ['$$subtotalValue', null] }, { $gt: ['$$subtotalValue', 0] }] },
          '$$subtotalValue',
          { $multiply: [priceExpr, qtyExpr] }
        ]
      }
    }
  }
  const cancelledAtExpr = {
    $convert: {
      input: '$items.cancelledAt',
      to: 'date',
      onError: null,
      onNull: null
    }
  }
  const approvedAtExpr = {
    $convert: {
      input: {
        $ifNull: [
          '$items.kitchenSentAt',
          '$items.sentAt'
        ]
      },
      to: 'date',
      onError: null,
      onNull: null
    }
  }

  const agg = await Order.aggregate([
    { $match: tenantMatch },
    ...(branchMatch ? [{ $match: branchMatch }] : []),
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        menuItemIdObj: menuItemIdExpr,
        cancelledAtValue: cancelledAtExpr,
        approvedAtValue: approvedAtExpr
      }
    },
    {
      $match: {
        'items.status': 'cancelled',
        cancelledAtValue: { $ne: null, $gte: fromDate, $lt: toDate },
        approvedAtValue: { $ne: null }
      }
    },
    { $match: { menuItemIdObj: { $ne: null } } },
    {
      $lookup: {
        from: 'menuitems',
        localField: 'menuItemIdObj',
        foreignField: '_id',
        as: 'mi'
      }
    },
    { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$menuItemIdObj',
        productId: { $first: '$menuItemIdObj' },
        menuItemId: { $first: '$menuItemIdObj' },
        name: { $first: { $ifNull: ['$items.nameSnapshot', { $ifNull: ['$mi.name', 'Bilinmeyen Ürün'] }] } },
        qty: { $sum: qtyExpr },
        revenue: { $sum: revenueExpr }
      }
    },
    { $match: { revenue: { $gt: 0 } } },
    { $sort: { revenue: -1, qty: -1 } }
  ])

  return (agg || []).map((r) => {
    const rawId = r?.menuItemId ?? r?.productId ?? r?._id
    const id = rawId != null ? String(rawId) : null
    return {
      productId: id,
      menuItemId: id,
      name: String(r?.name || 'Bilinmeyen Ürün'),
      qty: toMoneySafe(r?.qty),
      revenue: toMoneySafe(r?.revenue)
    }
  })
}

export const orders = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'reports')
    const { period, start, end, status } = req.query || {}
    const { from, to } = getLocalRangeExclusive(period, start, end)
    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }
    let filter = { tenantId: req.user.tenantId }
    filter = applyBranchFilter(filter, branchIds)
    if (status && status !== 'paid') {
      if (status === 'closed') filter.status = { $in: ['closed', 'completed'] }
      else filter.status = status
    }
    const effectiveDateExpr = { $ifNull: ['$closedAt', '$updatedAt'] }
    filter.$expr = {
      $and: [
        { $gte: [effectiveDateExpr, from] },
        { $lt: [effectiveDateExpr, to] }
      ]
    }
    
    if (!status) {
      filter.status = { $in: ['closed', 'completed'] }
    }

    const list = await Order.find(filter).sort({ updatedAt: -1 })
    const paidFiltered = status === 'paid'
      ? list.filter(o => {
          const payments = Array.isArray(o.payments) ? o.payments : []
          const paidTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
          const grandTotal = o.totals?.grandTotal || 0
          const remaining = Math.max(0, grandTotal - paidTotal)
          const hasLegacyPaid = (!o.payments || o.payments.length === 0) && o.paymentStatus === 'paid'
          return (grandTotal > 0 && remaining <= 0.01) || hasLegacyPaid
        })
      : list
    const computeNetTotal = (order) => {
      const items = Array.isArray(order?.items) ? order.items : []
      const total = items
        .filter(it => it && it.status !== 'cancelled')
        .reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0)
      const pct = Math.max(0, Math.min(100, Number(order?.discountPercent) || 0))
      const net = total - (total * pct) / 100
      return Math.max(0, Number.isFinite(net) ? net : 0)
    }

    const computePaid = (order, netTotalEffective) => {
      const payments = Array.isArray(order?.payments) ? order.payments : []
      let nonAccountPaid = 0
      let accountPaidExplicit = 0
      const byMethod = { cash: 0, pos: 0, bank: 0, account: 0 }
      for (const p of payments) {
        const amt = Number(p?.amount) || 0
        const bucket = normalizeMethod(p?.methodBucket || p?.method)
        byMethod[bucket] = (byMethod[bucket] || 0) + amt
        if (bucket === 'account') accountPaidExplicit += amt
        else nonAccountPaid += amt
      }
      const isAccountSettlement = String(order?.settlementType || '') === 'veresiye'
      const implicit = isAccountSettlement ? Math.max(0, (Number(netTotalEffective) || 0) - (nonAccountPaid + accountPaidExplicit)) : 0
      if (implicit > 0) byMethod.account += implicit
      const totalPaid = nonAccountPaid + accountPaidExplicit + implicit
      return { totalPaid, byMethod }
    }

    const tableIds = Array.from(new Set(paidFiltered.map(o => (o.tableId ? String(o.tableId) : null)).filter(Boolean)))
    const tables = tableIds.length > 0
      ? await Table.find({ _id: { $in: tableIds }, tenantId: req.user.tenantId, isActive: true }).select({ name: 1 }).lean()
      : []
    const tableMap = new Map(tables.map(t => [String(t._id), String(t.name || '')]))

    res.json({
      orders: paidFiltered.map(o => {
        const netTotal = computeNetTotal(o)
        const { totalPaid } = computePaid(o, netTotal)
        const signed = netTotal - totalPaid
        return {
          id: o.id,
          orderNo: o.orderNo ?? null,
          orderDayKey: o.orderDayKey || '',
          status: o.status,
          saleType: o.saleType,
          tableId: o.tableId ? String(o.tableId) : null,
          tableName: o.tableId ? (tableMap.get(String(o.tableId)) || '') : '',
          customerName: o.customerName || '',
          totals: o.totals,
          netTotal,
          paidTotal: totalPaid,
          balanceDueSigned: signed,
          note: o.note,
          createdAt: o.createdAt,
          closedAt: o.closedAt || o.updatedAt || o.paidAt || o.createdAt
        }
      })
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const summary = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'reports')
    const { from, to } = req.query || {}
    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }
    let filter = { tenantId: req.user.tenantId }
    filter = applyBranchFilter(filter, branchIds)
    if (from || to) {
      const effectiveDateExpr = { $ifNull: ['$closedAt', '$updatedAt'] }
      const fromStart = from ? startOfDayLocal(from) : null
      const toStart = to ? startOfDayLocal(to) : null
      const and = []
      if (fromStart) and.push({ $gte: [effectiveDateExpr, fromStart] })
      if (toStart) and.push({ $lt: [effectiveDateExpr, addDaysLocal(toStart, 1)] })
      if (and.length > 0) filter.$expr = { $and: and }
    }
    
    filter.status = { $in: ['closed', 'completed'] }
    const list = await Order.find(filter).select({ items: 1, discountPercent: 1, payments: 1, settlementType: 1 }).lean()

    const computeNetTotal = (order) => {
      const items = Array.isArray(order?.items) ? order.items : []
      const total = items
        .filter(it => it && it.status !== 'cancelled')
        .reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0)
      const pct = Math.max(0, Math.min(100, Number(order?.discountPercent) || 0))
      const net = total - (total * pct) / 100
      return Math.max(0, Number.isFinite(net) ? net : 0)
    }

    const computePaid = (order, netTotalEffective) => {
      const payments = Array.isArray(order?.payments) ? order.payments : []
      let nonAccountPaid = 0
      let accountPaidExplicit = 0
      for (const p of payments) {
        const amt = Number(p?.amount) || 0
        const bucket = normalizeMethod(p?.methodBucket || p?.method)
        if (bucket === 'account') accountPaidExplicit += amt
        else nonAccountPaid += amt
      }
      const isAccountSettlement = String(order?.settlementType || '') === 'veresiye'
      const implicit = isAccountSettlement ? Math.max(0, (Number(netTotalEffective) || 0) - (nonAccountPaid + accountPaidExplicit)) : 0
      return nonAccountPaid + accountPaidExplicit + implicit
    }

    let totalSales = 0
    let totalPaid = 0
    let overpayTotal = 0
    for (const o of list) {
      const net = computeNetTotal(o)
      const paid = computePaid(o, net)
      totalSales += net
      totalPaid += paid
      overpayTotal += Math.max(0, paid - net)
    }
    res.json({ totalSales, totalPaid, overpayTotal, count: list.length })
  } catch (err) {
    sendError(res, err)
  }
}

export const dashboard = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'reports')

    const { period, start, end } = req.query || {}
    const { from, to, startYmd, endYmd } = getLocalRangeExclusive(period, start, end)

    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }

    const effectiveDateExpr = { $ifNull: ['$closedAt', '$updatedAt'] }
    let filter = {
      tenantId: req.user.tenantId,
      status: { $in: ['closed', 'completed'] },
      $expr: {
        $and: [
          { $gte: [effectiveDateExpr, from] },
          { $lt: [effectiveDateExpr, to] }
        ]
      }
    }
    filter = applyBranchFilter(filter, branchIds)

    const orders = await Order.find(filter)
      .select({ items: 1, discountPercent: 1, payments: 1, settlementType: 1, createdAt: 1, closedAt: 1, updatedAt: 1, saleType: 1 })
      .lean()

    const computeNetTotal = (order) => {
      const items = Array.isArray(order?.items) ? order.items : []
      const itemsTotal = items
        .filter(it => it && it.status !== 'cancelled')
        .reduce((sum, it) => sum + toMoneySafe(it.subtotal), 0)
      const pct = Math.max(0, Math.min(100, toMoneySafe(order?.discountPercent)))
      const net = itemsTotal - (itemsTotal * pct) / 100
      return Math.max(0, net)
    }

    const hourFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' })
    const getHour = (d) => {
      try {
        const hh = hourFmt.format(d instanceof Date ? d : new Date(d))
        return String(hh).padStart(2, '0')
      } catch {
        return '00'
      }
    }

    const sales = {
      totalRevenue: 0,
      totalPaid: 0,
      collectedTotal: 0,
      accountChargedTotal: 0,
      accountCollectionTotal: 0,
      overpayTotal: 0,
      balanceDueSigned: 0,
      byMethod: { cash: 0, pos: 0, bank: 0, account: 0 },
      collectedByMethod: { cash: 0, pos: 0, bank: 0, account: 0 },
      currentAccountBalance: 0,
      orderCount: 0
    }

    const productMap = new Map()
    const hourlyCounts = new Map(Array.from({ length: 24 }).map((_, h) => [String(h).padStart(2, '0'), 0]))

    for (const o of orders) {
      sales.orderCount += 1

      const netTotalEffective = computeNetTotal(o)
      sales.totalRevenue += netTotalEffective

      const payments = Array.isArray(o?.payments) ? o.payments : []
      let nonAccountPaid = 0
      let accountPaidExplicit = 0
      for (const p of payments) {
        const amt = toMoneySafe(p?.amount)
        const bucket = normalizeMethod(p?.methodBucket || p?.method)
        if (bucket === 'account') accountPaidExplicit += amt
        else {
          nonAccountPaid += amt
          sales.collectedByMethod[bucket] = toMoneySafe(sales.collectedByMethod[bucket]) + amt
          sales.collectedTotal += amt
        }
        sales.byMethod[bucket] = toMoneySafe(sales.byMethod[bucket]) + amt
      }

      const isAccountSettlement = String(o?.settlementType || '') === 'veresiye'
      const implicitAccount = isAccountSettlement ? Math.max(0, netTotalEffective - (nonAccountPaid + accountPaidExplicit)) : 0
      if (implicitAccount > 0) {
        sales.byMethod.account = toMoneySafe(sales.byMethod.account) + implicitAccount
      }
      const totalPaidOrder = nonAccountPaid + accountPaidExplicit + implicitAccount
      sales.totalPaid += totalPaidOrder

      const overpay = Math.max(0, totalPaidOrder - netTotalEffective)
      sales.overpayTotal += overpay
      sales.balanceDueSigned += (netTotalEffective - totalPaidOrder)

      const items = Array.isArray(o?.items) ? o.items : []
      for (const it of items) {
        if (!it || it.status === 'cancelled') continue
        const menuItemId = it.menuItemId ? String(it.menuItemId) : null
        const name = String(it.nameSnapshot || '-')
        const qty = toMoneySafe(it.qty)
        const revenue = toMoneySafe(it.subtotal) > 0 ? toMoneySafe(it.subtotal) : (toMoneySafe(it.priceSnapshot) * qty)
        const key = `${menuItemId || 'null'}|${name}`
        const prev = productMap.get(key) || { menuItemId, name, qty: 0, revenue: 0 }
        prev.qty += qty
        prev.revenue += revenue
        productMap.set(key, prev)
      }

      const effectiveTs = o.closedAt || o.updatedAt || o.createdAt
      const hh = getHour(effectiveTs)
      hourlyCounts.set(hh, (hourlyCounts.get(hh) || 0) + 1)
    }

    const collectionFilterBase = applyBranchFilter({
      tenantId: req.user.tenantId,
      source: 'collection',
      type: 'credit',
      isDeleted: { $ne: true },
      createdAt: { $gte: from, $lt: to }
    }, branchIds)

    const accountChargeFilterBase = applyBranchFilter({
      tenantId: req.user.tenantId,
      type: 'debit',
      isDeleted: { $ne: true },
      createdAt: { $gte: from, $lt: to },
      source: { $in: ['order_veresiye', 'manual'] }
    }, branchIds)

    const accountFilterBase = applyBranchFilter({
      tenantId: req.user.tenantId,
      isActive: true
    }, branchIds)

    const [orderProducts, manualProducts, legacyManualProducts, cancelledProducts, collectionRows, accountChargeRows, accountBalanceAgg] = await Promise.all([
      aggregateOrderProducts({ tenantId: req.user.tenantId, branchIds, fromDate: from, toDate: to }),
      aggregateManualAccountProducts({ tenantId: req.user.tenantId, branchIds, fromDate: from, toDate: to }),
      aggregateLegacyManualAccountProducts({ tenantId: req.user.tenantId, branchIds, fromDate: from, toDate: to }),
      aggregateCancelledOrderProducts({ tenantId: req.user.tenantId, branchIds, fromDate: from, toDate: to }),
      AccountTransaction.find(collectionFilterBase)
        .select({ amount: 1, method: 1, methodBucket: 1 })
        .lean(),
      AccountTransaction.find(accountChargeFilterBase)
        .select({ amount: 1 })
        .lean(),
      CustomerAccount.aggregate([
        { $match: accountFilterBase },
        {
          $group: {
            _id: null,
            balanceTotal: {
              $sum: {
                $cond: [
                  { $gt: ['$balance', 0] },
                  '$balance',
                  0
                ]
              }
            }
          }
        }
      ])
    ])

    for (const tx of collectionRows || []) {
      const amt = toMoneySafe(tx?.amount)
      const bucket = normalizeMethod(tx?.methodBucket || tx?.method)
      sales.collectedByMethod[bucket] = toMoneySafe(sales.collectedByMethod[bucket]) + amt
      sales.collectedTotal += amt
      sales.accountCollectionTotal += amt
    }

    for (const tx of accountChargeRows || []) {
      sales.accountChargedTotal += toMoneySafe(tx?.amount)
    }

    sales.currentAccountBalance = toMoneySafe(accountBalanceAgg?.[0]?.balanceTotal || 0)

    const products = mergeProductRows(orderProducts, manualProducts, legacyManualProducts).slice(0, 10)
    const cancelledSummaryRows = mergeProductRows(cancelledProducts)
    const cancelled = {
      itemCount: cancelledSummaryRows.length,
      totalQty: cancelledSummaryRows.reduce((sum, row) => sum + toMoneySafe(row.qty), 0),
      totalRevenue: cancelledSummaryRows.reduce((sum, row) => sum + toMoneySafe(row.revenue), 0)
    }

    const hourly = Array.from({ length: 24 }).map((_, h) => {
      const hh = String(h).padStart(2, '0')
      return { hour: `${hh}:00`, count: hourlyCounts.get(hh) || 0 }
    })

    res.json({
      success: true,
      range: { start: startYmd, end: endYmd },
      sales: {
        totalRevenue: toMoneySafe(sales.totalRevenue),
        totalPaid: toMoneySafe(sales.totalPaid),
        collectedTotal: toMoneySafe(sales.collectedTotal),
        accountChargedTotal: toMoneySafe(sales.accountChargedTotal),
        accountCollectionTotal: toMoneySafe(sales.accountCollectionTotal),
        overpayTotal: toMoneySafe(sales.overpayTotal),
        balanceDueSigned: toMoneySafe(sales.balanceDueSigned),
        byMethod: {
          cash: toMoneySafe(sales.byMethod.cash),
          pos: toMoneySafe(sales.byMethod.pos),
          bank: toMoneySafe(sales.byMethod.bank),
          account: toMoneySafe(sales.byMethod.account)
        },
        collectedByMethod: {
          cash: toMoneySafe(sales.collectedByMethod.cash),
          pos: toMoneySafe(sales.collectedByMethod.pos),
          bank: toMoneySafe(sales.collectedByMethod.bank),
          account: toMoneySafe(sales.collectedByMethod.account)
        },
        currentAccountBalance: toMoneySafe(sales.currentAccountBalance),
        orderCount: Number(sales.orderCount || 0)
      },
      products: products.map(p => ({
        menuItemId: p.menuItemId,
        name: p.name,
        qty: toMoneySafe(p.qty),
        revenue: toMoneySafe(p.revenue)
      })),
      customers: {
        totalCustomers: Number(sales.orderCount || 0),
        hourly
      },
      cancelled: {
        itemCount: Number(cancelled.itemCount || 0),
        totalQty: toMoneySafe(cancelled.totalQty),
        totalRevenue: toMoneySafe(cancelled.totalRevenue)
      }
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const products = async (req, res) => {
  // === HARD DATE RANGE GUARD (TOP SCOPE) ===
  const period = String(req.query.period || 'today')
  const start = req.query.start
  const end = req.query.end

  const range = getLocalRangeExclusive(period, start, end)
  const { from, to, startYmd, endYmd } = range

  const fromDate = (from instanceof Date) ? from : new Date(from)
  const toDate = (to instanceof Date) ? to : new Date(to)

  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime())
  ) {
    return res.status(400).json({
      success: false,
      code: 'invalid_range',
      message: 'Invalid date range'
    })
  }

  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'reports')

    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }

    const [orderItems, manualItems, legacyManualItems, cancelledItems] = await Promise.all([
      aggregateOrderProducts({ tenantId: req.user.tenantId, branchIds, fromDate, toDate }),
      aggregateManualAccountProducts({ tenantId: req.user.tenantId, branchIds, fromDate, toDate }),
      aggregateLegacyManualAccountProducts({ tenantId: req.user.tenantId, branchIds, fromDate, toDate }),
      aggregateCancelledOrderProducts({ tenantId: req.user.tenantId, branchIds, fromDate, toDate })
    ])

    return res.json({
      success: true,
      range: { start: startYmd, end: endYmd },
      items: mergeProductRows(orderItems, manualItems, legacyManualItems),
      cancelledItems: mergeProductRows(cancelledItems)
    })

    const tenantIdStr = String(req.user.tenantId || '')
    const tenantIdObj = mongoose.Types.ObjectId.isValid(tenantIdStr) ? new mongoose.Types.ObjectId(tenantIdStr) : null
    const tenantMatch = tenantIdObj
      ? { $or: [{ tenantId: tenantIdObj }, { tenantId: tenantIdStr }] }
      : { tenantId: tenantIdStr }
    const branchMatch = buildBranchMatch(branchIds)

    const reportAtConvertExpr = {
      $convert: {
        input: {
          $ifNull: [
            '$paidAt',
            { $ifNull: ['$closedAt', '$updatedAt'] }
          ]
        },
        to: 'date',
        onError: null,
        onNull: null
      }
    }
    const salesMatch = {
      status: { $ne: 'cancelled' },
      $or: [
        { paymentStatus: 'paid' },
        { 'payments.0': { $exists: true } },
        { settlementType: 'veresiye' },
        { status: { $in: ['closed', 'completed'] } }
      ]
    }

    const nameExpr = { $ifNull: ['$mi.name', 'Bilinmeyen Ürün'] }
    const qtyRawExpr = { $convert: { input: '$items.quantity', to: 'double', onError: null, onNull: null } }
    const qtyExpr = {
      $cond: [
        {
          $or: [
            { $lte: [{ $ifNull: [qtyRawExpr, 0] }, 0] },
            { $eq: [qtyRawExpr, null] }
          ]
        },
        1,
        { $convert: { input: '$items.quantity', to: 'int', onError: 1, onNull: 1 } }
      ]
    }
    const priceExpr = {
      $convert: {
        input: { $ifNull: ['$items.price', '$mi.price'] },
        to: 'double',
        onError: 0,
        onNull: 0
      }
    }
    const revenueExpr = { $multiply: [priceExpr, qtyExpr] }

    const stages = [
      { $match: tenantMatch },
      ...(branchMatch ? [{ $match: branchMatch }] : []),
      { $addFields: { reportAt: reportAtConvertExpr } },
      { $match: { reportAt: { $ne: null, $gte: fromDate, $lt: toDate } } },
      { $match: salesMatch },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          $or: [
            { 'items.status': { $ne: 'cancelled' } },
            { 'items.status': { $exists: false } }
          ]
        }
      },
      { $match: { 'items.menuItemId': { $ne: null } } },
      {
        $addFields: {
          menuItemIdObj: {
            $cond: [
              { $eq: [{ $type: '$items.menuItemId' }, 'objectId'] },
              '$items.menuItemId',
              { $convert: { input: '$items.menuItemId', to: 'objectId', onError: null, onNull: null } }
            ]
          }
        }
      },
      { $match: { menuItemIdObj: { $ne: null } } },
      {
        $lookup: {
          from: 'menuitems',
          localField: 'menuItemIdObj',
          foreignField: '_id',
          as: 'mi'
        }
      },
      { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$menuItemIdObj',
          productId: { $first: '$menuItemIdObj' },
          menuItemId: { $first: '$menuItemIdObj' },
          name: { $first: nameExpr },
          qty: { $sum: qtyExpr },
          revenue: { $sum: revenueExpr }
        }
      },
      { $match: { revenue: { $gt: 0 } } },
      { $sort: { revenue: -1, qty: -1 } }
    ]

    const agg = await Order.aggregate(stages)
    const items = (agg || []).map(r => {
      const rawId = r?.menuItemId ?? r?.productId ?? r?._id
      const id = rawId != null ? String(rawId) : null
      return {
        productId: id,
        menuItemId: id,
        name: String(r?.name || 'Bilinmeyen Ürün'),
        qty: Number(r?.qty || 0),
        revenue: Number(r?.revenue || 0)
      }
    })

    res.json({ success: true, range: { start: startYmd, end: endYmd }, items })
  } catch (err) {
    sendError(res, err)
  }
}

const toFilenameTs = () => {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}${mo}${da}_${hh}${mm}`
}

export const exportXlsx = async (req, res) => {
  try {
    await ensureNotExpired(req.user.tenantId, req.user.id)
    await ensureFeature(req.user.tenantId, 'reports')

    const period = String(req.query.period || 'today')
    const start = req.query.start || req.query.from
    const end = req.query.end || req.query.to
    const { from, to, startYmd, endYmd } = getLocalRangeExclusive(period, start, end)

    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }

    const effectiveDateExpr = { $ifNull: ['$closedAt', '$updatedAt'] }
    let filter = {
      tenantId: req.user.tenantId,
      status: { $in: ['closed', 'completed'] },
      $expr: {
        $and: [
          { $gte: [effectiveDateExpr, from] },
          { $lt: [effectiveDateExpr, to] }
        ]
      }
    }
    filter = applyBranchFilter(filter, branchIds)

    const orders = await Order.find(filter)
      .select({ items: 1, discountPercent: 1, payments: 1, settlementType: 1 })
      .lean()

    const toMoneySafe = (v) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }

    const computeNetTotal = (order) => {
      const items = Array.isArray(order?.items) ? order.items : []
      const itemsTotal = items
        .filter(it => it && it.status !== 'cancelled')
        .reduce((sum, it) => sum + toMoneySafe(it.subtotal), 0)
      const pct = Math.max(0, Math.min(100, toMoneySafe(order?.discountPercent)))
      const net = itemsTotal - (itemsTotal * pct) / 100
      return Math.max(0, net)
    }

    const sales = {
      totalRevenue: 0,
      totalPaid: 0,
      byMethod: { cash: 0, pos: 0, bank: 0, account: 0 },
      orderCount: 0
    }
    const productMap = new Map()

    for (const o of orders) {
      sales.orderCount += 1
      const netTotalEffective = computeNetTotal(o)
      sales.totalRevenue += netTotalEffective

      const payments = Array.isArray(o?.payments) ? o.payments : []
      let nonAccountPaid = 0
      let accountPaidExplicit = 0
      for (const p of payments) {
        const amt = toMoneySafe(p?.amount)
        const bucket = normalizeMethod(p?.methodBucket || p?.method)
        if (bucket === 'account') accountPaidExplicit += amt
        else nonAccountPaid += amt
        sales.byMethod[bucket] = toMoneySafe(sales.byMethod[bucket]) + amt
      }
      const isAccountSettlement = String(o?.settlementType || '') === 'veresiye'
      const implicitAccount = isAccountSettlement ? Math.max(0, netTotalEffective - (nonAccountPaid + accountPaidExplicit)) : 0
      if (implicitAccount > 0) {
        sales.byMethod.account = toMoneySafe(sales.byMethod.account) + implicitAccount
      }
      const totalPaidOrder = nonAccountPaid + accountPaidExplicit + implicitAccount
      sales.totalPaid += totalPaidOrder

      const items = Array.isArray(o?.items) ? o.items : []
      for (const it of items) {
        if (!it || it.status === 'cancelled') continue
        const menuItemId = it.menuItemId ? String(it.menuItemId) : (it.productId ? String(it.productId) : null)
        const name = String(it.nameSnapshot || it.name || '-')
        const qtyRaw = toMoneySafe(it.qty ?? it.quantity ?? 1)
        const qty = qtyRaw > 0 ? qtyRaw : 1
        const subtotal = toMoneySafe(it.subtotal)
        const price = toMoneySafe(it.priceSnapshot ?? it.price)
        const revenue = subtotal > 0 ? subtotal : (price * qty)
        const key = `${menuItemId || 'null'}|${name}`
        const prev = productMap.get(key) || { menuItemId, name, qty: 0, revenue: 0 }
        prev.qty += qty
        prev.revenue += revenue
        productMap.set(key, prev)
      }
    }

    const [orderProducts, manualProducts, legacyManualProducts] = await Promise.all([
      aggregateOrderProducts({ tenantId: req.user.tenantId, branchIds, fromDate: from, toDate: to }),
      aggregateManualAccountProducts({ tenantId: req.user.tenantId, branchIds, fromDate: from, toDate: to }),
      aggregateLegacyManualAccountProducts({ tenantId: req.user.tenantId, branchIds, fromDate: from, toDate: to })
    ])
    const products = mergeProductRows(orderProducts, manualProducts, legacyManualProducts)

    const cash = toMoneySafe(sales.byMethod.cash)
    const pos = toMoneySafe(sales.byMethod.pos)
    const bank = toMoneySafe(sales.byMethod.bank)
    const account = toMoneySafe(sales.byMethod.account)
    const totalPaid = cash + pos + bank + account

    const wb = XLSX.utils.book_new()

    const wsSummary = XLSX.utils.aoa_to_sheet([
      ['Aralık', `${startYmd} → ${endYmd}`],
      ['Sipariş', Number(sales.orderCount || 0)],
      [],
      ['Toplam Ciro', toMoneySafe(sales.totalRevenue)],
      ['Toplam Tahsilat', toMoneySafe(sales.totalPaid)],
      [],
      ['Ödeme Özeti', ''],
      ['Nakit', cash],
      ['POS/Kart', pos],
      ['Banka', bank],
      ['Cari', account],
      ['Toplam Tahsilat', totalPaid]
    ])
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 26 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Satış Özeti')

    const wsProducts = XLSX.utils.aoa_to_sheet([
      ['Ürün', 'Adet', 'Ciro'],
      ...products.map(p => [String(p.name || ''), toMoneySafe(p.qty), toMoneySafe(p.revenue)])
    ])
    wsProducts['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Satılan Ürünler')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const filename = `rapor_${startYmd}_${endYmd}_${toFilenameTs()}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).end(buffer)
  } catch (err) {
    sendError(res, err)
  }
}
