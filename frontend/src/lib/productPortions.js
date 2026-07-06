const toSafeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const getProductSettings = (item) => (
  item?.settings && typeof item.settings === 'object' && !Array.isArray(item.settings)
    ? item.settings
    : {}
)

export const getProductPortionOptions = (item) => {
  const settings = getProductSettings(item)
  const basePrice = toSafeNumber(item?.price)
  const options = [{ key: 'full', label: 'Tam Porsiyon', price: basePrice }]
  if (settings?.halfPortionEnabled === true || item?.halfPortionEnabled === true) {
    options.push({
      key: 'half',
      label: 'Yarim Porsiyon',
      price: toSafeNumber(settings?.halfPortionPrice ?? item?.halfPortionPrice, basePrice)
    })
  }
  if (settings?.oneAndHalfPortionEnabled === true || item?.oneAndHalfPortionEnabled === true) {
    options.push({
      key: 'one_and_half',
      label: 'Bir Bucuk Porsiyon',
      price: toSafeNumber(settings?.oneAndHalfPortionPrice ?? item?.oneAndHalfPortionPrice, basePrice)
    })
  }
  return options
}

export const getSelectedProductPortion = (item, portionKey) => (
  getProductPortionOptions(item).find((option) => option.key === portionKey) || getProductPortionOptions(item)[0]
)

export const requiresProductConfig = (item) => !!item?.isWeightBased || getProductPortionOptions(item).length > 1

export const buildConfiguredProductPayload = (item, config = {}) => {
  const portion = getSelectedProductPortion(item, config?.portionKey || 'full')
  const weightGrams = item?.isWeightBased
    ? Math.round(Number(config?.weightGrams || 0))
    : null

  return {
    menuItemId: item?.id || item?.menuItemId || '',
    weightGrams: item?.isWeightBased ? weightGrams : null,
    portionKey: portion?.key || 'full',
    nameOverride: portion?.key === 'full' ? String(item?.name || '') : `${String(item?.name || '')} (${String(portion?.label || '')})`,
    priceOverride: toSafeNumber(portion?.price, toSafeNumber(item?.price))
  }
}
