import XLSX from 'xlsx'
import { parse as parseCsv } from 'csv-parse/sync'
import mongoose from 'mongoose'
import { error } from '../../../utils/errors.js'
import CanteenProduct from '../models/CanteenProduct.js'
import CanteenCategory from '../models/CanteenCategory.js'
import { CANTEEN_PRODUCTS_EXPORT_KEYS, trHeadersFor, trRowFor } from '../../../utils/excelHeaders.js'

const TEMPLATE_HEADERS = CANTEEN_PRODUCTS_EXPORT_KEYS

const normalizeAscii = (value) => {
  const s = String(value || '')
  return s
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
}

const normalizeHeader = (value) => normalizeAscii(value).replace(/[\s_-]+/g, '')

const headerAlias = (normalized) => {
  if (!normalized) return null
  if (normalized === 'barcode' || normalized === 'barkod') return 'barcode'
  if (normalized === 'name' || normalized === 'urunadi' || normalized === 'ad' || normalized === 'isim' || normalized === 'productname') return 'name'
  if (normalized === 'price' || normalized === 'satisfiyati' || normalized === 'satis' || normalized === 'fiyat') return 'price'
  if (normalized === 'costprice' || normalized === 'buyprice' || normalized === 'alisfiyati') return 'costPrice'
  if (normalized === 'vatrate' || normalized === 'vat_rate' || normalized === 'kdv' || normalized === 'kdvorani') return 'vatRate'
  if (normalized === 'stocktrackingenabled' || normalized === 'stocktracking' || normalized === 'stocktrack' || normalized === 'stoktakibi' || normalized === 'stoktakip') return 'stockTrackingEnabled'
  if (normalized === 'stockqty' || normalized === 'stok' || normalized === 'stokadet' || normalized === 'stokmiktar' || normalized === 'stokmiktari') return 'stockQty'
  if (normalized === 'categoryid' || normalized === 'category_id') return 'categoryId'
  if (normalized === 'category' || normalized === 'categoryname' || normalized === 'kategori' || normalized === 'kategoriadi') return 'category'
  return null
}

const asTrimmedString = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  return String(v).trim()
}

const asNumber = (v) => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const asBoolean = (v, defaultValue = false) => {
  if (v === null || v === undefined || v === '') return defaultValue
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (!s) return defaultValue
  if (['true', '1', 'yes', 'y', 'evet'].includes(s)) return true
  if (['false', '0', 'no', 'n', 'hayir', 'hayır'].includes(s)) return false
  return defaultValue
}

const detectCsvDelimiter = (text) => {
  const firstLine = String(text || '').split(/\r?\n/)[0] || ''
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  return semicolonCount > commaCount ? ';' : ','
}

const parseXlsxBuffer = (buffer) => {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const ws = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const headerRow = Array.isArray(matrix[0]) ? matrix[0] : []
  const rawHeaders = headerRow.map((h) => asTrimmedString(h))
  const rows = []
  for (let i = 1; i < matrix.length; i++) {
    const line = Array.isArray(matrix[i]) ? matrix[i] : []
    const obj = {}
    for (let c = 0; c < rawHeaders.length; c++) {
      const k = rawHeaders[c]
      if (!k) continue
      obj[k] = line[c]
    }
    rows.push(obj)
  }
  return { headers: rawHeaders, rows }
}

