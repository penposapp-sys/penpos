export const EXCEL_HEADERS_TR = {
  sku: 'SKU',
  barcode: 'Barkod',
  name: 'Ürün Adı',
  price: 'Satış Fiyatı',
  costPrice: 'Alış Fiyatı',
  vatRate: 'KDV Oranı',
  stockTrackingEnabled: 'Stok Takibi',
  stockQty: 'Stok Miktarı',
  category: 'Kategori',
  isActive: 'Aktif',
  description: 'Açıklama',
  unit: 'Birim',
  imageUrl: 'Görsel URL'
}

export const KERMES_PRODUCTS_EXPORT_KEYS = [
  'sku',
  'name',
  'price',
  'category',
  'isActive',
  'description',
  'barcode',
  'vatRate',
  'unit',
  'imageUrl'
]

export const CANTEEN_PRODUCTS_EXPORT_KEYS = [
  'barcode',
  'name',
  'price',
  'costPrice',
  'vatRate',
  'stockTrackingEnabled',
  'stockQty',
  'category'
]

export const trHeadersFor = (keys) => keys.map(k => EXCEL_HEADERS_TR[k] || k)

export const trRowFor = (row, keys) => {
  const out = {}
  for (const k of keys) out[EXCEL_HEADERS_TR[k] || k] = row?.[k] ?? ''
  return out
}

