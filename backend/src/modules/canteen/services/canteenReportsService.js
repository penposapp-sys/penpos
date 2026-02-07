import mongoose from 'mongoose'
import { getLocalRangeExclusive } from '../../../utils/dateRange.js'
import CanteenSale from '../models/CanteenSale.js'
import * as customerRepo from '../repositories/canteenCustomerRepository.js'
import * as saleRepo from '../repositories/canteenSaleRepository.js'
import * as collectionRepo from '../repositories/canteenCustomerCollectionRepository.js'

const computeBalanceForCustomer = async (tenantId, customerId) => {
  const sales = await saleRepo.listByTenantAndCustomer(tenantId, customerId, { limit: 10000 })
  const debt = (sales || []).reduce((sum, s) => sum + (s.payment?.method === 'account' ? Number(s.total || 0) : 0), 0)
  const paid = await collectionRepo.sumByCustomerAllBranches(tenantId, customerId)
  return Number(debt - paid)
}

export const summary = async (tenantId, branchIds, query) => {
  const { from, to } = getLocalRangeExclusive(query?.period, query?.start, query?.end)
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const match = { tenantId: new mongoose.Types.ObjectId(tenantId), branchId: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }, isActive: true, createdAt: { $gte: from, $lt: to } }

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
    { $group: { _id: '$payment.method', total: { $sum: '$total' } } }
  ])
  const byMethod = {}
  for (const r of by) {
    const k = String(r?._id || '')
    if (!k) continue
    byMethod[k] = Number(r?.total || 0)
  }
  return { totalRevenue, saleCount, avgBasket, byMethod }
}

export const products = async (tenantId, branchIds, query) => {
  const { from, to } = getLocalRangeExclusive(query?.period, query?.start, query?.end)
  const ids = Array.isArray(branchIds) ? branchIds.map(String).filter(Boolean) : []
  const match = { tenantId: new mongoose.Types.ObjectId(tenantId), branchId: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }, isActive: true, createdAt: { $gte: from, $lt: to } }
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
  const items = await customerRepo.listByTenant(tenantId)
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
        method: { $ifNull: ['$payment.method', ''] }
      }
    },
    {
      $group: {
        _id: { day: '$day', method: '$method' },
        totalRevenue: { $sum: '$total' },
        saleCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.day',
        totalRevenue: { $sum: '$totalRevenue' },
        saleCount: { $sum: '$saleCount' },
        methods: { $push: { k: '$_id.method', v: '$totalRevenue' } }
      }
    },
    { $sort: { _id: 1 } }
  ])

  const items = rows.map(r => {
    const byMethod = {}
    for (const it of (r.methods || [])) {
      const k = String(it?.k || '')
      if (!k) continue
      byMethod[k] = Number(it?.v || 0)
    }
    const totalRevenue = Number(r.totalRevenue || 0)
    const saleCount = Number(r.saleCount || 0)
    const avgBasket = saleCount > 0 ? totalRevenue / saleCount : 0
    return { day: String(r._id || ''), saleCount, totalRevenue, avgBasket, byMethod }
  })

  return { startYmd, endYmd, items }
}
