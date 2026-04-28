import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import http from 'http'
import https from 'https'
import dns from 'dns'
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

const requestBuffer = async (url, { method = 'GET', headers = {}, body = null, timeoutMs = 20000 } = {}) => {
  return new Promise((resolve, reject) => {
    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch (error) {
      reject(error)
      return
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http
    const payload = body == null
      ? null
      : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8')

    const requestHeaders = { ...headers }
    if (payload && !Object.keys(requestHeaders).some((key) => String(key).toLowerCase() === 'content-type')) {
      requestHeaders['Content-Type'] = 'application/json'
    }
    if (payload && !Object.keys(requestHeaders).some((key) => String(key).toLowerCase() === 'content-length')) {
      requestHeaders['Content-Length'] = String(payload.length)
    }

    const req = transport.request(parsedUrl, {
      method,
      headers: requestHeaders,
      family: 4,
      lookup: (hostname, options, callback) => dns.lookup(hostname, { ...options, family: 4 }, callback)
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      res.on('end', () => {
        resolve({
          status: Number(res.statusCode || 0),
          headers: res.headers || {},
          buffer: Buffer.concat(chunks)
        })
      })
    })

    req.on('error', (error) => reject(error))
    req.setTimeout(Math.max(1000, Number(timeoutMs || 20000)), () => {
      req.destroy(new Error('timeout'))
    })

    if (payload) req.write(payload)
    req.end()
  })
}

const httpJson = async (url, { method = 'GET', headers = {}, body = null, timeoutMs = 20000, allowNoContent = false } = {}) => {
  const res = await requestBuffer(url, { method, headers, body, timeoutMs })
  if (allowNoContent && res.status === 204) return null
  const txt = String(res.buffer || Buffer.alloc(0)).trim()
  let data = null
  try { data = txt ? JSON.parse(txt) : null } catch { data = null }
  if (res.status < 200 || res.status >= 300) {
    const msg = data?.message || data?.error || txt || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

const httpBuffer = async (url, { method = 'GET', headers = {}, timeoutMs = 20000 } = {}) => {
  const res = await requestBuffer(url, { method, headers, timeoutMs })
  if (res.status < 200 || res.status >= 300) {
    const txt = String(res.buffer || Buffer.alloc(0), 'utf8')
    const err = new Error(txt || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.buffer
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

const resolveConfigPath = async (argConfigPath) => {
  const explicit = String(argConfigPath || '').trim()
  if (explicit) return path.resolve(explicit)

  const candidates = []
  const execDir = path.dirname(String(process.execPath || ''))
  const cwd = process.cwd()
  if (execDir) candidates.push(path.join(execDir, 'config.json'))
  if (cwd) candidates.push(path.join(cwd, 'config.json'))
  candidates.push(defaultConfigPath())

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)
    if (await fileExists(resolved)) return resolved
  }
  return path.resolve(defaultConfigPath())
}

const defaultBaseDir = () => {
  const cfgPath = defaultConfigPath()
  return path.dirname(cfgPath)
}

const writeFatalLog = async (message, extra = null) => {
  try {
    const baseDir = defaultBaseDir()
    await ensureDir(baseDir)
    const file = path.join(baseDir, 'agent-fatal.log')
    const line = JSON.stringify({
      at: new Date().toISOString(),
      version: AGENT_VERSION,
      message: String(message || ''),
      extra
    })
    await fs.appendFile(file, line + os.EOL, 'utf8')
  } catch {
  }
}

const showFatalDialog = async (message) => {
  try {
    const text = String(message || 'Bilinmeyen hata').replace(/'/g, "''")
    const script = [
      'Add-Type -AssemblyName PresentationFramework',
      `[System.Windows.MessageBox]::Show('${text}', 'PenPOS Print Agent', 'OK', 'Error') | Out-Null`
    ].join('; ')
    await run('powershell.exe', ['-NoProfile', '-Command', script], { timeoutMs: 15000 })
  } catch {
  }
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

const describeError = (error) => {
  const message = String(error?.message || error || '').trim()
  const cause = error?.cause
  const code = String(cause?.code || error?.code || '').trim()
  const causeMessage = String(cause?.message || '').trim()
  return {
    message: message || 'unknown_error',
    code: code || '',
    cause: causeMessage || ''
  }
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
  server.on('error', (error) => {
    const code = String(error?.code || '').trim()
    if (code === 'EADDRINUSE') {
      log('warn', '[HTTP] status server port already in use, continuing without local status server', {
        port: Number(port || 17171)
      })
      return
    }
    log('error', '[HTTP] status server failed', {
      message: String(error?.message || error || ''),
      code
    })
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
    '$printerName = ' + psQuote(prn),
    '$content = ' + psQuote(String(content || '')),
    '$txtPath = ' + psQuote(txtPath),
    'Get-Printer -Name $printerName -ErrorAction Stop | Out-Null',
    '$printed = $false',
    'try {',
    '  $rawPrinterType = \'using System; using System.Runtime.InteropServices; public static class RawPrinterHelper { [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; } [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault); [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr hPrinter); [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr hPrinter, int level, DOCINFO di); [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr hPrinter); [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr hPrinter); [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr hPrinter); [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten); public static bool SendBytes(string printerName, byte[] bytes) { IntPtr hPrinter; if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false; try { var doc = new DOCINFO(); doc.pDocName = "PenPOS Raw Receipt"; doc.pDataType = "RAW"; if (StartDocPrinter(hPrinter, 1, doc) == 0) return false; try { if (!StartPagePrinter(hPrinter)) return false; IntPtr pUnmanaged = Marshal.AllocCoTaskMem(bytes.Length); try { Marshal.Copy(bytes, 0, pUnmanaged, bytes.Length); int written = 0; return WritePrinter(hPrinter, pUnmanaged, bytes.Length, out written) && written == bytes.Length; } finally { Marshal.FreeCoTaskMem(pUnmanaged); EndPagePrinter(hPrinter); } } finally { EndDocPrinter(hPrinter); } } finally { ClosePrinter(hPrinter); } } }\'',
    '  Add-Type -TypeDefinition $rawPrinterType -Language CSharp -ErrorAction Stop',
    '  $bytes = [System.Text.Encoding]::ASCII.GetBytes($content)',
    '  [System.IO.File]::WriteAllBytes($txtPath, $bytes)',
    '  if ([RawPrinterHelper]::SendBytes($printerName, $bytes)) { $printed = $true }',
    '} catch {',
    '}',
    'if (-not $printed) {',
    '  [System.IO.File]::WriteAllText($txtPath, $content, [System.Text.UTF8Encoding]::new($false))',
    '  $text = [System.IO.File]::ReadAllText($txtPath, [System.Text.UTF8Encoding]::new($false))',
    '  $lines = $text -split "\\r?\\n"',
    '  Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue',
    '  if ([type]::GetType("System.Drawing.Printing.PrintDocument, System.Drawing")) {',
    '    $doc = New-Object System.Drawing.Printing.PrintDocument',
    '    $doc.PrinterSettings.PrinterName = $printerName',
    '    $doc.OriginAtMargins = $false',
    '    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)',
    '    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController',
    '    $font = New-Object System.Drawing.Font("Consolas", 8, [System.Drawing.FontStyle]::Regular)',
    '    $brush = [System.Drawing.Brushes]::Black',
    '    $lineHeight = [int][Math]::Ceiling($font.GetHeight() + 1)',
    '    $index = 0',
    '    $handler = [System.Drawing.Printing.PrintPageEventHandler]{',
    '      param($sender, $ev)',
    '      $y = 0',
    '      $pageHeight = $ev.MarginBounds.Height',
    '      if ($pageHeight -le 0) { $pageHeight = $ev.PageBounds.Height }',
    '      while ($index -lt $lines.Length) {',
    '        if (($y + $lineHeight) -gt $pageHeight) { $ev.HasMorePages = $true; return }',
    '        $ev.Graphics.DrawString([string]$lines[$index], $font, $brush, 0, $y)',
    '        $y += $lineHeight',
    '        $index++',
    '      }',
    '      $ev.HasMorePages = $false',
    '    }',
    '    $doc.add_PrintPage($handler)',
    '    $doc.Print()',
    '    $doc.remove_PrintPage($handler)',
    '    $font.Dispose()',
    '    $doc.Dispose()',
    '  } else {',
    '    Get-Content -LiteralPath $txtPath -Encoding UTF8 | Out-Printer -Name $printerName',
    '  }',
    '}'
  ].join('; ')
  await run('powershell.exe', ['-NoProfile', '-Command', script], { timeoutMs: 30000 })
}

const downloadBinary = async ({ url, headers, destinationPath, timeoutMs }) => {
  const buf = await httpBuffer(url, { headers, timeoutMs })
  await ensureDir(path.dirname(destinationPath))
  await fs.writeFile(destinationPath, buf)
}

const triggerSelfUpdate = async ({ manifest, configPath, baseDir, headers, timeoutMs, log }) => {
  const downloadUrl = String(manifest?.downloadUrl || '').trim()
  const nextVersion = String(manifest?.version || '').trim()
  const fileName = String(manifest?.fileName || '').trim() || `PenPOS_PrintAgent_${nextVersion}.exe`
  const packageType = String(manifest?.packageType || '').trim().toLowerCase() || 'binary'
  if (!downloadUrl || !nextVersion) return false

  if (packageType === 'setup') {
    const setupPath = path.join(baseDir, 'updates', fileName)
    await downloadBinary({ url: downloadUrl, headers, destinationPath: setupPath, timeoutMs })
    const installArgsRaw = String(manifest?.installArgs || '').trim() || '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-'
    const installArgs = installArgsRaw.split(/\s+/g).filter(Boolean)
    const child = spawn(setupPath, installArgs, {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    })
    child.unref()
    log('info', '[UPDATE] Setup guncellemesi baslatildi', { nextVersion, currentVersion: AGENT_VERSION, setupPath, installArgs })
    return true
  }

  if (!isPackagedExecutable()) {
    log('warn', '[UPDATE] Paketlenmis exe modunda degil, binary otomatik guncelleme atlandi', { currentVersion: AGENT_VERSION, latestVersion: manifest?.version })
    return false
  }

  const updateDir = path.join(baseDir, 'updates')
  const pendingExePath = path.join(updateDir, fileName)
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
  const configPath = await resolveConfigPath(args.config)
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
  const message = String(e?.message || e || 'Bilinmeyen hata')
  console.error('[AGENT_FATAL]', message)
  Promise.resolve()
    .then(() => writeFatalLog(message, { stack: String(e?.stack || '') }))
    .then(() => showFatalDialog(`${message}\n\nDetay log: C:/ProgramData/PenPOS/PrintAgent/agent-fatal.log`))
    .finally(() => {
      process.exit(1)
    })
})