const parseCsvBuffer = (buffer) => {
  const text = buffer.toString('utf8')
  const delimiter = detectCsvDelimiter(text)
  const rows = parseCsv(text, { columns: true, skip_empty_lines: true, bom: true, delimiter })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

const csvStringify = (headers, rows) => {
  const encode = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = []
  lines.push(headers.map(encode).join(','))
  for (const r of rows) {
    lines.push(headers.map((h) => encode(r[h])).join(','))
  }
  return lines.join('\n')
}

const filenameStamp = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

const buildNormalizedRows = ({ headers, rows }) => {
  const headerMap = new Map()
  for (const raw of headers) {
    const normalized = normalizeHeader(raw)
    const canonical = headerAlias(normalized)
    if (!canonical) continue
    if (!headerMap.has(canonical)) headerMap.set(canonical, raw)
  }

  const requiredCols = ['barcode', 'name', 'price']
  for (const r of requiredCols) {
    if (!headerMap.has(r)) throw error('invalid_template', `Eksik kolon: ${r}`, 400)
  }
  if (!headerMap.has('categoryId') && !headerMap.has('category')) {
    throw error('invalid_template', 'Eksik kolon: categoryId veya category', 400)
  }

  return rows.map((raw) => {
    const get = (k) => {
      const key = headerMap.get(k)
      return key ? raw[key] : undefined
    }
    return {
      barcode: asTrimmedString(get('barcode')),
      name: asTrimmedString(get('name')),
      price: get('price'),
      costPrice: get('costPrice'),
      vatRate: get('vatRate'),
      stockTrackingEnabled: get('stockTrackingEnabled'),
      stockQty: get('stockQty'),
      categoryId: asTrimmedString(get('categoryId')),
      category: asTrimmedString(get('category'))
    }
  })
}

const normalizeCategoryKey = (value) => {
  const s = String(value || '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  return s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
}

const normalizeLegacyKey = (value) => String(value || '').trim().toLowerCase()
const toDisplayCategoryName = (value) => String(value || '').trim().replace(/\s+/g, ' ')

export const downloadTemplate = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx'
    const canonicalRows = [
      {
        barcode: '1234567890123',
        name: 'Örnek Ürün',
        price: 10,
        costPrice: 7,
        vatRate: 10,
        stockTrackingEnabled: 'TRUE',
        stockQty: 100,
        category: 'İçecek'
      },
      {
        barcode: '1234567890124',
        name: 'Örnek Ürün 2',
        price: 5,
        costPrice: 0,
        vatRate: 0,
        stockTrackingEnabled: 'FALSE',
        stockQty: 0,
        category: 'Atıştırmalık'
      }
    ]

    const headersTr = trHeadersFor(TEMPLATE_HEADERS)
    const rows = canonicalRows.map((r) => trRowFor(r, TEMPLATE_HEADERS))

    const baseName = 'canteen_products_template'
    if (format === 'csv') {
      const csv = csvStringify(headersTr, rows)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`)
      return res.send(csv)
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows, { header: headersTr })
    XLSX.utils.book_append_sheet(wb, ws, 'template')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export const exportProducts = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx'
    const tenantId = req.user.tenantId
    const branchId = req.canteenBranchId

    const categories = await CanteenCategory.find({ tenantId, branchId, isActive: true }).select('_id name').lean()
    const catNameById = new Map((categories || []).map((c) => [String(c._id), c.name]))

    const items = await CanteenProduct.find({ tenantId, branchId, isActive: true }).sort({ createdAt: -1 }).lean()
    const canonicalRows = (items || []).map((p) => {
      const categoryId = String(p.categoryId || '')
      return {
        barcode: p.barcode || '',
        name: p.name || '',
        price: typeof p.price === 'number' ? p.price : '',
        costPrice: typeof p.costPrice === 'number' ? p.costPrice : '',
        vatRate: typeof p.vatRate === 'number' ? p.vatRate : '',
        stockTrackingEnabled: p.stockTrackingEnabled === true ? 'TRUE' : 'FALSE',
        stockQty: typeof p.stockQty === 'number' ? p.stockQty : '',
        category: catNameById.get(categoryId) || ''
      }
    })

    const headersTr = trHeadersFor(TEMPLATE_HEADERS)
    const rows = canonicalRows.map((r) => trRowFor(r, TEMPLATE_HEADERS))

    const baseName = `canteen_products_export_${filenameStamp()}`
    if (format === 'csv') {
      const csv = csvStringify(headersTr, rows)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`)
      return res.send(csv)
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows, { header: headersTr })
    XLSX.utils.book_append_sheet(wb, ws, 'products')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export const importProducts = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const branchId = req.canteenBranchId
    const actorUserId = req.user.id
    const file = req.file
    if (!file || !file.buffer) return next(error('file_required', 'Dosya gerekli', 400))

    const originalName = String(file.originalname || '').toLowerCase()
    const ext = originalName.endsWith('.csv') ? 'csv' : (originalName.endsWith('.xlsx') ? 'xlsx' : '')
    if (!ext) return next(error('invalid_file_type', 'Sadece .xlsx veya .csv dosyaları desteklenir', 400))

    const parsed = ext === 'csv' ? parseCsvBuffer(file.buffer) : parseXlsxBuffer(file.buffer)
    const normalizedRows = buildNormalizedRows(parsed)
    const dataRows = normalizedRows
      .map((r, idx) => ({ ...r, __rowNumber: idx + 2 }))
      .filter((r) => {
        const { __rowNumber, ...rest } = r
        return Object.values(rest).some((v) => v !== '' && v !== null && v !== undefined)
      })

    const maxRows = 5000
    if (dataRows.length > maxRows) return next(error('too_many_rows', `Maksimum satır sayısı: ${maxRows}`, 400))

    const categories = await CanteenCategory.find({ tenantId, branchId, isActive: true }).select('_id name nameNormalized').lean()
    const catById = new Map((categories || []).map((c) => [String(c._id), c]))
    const catByKey = new Map()
    for (const c of (categories || [])) {
      const k1 = normalizeCategoryKey(c.name)
      const k2 = normalizeLegacyKey(c.nameNormalized)
      if (k1) catByKey.set(k1, c)
      if (k2) catByKey.set(k2, c)
    }

    const requestedKeyToDisplay = new Map()
    for (const r of dataRows) {
      const categoryNameInput = asTrimmedString(r.category)
      if (!categoryNameInput) continue
      const key = normalizeCategoryKey(categoryNameInput)
      if (!key) continue
      if (!requestedKeyToDisplay.has(key)) requestedKeyToDisplay.set(key, toDisplayCategoryName(categoryNameInput))
    }

    const existingRequestedKeys = new Set()
    for (const key of requestedKeyToDisplay.keys()) {
      if (catByKey.has(key)) existingRequestedKeys.add(key)
    }

    const missingKeys = Array.from(requestedKeyToDisplay.keys()).filter((k) => !catByKey.has(k))
    if (missingKeys.length > 0) {
      for (const key of missingKeys) {
        const name = requestedKeyToDisplay.get(key) || key
        const nameNormalized = normalizeLegacyKey(name)
        if (!nameNormalized) continue
        try {
          const created = await CanteenCategory.create({
            tenantId,
            branchId,
            name,
            nameNormalized,
            isActive: true,
            createdAt: new Date(),
            createdBy: actorUserId
          })
          catById.set(String(created._id), { _id: created._id, name: created.name, nameNormalized: created.nameNormalized })
          catByKey.set(key, { _id: created._id, name: created.name, nameNormalized: created.nameNormalized })
          catByKey.set(nameNormalized, { _id: created._id, name: created.name, nameNormalized: created.nameNormalized })
        } catch (e) {
          const code = Number(e?.code || 0)
          if (code === 11000) {
            const existingCat = await CanteenCategory.findOne({ tenantId, branchId, nameNormalized, isActive: true }).select('_id name nameNormalized').lean()
            if (existingCat) {
              catById.set(String(existingCat._id), existingCat)
              catByKey.set(key, existingCat)
              catByKey.set(normalizeLegacyKey(existingCat.nameNormalized), existingCat)
              catByKey.set(normalizeCategoryKey(existingCat.name), existingCat)
            }
          }
        }
      }
    }

    const createdCategories = missingKeys.filter((k) => catByKey.has(k)).length
    const matchedCategories = existingRequestedKeys.size

    const errors = []
    const valid = []
    const seenBarcode = new Set()
    let missingCategoryRows = 0

    for (const r of dataRows) {
      const row = r.__rowNumber

      if (!r.barcode) {
        errors.push({ row, field: 'barcode', message: 'Barkod zorunlu' })
        continue
      }
      if (seenBarcode.has(r.barcode)) {
        errors.push({ row, field: 'barcode', message: `Dosyada tekrar eden barkod: ${r.barcode}` })
        continue
      }
      seenBarcode.add(r.barcode)

      if (!r.name) {
        errors.push({ row, field: 'name', message: 'Ad boş olamaz' })
        continue
      }

      const price = asNumber(r.price)
      if (price === null || price < 0) {
        errors.push({ row, field: 'price', message: 'Fiyat sayı olmalı ve 0 veya daha büyük olmalı' })
        continue
      }

      const costPrice = r.costPrice === '' ? null : asNumber(r.costPrice)
      if (costPrice !== null && costPrice < 0) {
        errors.push({ row, field: 'costPrice', message: 'Alış fiyatı sayı olmalı ve 0 veya daha büyük olmalı' })
        continue
      }

      const vatRate = r.vatRate === '' ? null : asNumber(r.vatRate)
      if (vatRate !== null) {
        const allowed = [0, 1, 10, 20]
        if (!allowed.includes(vatRate)) {
          errors.push({ row, field: 'vatRate', message: `Geçersiz KDV oranı: ${vatRate}` })
          continue
        }
      }

      const stockTrackingEnabled = asBoolean(r.stockTrackingEnabled, false)
      const stockQty = r.stockQty === '' ? null : asNumber(r.stockQty)
      if (stockQty !== null && stockQty < 0) {
        errors.push({ row, field: 'stockQty', message: 'Stok sayı olmalı ve 0 veya daha büyük olmalı' })
        continue
      }

      const categoryIdInput = asTrimmedString(r.categoryId)
      const categoryNameInput = asTrimmedString(r.category)
      const categoryIdKnown = !!(categoryIdInput && catById.has(categoryIdInput))
      const categoryProvided = !!(categoryIdKnown || categoryNameInput)

      let resolvedCategoryId = null
      if (categoryIdKnown) {
        resolvedCategoryId = catById.get(categoryIdInput)._id
      } else if (categoryNameInput) {
        const key = normalizeCategoryKey(categoryNameInput)
        const cat = key ? (catByKey.get(key) || null) : null
        if (cat) resolvedCategoryId = cat._id
      } else {
        missingCategoryRows += 1
      }

      valid.push({
        row,
        barcode: r.barcode,
        name: r.name,
        price,
        costPrice: costPrice === null ? 0 : costPrice,
        vatRate: vatRate === null ? 0 : vatRate,
        stockTrackingEnabled,
        stockQty: stockQty === null ? 0 : stockQty,
        categoryProvided,
        categoryId: resolvedCategoryId
      })
    }

    if (valid.length === 0) {
      return res.json({ success: true, totalRows: dataRows.length, created: 0, updated: 0, failed: errors.length, errors, createdCategories, matchedCategories, missingCategoryRows })
    }

    const barcodes = valid.map((v) => v.barcode)
    const existing = await CanteenProduct.find({ tenantId, barcode: { $in: barcodes } }).select('barcode branchId').lean()
    const existingByBarcode = new Map((existing || []).map((p) => [String(p.barcode || ''), p]))

    const filteredValid = []
    for (const v of valid) {
      const ex = existingByBarcode.get(String(v.barcode))
      if (ex && String(ex.branchId) !== String(branchId)) {
        errors.push({ row: v.row, field: 'barcode', message: 'Bu barkod başka bir şubede kayıtlı' })
        continue
      }
      filteredValid.push(v)
    }

    if (filteredValid.length === 0) {
      return res.json({ success: true, totalRows: dataRows.length, created: 0, updated: 0, failed: errors.length, errors, createdCategories, matchedCategories, missingCategoryRows })
    }

    const existingInBranch = new Set((existing || []).filter((p) => String(p.branchId) === String(branchId)).map((p) => String(p.barcode || '')))
    const created = filteredValid.filter((v) => !existingInBranch.has(v.barcode)).length
    const updated = filteredValid.length - created

    const ops = filteredValid.map((v) => {
      const exists = existingInBranch.has(v.barcode)
      const shouldSetCategory = !!v.categoryProvided
      const categoryIdForUpdate = shouldSetCategory ? (v.categoryId || null) : (exists ? undefined : null)
      const set = {
        name: v.name,
        nameNormalized: normalizeLegacyKey(v.name),
        price: v.price,
        costPrice: v.costPrice,
        vatRate: v.vatRate,
        stockTrackingEnabled: v.stockTrackingEnabled,
        stockQty: v.stockQty,
        isActive: true
      }
      if (categoryIdForUpdate !== undefined) set.categoryId = categoryIdForUpdate
      return {
        updateOne: {
          filter: { tenantId, branchId, barcode: v.barcode },
          update: {
            $setOnInsert: { tenantId, branchId, barcode: v.barcode, createdAt: new Date() },
            $set: set
          },
          upsert: true
        }
      }
    })

    await CanteenProduct.bulkWrite(ops, { ordered: false })

    res.json({ success: true, totalRows: dataRows.length, created, updated, failed: errors.length, errors, createdCategories, matchedCategories, missingCategoryRows })
  } catch (err) {
    if (String(err?.message || '').includes('E11000')) {
      return next(error('duplicate', 'Tekrar eden kayıt (barkod veya kategori). Dosyayı kontrol edin.', 409))
    }
    next(err)
  }
}
