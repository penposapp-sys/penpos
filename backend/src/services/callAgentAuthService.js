import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto'
import { error } from '../utils/errors.js'
import CallAgentDevice from '../models/CallAgentDevice.js'
import CallAgentPairingSession from '../models/CallAgentPairingSession.js'
import CallAgentTokenSession from '../models/CallAgentTokenSession.js'
import Branch from '../models/Branch.js'
import Tenant from '../models/Tenant.js'

export const PAIRING_TTL_MS = 10 * 60 * 1000
export const PAIRING_MAX_ATTEMPTS = 6
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_REFRESH_ROTATIONS = 1000

const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const hashSecret = (value) => createHash('sha256').update(String(value)).digest('hex')

export const hashPairingCode = (code, salt) =>
  createHash('sha256').update(`${salt}:${String(code).toUpperCase()}`).digest('hex')

export const safeHashEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'hex')
  const b = Buffer.from(String(right || ''), 'hex')
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

export const validateDeviceScope = async (device) => {
  const [tenant, branch] = await Promise.all([
    Tenant.findOne({ _id: device.tenantId, status: 'active', isActive: { $ne: false } }).select('_id').lean(),
    Branch.findOne({
      _id: device.branchId,
      tenantId: device.tenantId,
      isActive: true,
      active: { $ne: false },
      isDeleted: { $ne: true },
      status: { $nin: ['inactive', 'deleted'] }
    }).select('_id').lean()
  ])
  if (!tenant || !branch) throw error('device_scope_inactive', 'Cihazın işletmesi veya şubesi etkin değil', 403)
}

export const createPairingCode = () =>
  Array.from({ length: 12 }, () => PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)]).join('')

const createToken = () => randomBytes(32).toString('base64url')

const createTokenPair = () => ({
  accessToken: createToken(),
  refreshToken: createToken()
})

const sessionDoc = async (device, tokens, now, familyId = randomUUID()) => {
  const accessExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS)
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS)
  const session = await CallAgentTokenSession.create({
    deviceId: device._id,
    tenantId: device.tenantId,
    branchId: device.branchId,
    familyId,
    accessTokenHash: hashSecret(tokens.accessToken),
    refreshTokenHash: hashSecret(tokens.refreshToken),
    accessExpiresAt,
    refreshExpiresAt
  })
  return { session, accessExpiresAt, refreshExpiresAt }
}

export const createPairingSession = async ({ deviceId, deviceName }) => {
  const now = new Date()
  const code = createPairingCode()
  const codeSalt = randomBytes(16).toString('hex')
  const pollSecret = randomBytes(32).toString('base64url')
  const session = await CallAgentPairingSession.create({
    deviceId,
    deviceName,
    codeHash: hashPairingCode(code, codeSalt),
    codeSalt,
    pollSecretHash: hashSecret(pollSecret),
    expiresAt: new Date(now.getTime() + PAIRING_TTL_MS),
    deleteAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  })
  return {
    pairingId: String(session._id),
    deviceId,
    pairingCode: code,
    pollSecret,
    expiresAt: session.expiresAt
  }
}

