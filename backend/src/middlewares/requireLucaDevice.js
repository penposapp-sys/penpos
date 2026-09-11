import crypto from 'crypto'
import LucaExtensionDevice from '../models/LucaExtensionDevice.js'
import { error } from '../utils/errors.js'

const hashDeviceToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex')

export const getLucaDeviceToken = (req) => {
  const header = String(req.headers.authorization || '')
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return String(req.body?.deviceToken || req.query?.deviceToken || '').trim()
}

export const findLucaDeviceByToken = async (token) => {
  const raw = String(token || '').trim()
  if (!raw) return null
  return LucaExtensionDevice.findOne({
    tokenHash: hashDeviceToken(raw),
    status: { $ne: 'revoked' }
  })
}

export const requireLucaDevice = async (req, res, next) => {
  try {
    const device = await findLucaDeviceByToken(getLucaDeviceToken(req))
    if (!device) return next(error('luca_device_unauthorized', 'Luca cihazı yetkilendirilemedi.', 401))

    const now = new Date()
    await LucaExtensionDevice.updateOne(
      { _id: device._id, status: { $ne: 'revoked' } },
      { $set: { status: 'online', lastSeen: now } }
    )
    device.status = 'online'
    device.lastSeen = now
    req.lucaDevice = device
    next()
  } catch (err) {
    next(err)
  }
}

export const hashLucaDeviceToken = hashDeviceToken
