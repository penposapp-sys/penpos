import { app, BrowserWindow, ipcMain, safeStorage, Tray, Menu } from 'electron'
import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { CallAgentClient } from './callAgentClient.js'
import { registerCallAgentIpc } from './callAgentIpc.js'
import { createRfCaptureDeduper, parseSerialLine } from './serialProtocol.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)
let mainWindow
let tray
let activePort
let appIsQuitting = false
let selectedPortPath = ''
let currentPortState = 'disconnected'
let currentPortError = ''
let reconnectTimer
let pendingPairingLink = ''
let callAgentClient
const rfCaptureDeduper = createRfCaptureDeduper()
const SERIAL_PREFERENCE_PATH = () => path.join(app.getPath('userData'), 'serial-port.json')

const singleInstanceLock = app.requestSingleInstanceLock()
if (!singleInstanceLock) app.quit()

const showMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow()
  mainWindow.show()
  mainWindow.focus()
}

const handlePairingLink = (value) => {
  const raw = String(value || '')
  if (!raw.startsWith('penpos-call-agent://')) return
  if (!callAgentClient) {
    pendingPairingLink = raw
    return
  }
  try {
    const link = new URL(raw)
    if (link.hostname !== 'pair') throw new Error('Eşleştirme bağlantısı tanınmadı.')
    showMainWindow()
    callAgentClient.followDashboardPairing({
      pairingId: link.searchParams.get('pairingId'),
      deviceId: link.searchParams.get('deviceId'),
      pairingCode: link.searchParams.get('pairingCode'),
      expiresAt: link.searchParams.get('expiresAt')
  }).catch((error) => callAgentClient.setState({ connectionStatus: 'error', lastError: error.message }))
  } catch (error) {
    console.error('Eşleştirme bağlantısı açılamadı:', error.message)
  }
}

if (singleInstanceLock) {
  app.on('second-instance', (_event, commandLine) => {
    const pairingLink = commandLine.find((argument) => String(argument).startsWith('penpos-call-agent://'))
    if (pairingLink) handlePairingLink(pairingLink)
    else showMainWindow()
  })
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handlePairingLink(url)
  })
}

const listWindowsPorts = async () => {
  if (process.platform !== 'win32') {
    throw new Error('COM port listeleme bu Windows uygulamasında desteklenir.')
  }

  const command = [
    "$ErrorActionPreference = 'Stop'",
    '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false',
    "Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object {",
    "  $match = [regex]::Match($_.Name, '\\((COM\\d+)\\)')",
    "  [PSCustomObject]@{ path = $match.Groups[1].Value; label = ($_.Name -replace '\\s+\\(COM\\d+\\)', '') }",
    '} | ConvertTo-Json -Compress'
  ].join('; ')
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    command
  ], { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 })

  const result = String(stdout || '').trim()
  if (!result) return []
  let ports
  try {
    ports = JSON.parse(result)
  } catch {
    throw new Error('Windows seri port yanıtı okunamadı.')
  }
  return (Array.isArray(ports) ? ports : [ports])
    .map((port) => ({ path: String(port.path || ''), label: String(port.label || '').trim() }))
    .filter((port) => /^COM\d+$/i.test(port.path))
}

const sendPortState = (state, error = '') => {
  currentPortState = state
  currentPortError = error
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('serial:state', { state, error })
}

const sendSerialEvent = (event) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('serial:event', event)
}

const listPorts = async () => {
  try {
    return await listWindowsPorts()
  } catch (error) {
    throw new Error(`Seri portlar listelenemedi: ${error.message}`)
  }
}

const saveSelectedPort = async (portPath) => {
  selectedPortPath = String(portPath || '')
  await writeFile(SERIAL_PREFERENCE_PATH(), `${JSON.stringify({ portPath: selectedPortPath }, null, 2)}\n`, 'utf8')
}

