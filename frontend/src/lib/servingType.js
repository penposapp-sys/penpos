export function servingTypeToApi(value) {
  if (value === undefined || value === null) return null

  const raw = String(value).trim()
  if (!raw) return null

  const simplified = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (simplified === 'tray' || simplified === 'plate' || simplified === 'package') return simplified
  if (simplified === 'tepside') return 'tray'
  if (simplified === 'tabakta') return 'plate'
  if (simplified === 'paket') return 'package'

  return null
}

