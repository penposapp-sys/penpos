import assert from 'node:assert/strict'
import express from 'express'
import { test } from 'node:test'
import mongoose from 'mongoose'
import AuditLog from '../src/models/AuditLog.js'
import Branch from '../src/models/Branch.js'
import CallAgentDevice from '../src/models/CallAgentDevice.js'
import CallAgentPairingSession from '../src/models/CallAgentPairingSession.js'
import CallAgentTokenSession from '../src/models/CallAgentTokenSession.js'
import Tenant from '../src/models/Tenant.js'
import User from '../src/models/User.js'
import callAgentsRouter from '../src/routes/callAgents.js'
import { hashSecret, rotateRefreshToken } from '../src/services/callAgentAuthService.js'
import { signToken } from '../src/utils/jwt.js'
import { requireCallAgentHttps } from '../src/middlewares/requireCallAgentHttps.js'
import { sendError } from '../src/utils/errors.js'

const tenantA = '64b000000000000000000001'
const tenantB = '64b000000000000000000009'
const branchA = '64b000000000000000000002'
const branchOther = '64b000000000000000000003'
const branchB = '64b000000000000000000008'
const userId = '64b000000000000000000007'
const pairingId = '64b000000000000000000010'
const deviceRecordId = '64b000000000000000000011'
const tokenSessionId = '64b000000000000000000012'
const deviceId = '72c00000-0000-4000-8000-000000000001'

const query = (value) => ({
  select() { return this },
  lean() { return this },
  sort() { return this },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject) }
})

const matches = (document, filter) => {
  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or') {
      if (!expected.some((clause) => matches(document, clause))) return false
      continue
    }
    if (expected?.$in) {
      if (!expected.$in.map(String).includes(String(document[key]))) return false
      continue
    }
    if (expected?.$nin) {
      if (expected.$nin.map(String).includes(String(document[key]))) return false
      continue
    }
    if (expected?.$ne !== undefined) {
      if (String(document[key] ?? '') === String(expected.$ne)) return false
      continue
    }
    if (['accessExpiresAt', 'refreshExpiresAt', 'expiresAt'].includes(key) && expected?.$gt) {
      if (!(new Date(document[key]) > expected.$gt)) return false
      continue
    }
    if (key === 'failedAttempts' && expected?.$lt !== undefined) {
      if (!(document.failedAttempts < expected.$lt)) return false
      continue
    }
    if (key === 'failedAttempts' && expected?.$gte !== undefined) {
      if (!(document.failedAttempts >= expected.$gte)) return false
      continue
    }
    if (key === '_id' && expected?.$ne) {
      if (String(document._id) === String(expected.$ne)) return false
      continue
    }
    if (key === 'refreshTokenHistory') {
      if (!document.refreshTokenHistory?.includes(expected)) return false
      continue
    }
    if (String(document[key] ?? '') !== String(expected ?? '')) return false
  }
  return true
}

