import XLSX from 'xlsx'
import { parse as parseCsv } from 'csv-parse/sync'
import MenuItem from '../models/MenuItem.js'
import Category from '../models/Category.js'
import { error } from '../utils/errors.js'
import { KERMES_PRODUCTS_EXPORT_KEYS, trHeadersFor, trRowFor } from '../utils/excelHeaders.js'

const TEMPLATE_HEADERS = KERMES_PRODUCTS_EXPORT_KEYS

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
  if (normalized === 'sku' || normalized === 'urunkodu' || normalized === 'kodu' || normalized === 'code') return 'sku'
  if (normalized === 'name' || normalized === 'urunadi' || normalized === 'ad' || normalized === 'isim' || normalized === 'productname') return 'name'
  if (normalized === 'price' || normalized === 'satisfiyati' || normalized === 'satis' || normalized === 'fiyat') return 'price'
  if (normalized === 'category' || normalized === 'categoryname' || normalized === 'kategoriname' || normalized === 'kategori' || normalized === 'kategoriadi') return 'category'
  if (normalized === 'categoryid' || normalized === 'category_id') return 'categoryId'
  if (normalized === 'isactive' || normalized === 'is_active' || normalized === 'aktif' || normalized === 'active') return 'isActive'
  if (normalized === 'description' || normalized === 'aciklama') return 'description'
  if (normalized === 'barcode' || normalized === 'barkod') return 'barcode'
  if (normalized === 'vatrate' || normalized === 'vat_rate' || normalized === 'kdv' || normalized === 'kdvorani') return 'vatRate'
  if (normalized === 'unit' || normalized === 'birim') return 'unit'
  if (normalized === 'imageurl' || normalized === 'image_url' || normalized === 'gorselurl' || normalized === 'resimurl') return 'imageUrl'
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

