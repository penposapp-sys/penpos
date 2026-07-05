import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenReportsService.js'
import * as customerService from '../services/canteenCustomerService.js'
import CanteenProduct from '../models/CanteenProduct.js'
import XLSX from 'xlsx'
import mongoose from 'mongoose'

export const summary = async (req, res) => {
  try {
    const result = await service.summary(req.user.tenantId, req.canteenBranchIds || [], req.query || {})
    res.json({ success: true, summary: result })
  } catch (err) {
    sendError(res, err)
  }
}

export const products = async (req, res) => {
  try {
    const items = await service.products(req.user.tenantId, req.canteenBranchIds || [], req.query || {})
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}

export const customers = async (req, res) => {
  try {
    const items = await service.customers(req.user.tenantId, req.canteenBranchIds || [])
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}

export const zReport = async (req, res) => {
  try {
    const report = await service.zReport(req.user.tenantId, req.canteenBranchIds || [], req.query || {})
    res.json({ success: true, ok: true, ...report })
  } catch (err) {
    sendError(res, err)
  }
}

export const cashReport = async (req, res) => {
  try {
    const report = await service.cashReport(req.user.tenantId, req.canteenBranchIds || [], req.query || {})
    res.json({ success: true, ok: true, ...report })
  } catch (err) {
    sendError(res, err)
  }
}

const ymdToTr = (ymd) => {
  const s = String(ymd || '').trim()
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s)
  if (!m) return s
  return `${m[3]}.${m[2]}.${m[1]}`
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

export const exportAll = async (req, res) => {
  try {
    const query = { ...(req.query || {}) }
    if (query?.period === 'range') {
      if (!query.start && query.from) query.start = query.from
      if (!query.end && query.to) query.end = query.to
    }

    const branchIds = req.canteenBranchIds || []
    const salesDaily = await service.salesDaily(req.user.tenantId, branchIds, query)
    const topProducts = await service.products(req.user.tenantId, branchIds, query)
    const customers = await customerService.listCustomers(req.user.tenantId, { includeInactive: true })

    const productIds = topProducts
      .map((item) => String(item.productId || '').trim())
      .filter((id) => mongoose.isValidObjectId(id))
    const productRows = productIds.length > 0
      ? await CanteenProduct.find({
        tenantId: req.user.tenantId,
        _id: { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) }
      }).select('_id barcode').lean()
      : []
    const barcodeById = new Map(productRows.map((row) => [String(row._id), String(row.barcode || '')]))

    const wb = XLSX.utils.book_new()

    const paymentColumns = Array.isArray(salesDaily.methodColumns) ? salesDaily.methodColumns : []
    const salesHeader = ['Tarih', 'İşlem Sayısı', 'Ciro', 'Ortalama Sepet', ...paymentColumns.map((item) => String(item?.name || item?.id || ''))]
    const salesRows = (salesDaily.items || []).map((row) => {
      const by = row.byMethod || {}
      return [
        ymdToTr(row.day),
        Number(row.saleCount || 0),
        Number(row.totalRevenue || 0),
        Number(row.avgBasket || 0),
        ...paymentColumns.map((item) => Number(by?.[String(item?.id || '')] || 0))
      ]
    })
    const wsSales = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows])
    wsSales['!cols'] = [
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      ...paymentColumns.map((item) => ({ wch: Math.max(12, String(item?.name || '').length + 2) }))
    ]
    XLSX.utils.book_append_sheet(wb, wsSales, 'Satis Raporu')

    const prodHeader = ['Urun', 'Barkod', 'Adet', 'Ciro']
    const prodRows = (topProducts || []).map((item) => [
      String(item.name || ''),
      barcodeById.get(String(item.productId)) || '',
      Number(item.qty || 0),
      Number(item.total || 0)
    ])
    const wsProd = XLSX.utils.aoa_to_sheet([prodHeader, ...prodRows])
    wsProd['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsProd, 'En Cok Satilan Urunler')

    const custHeader = ['Cari Adi', 'Telefon', 'Borc/Bakiye', 'Son Islem Tarihi']
    const custRows = (customers || []).map((customer) => [
      String(customer.name || ''),
      String(customer.phone || ''),
      Number(customer.balance || 0),
      customer.lastActionAt ? new Date(customer.lastActionAt).toLocaleString('tr-TR') : ''
    ])
    const wsCust = XLSX.utils.aoa_to_sheet([custHeader, ...custRows])
    wsCust['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsCust, 'Cariler')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const filename = `raporlar_${toFilenameTs()}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).end(buffer)
  } catch (err) {
    sendError(res, err)
  }
}
