const normalizeLabelServingType = (value) => {
  const simplified = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  if (['plate', 'tabakta'].includes(simplified)) return 'plate'
  if (['tray', 'tepside'].includes(simplified)) return 'tray'
  if (['package', 'paket', 'pakette'].includes(simplified)) return 'package'
  return null
}

const labelServingTypeText = (value) => {
  switch (normalizeLabelServingType(value)) {
    case 'plate': return 'TABAKTA'
    case 'tray': return 'TEPSIDE'
    case 'package': return 'PAKET'
    default: return ''
  }
}

const buildLabelAmountLine = ({ qty, weightGrams, isWeightBased, servingType } = {}) => {
  const weight = Math.max(0, Number(weightGrams || 0))
  const count = Math.max(1, Number(qty || 1))
  const amount = isWeightBased === true && weight > 0 ? `${weight} GR` : `${count} ADET`
  const servingLabel = labelServingTypeText(servingType)
  return servingLabel ? `${amount} - ${servingLabel}` : amount
}

export { normalizeLabelServingType, labelServingTypeText, buildLabelAmountLine }