const asBoolean = (v, defaultValue = true) => {
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

const buildNormalizedRows = ({ headers, rows }) => {
  const headerMap = new Map()
  for (const raw of headers) {
    const normalized = normalizeHeader(raw)
    const canonical = headerAlias(normalized)
    if (!canonical) continue
    if (!headerMap.has(canonical)) headerMap.set(canonical, raw)
  }

  const requiredCols = ['sku', 'name', 'price']
  for (const r of requiredCols) {
    if (!headerMap.has(r)) {
      throw error('invalid_template', `Eksik kolon: ${r}`, 400)
    }
  }
  if (!headerMap.has('categoryId') && !headerMap.has('category')) {
    throw error('invalid_template', 'Eksik kolon: categoryId veya category', 400)
  }

  const normalizedRows = rows.map((raw) => {
    const get = (k) => {
      const key = headerMap.get(k)
      return key ? raw[key] : undefined
    }
    return {
      sku: asTrimmedString(get('sku')),
      name: asTrimmedString(get('name')),
      price: get('price'),
      categoryId: asTrimmedString(get('categoryId')),
      category: asTrimmedString(get('category')),
      isActive: get('isActive'),
      description: asTrimmedString(get('description')),
      barcode: asTrimmedString(get('barcode')),
      vatRate: get('vatRate'),
      unit: asTrimmedString(get('unit')),
      imageUrl: asTrimmedString(get('imageUrl'))
    }
  })

  return normalizedRows
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

export const exportProducts = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx'
    const tenantId = req.user.tenantId
    const categories = await Category.find({ tenantId }).select('_id name').lean()
    const catNameById = new Map(categories.map((c) => [String(c._id), c.name]))

    const items = await MenuItem.find({ tenantId }).sort({ updatedAt: -1 }).lean()
    const canonicalRows = items.map((i) => {
      const categoryId = String(i.categoryId || '')
      return {
        sku: i.sku || '',
        name: i.name || '',
        price: typeof i.price === 'number' ? i.price : '',
        category: catNameById.get(categoryId) || '',
        isActive: i.isActive === false ? 'FALSE' : 'TRUE',
        description: i.description || '',
        barcode: i.barcode || '',
        vatRate: typeof i.vatRate === 'number' ? i.vatRate : '',
        unit: i.unit || '',
        imageUrl: i.imageUrl || ''
      }
    })

    const headersTr = trHeadersFor(TEMPLATE_HEADERS)
    const rows = canonicalRows.map(r => trRowFor(r, TEMPLATE_HEADERS))

    const baseName = `products_export_${filenameStamp()}`
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

export const downloadTemplate = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx'
    const canonicalRows = [
      {
        sku: 'SKU-001',
        name: 'Örnek Ürün',
        price: 100,
        category: 'MevcutKategoriAdi',
        isActive: 'TRUE',
        description: 'Açıklama (opsiyonel)',
        barcode: '1234567890123',
        vatRate: 10,
        unit: 'adet',
        imageUrl: 'https://example.com/image.png'
      },
      {
        sku: 'SKU-002',
        name: 'Örnek Ürün 2',
        price: 50,
        category: 'MevcutKategoriAdi',
        isActive: '1',
        description: '',
        barcode: '',
        vatRate: 0,
        unit: '',
        imageUrl: ''
      }
    ]

    const headersTr = trHeadersFor(TEMPLATE_HEADERS)
    const rows = canonicalRows.map(r => trRowFor(r, TEMPLATE_HEADERS))

    const baseName = 'products_template'
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

export const importProducts = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const actorUserId = req.user.id
    const file = req.file
    if (!file || !file.buffer) {
      return next(error('file_required', 'Dosya gerekli', 400))
    }
    const originalName = String(file.originalname || '').toLowerCase()
    const ext = originalName.endsWith('.csv') ? 'csv' : (originalName.endsWith('.xlsx') ? 'xlsx' : '')
    if (!ext) {
      return next(error('invalid_file_type', 'Sadece .xlsx veya .csv dosyaları desteklenir', 400))
    }

    const parsed = ext === 'csv' ? parseCsvBuffer(file.buffer) : parseXlsxBuffer(file.buffer)
    const normalizedRows = buildNormalizedRows(parsed)
    const dataRows = normalizedRows
      .map((r, idx) => ({ ...r, __rowNumber: idx + 2 }))
      .filter((r) => {
        const { __rowNumber, ...rest } = r
        return Object.values(rest).some((v) => v !== '' && v !== null && v !== undefined)
      })

    const maxRows = 5000
    if (dataRows.length > maxRows) {
      return next(error('too_many_rows', `Maksimum satır sayısı: ${maxRows}`, 400))
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

    const toDisplayCategoryName = (value) => {
      return String(value || '').trim().replace(/\s+/g, ' ')
    }

    const categories = await Category.find({ tenantId }).select('_id name').lean()
    const catById = new Map(categories.map((c) => [String(c._id), c]))
    const catByKey = new Map(categories.map((c) => [normalizeCategoryKey(c.name), c]))

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

    const missingKeys = Array.from(requestedKeyToDisplay.keys()).filter(k => !catByKey.has(k))
    if (missingKeys.length > 0) {
      const docs = missingKeys.map((k) => ({ tenantId, createdBy: actorUserId, name: requestedKeyToDisplay.get(k) || k, isActive: true }))
      try {
        await Category.insertMany(docs, { ordered: false })
      } catch {}
      const refreshed = await Category.find({ tenantId }).select('_id name').lean()
      catById.clear()
      catByKey.clear()
      for (const c of refreshed) {
        catById.set(String(c._id), c)
        catByKey.set(normalizeCategoryKey(c.name), c)
      }
    }

    const createdCategories = missingKeys.filter(k => catByKey.has(k)).length
    const matchedCategories = existingRequestedKeys.size

    const errors = []
    const valid = []
    const seenSku = new Set()
    let missingCategoryRows = 0

    for (const r of dataRows) {
      const row = r.__rowNumber

      if (!r.sku) {
        errors.push({ row, field: 'sku', message: 'SKU zorunlu' })
        continue
      }
      if (seenSku.has(r.sku)) {
        errors.push({ row, field: 'sku', message: `Dosyada tekrar eden SKU: ${r.sku}` })
        continue
      }
      seenSku.add(r.sku)

      if (!r.name) {
        errors.push({ row, field: 'name', message: 'Ad boş olamaz' })
        continue
      }

      const price = asNumber(r.price)
      if (price === null || price < 0) {
        errors.push({ row, field: 'price', message: 'Fiyat sayı olmalı ve 0 veya daha büyük olmalı' })
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

      const isActive = asBoolean(r.isActive, true)
      const vatRate = r.vatRate === '' ? null : asNumber(r.vatRate)
      if (vatRate !== null) {
        const allowed = [0, 1, 10, 20]
        if (!allowed.includes(vatRate)) {
          errors.push({ row, field: 'vatRate', message: `Geçersiz KDV oranı: ${vatRate}` })
          continue
        }
      }

      valid.push({
        row,
        sku: r.sku,
        name: r.name,
        price,
        categoryProvided,
        categoryId: resolvedCategoryId,
        isActive,
        description: r.description || '',
        barcode: r.barcode || '',
        vatRate: vatRate === null ? 0 : vatRate,
        unit: r.unit || '',
        imageUrl: r.imageUrl || ''
      })
    }

    if (valid.length === 0) {
      return res.json({ success: true, totalRows: dataRows.length, created: 0, updated: 0, failed: errors.length, errors, createdCategories, matchedCategories, missingCategoryRows })
    }

    const skus = valid.map((v) => v.sku)
    const existing = await MenuItem.find({ tenantId, sku: { $in: skus } }).select('sku').lean()
    const existingSkus = new Set(existing.map((e) => String(e.sku || '')))
    const created = valid.filter((v) => !existingSkus.has(v.sku)).length
    const updated = valid.length - created

    const ops = valid.map((v) => {
      const exists = existingSkus.has(v.sku)
      const shouldSetCategory = !!v.categoryProvided
      const categoryIdForUpdate = shouldSetCategory ? (v.categoryId || null) : (exists ? undefined : null)
      const set = {
        name: v.name,
        price: v.price,
        description: v.description,
        barcode: v.barcode,
        vatRate: v.vatRate,
        unit: v.unit,
        imageUrl: v.imageUrl,
        isActive: v.isActive
      }
      if (categoryIdForUpdate !== undefined) set.categoryId = categoryIdForUpdate

      return {
      updateOne: {
        filter: { tenantId, sku: v.sku },
        update: {
          $setOnInsert: { tenantId, sku: v.sku },
          $set: set
        },
        upsert: true
      }
      }
    })

    await MenuItem.bulkWrite(ops, { ordered: false })

    res.json({ success: true, totalRows: dataRows.length, created, updated, failed: errors.length, errors, createdCategories, matchedCategories, missingCategoryRows })
  } catch (err) {
    next(err)
  }
}
