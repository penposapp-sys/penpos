import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import http from 'http'
import { spawn } from 'child_process'

const AGENT_VERSION = '0.1.0'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const readJson = async (p) => {
  const raw = await fs.readFile(p, 'utf8')
  return JSON.parse(raw)
}

const writeJson = async (p, value) => {
  const txt = JSON.stringify(value, null, 2)
  await fs.writeFile(p, txt, 'utf8')
}

const run = (file, args, { timeoutMs = 30000 } = {}) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(file, args, { windowsHide: true })
    const chunks = []
    const errChunks = []
    const t = setTimeout(() => {
      try { proc.kill() } catch {}
      reject(new Error('timeout'))
    }, timeoutMs)
    proc.stdout.on('data', (d) => chunks.push(d))
    proc.stderr.on('data', (d) => errChunks.push(d))
    proc.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    proc.on('close', (code) => {
      clearTimeout(t)
      const out = Buffer.concat(chunks).toString('utf8')
      const err = Buffer.concat(errChunks).toString('utf8')
      if (code === 0) resolve({ out, err })
      else reject(new Error(err || out || `exit ${code}`))
    })
  })
}

const listPrintersWindows = async () => {
  const cmd = 'Get-Printer | Select-Object -ExpandProperty Name'
  try {
    const { out } = await run('powershell.exe', ['-NoProfile', '-Command', cmd], { timeoutMs: 8000 })
    return String(out || '')
      .split(/\r?\n/g)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 200)
  } catch {
    return []
  }
}

const fetchWithTimeout = async (url, { method = 'GET', headers = {}, body = null, timeoutMs = 20000 } = {}) => {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs || 20000)))
  try {
    const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : null,
    signal: controller.signal
    })
    return res
  } finally {
    clearTimeout(t)
  }
}

