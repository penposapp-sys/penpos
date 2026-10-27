import { error } from '../utils/errors.js'
import { verifyToken } from '../utils/jwt.js'
import PrintStation from '../models/PrintStation.js'

const getBearer = (req) => {
  const h = String(req.headers?.authorization || '')
  if (!h.toLowerCase().startsWith('bearer ')) return ''
  return h.slice(7).trim()
}

export const requireStationAuth = (req, res, next) => {
  ;(async () => {
    try {
      const token = getBearer(req)
      if (token) {
        const payload = verifyToken(token)
        if (!payload || payload.type !== 'station') throw error('unauthorized', 'Invalid station token', 401)
        const stationId = String(payload.stationId || '')
        const agentId = String(payload.agentId || '')
        if (!agentId) throw error('unauthorized', 'Agent identity required', 401)
        const station = await PrintStation.findById(stationId).select('agentOwnerId tenantId system').lean()
        if (!station || String(station.agentOwnerId || '') !== agentId) throw error('station_agent_conflict', 'Print Agent istasyon sahibi değil', 409)
        req.stationAuth = { stationId, tenantId: String(station.tenantId || ''), system: String(station.system || 'kermes'), agentId }
        next()
        return
      }

      throw error('unauthorized', 'Station token required', 401)
    } catch (err) {
      next(err?.status ? err : error('unauthorized', 'Invalid station token', 401))
    }
  })()
}