const installMocks = (t, user, branches) => {
  const pairings = new Map()
  const devices = new Map()
  const tokenSessions = new Map()
  let nextTokenId = tokenSessionId

  const tenant = {
    _id: user.tenantId,
    id: user.tenantId,
    name: 'Test işletme',
    status: 'active',
    isActive: true,
    subscriptionStatus: 'active',
    planEndsAt: new Date(Date.now() + 86400000),
    allowedBranchIds: branches.map((branch) => branch._id)
  }

  t.mock.method(User, 'findById', () => query(user))
  t.mock.method(Tenant, 'findById', () => query(tenant))
  t.mock.method(Tenant, 'findOne', (filter) =>
    query(String(filter?._id || '') === String(user.tenantId) ? tenant : null)
  )
  t.mock.method(Branch, 'findOne', (filter) =>
    query(branches.find((branch) =>
      String(branch._id) === String(filter?._id)
      && String(branch.tenantId) === String(filter?.tenantId)
      && branch.isActive === true
    ) || null)
  )
  t.mock.method(Branch, 'find', (filter) =>
    query(branches.filter((branch) => matches(branch, filter)))
  )
  t.mock.method(CallAgentPairingSession, 'create', async (value) => {
    const session = { ...value, _id: pairingId, failedAttempts: 0, status: 'pending' }
    pairings.set(String(session._id), session)
    return session
  })
  t.mock.method(CallAgentPairingSession, 'findById', async (id) => pairings.get(String(id)) || null)
  t.mock.method(CallAgentPairingSession, 'findOneAndUpdate', async (filter, update) => {
    const session = pairings.get(String(filter._id))
    if (!session || !matches(session, filter)) return null
    if (update.$inc?.failedAttempts) session.failedAttempts += update.$inc.failedAttempts
    Object.assign(session, update.$set || {})
    return session
  })
  t.mock.method(CallAgentPairingSession, 'updateOne', async (filter, update) => {
    const session = pairings.get(String(filter._id))
    if (session && matches(session, filter)) Object.assign(session, update.$set || {})
    return { modifiedCount: session ? 1 : 0 }
  })
  t.mock.method(CallAgentDevice, 'findOne', (filter) =>
    query([...devices.values()].find((device) => matches(device, filter)) || null)
  )
  t.mock.method(CallAgentDevice, 'find', (filter) =>
    query([...devices.values()].filter((device) => matches(device, filter)))
  )
  t.mock.method(CallAgentDevice, 'create', async (value) => {
    const device = { ...value, _id: deviceRecordId, lastHeartbeatMeta: value.lastHeartbeatMeta || {} }
    devices.set(device.deviceId, device)
    return device
  })
  t.mock.method(CallAgentDevice, 'findOneAndUpdate', async (filter, update) => {
    const device = [...devices.values()].find((item) => matches(item, filter))
    if (!device) return null
    Object.assign(device, update.$set || {})
    return device
  })
  t.mock.method(CallAgentTokenSession, 'create', async (value) => {
    const session = {
      ...value,
      _id: nextTokenId,
      refreshTokenHistory: [],
      revokedAt: null
    }
    nextTokenId = '64b000000000000000000013'
    tokenSessions.set(String(session._id), session)
    return session
  })
  t.mock.method(CallAgentTokenSession, 'findOne', (filter) =>
    query([...tokenSessions.values()].find((session) => matches(session, filter)) || null)
  )
  t.mock.method(CallAgentTokenSession, 'findOneAndUpdate', async (filter, update) => {
    const session = [...tokenSessions.values()].find((item) => matches(item, filter))
    if (!session) return null
    if (update.$push?.refreshTokenHistory) session.refreshTokenHistory.push(update.$push.refreshTokenHistory)
    Object.assign(session, update.$set || {})
    return session
  })
  t.mock.method(CallAgentTokenSession, 'updateOne', async (filter, update) => {
    const session = [...tokenSessions.values()].find((item) => matches(item, filter))
    if (session) Object.assign(session, update.$set || {})
    return { modifiedCount: session ? 1 : 0 }
  })
  t.mock.method(CallAgentTokenSession, 'updateMany', async (filter, update) => {
    let modifiedCount = 0
    for (const session of tokenSessions.values()) {
      if (matches(session, filter)) {
        Object.assign(session, update.$set || {})
        modifiedCount += 1
      }
    }
    return { modifiedCount }
  })
  t.mock.method(AuditLog, 'create', async () => ({ _id: new mongoose.Types.ObjectId() }))

  return { pairings, devices, tokenSessions }
}

