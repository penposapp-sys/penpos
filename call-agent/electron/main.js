import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { createSimulatorStore } from './simulatorStore.js'
import { CallAgentClient } from './callAgentClient.js'
import { registerCallAgentIpc } from './callAgentIpc.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)
let mainWindow
let activePort
let simulatorStore
let callAgentClient

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
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('serial:state', { state, error })
}

const listPorts = async () => {
  try {
    return await listWindowsPorts()
  } catch (error) {
    throw new Error(`Seri portlar listelenemedi: ${error.message}`)
  }
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
}

ipcMain.handle('serial:list', listPorts)

ipcMain.handle('serial:connect', async (_event, selectedPath) => {
  const portPath = String(selectedPath || '').trim()
  if (!/^COM\d+$/i.test(portPath)) throw new Error('Geçerli bir COM portu seçin.')
  if (activePort && activePort.exitCode === null) throw new Error('Bir seri porta zaten bağlı.')

  const knownPorts = await listPorts()
  if (!knownPorts.some((port) => port.path === portPath)) {
    throw new Error('Seçilen port artık kullanılabilir değil. Port listesini yenileyin.')
  }

  const connectScript = [
    "$ErrorActionPreference = 'Stop'",
    '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false',
    '$port = $null',
    'try {',
    '  $port = New-Object System.IO.Ports.SerialPort -ArgumentList @($env:PENPOS_PORT_NAME, 9600)',
    '  $port.Open()',
    '  [Console]::Out.WriteLine((@{ ok = $true } | ConvertTo-Json -Compress))',
    '  while ($true) {',
    '    $command = [Console]::In.ReadLine()',
    "    if ($null -eq $command -or $command -eq 'CLOSE') {",
    '      if ($port.IsOpen) { $port.Close() }',
    '      [Console]::Out.WriteLine((@{ closed = $true } | ConvertTo-Json -Compress))',
    '      break',
    '    }',
    '  }',
    '} catch {',
    '  [Console]::Out.WriteLine((@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress))',
    '  exit 1',
    '} finally {',
    '  if ($port -and $port.IsOpen) { $port.Close() }',
    '}'
  ].join('; ')
  const portProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    connectScript
  ], {
    windowsHide: true,
    env: { ...process.env, PENPOS_PORT_NAME: portPath },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  activePort = portProcess

  let outputBuffer = ''
  let connected = false
  let startupError = ''
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      portProcess.kill()
      reject(new Error('COM port bağlantısı zaman aşımına uğradı.'))
    }, 10000)
    const handleLine = (line) => {
      if (!line.trim()) return
      let response
      try {
        response = JSON.parse(line)
      } catch {
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
      if (response.closed) sendPortState('disconnected')
    }

    portProcess.stdout.on('data', (chunk) => {
      outputBuffer += chunk.toString('utf8')
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
        if (code !== 0) sendPortState('error', startupError.trim() || 'Seri port bağlantısı beklenmedik şekilde kesildi.')
        else sendPortState('disconnected')
      }
    })
  }).catch((error) => {
    if (activePort === portProcess) activePort = undefined
    sendPortState('error', `Seri porta bağlanılamadı: ${error.message}`)
    throw new Error(`Seri porta bağlanılamadı: ${error.message}`)
  })

  return { path: portPath }
})

ipcMain.handle('serial:disconnect', async () => {
  try {
    await closeActivePort()
    sendPortState('disconnected')
  } catch (error) {
    sendPortState('error', `Bağlantı kesilemedi: ${error.message}`)
    throw new Error(`Bağlantı kesilemedi: ${error.message}`)
  }
})

const getSimulatorStore = () => {
  if (!simulatorStore) throw new Error('Sanal kumanda deposu henüz hazır değil.')
  return simulatorStore
}

const assertMainWindowSender = (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Bu işlem için uygulama penceresi gerekli.')
  }
}

ipcMain.handle('simulator:list', async (event) => {
  assertMainWindowSender(event)
  return getSimulatorStore().list()
})

ipcMain.handle('simulator:press', async (event, buttonCode) => {
  assertMainWindowSender(event)
  return getSimulatorStore().create(buttonCode)
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
  simulatorStore = createSimulatorStore(path.join(app.getPath('userData'), 'simulator-events.json'))
  callAgentClient = new CallAgentClient({
    storageDirectory: app.getPath('userData'),
    safeStorage,
    onStatus: sendCallAgentState
  })
  await callAgentClient.initialize()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error) => {
  console.error('Uygulama başlatılamadı:', error)
  app.quit()
})

app.on('before-quit', (event) => {
  callAgentClient?.stop()
  if (!activePort || activePort.exitCode !== null) return
  event.preventDefault()
  closeActivePort()
    .catch((error) => console.error('Seri port kapatılamadı:', error))
    .finally(() => app.exit(0))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