const httpJson = async (url, { method = 'GET', headers = {}, body = null, timeoutMs = 20000, allowNoContent = false } = {}) => {
  const res = await fetchWithTimeout(url, { method, headers, body, timeoutMs })
  if (allowNoContent && res.status === 204) return null
  const txt = await res.text().catch(() => '')
  let data = null
  try { data = txt ? JSON.parse(txt) : null } catch { data = null }
  if (!res.ok) {
    const msg = data?.message || data?.error || txt || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

const httpBuffer = async (url, { method = 'GET', headers = {}, timeoutMs = 20000 } = {}) => {
  const res = await fetchWithTimeout(url, { method, headers, timeoutMs })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const err = new Error(txt || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

const fileExists = async (p) => {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

const resolveSumatraPath = async (cfgSumatraPath) => {
  const configured = String(cfgSumatraPath || '').trim()
  if (configured) return configured

  const home = os.homedir()
  const candidates = [
    path.join(home, 'AppData', 'Local', 'SumatraPDF', 'SumatraPDF.exe'),
    'C:/Program Files/SumatraPDF/SumatraPDF.exe',
    'C:/Program Files (x86)/SumatraPDF/SumatraPDF.exe'
  ]

  for (const c of candidates) {
    if (await fileExists(c)) return c
  }
  return ''
}

const parseArgs = (argv) => {
  const args = Array.isArray(argv) ? argv.slice(2) : []
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i] || '')
    if (a === '--config') {
      out.config = String(args[i + 1] || '')
      i++
    }
  }
  return out
}

const defaultConfigPath = () => {
  const programData = process.env.PROGRAMDATA || 'C:/ProgramData'
  return path.join(programData, 'PenPOS', 'PrintAgent', 'config.json')
}

const compareVersions = (left, right) => {
  const a = String(left || '').trim().replace(/^v/i, '').split('.').map((part) => Number(part || 0))
  const b = String(right || '').trim().replace(/^v/i, '').split('.').map((part) => Number(part || 0))
  const maxLen = Math.max(a.length, b.length, 3)
  for (let i = 0; i < maxLen; i++) {
    const av = Number.isFinite(a[i]) ? a[i] : 0
    const bv = Number.isFinite(b[i]) ? b[i] : 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

const isPackagedExecutable = () => {
  const execPath = String(process.execPath || '').trim().toLowerCase()
  const baseName = path.basename(execPath)
  if (!execPath.endsWith('.exe')) return false
  return baseName !== 'node.exe'
}

const ensureDir = async (p) => {
  await fs.mkdir(p, { recursive: true })
}

const openLogger = async (baseDir) => {
  const logDir = path.join(baseDir, 'logs')
  await ensureDir(logDir)
  const logFile = path.join(logDir, 'agent.log')
  const log = async (level, msg, extra = null) => {
    const line = JSON.stringify({ at: new Date().toISOString(), level, msg, extra }, null, 0)
    try { await fs.appendFile(logFile, line + os.EOL, 'utf8') } catch {}
    if (level === 'error') console.error(msg, extra || '')
    else console.log(msg, extra || '')
  }
  return { log, logDir, logFile }
}

const startStatusServer = ({ port, getStatus, log }) => {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (req.method === 'GET' && url.pathname === '/status') {
        const body = JSON.stringify(getStatus())
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(body)
        return
      }
      res.statusCode = 404
      res.end('not found')
    } catch {
      res.statusCode = 500
      res.end('error')
    }
  })
  server.listen(Number(port || 17171), '127.0.0.1', () => {
    log('info', '[HTTP] status server listening', { port: Number(port || 17171) })
  })
  return server
}

const printPdf = async ({ sumatraPath, printerName, pdfPath, orientation = 'portrait' }) => {
  const exe = String(sumatraPath || '').trim()
  const prn = String(printerName || '').trim()
  const dir = String(orientation || '').trim().toLowerCase() === 'landscape' ? 'landscape' : 'portrait'
  if (!exe) throw new Error('sumatraPath missing')
  if (!prn) throw new Error('printerName missing')
  await run(exe, ['-print-to', prn, '-print-settings', `noscale,${dir}`, '-silent', pdfPath], { timeoutMs: 30000 })
}

const psQuote = (value) => `'${String(value || '').replace(/'/g, "''")}'`

const printRawText = async ({ printerName, content, txtPath }) => {
  const prn = String(printerName || '').trim()
  if (!prn) throw new Error('printerName missing')
  const script = [
    '$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()',
    `[System.IO.File]::WriteAllText(${psQuote(txtPath)}, ${psQuote(String(content || ''))}, [System.Text.UTF8Encoding]::new($false))`,
    '$text = [System.IO.File]::ReadAllText(' + psQuote(txtPath) + ', [System.Text.UTF8Encoding]::new($false))',
    '$lines = $text -split "\\r?\\n"',
    '$doc = New-Object System.Drawing.Printing.PrintDocument',
    '$doc.PrinterSettings.PrinterName = ' + psQuote(prn),
    '$doc.OriginAtMargins = $false',
    '$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)',
    '$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController',
    '$font = New-Object System.Drawing.Font("Consolas", 9)',
    '$brush = [System.Drawing.Brushes]::Black',
    '$lineHeight = [int][Math]::Ceiling($font.GetHeight() + 2)',
    '$index = 0',
    '$handler = [System.Drawing.Printing.PrintPageEventHandler]{',
    '  param($sender, $ev)',
    '  $y = 0',
    '  $pageHeight = $ev.MarginBounds.Height',
    '  if ($pageHeight -le 0) { $pageHeight = $ev.PageBounds.Height }',
    '  $pageWidth = $ev.PageBounds.Width',
    '  while ($index -lt $lines.Length) {',
    '    if (($y + $lineHeight) -gt $pageHeight) {',
    '      $ev.HasMorePages = $true',
    '      return',
    '    }',
    '    $line = [string]$lines[$index]',
    '    $ev.Graphics.DrawString($line, $font, $brush, 0, $y)',
    '    $y += $lineHeight',
    '    $index++',
    '  }',
    '  $ev.HasMorePages = $false',
    '}',
    '$doc.add_PrintPage($handler)',
    '$doc.Print()',
    '$doc.remove_PrintPage($handler)',
    '$font.Dispose()',
    '$doc.Dispose()'
  ].join('; ')
  await run('powershell.exe', ['-NoProfile', '-Command', script], { timeoutMs: 30000 })
}

const downloadBinary = async ({ url, headers, destinationPath, timeoutMs }) => {
  const buf = await httpBuffer(url, { headers, timeoutMs })
  await ensureDir(path.dirname(destinationPath))
  await fs.writeFile(destinationPath, buf)
}

const triggerSelfUpdate = async ({ manifest, configPath, baseDir, headers, timeoutMs, log }) => {
  if (!isPackagedExecutable()) {
    log('warn', '[UPDATE] Paketlenmis exe modunda degil, otomatik guncelleme atlandi', { currentVersion: AGENT_VERSION, latestVersion: manifest?.version })
    return false
  }

  const downloadUrl = String(manifest?.downloadUrl || '').trim()
  const nextVersion = String(manifest?.version || '').trim()
  if (!downloadUrl || !nextVersion) return false

  const updateDir = path.join(baseDir, 'updates')
  const pendingExePath = path.join(updateDir, `PenPOS_PrintAgent_${nextVersion}.exe`)
  const updaterScriptPath = path.join(updateDir, 'apply-update.ps1')
  const currentExePath = process.execPath

  await downloadBinary({ url: downloadUrl, headers, destinationPath: pendingExePath, timeoutMs })

  const script = [
    'param([string]$TargetExe,[string]$SourceExe,[string]$ConfigPath,[int]$PidToWait)',
    'Start-Sleep -Seconds 2',
    'try { Wait-Process -Id $PidToWait -Timeout 30 } catch {}',
    'Start-Sleep -Milliseconds 800',
    'Copy-Item -LiteralPath $SourceExe -Destination $TargetExe -Force',
    'Start-Process -FilePath $TargetExe -ArgumentList @("--config", $ConfigPath)',
    'Start-Sleep -Seconds 2',
    'Remove-Item -LiteralPath $SourceExe -Force -ErrorAction SilentlyContinue'
  ].join('\r\n')
  await ensureDir(updateDir)
  await fs.writeFile(updaterScriptPath, script, 'utf8')

  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    updaterScriptPath,
    currentExePath,
    pendingExePath,
    path.resolve(configPath),
    String(process.pid)
  ], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  })
  child.unref()
  log('info', '[UPDATE] Guncelleme indirildi, agent yeniden baslatilacak', { nextVersion, currentVersion: AGENT_VERSION })
  return true
}