const readSelectedPort = async () => {
  try {
    const saved = JSON.parse(await readFile(SERIAL_PREFERENCE_PATH(), 'utf8'))
    selectedPortPath = /^COM\d+$/i.test(String(saved?.portPath || '')) ? String(saved.portPath).toUpperCase() : ''
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error('Saklanan COM portu okunamadı:', error.message)
    selectedPortPath = ''
  }
  return selectedPortPath
}

const schedulePortReconnect = () => {
  if (!selectedPortPath || appIsQuitting || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    if (activePort && activePort.exitCode === null) return
    connectSerialPort(selectedPortPath).catch((error) => {
      sendPortState('error', `COM portuna yeniden bağlanılamadı: ${error.message}`)
      schedulePortReconnect()
    })
  }, 4000)
  reconnectTimer.unref?.()
}

const closeActivePort = async () => {
  if (!activePort) return
  const process = activePort
  activePort = undefined
  if (process.exitCode !== null) return

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      process.kill()
      reject(new Error('Seri port işlemi zamanında kapanmadı.'))
    }, 5000)
    process.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    process.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    process.stdin.write('CLOSE\n')
  })
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'PenPOS Çağrı Ajanı',
    backgroundColor: '#0b1220',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const developmentUrl = process.env.VITE_DEV_SERVER_URL
  const allowedUrl = developmentUrl
    ? new URL(developmentUrl).origin
    : pathToFileURL(path.resolve(currentDirectory, '..', 'dist', 'index.html')).href
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowed = developmentUrl
      ? new URL(url).origin === allowedUrl
      : url === allowedUrl
    if (!isAllowed) event.preventDefault()
  })

  if (developmentUrl) {
    mainWindow.loadURL(developmentUrl)
  } else {
    mainWindow.loadFile(path.join(currentDirectory, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
  mainWindow.on('close', (event) => {
    if (appIsQuitting) return
    event.preventDefault()
    mainWindow.hide()
  })
}

const createTray = async () => {
  if (tray) return
  const icon = await app.getFileIcon(process.execPath, { size: 'small' })
  tray = new Tray(icon)
  tray.setToolTip('PenPOS Çağrı Ajanı · arka planda çalışıyor')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'PenPOS Çağrı Ajanını aç', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        appIsQuitting = true
        app.quit()
      }
    }
  ]))
  tray.on('double-click', showMainWindow)
}

ipcMain.handle('serial:list', listPorts)
ipcMain.handle('serial:get-state', () => ({ state: currentPortState, error: currentPortError, portPath: selectedPortPath }))

const ALLOWED_SERIAL_COMMANDS = new Set([
  'LEARN A', 'LEARN B', 'LEARN C', 'LEARN OFF', 'LEARN STATUS',
  'LEARN CLEAR A', 'LEARN CLEAR B', 'LEARN CLEAR C'
])

ipcMain.handle('serial:command', (_event, value) => {
  const command = String(value || '').trim().toUpperCase()
  if (!ALLOWED_SERIAL_COMMANDS.has(command)) throw new Error('Desteklenmeyen alıcı komutu.')
  if (!activePort || activePort.exitCode !== null || activePort.stdin.destroyed) {
    throw new Error('Önce USB alıcısına bağlanın.')
  }
  activePort.stdin.write(`COMMAND ${command}\n`)
  return { ok: true, command }
})

