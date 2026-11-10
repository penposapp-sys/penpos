import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import { registerCallAgentIpc } from '../electron/callAgentIpc.js'

const electronDirectory = fileURLToPath(new URL('../electron/', import.meta.url))
const readElectronFile = (name) => readFile(path.join(electronDirectory, name), 'utf8')

test('IPC exposes only the intended call-agent operations to the trusted window', async () => {
  const handlers = new Map()
  const listeners = new Map()
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler),
    on: (channel, listener) => listeners.set(channel, listener)
  }
  const sentMessages = []
  const mainWindow = {
    webContents: {
      send: (...args) => sentMessages.push(args)
    },
    isDestroyed: () => false
  }
  const status = {
    connectionStatus: 'connected',
    deviceId: 'device-1',
    tenantName: 'İşletmem',
    branchName: 'Merkez'
  }
  const calls = []
  const client = {
    getStatus: () => status,
    beginPairing: async (backendUrl) => {
      calls.push(['beginPairing', backendUrl])
      return { pairingCode: 'ABCD2345EFGH', pairingId: 'pairing-1' }
    },
    heartbeat: async () => ({ ...status, lastHeartbeatAt: new Date().toISOString() }),
    stopPairing: () => ({ ...status, pairingStatus: 'idle' })
  }

  registerCallAgentIpc({ ipcMain, getMainWindow: () => mainWindow, getClient: () => client })

  assert.deepEqual([...handlers.keys()], [
    'call-agent:status',
    'call-agent:begin-pairing',
    'call-agent:heartbeat',
    'call-agent:stop-pairing'
  ])
  assert.deepEqual([...listeners.keys()], ['call-agent:subscribe'])
  const trustedEvent = { sender: mainWindow.webContents }
  assert.deepEqual(await handlers.get('call-agent:status')(trustedEvent), status)
  const pairing = await handlers.get('call-agent:begin-pairing')(trustedEvent, 'https://pos.example.com')
  assert.deepEqual(calls, [['beginPairing', 'https://pos.example.com']])
  assert.equal('accessToken' in pairing, false)
  assert.equal('refreshToken' in pairing, false)
  await handlers.get('call-agent:heartbeat')(trustedEvent)
  handlers.get('call-agent:stop-pairing')(trustedEvent)
  listeners.get('call-agent:subscribe')(trustedEvent)
  assert.deepEqual(sentMessages, [['call-agent:state', status]])

  const untrustedEvent = { sender: { send() {} } }
  assert.throws(() => handlers.get('call-agent:status')(untrustedEvent), /uygulama penceresi gerekli/)
  await assert.rejects(handlers.get('call-agent:begin-pairing')(untrustedEvent, 'https://pos.example.com'), /uygulama penceresi gerekli/)
  assert.throws(() => listeners.get('call-agent:subscribe')(untrustedEvent), /uygulama penceresi gerekli/)
})

test('preload keeps IPC private and does not expose credentials or unrestricted channels', async () => {
  const preload = await readElectronFile('preload.cjs')
  assert.match(preload, /contextBridge\.exposeInMainWorld\('callAgent'/)
  assert.doesNotMatch(preload, /exposeInMainWorld\(['"](?:ipcRenderer|require|process|electron)['"]/)
  assert.doesNotMatch(preload, /accessToken|refreshToken|pollSecret/)
  assert.match(preload, /ipcRenderer\.invoke\('call-agent:begin-pairing'/)
  assert.match(preload, /ipcRenderer\.invoke\('call-agent:heartbeat'/)
  assert.match(preload, /ipcRenderer\.send\('call-agent:subscribe'\)/)
  assert.doesNotMatch(preload, /ipcRenderer\.send\((?!'call-agent:subscribe')/)
  assert.match(preload, /ipcRenderer\.removeListener\(/)
})

test('Electron denies renderer Node access, untrusted navigation, and new windows', async () => {
  const main = await readElectronFile('main.js')
  assert.match(main, /nodeIntegration:\s*false/)
  assert.match(main, /contextIsolation:\s*true/)
  assert.match(main, /sandbox:\s*true/)
  assert.match(main, /setWindowOpenHandler\(\(\)\s*=>\s*\(\{\s*action:\s*'deny'\s*\}\)\)/)
  assert.match(main, /will-navigate/)
  assert.match(main, /assertMainWindowSender/)
})

test('simulator persistence has no backend/network route', async () => {
  const simulator = await readElectronFile('simulatorStore.js')
  const main = await readElectronFile('main.js')
  assert.doesNotMatch(simulator, /\bfetch\s*\(|https?:\/\/|callAgentClient/)
  assert.match(main, /ipcMain\.handle\('simulator:press'[\s\S]*?getSimulatorStore\(\)\.create\(buttonCode\)/)
  assert.doesNotMatch(main.match(/ipcMain\.handle\('simulator:press'[\s\S]*?\n\}\)/)?.[0] || '', /callAgentClient|fetch\s*\(/)
})

test('raw RF captures are validated and stay diagnostic until a real protocol is mapped', async () => {
  const main = await readElectronFile('main.js')
  const preload = await readElectronFile('preload.cjs')
  const protocol = await readElectronFile('serialProtocol.js')
  const captureHandler = main.match(/if \(parsed\.kind === 'capture'\) \{[\s\S]*?\n      \}/)?.[0] || ''

  assert.match(main, /parseSerialLine\(line\)/)
  assert.match(main, /sendSerialEvent\(parsed\.event\)/)
  assert.match(preload, /ipcRenderer\.on\('serial:event'/)
  assert.match(protocol, /message\.eventType !== 'raw_capture'/)
  assert.match(protocol, /message\.protocol !== 'unknown'/)
  assert.match(protocol, /message\.deviceId !== '' \|\| message\.buttonCode !== ''/)
  assert.doesNotMatch(captureHandler, /callAgentClient|fetch\s*\(|request\s*\(/)
})
