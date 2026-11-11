import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'
import Branch from '../models/Branch.js'
import CallAgentDevice from '../models/CallAgentDevice.js'
import CallAgentPairingSession from '../models/CallAgentPairingSession.js'
import CallAgentTokenSession from '../models/CallAgentTokenSession.js'
import Tenant from '../models/Tenant.js'
import Table from '../models/Table.js'
import { log as auditLog } from '../services/auditService.js'
import {
  approvePairingSession,
  completePairing,
  createPairingSession,
  rotateRefreshToken
} from '../services/callAgentAuthService.js'
import { error, sendError } from '../utils/errors.js'
import { cancelCallAgentCallsByTable, createWaiterCall } from '../services/waiterCallService.js'

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const PAIRING_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{12}$/i

const sendControllerError = (res, err) => sendError(res, err)

const validatePairingId = (value) => {
  const pairingId = String(value || '').trim()
  if (!mongoose.isValidObjectId(pairingId)) throw error('invalid_request', 'Eşleştirme oturumu geçersiz', 400)
  return pairingId
}

const validateBranchesForUser = async (req, { branchId: rawBranchId, allBranches = false } = {}) => {
  const tenantId = String(req.user?.tenantId || '').trim()
  if (!mongoose.isValidObjectId(tenantId)) throw error('missing_tenant', 'Doğrulanmış işletme kapsamı gerekli', 403)

  let requestedIds = []
  if (allBranches) {
    const filter = {
      tenantId,
      isActive: true,
      active: { $ne: false },
      isDeleted: { $ne: true },
      status: { $nin: ['inactive', 'deleted'] }
    }
    if (req.user.role === 'staff') {
      const allowedIds = Array.isArray(req.user.branchIds) ? req.user.branchIds.map(String).filter(Boolean) : []
      filter._id = { $in: allowedIds }
    }
    requestedIds = (await Branch.find(filter).select('_id').sort({ name: 1 }).lean()).map((branch) => String(branch._id))
  } else {
    const branchId = String(rawBranchId || '').trim()
    if (!mongoose.isValidObjectId(branchId)) throw error('invalid_request', 'Geçerli bir şube seçilmelidir', 400)
    requestedIds = [branchId]
  }
  if (!requestedIds.length) throw error('invalid_request', 'En az bir etkin şube seçilmelidir', 400)

  if (req.user.role === 'staff') {
    const allowedBranchIds = Array.isArray(req.user.branchIds) ? req.user.branchIds.map(String) : []
    if (requestedIds.some((id) => !allowedBranchIds.includes(id))) {
      throw error('branch_not_allowed', 'Bu şubeye erişim yetkiniz yok', 403)
    }
  }

  const branches = await Branch.find({
    _id: { $in: requestedIds },
    tenantId,
    isActive: true,
    active: { $ne: false },
    isDeleted: { $ne: true },
    status: { $nin: ['inactive', 'deleted'] }
  }).select('_id tenantId').sort({ name: 1 }).lean()
  if (branches.length !== requestedIds.length) throw error('branch_not_found', 'Şubelerden biri bulunamadı veya etkin değil', 404)
  const branchIds = branches.map((branch) => branch._id)
  return { tenantId, branchId: branchIds[0], branchIds }
}

