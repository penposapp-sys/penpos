export const ServingType = {
  TRAY: 'tray',
  PLATE: 'plate',
  PACKAGE: 'package'
}

export const normalizeServingType = (value, { fallback = ServingType.PLATE } = {}) => {
  if (value === undefined || value === null) return fallback
  const raw = String(value).trim()
  if (!raw) return fallback

  const simplified = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (simplified === 'tray' || simplified === 'plate' || simplified === 'package') return simplified
  if (simplified === 'tepside') return ServingType.TRAY
  if (simplified === 'tabakta') return ServingType.PLATE
  if (simplified === 'paket') return ServingType.PACKAGE

  return fallback
}

export const servingTypeLabelTR = (value, { fallback = 'TABAKTA' } = {}) => {
  const v = normalizeServingType(value, { fallback: null })
  switch (v) {
    case ServingType.TRAY:
      return 'TEPSİDE'
    case ServingType.PLATE:
      return 'TABAKTA'
    case ServingType.PACKAGE:
      return 'PAKET'
    default:
      return fallback
  }
}