export const approvePairingSession = async ({ session, code, tenantId, branchId, userId, deviceName }) => {
  const now = new Date()
  const submittedHash = hashPairingCode(code, session.codeSalt)
  if (!safeHashEqual(submittedHash, session.codeHash)) {
    if (session.status === 'pending') {
      const updated = await CallAgentPairingSession.findOneAndUpdate(
        { _id: session._id, status: 'pending', expiresAt: { $gt: now }, failedAttempts: { $lt: PAIRING_MAX_ATTEMPTS } },
        { $inc: { failedAttempts: 1 } },
        { new: true }
      )
      if (updated && updated.failedAttempts >= PAIRING_MAX_ATTEMPTS) {
        await CallAgentPairingSession.updateOne(
          { _id: session._id, status: 'pending', failedAttempts: { $gte: PAIRING_MAX_ATTEMPTS } },
          { $set: { status: 'locked' } }
        )
      }
    }
    throw error('invalid_pairing_code', 'Eşleştirme kodu geçersiz', 400)
  }
  if (session.status === 'approved' && String(session.tenantId) === String(tenantId)
      && String(session.branchId) === String(branchId) && String(session.approvedBy) === String(userId)) {
    return ensureApprovedDevice(session, { tenantId, branchId, userId, deviceName, now })
  }
  if (session.status !== 'pending' || new Date(session.expiresAt).getTime() <= now.getTime()) {
    throw error('pairing_expired', 'Eşleştirme kodunun süresi doldu veya kod kullanılamıyor', 410)
  }
  if (Number(session.failedAttempts || 0) >= PAIRING_MAX_ATTEMPTS) {
    throw error('pairing_locked', 'Eşleştirme kodu çok fazla hatalı deneme nedeniyle kilitlendi', 429)
  }
  const existingDevice = await CallAgentDevice.findOne({ deviceId: session.deviceId })
  if (existingDevice && existingDevice.status !== 'revoked'
      && String(existingDevice.pairingSessionId) !== String(session._id)) {
    throw error('device_already_paired', 'Bu cihaz kimliği başka bir aktif eşleştirmeye bağlı', 409)
  }

  const approved = await CallAgentPairingSession.findOneAndUpdate(
    {
      _id: session._id,
      status: 'pending',
      expiresAt: { $gt: now },
      failedAttempts: { $lt: PAIRING_MAX_ATTEMPTS },
      codeHash: submittedHash
    },
    {
      $set: {
        status: 'approved',
        tenantId,
        branchId,
        approvedBy: userId,
        approvedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000)
      }
    },
    { new: true }
  )
  if (!approved) throw error('pairing_unavailable', 'Eşleştirme isteği artık kullanılamıyor', 409)
  return ensureApprovedDevice(approved, { tenantId, branchId, userId, deviceName, now })
}

const ensureApprovedDevice = async (session, { tenantId, branchId, userId, deviceName, now }) => {
  let device = await CallAgentDevice.findOne({ deviceId: session.deviceId })
  if (device && String(device.pairingSessionId) !== String(session._id)) {
    if (device.status !== 'revoked') {
      throw error('device_already_paired', 'Bu cihaz kimliği başka bir aktif eşleştirmeye bağlı', 409)
    }
    device = await CallAgentDevice.findOneAndUpdate(
      { _id: device._id, status: 'revoked' },
      {
        $set: {
          pairingSessionId: session._id,
          tenantId,
          branchId,
          name: String(deviceName || session.deviceName || 'PenPOS Çağrı Ajanı').trim(),
          status: 'active',
          pairedBy: userId,
          pairedAt: now,
          revokedAt: null,
          revokedBy: null,
          lastHeartbeatAt: null,
          lastHeartbeatMeta: { hostname: '', version: '' }
        }
      },
      { new: true }
    )
    if (!device) throw error('device_pairing_conflict', 'Cihaz eşleştirmesi aynı anda değiştirildi', 409)
  } else if (!device) {
    try {
      device = await CallAgentDevice.create({
        deviceId: session.deviceId,
        pairingSessionId: session._id,
        tenantId,
        branchId,
        name: String(deviceName || session.deviceName || 'PenPOS Çağrı Ajanı').trim(),
        status: 'active',
        pairedBy: userId,
        pairedAt: now
      })
    } catch (createError) {
      if (createError?.code !== 11000) throw createError
      device = await CallAgentDevice.findOne({ deviceId: session.deviceId })
      if (!device) throw createError
    }
  }

  if (String(device.tenantId) !== String(tenantId) || String(device.branchId) !== String(branchId)
      || device.status !== 'active') {
    throw error('device_pairing_conflict', 'Cihazın mevcut tenant veya şube kapsamı eşleşmiyor', 409)
  }
  return device
}

