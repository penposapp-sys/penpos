import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenReportsService.js'
import * as customerService from '../services/canteenCustomerService.js'
import CanteenProduct from '../models/CanteenProduct.js'
import XLSX from 'xlsx'
import mongoose from 'mongoose'

export const summary = async (req, res) => {
  try {
    const summary = await service.summary(req.user.tenantId, req.canteenBranchIds || [], req.query || {})
    res.json({ success: true, summary })
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
    const customers = await customerService.listCustomers(req.user.tenantId)

    const productIds = topProducts
      .map(p => String(p.productId || '').trim())
      .filter(id => mongoose.isValidObjectId(id))
    const productRows = productIds.length > 0
      ? await CanteenProduct.find({ tenantId: req.user.tenantId, _id: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) } }).select('_id barcode').lean()
      : []
    const barcodeById = new Map(productRows.map(r => [String(r._id), String(r.barcode || '')]))

    const wb = XLSX.utils.book_new()

    const salesHeader = ['Tarih', 'İşlem Sayısı', 'Ciro', 'Ortalama Sepet', 'Nakit', 'POS', 'Banka', 'Cari/Veresiye']
    const salesRows = (salesDaily.items || []).map(r => {
      const by = r.byMethod || {}
      const cash = Number(by.cash || 0)
      const pos = Number(by.pos || 0) + Number(by.card || 0)
      const bank = Number(by.bank || 0)
      const account = Number(by.account || 0)
      return [
        ymdToTr(r.day),
        Number(r.saleCount || 0),
        Number(r.totalRevenue || 0),
        Number(r.avgBasket || 0),
        cash,
        pos,
        bank,
        account
      ]
    })
    const wsSales = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows])
    wsSales['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsSales, 'Satış Raporu')

    const prodHeader = ['Ürün', 'Barkod', 'Adet', 'Ciro']
    const prodRows = (topProducts || []).map(p => [
      String(p.name || ''),
      barcodeById.get(String(p.productId)) || '',
      Number(p.qty || 0),
      Number(p.total || 0)
    ])
    const wsProd = XLSX.utils.aoa_to_sheet([prodHeader, ...prodRows])
    wsProd['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsProd, 'En Çok Satılan Ürünler')

    const custHeader = ['Cari Adı', 'Telefon', 'Borç/Bakiye', 'Son İşlem Tarihi']
    const custRows = (customers || []).map(c => [
      String(c.name || ''),
      String(c.phone || ''),
      Number(c.balance || 0),
      c.lastActionAt ? new Date(c.lastActionAt).toLocaleString('tr-TR') : ''
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