const startServer = async (t, user, branches) => {
  const app = express()
  app.use('/api/call-agents', requireCallAgentHttps)
  app.use(express.json({ limit: '50mb' }))
  app.use('/api/call-agents', callAgentsRouter)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    return sendError(res, err)
  })
  const server = app.listen(0)
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve())
  }))
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/api/call-agents`,
    auth: `Bearer ${signToken({ sub: userId, tenantId: user.tenantId })}`
  }
}

const jsonRequest = (url, { method = 'POST', headers = {}, body } = {}) => fetch(url, {
  method,
  headers: {
    'x-forwarded-proto': 'https',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...headers
  },
  ...(body ? { body: JSON.stringify(body) } : {})
})

test('pairing is tenant/branch scoped; token rotation, heartbeat, and revocation work independently', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    name: 'Tenant Admin',
    role: 'tenant_admin',
    tenantId: tenantA,
    permissions: [],
    isActive: true
  }
  const branches = [
    { _id: branchA, tenantId: tenantA, name: 'Merkez', isActive: true },
    { _id: branchOther, tenantId: tenantA, name: 'Şube 2', isActive: true },
    { _id: branchB, tenantId: tenantB, name: 'Başka İşletme', isActive: true }
  ]
  const { pairings, devices, tokenSessions } = installMocks(t, user, branches)
  const { baseUrl, auth } = await startServer(t, user, branches)

  const startResponse = await jsonRequest(`${baseUrl}/pairings`, {
    body: { deviceId, deviceName: 'Çağrı Ajanı PC' }
  })
  assert.equal(startResponse.status, 201)
  const pairing = await startResponse.json()
  assert.equal(pairing.success, true)
  assert.equal(pairing.pairingCode.length, 12)
  assert.notEqual(pairings.get(pairing.pairingId).codeHash, pairing.pairingCode)
  assert.notEqual(pairings.get(pairing.pairingId).pollSecretHash, pairing.pollSecret)

  const crossTenantResponse = await jsonRequest(`${baseUrl}/pairings/${pairing.pairingId}/approve`, {
    headers: { Authorization: auth },
    body: { code: pairing.pairingCode, branchId: branchB }
  })
  assert.equal(crossTenantResponse.status, 404)
  assert.equal(devices.size, 0)

  const crossBranchResponse = await jsonRequest(`${baseUrl}/pairings/${pairing.pairingId}/approve`, {
    headers: { Authorization: auth },
    body: { code: pairing.pairingCode, branchId: branchOther }
  })
  assert.equal(crossBranchResponse.status, 200)
  assert.equal((await crossBranchResponse.json()).device.branchId, branchOther)
  const deviceListResponse = await jsonRequest(`${baseUrl}/devices`, { method: 'GET', headers: { Authorization: auth } })
  const listedDevices = await deviceListResponse.json()
  assert.equal(deviceListResponse.status, 200)
  assert.equal(listedDevices.devices.length, 1)
  assert.equal(listedDevices.devices[0].branchId, branchOther)

  const completeResponse = await jsonRequest(`${baseUrl}/pairings/${pairing.pairingId}/complete`, {
    headers: { 'x-pairing-secret': pairing.pollSecret }
  })
  assert.equal(completeResponse.status, 200)
  const issued = await completeResponse.json()
  assert.equal(issued.status, 'paired')
  assert.equal(issued.accessToken.length, 43)
  assert.equal(issued.refreshToken.length, 43)
  const tokenRecord = [...tokenSessions.values()][0]
  assert.notEqual(tokenRecord.accessTokenHash, issued.accessToken)
  assert.notEqual(tokenRecord.refreshTokenHash, issued.refreshToken)

  const heartbeat = await jsonRequest(`${baseUrl}/devices/${deviceId}/heartbeat`, {
    headers: { Authorization: `Bearer ${issued.accessToken}` },
    body: { hostname: 'POS-PC', version: '0.1.0' }
  })
  assert.equal(heartbeat.status, 200)
  const heartbeatData = await heartbeat.json()
  assert.equal(heartbeatData.tenant.name, 'Test işletme')
  assert.equal(heartbeatData.branch.name, 'Şube 2')

  const refreshedResponse = await jsonRequest(`${baseUrl}/tokens/refresh`, {
    body: { refreshToken: issued.refreshToken }
  })
  assert.equal(refreshedResponse.status, 200)
  const refreshed = await refreshedResponse.json()
  assert.notEqual(refreshed.refreshToken, issued.refreshToken)

  const refreshedHeartbeat = await jsonRequest(`${baseUrl}/devices/${deviceId}/heartbeat`, {
    headers: { Authorization: `Bearer ${refreshed.accessToken}` },
    body: { hostname: 'POS-PC', version: '0.1.0' }
  })
  assert.equal(refreshedHeartbeat.status, 200)

  const revokeResponse = await jsonRequest(`${baseUrl}/devices/${deviceId}/revoke`, {
    headers: { Authorization: auth }
  })
  assert.equal(revokeResponse.status, 200)
  assert.equal(devices.get(deviceId).status, 'revoked')
  assert.equal([...tokenSessions.values()][0].revokedAt instanceof Date, true)

  const revokedHeartbeat = await jsonRequest(`${baseUrl}/devices/${deviceId}/heartbeat`, {
    headers: { Authorization: `Bearer ${refreshed.accessToken}` },
    body: { hostname: 'POS-PC', version: '0.1.0' }
  })
  assert.equal(revokedHeartbeat.status, 401)
})

test('reusing a rotated refresh token revokes its complete token session', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    role: 'tenant_admin',
    tenantId: tenantA,
    permissions: [],
    isActive: true
  }
  const branches = [{ _id: branchA, tenantId: tenantA, isActive: true }]
  const { devices, tokenSessions } = installMocks(t, user, branches)
  const refreshToken = 'a'.repeat(43)
  const tokenRecord = {
    _id: tokenSessionId,
    deviceId: deviceRecordId,
    tenantId: tenantA,
    branchId: branchA,
    familyId: 'family-1',
    accessTokenHash: hashSecret('b'.repeat(43)),
    refreshTokenHash: hashSecret(refreshToken),
    refreshTokenHistory: [],
    accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    refreshExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null
  }
  devices.set(deviceId, {
    _id: deviceRecordId,
    deviceId,
    tenantId: tenantA,
    branchId: branchA,
    status: 'active'
  })
  tokenSessions.set(String(tokenRecord._id), tokenRecord)

  const rotated = await rotateRefreshToken(refreshToken)
  assert.notEqual(rotated.refreshToken, refreshToken)
  await assert.rejects(
    rotateRefreshToken(refreshToken),
    (err) => err.status === 401 && err.payload.error === 'refresh_token_reuse'
  )
  assert.equal(tokenRecord.revokedAt instanceof Date, true)
})

test('staff cannot pair a device to a different tenant branch outside their assigned branch list', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    name: 'Branch Staff',
    role: 'staff',
    tenantId: tenantA,
    branchId: branchA,
    branchIds: [branchA],
    permissions: ['manage_settings'],
    isActive: true
  }
  const branches = [
    { _id: branchA, tenantId: tenantA, isActive: true },
    { _id: branchOther, tenantId: tenantA, isActive: true }
  ]
  const { pairings, devices } = installMocks(t, user, branches)
  const { baseUrl, auth } = await startServer(t, user, branches)
  const startResponse = await jsonRequest(`${baseUrl}/pairings`, { body: { deviceId } })
  const pairing = await startResponse.json()

  const response = await jsonRequest(`${baseUrl}/pairings/${pairing.pairingId}/approve`, {
    headers: { Authorization: auth },
    body: { code: pairing.pairingCode, branchId: branchOther }
  })
  assert.equal(response.status, 403)
  assert.equal(pairings.get(pairing.pairingId).status, 'pending')
  assert.equal(devices.size, 0)
})

test('staff device management lists only devices from assigned branches', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    role: 'staff',
    tenantId: tenantA,
    branchId: branchA,
    branchIds: [branchA],
    permissions: ['manage_settings'],
    isActive: true
  }
  const branches = [
    { _id: branchA, tenantId: tenantA, name: 'Merkez', isActive: true },
    { _id: branchOther, tenantId: tenantA, name: 'Diğer şube', isActive: true }
  ]
  const { devices } = installMocks(t, user, branches)
  devices.set(deviceId, {
    _id: deviceRecordId,
    deviceId,
    tenantId: tenantA,
    branchId: branchOther,
    name: 'Yetkisiz cihaz',
    status: 'active'
  })
  const { baseUrl, auth } = await startServer(t, user, branches)

  const response = await jsonRequest(`${baseUrl}/devices`, { method: 'GET', headers: { Authorization: auth } })
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(result.devices, [])
})

test('call-agent branch list is tenant-scoped and strictly limited to staff assignments', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    role: 'staff',
    tenantId: tenantA,
    branchId: branchA,
    branchIds: [branchA],
    permissions: ['manage_settings'],
    isActive: true
  }
  const branches = [
    { _id: branchA, tenantId: tenantA, name: 'Merkez', isActive: true, active: true, isDeleted: false, status: 'active' },
    { _id: branchOther, tenantId: tenantA, name: 'Yetkisiz', isActive: true, active: true, isDeleted: false, status: 'active' },
    { _id: branchB, tenantId: tenantB, name: 'Başka işletme', isActive: true, active: true, isDeleted: false, status: 'active' }
  ]
  installMocks(t, user, branches)
  const { baseUrl, auth } = await startServer(t, user, branches)

  const response = await jsonRequest(`${baseUrl}/branches`, { method: 'GET', headers: { Authorization: auth } })
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(result.branches.map((branch) => branch._id), [branchA])

  user.branchIds = []
  user.branchId = null
  const unassignedResponse = await jsonRequest(`${baseUrl}/branches`, { method: 'GET', headers: { Authorization: auth } })
  assert.deepEqual((await unassignedResponse.json()).branches, [])
})

test('staff without device-management permission cannot list or revoke devices', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    role: 'staff',
    tenantId: tenantA,
    branchId: branchA,
    branchIds: [branchA],
    permissions: [],
    isActive: true
  }
  const branches = [{ _id: branchA, tenantId: tenantA, name: 'Merkez', isActive: true }]
  const { devices } = installMocks(t, user, branches)
  devices.set(deviceId, {
    _id: deviceRecordId,
    deviceId,
    tenantId: tenantA,
    branchId: branchA,
    name: 'Ajan',
    status: 'active'
  })
  const { baseUrl, auth } = await startServer(t, user, branches)

  const listResponse = await jsonRequest(`${baseUrl}/devices`, { method: 'GET', headers: { Authorization: auth } })
  const revokeResponse = await jsonRequest(`${baseUrl}/devices/${deviceId}/revoke`, { headers: { Authorization: auth } })
  assert.equal(listResponse.status, 403)
  assert.equal(revokeResponse.status, 403)
  assert.equal(devices.get(deviceId).status, 'active')
})

test('approval endpoint rejects unauthenticated callers before accessing pairing state', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    name: 'Tenant Admin',
    role: 'tenant_admin',
    tenantId: tenantA,
    permissions: [],
    isActive: true
  }
  const branches = [{ _id: branchA, tenantId: tenantA, isActive: true }]
  const { pairings } = installMocks(t, user, branches)
  const { baseUrl } = await startServer(t, user, branches)

  const response = await jsonRequest(`${baseUrl}/pairings/${pairingId}/approve`, {
    body: { code: 'AAAAAAAAAAAA', branchId: branchA }
  })
  assert.equal(response.status, 401)
  assert.equal(pairings.size, 0)
})

test('pairing code is locked after the configured number of invalid attempts', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    name: 'Tenant Admin',
    role: 'tenant_admin',
    tenantId: tenantA,
    permissions: [],
    isActive: true
  }
  const branches = [{ _id: branchA, tenantId: tenantA, isActive: true }]
  const { pairings, devices } = installMocks(t, user, branches)
  const { baseUrl, auth } = await startServer(t, user, branches)
  const startResponse = await jsonRequest(`${baseUrl}/pairings`, { body: { deviceId } })
  const pairing = await startResponse.json()

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await jsonRequest(`${baseUrl}/pairings/${pairing.pairingId}/approve`, {
      headers: { Authorization: auth },
      body: { code: 'AAAAAAAAAAAA', branchId: branchA }
    })
    assert.equal(response.status, 400)
  }
  assert.equal(pairings.get(pairing.pairingId).status, 'locked')

  const correctCodeResponse = await jsonRequest(`${baseUrl}/pairings/${pairing.pairingId}/approve`, {
    headers: { Authorization: auth },
    body: { code: pairing.pairingCode, branchId: branchA }
  })
  assert.equal(correctCodeResponse.status, 410)
  assert.equal(devices.size, 0)
})

test('call-agent HTTP API rejects plain requests before pairing state is created', async (t) => {
  const user = {
    _id: userId,
    id: userId,
    role: 'tenant_admin',
    tenantId: tenantA,
    permissions: [],
    isActive: true
  }
  const { pairings } = installMocks(t, user, [])
  const { baseUrl } = await startServer(t, user, [])
  const response = await fetch(`${baseUrl}/pairings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId })
  })

  assert.equal(response.status, 426)
  assert.equal((await response.json()).error, 'https_required')
  assert.equal(pairings.size, 0)

  const preflight = await fetch(`${baseUrl}/pairings`, { method: 'OPTIONS' })
  assert.equal(preflight.status, 426)
})

test('forwarded HTTPS is trusted only from a loopback proxy', () => {
  let nextError
  requireCallAgentHttps(
    { socket: { encrypted: false, remoteAddress: '203.0.113.10' }, headers: { 'x-forwarded-proto': 'https' } },
    {},
    (err) => { nextError = err }
  )
  assert.equal(nextError?.status, 426)

  let accepted = false
  requireCallAgentHttps(
    { socket: { encrypted: false, remoteAddress: '::ffff:127.0.0.1' }, headers: { 'x-forwarded-proto': 'https' } },
    {},
    (err) => { accepted = !err }
  )
  assert.equal(accepted, true)
})
