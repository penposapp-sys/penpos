const defaultOptionRow = () => ({
  id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  group: '',
  name: '',
  priceDiff: 0,
  sortOrder: 0
})

const defaultIngredientRow = () => ({
  id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  quantity: 1,
  unit: 'Adet',
  deductFromStock: true
})

export const PRODUCT_SETTINGS_DEFAULTS = {
  packagePrice: 0,
  costPrice: 0,
  isFavorite: false,
  qrMenuVisible: false,
  qrImageUrl: '',
  qrTitle: '',
  qrDescription: '',
  qrForeignName: '',
  qrForeignDescription: '',
  stockQty: 0,
  criticalStockQty: 0,
  stockUnit: 'Adet',
  stockTrackingEnabled: false,
  closeSaleWhenOutOfStock: false,
  allowNegativeStock: true,
  halfPortionEnabled: false,
  halfPortionPrice: 0,
  oneAndHalfPortionEnabled: false,
  oneAndHalfPortionPrice: 0,
  weightUnit: 'Gram',
  optionGroups: [],
  ingredients: [],
  pluCode: '',
  quickSaleCode: '',
  barcodeSaleEnabled: false,
  scaleBarcodeEnabled: false,
  priceHistory: []
}

export const PRODUCT_SETTING_GROUPS = [
  { key: 'general', title: 'Genel Ayarlar', icon: 'A' },
  { key: 'image', title: 'Ürün Görseli', icon: 'G' },
  { key: 'stock', title: 'Stok Yönetimi', icon: 'S' },
  { key: 'qr', title: 'Dijital Menü / QR', icon: 'Q' },
  { key: 'portion', title: 'Porsiyon ve Tartı', icon: 'P' },
  { key: 'options', title: 'Ürün Ek Seçenekleri', icon: 'E' },
  { key: 'ingredients', title: 'Ürün Malzemeleri', icon: 'M' },
  { key: 'barcode', title: 'Barkod', icon: 'B' },
  { key: 'priceHistory', title: 'Fiyat Geçmişi', icon: 'F' }
]

const asNumber = (value, fallback = 0) => {
  const normalized = String(value ?? '').replace(',', '.').trim()
  const number = Number(normalized)
  return Number.isFinite(number) ? number : fallback
}

const asBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

const normalizeOptionGroups = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => ({
    id: String(item?.id || `opt-${index}`),
    group: String(item?.group || ''),
    name: String(item?.name || ''),
    priceDiff: asNumber(item?.priceDiff, 0),
    sortOrder: asNumber(item?.sortOrder, index)
  }))
}

const normalizeIngredients = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => ({
    id: String(item?.id || `ing-${index}`),
    name: String(item?.name || ''),
    quantity: asNumber(item?.quantity, 1),
    unit: String(item?.unit || 'Adet'),
    deductFromStock: asBoolean(item?.deductFromStock, true)
  }))
}

const normalizePriceHistory = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((entry, index) => ({
    id: String(entry?.id || `price-${index}`),
    oldPrice: asNumber(entry?.oldPrice, 0),
    newPrice: asNumber(entry?.newPrice, 0),
    changedAt: String(entry?.changedAt || ''),
    changedBy: String(entry?.changedBy || ''),
    changedByName: String(entry?.changedByName || '')
  }))
}

export const mergeProductSettings = (settings = {}) => ({
  ...PRODUCT_SETTINGS_DEFAULTS,
  ...(settings && typeof settings === 'object' ? settings : {}),
  optionGroups: normalizeOptionGroups(settings?.optionGroups),
  ingredients: normalizeIngredients(settings?.ingredients),
  priceHistory: normalizePriceHistory(settings?.priceHistory)
})

export const createEmptyProductForm = (categoryId = '') => ({
  categoryId: categoryId || '',
  name: '',
  price: 0,
  description: '',
  imageUrl: '',
  sortOrder: 0,
  isWeightBased: false,
  printLabelEnabled: false,
  isActive: true,
  branchIds: [],
  allBranches: true,
  barcode: '',
  vatRate: 0,
  unit: '',
  visibility: {
    allBranches: true,
    branchIds: []
  },
  ...mergeProductSettings({})
})