export const completePairing = async ({ session, pollSecret }) => {
  if (!safeHashEqual(hashSecret(pollSecret), session.pollSecretHash)) {
    throw error('invalid_pairing_secret', 'Eşleştirme oturum anahtarı geçersiz', 401)
  }
  if (session.status === 'pending' && new Date(session.expiresAt).getTime() <= Date.now()) {
    await CallAgentPairingSession.updateOne({ _id: session._id, status: 'pending' }, { $set: { status: 'expired' } })
    throw error('pairing_expired', 'Eşleştirme kodunun süresi doldu', 410)
  }
  if (session.status === 'pending') return { status: 'pending' }
  if (session.status !== 'approved') {
    throw error('pairing_unavailable', 'Eşleştirme isteği artık kullanılamıyor', 410)
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await CallAgentPairingSession.updateOne({ _id: session._id, status: 'approved' }, { $set: { status: 'expired' } })
    throw error('pairing_expired', 'Onaylanan eşleştirme isteğinin süresi doldu', 410)
  }

  const device = await CallAgentDevice.findOne({
    deviceId: session.deviceId,
    pairingSessionId: session._id,
    tenantId: session.tenantId,
    branchId: session.branchId,
    status: 'active'
  })
  if (!device) throw error('device_not_active', 'Eşleştirilen cihaz etkin değil', 403)

  const tokens = createTokenPair()
  const { session: tokenSession, accessExpiresAt, refreshExpiresAt } =
    await sessionDoc(device, tokens, new Date())
  const consumed = await CallAgentPairingSession.findOneAndUpdate(
    { _id: session._id, status: 'approved', expiresAt: { $gt: new Date() } },
    { $set: { status: 'consumed', consumedAt: new Date(), tokenSessionId: tokenSession._id } },
    { new: true }
  )
  if (!consumed) {
    await CallAgentTokenSession.updateOne({ _id: tokenSession._id }, { $set: { revokedAt: new Date() } })
    throw error('pairing_unavailable', 'Eşleştirme isteği daha önce tamamlandı', 409)
  }
  await CallAgentTokenSession.updateMany(
    { deviceId: device._id, _id: { $ne: tokenSession._id }, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  )
  return {
    status: 'paired',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt,
    refreshExpiresAt
  }
}

export const rotateRefreshToken = async (refreshToken) => {
  const tokenHash = hashSecret(refreshToken)
  const now = new Date()
  const current = await CallAgentTokenSession.findOne({
    refreshTokenHash: tokenHash,
    revokedAt: null,
    refreshExpiresAt: { $gt: now }
  })

  if (!current) {
    const reused = await CallAgentTokenSession.findOne({
      refreshTokenHistory: tokenHash,
      revokedAt: null
    })
    if (reused) {
      await CallAgentTokenSession.updateOne(
        { _id: reused._id, revokedAt: null },
        { $set: { revokedAt: now } }
      )
      throw error('refresh_token_reuse', 'Yeniden kullanılmış oturum anahtarı nedeniyle cihaz oturumu kapatıldı', 401)
    }
    throw error('invalid_refresh_token', 'Oturum anahtarı geçersiz veya süresi dolmuş', 401)
  }

  const device = await CallAgentDevice.findOne({
    _id: current.deviceId,
    status: 'active',
    tenantId: current.tenantId,
    branchId: current.branchId
  })
  if (!device) {
    await CallAgentTokenSession.updateOne({ _id: current._id }, { $set: { revokedAt: now } })
    throw error('device_not_active', 'Cihaz yetkisi etkin değil', 403)
  }
  await validateDeviceScope(device)
  const refreshHistory = Array.isArray(current.refreshTokenHistory) ? current.refreshTokenHistory : []
  if (refreshHistory.length >= MAX_REFRESH_ROTATIONS) {
    await CallAgentTokenSession.updateOne({ _id: current._id, revokedAt: null }, { $set: { revokedAt: now } })
    throw error('refresh_rotation_limit', 'Oturum yenileme sınırına ulaşıldı; cihazı yeniden eşleştirin', 401)
  }

  const tokens = createTokenPair()
  const accessExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS)
  const rotated = await CallAgentTokenSession.findOneAndUpdate(
    { _id: current._id, refreshTokenHash: tokenHash, revokedAt: null, refreshExpiresAt: { $gt: now } },
    {
      $set: {
        accessTokenHash: hashSecret(tokens.accessToken),
        refreshTokenHash: hashSecret(tokens.refreshToken),
        accessExpiresAt
      },
      $push: { refreshTokenHistory: tokenHash }
    },
    { new: true }
  )
  if (!rotated) {
    const reused = await CallAgentTokenSession.findOne({
      _id: current._id,
      refreshTokenHistory: tokenHash,
      revokedAt: null
    })
    if (reused) {
      await CallAgentTokenSession.updateOne({ _id: reused._id, revokedAt: null }, { $set: { revokedAt: now } })
      throw error('refresh_token_reuse', 'Yeniden kullanılmış oturum anahtarı nedeniyle cihaz oturumu kapatıldı', 401)
    }
    throw error('invalid_refresh_token', 'Oturum anahtarı geçersiz veya süresi dolmuş', 401)
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt,
    refreshExpiresAt: rotated.refreshExpiresAt
  }
}
