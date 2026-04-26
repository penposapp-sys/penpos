const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const buildGroupKey = (item) => [
  String(item?.menuItemId || ''),
  String(item?.note || ''),
  String(item?.status || ''),
  String(item?.weightGrams || ''),
  String(item?.servingType || '')
].join('|')

const buildGroupedRows = (items = [], prefix = 'g') => Object.values((Array.isArray(items) ? items : []).reduce((acc, item) => {
  const key = buildGroupKey(item)
  const stableId = item?._id || item?.id || item?.itemId || null
  const prev = acc[key]
  if (!prev) {
    acc[key] = {
      key: `${prefix}:${key}`,
      menuItemId: item?.menuItemId || null,
      itemId: stableId ? String(stableId) : null,
      itemIds: stableId ? [String(stableId)] : [],
      note: item?.note || '',
      qty: toNumber(item?.qty),
      subtotal: toNumber(item?.subtotal),
      repr: item
    }
  } else {
    prev.qty += toNumber(item?.qty)
    prev.subtotal += toNumber(item?.subtotal)
    if (stableId) prev.itemIds.push(String(stableId))
  }
  return acc
}, {}))

const buildSeparateRows = (items = [], prefix = 's') => {
  const rows = []
  for (const item of Array.isArray(items) ? items : []) {
    const stableId = item?._id || item?.id || item?.itemId || null
    const itemId = stableId ? String(stableId) : null
    const qty = Math.max(0, Math.floor(toNumber(item?.qty)))
    const subtotal = toNumber(item?.subtotal)
    const isWeightBased = !!item?.isWeightBased
    const unitSubtotal = qty > 0 ? subtotal / qty : subtotal

    if (!isWeightBased && qty > 1) {
      for (let index = 0; index < qty; index += 1) {
        rows.push({
          key: `${itemId || `${prefix}:${String(item?.menuItemId || '')}`}:u:${index}`,
          menuItemId: item?.menuItemId || null,
          itemId,
          itemIds: itemId ? [itemId] : [],
          note: item?.note || '',
          qty: 1,
          subtotal: Math.round(unitSubtotal * 100) / 100,
          repr: item,
          splitUnit: true,
          splitSourceQty: qty
        })
      }
      continue
    }

    rows.push({
      key: itemId || `${prefix}:${String(item?.menuItemId || '')}:${rows.length}`,
      menuItemId: item?.menuItemId || null,
      itemId,
      itemIds: itemId ? [itemId] : [],
      note: item?.note || '',
      qty,
      subtotal,
      repr: item
    })
  }
  return rows
}

export const buildCartRows = (items = [], mode = 'grouped', prefix = 'g') => {
  if (mode === 'grouped') {
    return buildGroupedRows(items, prefix)
  }
  return buildSeparateRows(items, prefix)
}
