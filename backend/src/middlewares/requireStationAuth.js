import { error } from '../utils/errors.js'
import { verifyToken } from '../utils/jwt.js'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
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
        req.stationAuth = {
          stationId: String(payload.stationId || ''),
          tenantId: String(payload.tenantId || ''),
          system: String(payload.system || 'kermes')
        }
        next()
        return
      }

      const stationId = String(req.headers['x-station-id'] || req.params?.stationId || '').trim()
      const stationSecret = String(req.headers['x-station-secret'] || '').trim()
      if (!stationId || !mongoose.isValidObjectId(stationId) || !stationSecret) {
        throw error('unauthorized', 'Station token required', 401)
      }
      const st = await PrintStation.findById(stationId).select('secretHash tenantId system').lean()
      if (!st || !String(st.secretHash || '').trim()) throw error('unauthorized', 'Invalid station token', 401)
      const ok = await bcrypt.compare(stationSecret, String(st.secretHash || ''))
      if (!ok) throw error('unauthorized', 'Invalid station token', 401)
      req.stationAuth = {
        stationId: String(stationId),
        tenantId: String(st.tenantId || ''),
        system: String(st.system || 'kermes')
      }
      next()
    } catch {
      next(error('unauthorized', 'Invalid station token', 401))
    }
  })()
}
