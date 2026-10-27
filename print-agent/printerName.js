const redirectedBaseName = (name) => String(name || '').trim().replace(
  /\s*\(\s*(?:\d+\s+(?:redirected|yönlendirildi)|(?:redirected|yönlendirildi)\s+\d+)\s*\)\s*$/i,
  ''
).trim()

export const resolveWindowsPrinterName = (requestedName, availableNames) => {
  const requested = String(requestedName || '').trim()
  if (!requested) throw new Error('printerName missing')
  const available = Array.isArray(availableNames) ? availableNames.map((name) => String(name || '').trim()).filter(Boolean) : []
  const exact = available.find((name) => name.toLocaleLowerCase('en-US') === requested.toLocaleLowerCase('en-US'))
  if (exact) return exact

  const requestedBase = redirectedBaseName(requested)
  if (requestedBase === requested) throw new Error(`Printer not found: ${requested}`)
  const matches = available.filter((name) => name.toLocaleLowerCase('en-US') === requestedBase.toLocaleLowerCase('en-US'))
  if (matches.length === 1) return matches[0]
  throw new Error(matches.length ? `Ambiguous redirected printer: ${requested}` : `Printer not found: ${requested}`)
}
