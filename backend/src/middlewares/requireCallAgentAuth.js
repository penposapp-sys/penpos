import { hashSecret, validateDeviceScope } from '../services/callAgentAuthService.js'
import CallAgentDevice from '../models/CallAgentDevice.js'
import CallAgentTokenSession from '../models/CallAgentTokenSession.js'
import { error } from '../utils/errors.js'

const getBearerToken = (req) => {
  const header = String(req.headers?.authorization || '')
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

export const requireCallAgentAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req)
    if (!token) throw error('unauthorized', 'Çağrı ajanı erişim anahtarı gerekli', 401)

    const tokenSession = await CallAgentTokenSession.findOne({
      accessTokenHash: hashSecret(token),
      revokedAt: null
    })
    if (!tokenSession) throw error('unauthorized', 'Çağrı ajanı erişim anahtarı geçersiz veya cihaz iptal edilmiş', 401)

    const device = await CallAgentDevice.findOne({
      _id: tokenSession.deviceId,
      tenantId: tokenSession.tenantId,
      branchId: tokenSession.branchId,
      status: 'active'
    })
    if (!device) throw error('unauthorized', 'Çağrı ajanı cihaz yetkisi etkin değil', 401)

    await validateDeviceScope(device)

    req.callAgentAuth = {
      deviceId: String(device.deviceId),
      deviceRecordId: String(device._id),
      tenantId: String(device.tenantId),
      branchId: String(device.branchId),
      branchIds: (device.branchIds?.length ? device.branchIds : [device.branchId]).map(String),
      tokenSessionId: String(tokenSession._id)
    }
    next()
  } catch (err) {
    next(err)
  }
}