export const inflateProductForm = (item = {}) => {
  const settings = mergeProductSettings(item?.settings)
  const branchIds = Array.isArray(item?.branchIds) ? item.branchIds.map((branchId) => String(branchId)) : []
  return {
    categoryId: String(item?.categoryId || ''),
    name: String(item?.name || ''),
    price: asNumber(item?.price, 0),
    description: String(item?.description || ''),
    imageUrl: String(item?.imageUrl || ''),
    sortOrder: asNumber(item?.sortOrder, 0),
    isWeightBased: asBoolean(item?.isWeightBased, false),
    printLabelEnabled: asBoolean(item?.printLabelEnabled, false),
    isActive: item?.isActive !== false,
    barcode: String(item?.barcode || ''),
    vatRate: asNumber(item?.vatRate, 0),
    unit: String(item?.unit || ''),
    branchIds,
    allBranches: branchIds.length === 0,
    visibility: {
      allBranches: branchIds.length === 0,
      branchIds
    },
    ...settings
  }
}

export const buildProductPayload = (form = {}) => ({
  categoryId: form.categoryId,
  name: String(form.name || '').trim(),
  price: asNumber(form.price, 0),
  description: String(form.description || '').trim(),
  sortOrder: asNumber(form.sortOrder, 0),
  isWeightBased: !!form.isWeightBased,
  printLabelEnabled: !!form.printLabelEnabled,
  isActive: form.isActive !== false,
  barcode: String(form.barcode || '').trim(),
  vatRate: asNumber(form.vatRate, 0),
  unit: String(form.unit || '').trim(),
  allBranches: form.visibility?.allBranches !== false,
  branchIds: form.visibility?.allBranches ? [] : (Array.isArray(form.visibility?.branchIds) ? form.visibility.branchIds : []),
  settings: {
    packagePrice: asNumber(form.packagePrice, 0),
    costPrice: asNumber(form.costPrice, 0),
    isFavorite: !!form.isFavorite,
    qrMenuVisible: !!form.qrMenuVisible,
    qrImageUrl: String(form.qrImageUrl || '').trim(),
    qrTitle: String(form.qrTitle || '').trim(),
    qrDescription: String(form.qrDescription || '').trim(),
    qrForeignName: String(form.qrForeignName || '').trim(),
    qrForeignDescription: String(form.qrForeignDescription || '').trim(),
    stockQty: asNumber(form.stockQty, 0),
    criticalStockQty: asNumber(form.criticalStockQty, 0),
    stockUnit: String(form.stockUnit || 'Adet').trim(),
    stockTrackingEnabled: !!form.stockTrackingEnabled,
    closeSaleWhenOutOfStock: !!form.closeSaleWhenOutOfStock,
    allowNegativeStock: !!form.allowNegativeStock,
    halfPortionEnabled: !!form.halfPortionEnabled,
    halfPortionPrice: asNumber(form.halfPortionPrice, 0),
    oneAndHalfPortionEnabled: !!form.oneAndHalfPortionEnabled,
    oneAndHalfPortionPrice: asNumber(form.oneAndHalfPortionPrice, 0),
    weightUnit: String(form.weightUnit || 'Gram').trim(),
    optionGroups: normalizeOptionGroups(form.optionGroups),
    ingredients: normalizeIngredients(form.ingredients),
    pluCode: String(form.pluCode || '').trim(),
    quickSaleCode: String(form.quickSaleCode || '').trim(),
    barcodeSaleEnabled: !!form.barcodeSaleEnabled,
    scaleBarcodeEnabled: !!form.scaleBarcodeEnabled,
    priceHistory: normalizePriceHistory(form.priceHistory)
  }
})

export const createNewOptionRow = defaultOptionRow
export const createNewIngredientRow = defaultIngredientRow
