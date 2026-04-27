export const getPrintersSettings = async (req, res) => {
  const buildBaseUrl = () => {
    const envBase = String(process.env.BASE_URL || '').trim()
    if (envBase) return envBase.replace(/\/+$/, '')
    try {
      const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
      const xfHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
      const proto = xfProto || String(req.protocol || 'http')
      const host = xfHost || String(req.get('host') || '')
      if (!host) return ''
      return `${proto}://${host}`
    } catch {
      return ''
    }
  }

  const fallbackPath = '/api/public/downloads/print-agent/windows'
  const manifestPath = '/api/public/downloads/print-agent/windows/manifest'
  const base = buildBaseUrl()
  const downloadUrl = String(process.env.PRINT_AGENT_WINDOWS_URL || (base ? new URL(fallbackPath, base).toString() : fallbackPath)).trim()
  const manifestUrl = String(process.env.PRINT_AGENT_WINDOWS_MANIFEST_URL || (base ? new URL(manifestPath, base).toString() : manifestPath)).trim()
  res.json({
    success: true,
    printAgent: {
      pcPrinter: {
        platform: 'windows',
        downloadUrl,
        manifestUrl
      }
    }
  })
}