const connectSerialPort = async (selectedPath) => {
  const portPath = String(selectedPath || '').trim()
  if (!/^COM\d+$/i.test(portPath)) throw new Error('Geçerli bir COM portu seçin.')
  if (activePort && activePort.exitCode === null) throw new Error('Bir seri porta zaten bağlı.')

  const knownPorts = await listPorts()
  if (!knownPorts.some((port) => port.path === portPath)) {
    throw new Error('Seçilen port artık kullanılabilir değil. Port listesini yenileyin.')
  }
  await saveSelectedPort(portPath.toUpperCase())
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = undefined
  sendPortState('connecting')

  const portProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    app.isPackaged
      ? path.join(process.resourcesPath, 'serialPortReader.ps1')
      : path.join(currentDirectory, 'serialPortReader.ps1')
  ], {
    windowsHide: true,
    env: { ...process.env, PENPOS_PORT_NAME: portPath },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  activePort = portProcess

  let outputBuffer = ''
  let connected = false
  let startupError = ''
  let serialReadError = ''
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      portProcess.kill()
      reject(new Error('COM port bağlantısı zaman aşımına uğradı.'))
    }, 10000)
    const handleLine = (line) => {
      if (!line.trim()) return
      let response
      const parsed = parseSerialLine(line)
      if (parsed.kind === 'ignore') return
      if (parsed.kind === 'invalid') {
        if (connected) sendSerialEvent({ eventType: 'invalid', error: parsed.error })
        else startupError = parsed.error
        return
      }

      // Capture and match parser results carry `event`, not a raw `message`.
      // Keep the control response optional so RF events cannot crash Electron's main process.
      response = parsed.message || {}
      if (parsed.kind === 'learning_status') {
        sendSerialEvent(parsed.event)
        return
      }
      if (response.serialError) {
        serialReadError = `Seri bağlantı koptu: ${String(response.serialError).slice(0, 500)}`
        sendPortState('error', serialReadError)
        if (portProcess.exitCode === null && !portProcess.stdin.destroyed) {
          portProcess.stdin.write('CLOSE\n')
        }
        return
      }
      if (parsed.kind === 'capture') {
        if (!rfCaptureDeduper.accept(parsed.event)) return
        sendSerialEvent(parsed.event)
        void getCallAgentClient().processRfCapture(parsed.event)
          .then((result) => {
            if (result.kind === 'learned') {
              sendSerialEvent({ eventType: 'rf_button_learned', tableId: result.tableId, tableName: result.tableName, label: result.label })
              return
            }
            if (result.kind !== 'match') return
            const matchId = randomUUID()
            const matchEvent = {
              eventType: 'button_match',
              matchId,
              matchedLabel: result.label,
              action: result.action,
              actionName: result.actionName,
              tableId: result.tableId,
              tableName: result.tableName,
              matchQualityPct: result.quality,
              actionStatus: 'sending',
              receivedAt: new Date().toISOString()
            }
            sendSerialEvent(matchEvent)
            void getCallAgentClient().performRfAction(result.action, result.tableId)
              .then((actionResult) => sendSerialEvent({
                eventType: 'button_action_result',
                matchId,
                ok: true,
                action: result.action,
                actionName: result.actionName,
                tableId: result.tableId,
                tableName: String(actionResult?.table?.name || result.tableName || ''),
                cancelledCount: Number(actionResult?.cancelledCount || 0),
                receivedAt: new Date().toISOString()
              }))
              .catch((actionError) => sendSerialEvent({
                eventType: 'button_action_result',
                matchId,
                ok: false,
                action: result.action,
                actionName: result.actionName,
                tableId: result.tableId,
                tableName: result.tableName,
                error: String(actionError?.message || 'Tuş işlemi gönderilemedi.').slice(0, 300),
                receivedAt: new Date().toISOString()
              }))
          })
          .catch((profileError) => sendSerialEvent({
            eventType: 'invalid',
            error: String(profileError?.message || 'RF tuş profili işlenemedi.').slice(0, 300)
          }))
        return
      }
      if (parsed.kind === 'button_match') {
        // Action dispatch uses the raw capture and per-table profiles above.
        return
      }
      if (!connected) {
        connected = response.ok === true
        startupError = String(response.error || '')
        if (connected) {
          clearTimeout(timer)
          resolve(true)
          sendPortState('connected')
        } else {
          clearTimeout(timer)
          reject(new Error(startupError || 'Seri porta bağlanılamadı.'))
        }
        return
      }
      if (response.closed) {
        sendPortState(serialReadError ? 'error' : 'disconnected', serialReadError)
      }
    }

    portProcess.stdout.on('data', (chunk) => {
      outputBuffer += chunk.toString('utf8')
      if (outputBuffer.length > 64 * 1024) {
        outputBuffer = ''
        sendSerialEvent({ eventType: 'invalid', error: 'Seri veri tamponu sınırı aşıldı; veri atıldı.' })
        return
      }
      const lines = outputBuffer.split(/\r?\n/)
      outputBuffer = lines.pop() || ''
      lines.forEach(handleLine)
    })
    portProcess.stderr.on('data', (chunk) => {
      startupError += chunk.toString('utf8')
    })
    portProcess.once('error', (error) => {
      clearTimeout(timer)
      reject(new Error(`Seri port işlemi başlatılamadı: ${error.message}`))
    })
    portProcess.once('exit', (code) => {
      if (!connected) {
        clearTimeout(timer)
        reject(new Error(startupError.trim() || `Seri port işlemi başlatılamadı (kod ${code}).`))
      } else {
        if (activePort === portProcess) activePort = undefined
        if (code !== 0) sendPortState('error', serialReadError || startupError.trim() || 'Seri port bağlantısı beklenmedik şekilde kesildi.')
        else sendPortState(serialReadError ? 'error' : 'disconnected', serialReadError)
        if (!appIsQuitting && selectedPortPath) schedulePortReconnect()
      }
    })
  }).catch((error) => {
    if (activePort === portProcess) activePort = undefined
    sendPortState('error', `Seri porta bağlanılamadı: ${error.message}`)
    if (!appIsQuitting && selectedPortPath) schedulePortReconnect()
    throw new Error(`Seri porta bağlanılamadı: ${error.message}`)
  })

  return { path: portPath }
}