export const createPairing = async (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId || '').trim()
    const deviceName = String(req.body?.deviceName || '').trim()
    if (!UUID_PATTERN.test(deviceId)) throw error('invalid_request', 'Geçerli bir cihaz kimliği gerekli', 400)
    if (deviceName.length > 100) throw error('invalid_request', 'Cihaz adı en fazla 100 karakter olabilir', 400)
    const pairing = await createPairingSession({ deviceId, deviceName })
    res.status(201).json({ success: true, ...pairing })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const createDashboardPairing = async (req, res) => {
  try {
    const deviceName = String(req.body?.deviceName || '').trim()
    if (deviceName.length > 100) throw error('invalid_request', 'Cihaz adı en fazla 100 karakter olabilir', 400)
    const { tenantId, branchId, branchIds } = await validateBranchesForUser(req, {
      branchId: req.body?.branchId,
      allBranches: req.body?.allBranches === true
    })
    const deviceId = randomUUID()
    const pairing = await createPairingSession({ deviceId, deviceName })
    const session = await CallAgentPairingSession.findById(pairing.pairingId)
    if (!session) throw error('pairing_not_found', 'Yeni eşleştirme isteği bulunamadı', 500)
    const device = await approvePairingSession({
      session,
      code: pairing.pairingCode,
      tenantId,
      branchId,
      branchIds,
      userId: req.user.id,
      deviceName
    })
    await auditLog(tenantId, req.user.id, 'call_agent_device_paired', 'CallAgentDevice', device._id, {
      deviceId,
      branchId: String(branchId),
      branchIds: branchIds.map(String),
      source: 'settings'
    })
    const approvedSession = await CallAgentPairingSession.findById(pairing.pairingId).select('expiresAt').lean()
    res.status(201).json({
      success: true,
      device: {
        id: String(device._id),
        deviceId: device.deviceId,
        name: device.name,
        branchId: String(device.branchId),
        branchIds: (device.branchIds?.length ? device.branchIds : [device.branchId]).map(String),
        status: device.status
      },
      pairing: {
        pairingId: pairing.pairingId,
        deviceId,
        pairingCode: pairing.pairingCode,
        expiresAt: approvedSession?.expiresAt || pairing.expiresAt
      }
    })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const approvePairing = async (req, res) => {
  try {
    const pairingId = validatePairingId(req.params.pairingId)
    const code = String(req.body?.code || '').trim().toUpperCase()
    const deviceName = String(req.body?.deviceName || '').trim()
    if (!PAIRING_CODE_PATTERN.test(code)) throw error('invalid_request', 'Eşleştirme kodu biçimi geçersiz', 400)
    if (deviceName.length > 100) throw error('invalid_request', 'Cihaz adı en fazla 100 karakter olabilir', 400)

    const { tenantId, branchId, branchIds } = await validateBranchesForUser(req, {
      branchId: req.body?.branchId,
      allBranches: req.body?.allBranches === true
    })
    const session = await CallAgentPairingSession.findById(pairingId)
    if (!session) throw error('pairing_not_found', 'Eşleştirme isteği bulunamadı', 404)
    const wasApproved = session.status === 'approved'
    const device = await approvePairingSession({
      session,
      code,
      tenantId,
      branchId,
      branchIds,
      userId: req.user.id,
      deviceName
    })
    if (!wasApproved) {
      await auditLog(tenantId, req.user.id, 'call_agent_device_paired', 'CallAgentDevice', device._id, {
        deviceId: device.deviceId,
        branchId: String(branchId),
        branchIds: branchIds.map(String)
      })
    }
    res.json({
      success: true,
      device: {
        id: String(device._id),
        deviceId: device.deviceId,
        name: device.name,
        branchId: String(device.branchId),
        branchIds: (device.branchIds?.length ? device.branchIds : [device.branchId]).map(String),
        status: device.status
      }
    })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const completePairingRequest = async (req, res) => {
  try {
    const pairingId = validatePairingId(req.params.pairingId)
    const pollSecret = String(req.headers['x-pairing-secret'] || '').trim()
    const pairingCode = String(req.headers['x-pairing-code'] || '').trim().toUpperCase()
    if ((!pollSecret || pollSecret.length > 200) && !PAIRING_CODE_PATTERN.test(pairingCode)) {
      throw error('invalid_pairing_secret', 'Eşleştirme oturum anahtarı gerekli', 401)
    }
    const session = await CallAgentPairingSession.findById(pairingId)
    if (!session) throw error('pairing_not_found', 'Eşleştirme isteği bulunamadı', 404)
    const result = await completePairing({ session, pollSecret, pairingCode })
    res.json({ success: true, ...result })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const refreshTokens = async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || '')
    if (refreshToken.length < 40 || refreshToken.length > 200) {
      throw error('invalid_refresh_token', 'Oturum anahtarı geçersiz', 401)
    }
    const tokens = await rotateRefreshToken(refreshToken)
    res.json({ success: true, ...tokens })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const heartbeat = async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId || '').trim()
    if (deviceId !== req.callAgentAuth?.deviceId) throw error('forbidden', 'Cihaz kapsamı eşleşmiyor', 403)
    const hostname = String(req.body?.hostname || '').trim()
    const version = String(req.body?.version || '').trim()
    if (hostname.length > 100 || version.length > 40) {
      throw error('invalid_request', 'Heartbeat bilgileri geçersiz', 400)
    }
    const now = new Date()
    const updated = await CallAgentDevice.findOneAndUpdate(
      {
        deviceId,
        _id: req.callAgentAuth.deviceRecordId,
        tenantId: req.callAgentAuth.tenantId,
        branchId: req.callAgentAuth.branchId,
        status: 'active'
      },
      { $set: { lastHeartbeatAt: now, lastHeartbeatMeta: { hostname, version } } },
      { new: true }
    )
    if (!updated) throw error('device_not_active', 'Cihaz yetkisi etkin değil', 403)
    const branchIds = (req.callAgentAuth.branchIds?.length
      ? req.callAgentAuth.branchIds
      : [req.callAgentAuth.branchId]).map(String)
    const [tenant, branches] = await Promise.all([
      Tenant.findOne({ _id: req.callAgentAuth.tenantId, status: 'active', isActive: { $ne: false } })
        .select('_id name')
        .lean(),
      Branch.find({
        _id: { $in: branchIds },
        tenantId: req.callAgentAuth.tenantId,
        isActive: true,
        active: { $ne: false },
        isDeleted: { $ne: true },
        status: { $nin: ['inactive', 'deleted'] }
      }).select('_id name').sort({ name: 1 }).lean()
    ])
    if (!tenant || !branches.length) throw error('device_scope_inactive', 'Cihazın işletmesi veya şubesi etkin değil', 403)
    const primaryBranch = branches.find((branch) => String(branch._id) === String(req.callAgentAuth.branchId)) || branches[0]
    res.json({
      success: true,
      lastHeartbeatAt: now.toISOString(),
      tenant: { id: String(tenant._id), name: String(tenant.name || '') },
      branch: { id: String(primaryBranch._id), name: String(primaryBranch.name || '') },
      branches: branches.map((branch) => ({ id: String(branch._id), name: String(branch.name || '') }))
    })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const listDevices = async (req, res) => {
  try {
    const tenantId = String(req.user?.tenantId || '').trim()
    if (!mongoose.isValidObjectId(tenantId)) throw error('missing_tenant', 'Doğrulanmış işletme kapsamı gerekli', 403)
    const filter = { tenantId }
    if (req.user.role === 'staff') {
      const branchIds = Array.isArray(req.user.branchIds) ? req.user.branchIds.map(String).filter(Boolean) : []
      if (branchIds.length === 0) return res.json({ success: true, devices: [] })
      filter.$or = [{ branchId: { $in: branchIds } }, { branchIds: { $in: branchIds } }]
    }

    const devices = await CallAgentDevice.find(filter)
      .select('deviceId name branchId branchIds status pairedAt revokedAt lastHeartbeatAt lastHeartbeatMeta')
      .sort({ pairedAt: -1 })
      .lean()
    res.json({
      success: true,
      devices: devices.map((device) => ({
        deviceId: String(device.deviceId),
        name: String(device.name || ''),
        branchId: String(device.branchId),
        branchIds: (device.branchIds?.length ? device.branchIds : [device.branchId]).map(String),
        status: device.status,
        pairedAt: device.pairedAt,
        revokedAt: device.revokedAt || null,
        lastHeartbeatAt: device.lastHeartbeatAt || null,
        lastHeartbeatMeta: {
          hostname: String(device.lastHeartbeatMeta?.hostname || ''),
          version: String(device.lastHeartbeatMeta?.version || '')
        }
      }))
    })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const listBranches = async (req, res) => {
  try {
    const tenantId = String(req.user?.tenantId || '').trim()
    if (!mongoose.isValidObjectId(tenantId)) throw error('missing_tenant', 'Doğrulanmış işletme kapsamı gerekli', 403)
    const filter = {
      tenantId,
      isActive: true,
      active: { $ne: false },
      isDeleted: { $ne: true },
      status: { $nin: ['inactive', 'deleted'] }
    }
    if (req.user.role === 'staff') {
      const branchIds = Array.isArray(req.user.branchIds) ? req.user.branchIds.map(String).filter(Boolean) : []
      if (branchIds.length === 0) return res.json({ success: true, branches: [] })
      filter._id = { $in: branchIds }
    }

    const branches = await Branch.find(filter)
      .select('_id name')
      .sort({ name: 1 })
      .lean()
    res.json({
      success: true,
      branches: branches.map((branch) => ({
        _id: String(branch._id),
        name: String(branch.name || ''),
        isActive: true
      }))
    })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const revokeDevice = async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId || '').trim()
    const tenantId = String(req.user?.tenantId || '').trim()
    if (!UUID_PATTERN.test(deviceId)) throw error('invalid_request', 'Cihaz kimliği geçersiz', 400)
    if (!mongoose.isValidObjectId(tenantId)) throw error('missing_tenant', 'Doğrulanmış işletme kapsamı gerekli', 403)
    const device = await CallAgentDevice.findOne({ deviceId, tenantId })
    if (!device) throw error('device_not_found', 'Cihaz bulunamadı', 404)
    if (req.user.role === 'staff') {
      const allowedBranchIds = Array.isArray(req.user.branchIds) ? req.user.branchIds.map(String) : []
      const deviceBranchIds = (device.branchIds?.length ? device.branchIds : [device.branchId]).map(String)
      if (!deviceBranchIds.some((id) => allowedBranchIds.includes(id))) {
        throw error('branch_not_allowed', 'Bu şubedeki cihazı yönetme yetkiniz yok', 403)
      }
    }
    if (device.status !== 'revoked') {
      const now = new Date()
      const revoked = await CallAgentDevice.findOneAndUpdate(
        { _id: device._id, tenantId, branchId: device.branchId, status: 'active' },
        { $set: { status: 'revoked', revokedAt: now, revokedBy: req.user.id } },
        { new: true }
      )
      if (!revoked) throw error('device_not_active', 'Cihaz yetkisi aynı anda değiştirildi', 409)
      await auditLog(tenantId, req.user.id, 'call_agent_device_revoked', 'CallAgentDevice', device._id, {
        deviceId,
        branchId: String(device.branchId)
      })
    }
    await CallAgentTokenSession.updateMany(
      { deviceId: device._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    )
    res.json({ success: true, deviceId, status: 'revoked' })
  } catch (err) {
    sendControllerError(res, err)
  }
}

const assertAuthenticatedDeviceRoute = (req) => {
  const deviceId = String(req.params.deviceId || '').trim()
  if (!deviceId || deviceId !== req.callAgentAuth?.deviceId) {
    throw error('forbidden', 'Cihaz kapsamı eşleşmiyor', 403)
  }
}

export const listRfTables = async (req, res) => {
  try {
    assertAuthenticatedDeviceRoute(req)
    const branchIds = (req.callAgentAuth.branchIds?.length
      ? req.callAgentAuth.branchIds
      : [req.callAgentAuth.branchId]).map(String)
    const [tables, branches] = await Promise.all([
      Table.find({ tenantId: req.callAgentAuth.tenantId, branchId: { $in: branchIds }, isActive: true })
        .select('_id name branchId').sort({ name: 1 }).lean(),
      Branch.find({ _id: { $in: branchIds } }).select('_id name').lean()
    ])
    const branchNames = new Map(branches.map((branch) => [String(branch._id), String(branch.name || '')]))
    res.json({
      success: true,
      tables: tables.map((table) => ({
        id: String(table._id),
        name: String(table.name || ''),
        branchId: String(table.branchId || ''),
        branchName: branchNames.get(String(table.branchId || '')) || ''
      }))
    })
  } catch (err) {
    sendControllerError(res, err)
  }
}

export const performRfAction = async (req, res) => {
  try {
    assertAuthenticatedDeviceRoute(req)
    const action = String(req.body?.action || '').trim()
    const tableId = String(req.body?.tableId || '').trim()
    if (!['waiter_call', 'service_request', 'cancel'].includes(action)) {
      throw error('invalid_request', 'Tuş işlemi tanınmıyor', 400)
    }
    if (!mongoose.isValidObjectId(tableId)) throw error('invalid_request', 'Geçerli bir masa seçilmelidir', 400)
    const branchIds = (req.callAgentAuth.branchIds?.length
      ? req.callAgentAuth.branchIds
      : [req.callAgentAuth.branchId]).map(String)
    const table = await Table.findOne({
      _id: tableId,
      tenantId: req.callAgentAuth.tenantId,
      branchId: { $in: branchIds },
      isActive: true
    }).select('_id name').lean()
    if (!table) throw error('table_not_found', 'Seçilen masa bu cihaza bağlı şubede bulunamadı', 404)

    if (action === 'cancel') {
      const result = await cancelCallAgentCallsByTable({
        tenantId: req.callAgentAuth.tenantId,
        tableId: String(table._id),
        callAgentDeviceId: req.callAgentAuth.deviceId
      })
      return res.json({ success: true, action, table: { id: String(table._id), name: table.name }, ...result })
    }

    const call = await createWaiterCall({
      tenantId: req.callAgentAuth.tenantId,
      tableId: String(table._id),
      callType: action,
      source: 'call_agent',
      callAgentDeviceId: req.callAgentAuth.deviceId
    })
    return res.json({ success: true, action, table: { id: String(table._id), name: table.name }, call })
  } catch (err) {
    sendControllerError(res, err)
  }
}
