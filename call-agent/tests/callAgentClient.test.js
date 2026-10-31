import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { CallAgentClient, normalizeBackendUrl } from '../electron/callAgentClient.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const tokens = {
  accessToken: 'access-token-value-that-is-long-enough-for-validation-123456',
  refreshToken: 'refresh-token-value-that-is-long-enough-for-validation-123456',
  accessExpiresAt: new Date(Date.now() + 30 * 1000).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}
const refreshedTokens = {
  accessToken: 'rotated-access-token-value-long-enough-for-validation-123456',
  refreshToken: 'rotated-refresh-token-value-long-enough-for-validation-123456',
  accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  refreshExpiresAt: tokens.refreshExpiresAt
}

const createSafeStorage = (available = true) => ({
  isEncryptionAvailable: () => available,
  encryptString: (value) => Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`),
  decryptString: (value) => {
    const encoded = value.toString('utf8').replace(/^encrypted:/, '')
    return Buffer.from(encoded, 'base64').toString('utf8')
  }
})

const response = (body, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => JSON.stringify(body)
})

const withTemporaryDirectory = async (run) => {
  const directory = await mkdtemp(path.join(testDirectory, '.call-agent-client-test-'))
  try {
    await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('PenPOS API adresi HTTPS kök adresiyle sınırlıdır', () => {
  assert.equal(normalizeBackendUrl('https://pos.example.com/'), 'https://pos.example.com')
  for (const invalidUrl of [
    'http://pos.example.com',
    'https://user:password@pos.example.com',
    'https://pos.example.com/api',
    'https://pos.example.com/?redirect=http://attacker.example'
  ]) {
    assert.throws(() => normalizeBackendUrl(invalidUrl))
  }
})

test('device ID persists; tokens use safeStorage, are not exposed, and heartbeat resumes after restart', async () => {
  await withTemporaryDirectory(async (directory) => {
    let pairingApproved = false
    const requests = []
    const fetchImpl = async (url, options) => {
      requests.push({ url, options })
      assert.equal(new URL(url).protocol, 'https:')
      assert.equal(options.redirect, 'manual')
      if (url.endsWith('/pairings')) {
        return response({
          pairingId: 'pairing-1',
          pairingCode: 'ABCD2345EFGH',
          pollSecret: 'pairing-poll-secret',
          expiresAt: new Date(Date.now() + 600_000).toISOString()
        })
      }
      if (url.endsWith('/pairings/pairing-1/complete')) {
        return response(pairingApproved ? { status: 'paired', ...tokens } : { status: 'pending' })
      }
      if (url.endsWith('/tokens/refresh')) return response(refreshedTokens)
      if (url.endsWith(`/devices/${identity.deviceId}/heartbeat`)) {
        return response({
          success: true,
          lastHeartbeatAt: new Date().toISOString(),
          tenant: { id: 'tenant-1', name: 'Test İşletmesi' },
          branch: { id: 'branch-1', name: 'Merkez Şube' }
        })
      }
      throw new Error(`Unexpected API request: ${url}`)
    }

    const safeStorage = createSafeStorage()
    const firstClient = new CallAgentClient({
      storageDirectory: directory,
      safeStorage,
      fetchImpl,
      autoHeartbeat: false
    })
    const firstStatus = await firstClient.initialize()
    const identity = JSON.parse(await readFile(path.join(directory, 'call-agent-device.json'), 'utf8'))
    assert.equal(firstStatus.deviceId, identity.deviceId)

    const pairing = await firstClient.beginPairing('https://pos.example.com')
    assert.equal(pairing.pairingCode, 'ABCD2345EFGH')
    assert.equal('pollSecret' in pairing, false)
    await new Promise((resolve) => setTimeout(resolve, 5))

    pairingApproved = true
    await firstClient.pollPairing()
    const connectedStatus = firstClient.getStatus()
    assert.equal(connectedStatus.connectionStatus, 'connected')
    assert.equal(connectedStatus.paired, true)
    assert.equal('accessToken' in connectedStatus, false)
    assert.equal('refreshToken' in connectedStatus, false)
    assert.ok(connectedStatus.lastHeartbeatAt)
    assert.equal(connectedStatus.tenantName, 'Test İşletmesi')
    assert.equal(connectedStatus.branchName, 'Merkez Şube')
    assert.equal(requests.some(({ url }) => url.endsWith('/tokens/refresh')), true)
    firstClient.stop()

    const tokenPath = path.join(directory, 'call-agent-token.dat')
    const encryptedTokenFile = await readFile(tokenPath)
    assert.match(encryptedTokenFile.toString('utf8'), /^encrypted:/)
    assert.equal(encryptedTokenFile.includes(Buffer.from(tokens.accessToken)), false)
    assert.equal(encryptedTokenFile.includes(Buffer.from(refreshedTokens.accessToken)), false)

    const files = await readdir(directory)
    assert.ok(files.includes('call-agent-device.json'))
    assert.ok(files.includes('call-agent-config.json'))
    assert.ok(files.includes('call-agent-token.dat'))

    const restartedClient = new CallAgentClient({
      storageDirectory: directory,
      safeStorage,
      fetchImpl,
      autoHeartbeat: false
    })
    const restartedStatus = await restartedClient.initialize()
    assert.equal(restartedStatus.deviceId, identity.deviceId)
    assert.equal(restartedStatus.paired, true)
    assert.equal(restartedStatus.backendUrl, 'https://pos.example.com')
    assert.equal(requests.some(({ options }) => options.headers?.Authorization === `Bearer ${refreshedTokens.accessToken}`), true)
    restartedClient.stop()
  })
})

test('token storage and pairing fail closed when safeStorage encryption is unavailable', async () => {
  await withTemporaryDirectory(async (directory) => {
    let requestCount = 0
    const client = new CallAgentClient({
      storageDirectory: directory,
      safeStorage: createSafeStorage(false),
      fetchImpl: async () => {
        requestCount += 1
        return response({})
      },
      autoHeartbeat: false
    })
    await client.initialize()

    await assert.rejects(client.beginPairing('https://pos.example.com'), /şifrelemesi kullanılamıyor/)
    assert.equal(requestCount, 0)
    assert.equal((await readdir(directory)).includes('call-agent-token.dat'), false)
  })
})

test('HTTPS redirects are rejected without following the destination', async () => {
  await withTemporaryDirectory(async (directory) => {
    let requestOptions
    const client = new CallAgentClient({
      storageDirectory: directory,
      safeStorage: createSafeStorage(),
      fetchImpl: async (_url, options) => {
        requestOptions = options
        return response({}, 307)
      },
      autoHeartbeat: false
    })
    await client.initialize()
    await assert.rejects(client.beginPairing('https://pos.example.com'), /yönlendirmesi reddedildi/)
    assert.equal(requestOptions.redirect, 'manual')
    client.stop()
  })
})

test('certificate validation errors are surfaced and never downgraded to HTTP', async () => {
  await withTemporaryDirectory(async (directory) => {
    let requestUrl = ''
    const client = new CallAgentClient({
      storageDirectory: directory,
      safeStorage: createSafeStorage(),
      fetchImpl: async (url) => {
        requestUrl = url
        throw new Error('certificate verify failed')
      },
      autoHeartbeat: false
    })
    await client.initialize()
    await assert.rejects(client.beginPairing('https://pos.example.com'), /certificate verify failed/)
    assert.equal(new URL(requestUrl).protocol, 'https:')
    client.stop()
  })
})

test('startup checks the saved device connection immediately', async () => {
  await withTemporaryDirectory(async (directory) => {
    const safeStorage = createSafeStorage()
    await writeFile(path.join(directory, 'call-agent-config.json'), JSON.stringify({ backendUrl: 'https://pos.example.com' }))
    await writeFile(path.join(directory, 'call-agent-device.json'), JSON.stringify({ deviceId: '72c00000-0000-4000-8000-000000000001' }))
    await writeFile(path.join(directory, 'call-agent-token.dat'), safeStorage.encryptString(JSON.stringify({
      ...tokens,
      accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    })))
    let heartbeatRequests = 0
    let connected
    const connectedState = new Promise((resolve) => { connected = resolve })
    const client = new CallAgentClient({
      storageDirectory: directory,
      safeStorage,
      fetchImpl: async (url) => {
        if (!url.endsWith('/devices/72c00000-0000-4000-8000-000000000001/heartbeat')) {
          throw new Error(`Unexpected API request: ${url}`)
        }
        heartbeatRequests += 1
        return response({
          success: true,
          lastHeartbeatAt: new Date().toISOString(),
          tenant: { id: 'tenant-1', name: 'Test İşletmesi' },
          branch: { id: 'branch-1', name: 'Merkez Şube' }
        })
      },
      onStatus: (state) => {
        if (state.connectionStatus === 'connected') connected(state)
      }
    })

    await client.initialize()
    await connectedState
    assert.equal(heartbeatRequests, 1)
    assert.equal(client.getStatus().branchName, 'Merkez Şube')
    client.stop()
  })
})

test('revoked device access clears the saved local session and requires re-pairing', async () => {
  await withTemporaryDirectory(async (directory) => {
    const safeStorage = createSafeStorage()
    await writeFile(path.join(directory, 'call-agent-config.json'), JSON.stringify({ backendUrl: 'https://pos.example.com' }))
    await writeFile(path.join(directory, 'call-agent-device.json'), JSON.stringify({ deviceId: '72c00000-0000-4000-8000-000000000001' }))
    await writeFile(path.join(directory, 'call-agent-token.dat'), safeStorage.encryptString(JSON.stringify(tokens)))
    const client = new CallAgentClient({
      storageDirectory: directory,
      safeStorage,
      fetchImpl: async () => response({ error: 'device_not_active', message: 'Cihaz yetkisi etkin değil' }, 403),
      autoHeartbeat: false
    })

    await client.initialize()
    await assert.rejects(client.heartbeat(), /Cihaz yetkisi etkin değil/)
    assert.equal(client.getStatus().paired, false)
    assert.equal(client.getStatus().pairingStatus, 'revoked')
    assert.equal((await readdir(directory)).includes('call-agent-token.dat'), false)
    client.stop()
  })
})

test('expired refresh credentials are removed instead of left in a paired state', async () => {
  await withTemporaryDirectory(async (directory) => {
    const safeStorage = createSafeStorage()
    const expiredTokens = {
      ...tokens,
      accessExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      refreshExpiresAt: new Date(Date.now() - 60_000).toISOString()
    }
    await writeFile(path.join(directory, 'call-agent-config.json'), JSON.stringify({ backendUrl: 'https://pos.example.com' }))
    await writeFile(path.join(directory, 'call-agent-device.json'), JSON.stringify({ deviceId: '72c00000-0000-4000-8000-000000000001' }))
    await writeFile(path.join(directory, 'call-agent-token.dat'), safeStorage.encryptString(JSON.stringify(expiredTokens)))
    const client = new CallAgentClient({
      storageDirectory: directory,
      safeStorage,
      fetchImpl: async () => response({ error: 'invalid_refresh_token', message: 'Oturum süresi dolmuş' }, 401),
      autoHeartbeat: false
    })

    await client.initialize()
    await assert.rejects(client.heartbeat(), /Oturum süresi dolmuş/)
    assert.equal(client.getStatus().paired, false)
    assert.equal(client.getStatus().pairingStatus, 'expired')
    assert.equal((await readdir(directory)).includes('call-agent-token.dat'), false)
    client.stop()
  })
})

test('network loss leaves the encrypted session intact and the next heartbeat reconnects', async () => {
  await withTemporaryDirectory(async (directory) => {
    const safeStorage = createSafeStorage()
    let online = false
    await writeFile(path.join(directory, 'call-agent-config.json'), JSON.stringify({ backendUrl: 'https://pos.example.com' }))
    await writeFile(path.join(directory, 'call-agent-device.json'), JSON.stringify({ deviceId: '72c00000-0000-4000-8000-000000000001' }))
    await writeFile(path.join(directory, 'call-agent-token.dat'), safeStorage.encryptString(JSON.stringify({
      ...tokens,
      accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    })))
    const client = new CallAgentClient({
      storageDirectory: directory,
      safeStorage,
      fetchImpl: async (url) => {
        if (!online) throw new Error('network unavailable')
        assert.ok(url.endsWith('/devices/72c00000-0000-4000-8000-000000000001/heartbeat'))
        return response({
          success: true,
          lastHeartbeatAt: new Date().toISOString(),
          tenant: { id: 'tenant-1', name: 'Test İşletmesi' },
          branch: { id: 'branch-1', name: 'Merkez Şube' }
        })
      },
      autoHeartbeat: false
    })

    await client.initialize()
    await assert.rejects(client.heartbeat(), /network unavailable/)
    assert.equal(client.getStatus().connectionStatus, 'disconnected')
    assert.equal(client.getStatus().paired, true)
    assert.equal((await readdir(directory)).includes('call-agent-token.dat'), true)

    online = true
    const reconnected = await client.heartbeat()
    assert.equal(reconnected.connectionStatus, 'connected')
    assert.equal(reconnected.branchName, 'Merkez Şube')
    client.stop()
  })
})