ipcMain.handle('serial:connect', (_event, selectedPath) => connectSerialPort(selectedPath))

ipcMain.handle('serial:disconnect', async () => {
  try {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    await saveSelectedPort('')
    await closeActivePort()
    sendPortState('disconnected')
  } catch (error) {
    sendPortState('error', `Bağlantı kesilemedi: ${error.message}`)
    throw new Error(`Bağlantı kesilemedi: ${error.message}`)
  }
})

const getCallAgentClient = () => {
  if (!callAgentClient) throw new Error('PenPOS bağlantı altyapısı henüz hazır değil.')
  return callAgentClient
}

const sendCallAgentState = (state) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('call-agent:state', state)
}

registerCallAgentIpc({
  ipcMain,
  getMainWindow: () => mainWindow,
  getClient: getCallAgentClient
})

app.whenReady().then(async () => {
  app.setAsDefaultProtocolClient('penpos-call-agent')
  if (app.isPackaged && process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath })
  }
  await createTray()
  callAgentClient = new CallAgentClient({
    storageDirectory: app.getPath('userData'),
    safeStorage,
    onStatus: sendCallAgentState
  })
  await callAgentClient.initialize()
  createWindow()
  const startupPairingLink = process.argv.find((argument) => String(argument).startsWith('penpos-call-agent://'))
  const pairingLink = pendingPairingLink || startupPairingLink
  pendingPairingLink = ''
  if (pairingLink) handlePairingLink(pairingLink)
  if (app.getLoginItemSettings().wasOpenedAtLogin) mainWindow.hide()
  const savedPort = await readSelectedPort()
  if (savedPort) {
    connectSerialPort(savedPort).catch((error) => {
      sendPortState('error', `Kaydedilmiş ${savedPort} portuna bağlanılamadı: ${error.message}`)
      schedulePortReconnect()
    })
  }
  app.on('activate', () => {
    showMainWindow()
  })
}).catch((error) => {
  console.error('Uygulama başlatılamadı:', error)
  app.quit()
})

app.on('before-quit', (event) => {
  appIsQuitting = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = undefined
  callAgentClient?.stop()
  if (!activePort || activePort.exitCode !== null) return
  event.preventDefault()
  closeActivePort()
    .catch((error) => console.error('Seri port kapatılamadı:', error))
    .finally(() => app.exit(0))
})

app.on('window-all-closed', () => {
  // Keep the RF receiver, server heartbeat, and tray process alive after the window hides.
})