const main = async () => {
  const args = parseArgs(process.argv)
  const configPath = path.resolve(String(args.config || defaultConfigPath()))
  const cfg = await readJson(configPath)
  const baseDir = path.dirname(configPath)
  const { log } = await openLogger(baseDir)
  const backendBaseUrl = String(cfg.backendBaseUrl || '').replace(/\/+$/, '')
  const stationId = String(cfg.stationId || '').trim()
  const stationSecret = String(cfg.stationSecret || '').trim()
  const jobPollIntervalMs = Math.max(500, Number(cfg.jobPollIntervalMs || 1500))
  const heartbeatIntervalMs = Math.max(2000, Number(cfg.heartbeatIntervalMs || 10000))
  const requestTimeoutMs = Math.max(2000, Number(cfg.requestTimeoutMs || 20000))
  const updateCheckIntervalMs = Math.max(30000, Number(cfg.updateCheckIntervalMs || 300000))
  const autoUpdate = cfg.autoUpdate !== false
  const httpPort = Math.max(1, Number(cfg.httpPort || 17171))
  const spoolDir = String(cfg.spoolDir || '').trim() || path.join(baseDir, 'spool')
  await ensureDir(spoolDir)
  const sumatraPath = await resolveSumatraPath(cfg.sumatraPath)

  log('info', '[BOOT]', { configPath, stationId, backendBaseUrl, httpPort })

  if (!backendBaseUrl || !stationId || !stationSecret) {
    throw new Error('config.json eksik: backendBaseUrl, stationId, stationSecret')
  }
  if (!sumatraPath) {
    throw new Error('SumatraPDF bulunamadı. sumatraPath’i config.json’a yaz.')
  }

  const status = {
    backendOnline: false,
    lastHeartbeatAt: null,
    printers: [],
    stationId,
    version: AGENT_VERSION,
    update: {
      available: false,
      latestVersion: '',
      lastCheckedAt: null
    }
  }

  startStatusServer({ port: httpPort, getStatus: () => ({ ...status }), log })

  const tokenCachePath = path.join(baseDir, 'token.json')
  const readTokenCache = async () => {
    try {
      const j = await readJson(tokenCachePath)
      const t = String(j?.token || '').trim()
      return t
    } catch {
      return ''
    }
  }
  const writeTokenCache = async (token) => {
    try {
      await writeJson(tokenCachePath, { token: String(token || ''), at: new Date().toISOString() })
    } catch {
    }
  }

  const authUrl = `${backendBaseUrl}/api/printing/stations/${encodeURIComponent(stationId)}/auth`
  let token = await readTokenCache()
  const buildHeaders = () => ({
    Authorization: token ? `Bearer ${token}` : '',
    'x-station-id': stationId,
    'x-station-secret': stationSecret
  })

  const auth = async () => {
    log('info', '[AUTH] Auth oluyor...', { stationId })
    const body = { stationSecret, hostname: os.hostname(), at: new Date().toISOString(), version: AGENT_VERSION }
    const authRes = await httpJson(authUrl, { method: 'POST', body, timeoutMs: requestTimeoutMs })
    const t = String(authRes?.token || authRes?.data?.token || '').trim()
    if (!t) throw new Error('Station token alınamadı')
    token = t
    await writeTokenCache(token)
    log('info', '[AUTH] Token alındı', { stationId })
  }

  try {
    await auth()
  } catch (e) {
    if (e?.status === 401) log('error', '[AUTH] 401 station auth failed → secret yanlış/eskimiş')
    else log('error', '[AUTH] Network error → backendBaseUrl yanlış/LAN kapalı')
  }

  const hbUrl = `${backendBaseUrl}/api/printing/stations/${encodeURIComponent(stationId)}/heartbeat`
  const claimUrl = `${backendBaseUrl}/api/printing/stations/${encodeURIComponent(stationId)}/claim-next`
  const updateManifestUrl = `${backendBaseUrl}/api/public/downloads/print-agent/windows/manifest`

  let lastHb = 0
  let lastUpdateCheckAt = 0
  let backoffMs = 1000
  let pollingStarted = false

  while (true) {
    const now = Date.now()
    if (now - lastHb > heartbeatIntervalMs) {
      lastHb = now
      const printers = await listPrintersWindows()
      try {
        await httpJson(hbUrl, {
          method: 'POST',
          headers: buildHeaders(),
          body: {
            printers,
            hostname: os.hostname(),
            at: new Date().toISOString(),
            version: AGENT_VERSION
          },
          timeoutMs: requestTimeoutMs
        })
        status.backendOnline = true
        status.lastHeartbeatAt = new Date().toISOString()
        status.printers = printers
        log('info', '[HEARTBEAT] gönderildi', { printers: printers.length })
      } catch (e) {
        status.backendOnline = false
        if (e?.status === 401) {
          log('error', '[HEARTBEAT] 401 station auth failed → secret yanlış/eskimiş')
          try { await auth() } catch {}
        } else {
          log('error', '[HEARTBEAT] Network error → backendBaseUrl yanlış/LAN kapalı')
        }
      }
    }

    if (now - lastUpdateCheckAt > updateCheckIntervalMs) {
      lastUpdateCheckAt = now
      try {
        const manifest = await httpJson(updateManifestUrl, { timeoutMs: requestTimeoutMs })
        const latestVersion = String(manifest?.version || '').trim()
        status.update = {
          available: !!latestVersion && compareVersions(latestVersion, AGENT_VERSION) > 0,
          latestVersion,
          lastCheckedAt: new Date().toISOString()
        }
        if (status.update.available) {
          log('info', '[UPDATE] Yeni surum bulundu', { currentVersion: AGENT_VERSION, latestVersion })
          if (autoUpdate) {
            const started = await triggerSelfUpdate({
              manifest,
              configPath,
              baseDir,
              headers: buildHeaders(),
              timeoutMs: Math.max(15000, requestTimeoutMs),
              log
            })
            if (started) {
              process.exit(0)
            }
          }
        }
      } catch (e) {
        status.update = {
          ...status.update,
          lastCheckedAt: new Date().toISOString()
        }
        log('warn', '[UPDATE] Surum kontrolu basarisiz', { message: String(e?.message || e) })
      }
    }

    let claim = null
    try {
      if (!pollingStarted) {
        log('info', '[CLAIM] Claim-next polling başladı')
        pollingStarted = true
      }
      claim = await httpJson(claimUrl, {
        method: 'POST',
        headers: buildHeaders(),
        body: { meta: { at: new Date().toISOString(), hostname: os.hostname(), version: AGENT_VERSION } },
        timeoutMs: requestTimeoutMs,
        allowNoContent: true
      })
      backoffMs = 1000
    } catch (e) {
      if (e?.status === 401) {
        log('error', '[CLAIM] 401 station auth failed → secret yanlış/eskimiş')
        try { await auth() } catch {}
      }
      await sleep(backoffMs)
      backoffMs = Math.min(30000, backoffMs * 2)
      continue
    }

    const job = claim?.job || claim || null
    const jobIdRaw = String(job?.id || job?._id || job?.jobId || '').trim()
    if (!jobIdRaw) {
      await sleep(jobPollIntervalMs)
      continue
    }

    const jobId = jobIdRaw
    const completeUrl = `${backendBaseUrl}/api/printing/jobs/${encodeURIComponent(jobId)}/complete`
    const failUrl = `${backendBaseUrl}/api/printing/jobs/${encodeURIComponent(jobId)}/fail`

    try {
      const printerName = String(job.printerName || job.printer || job?.printSettings?.printerName || '').trim()
      const copies = Math.max(1, Math.min(10, Number(job.copies || job?.printSettings?.copies || 1)))
      const orientation = String(job?.type || '').trim().toLowerCase() === 'label' ? 'landscape' : 'portrait'
      const payloadType = String(job?.payloadType || '').trim().toLowerCase()
      const rawContent = String(job?.rawContent || '').trim()
      const pdfBase64 = String(job?.content?.data || job?.pdfBase64 || '')
      if (!printerName) throw new Error('printerName missing')

      if (String(job?.type || '').trim().toLowerCase() === 'receipt' && payloadType === 'raw' && rawContent) {
        const txtTmp = path.join(spoolDir, `job-${jobId}.txt`)
        try {
          for (let i = 0; i < copies; i++) {
            await printRawText({ printerName, content: rawContent, txtPath: txtTmp })
          }
          await httpJson(completeUrl, { method: 'PATCH', headers: buildHeaders(), timeoutMs: requestTimeoutMs })
        } finally {
          await fs.unlink(txtTmp).catch(() => {})
        }
      } else {
        let pdfBuf = null
        if (pdfBase64) {
          pdfBuf = Buffer.from(pdfBase64, 'base64')
        } else {
          const url = String(job.documentUrl || job.url || job.fileUrl || '').trim()
          if (!url) throw new Error('pdf missing')
          pdfBuf = await httpBuffer(url, { headers: buildHeaders(), timeoutMs: requestTimeoutMs })
        }

        const tmp = path.join(spoolDir, `job-${jobId}.pdf`)
        await fs.writeFile(tmp, pdfBuf)
        try {
          for (let i = 0; i < copies; i++) {
            await printPdf({ sumatraPath, printerName, pdfPath: tmp, orientation })
          }
          await httpJson(completeUrl, { method: 'PATCH', headers: buildHeaders(), timeoutMs: requestTimeoutMs })
        } finally {
          await fs.unlink(tmp).catch(() => {})
        }
      }
    } catch (e) {
      try {
        await httpJson(failUrl, {
          method: 'PATCH',
          headers: buildHeaders(),
          body: { retry: true, maxAttempts: 3, error: { message: String(e?.message || 'Print failed') } },
          timeoutMs: requestTimeoutMs
        })
      } catch (e2) {
        if (e2?.status === 401) {
          try { await auth() } catch {}
        }
      }
      await sleep(500)
    }
  }
}

main().catch((e) => {
  console.error('[AGENT_FATAL]', e?.message || e)
  process.exit(1)
})
