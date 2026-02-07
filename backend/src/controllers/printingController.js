import { sendError } from '../utils/errors.js'
import * as service from '../services/printingService.js'
import * as logger from '../utils/logger.js'
import PrintStation from '../models/PrintStation.js'
import bcrypt from 'bcryptjs'

export const listPrinters = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system)
    const printers = await service.listPrinters(req.user.tenantId, system)
    res.json({ success: true, printers })
  } catch (err) {
    sendError(res, err)
  }
}

export const createPrinter = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system)
    const printer = await service.createPrinter(req.user.tenantId, system, req.body || {})
    res.json({ success: true, printer })
  } catch (err) {
    sendError(res, err)
  }
}

export const updatePrinter = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system || req.query?.system)
    const printer = await service.updatePrinter(req.user.tenantId, system, req.params.id, req.body || {})
    res.json({ success: true, printer })
  } catch (err) {
    sendError(res, err)
  }
}

export const listProfiles = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system)
    const profiles = await service.listProfiles(req.user.tenantId, system)
    res.json({ success: true, profiles })
  } catch (err) {
    sendError(res, err)
  }
}

export const createProfile = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system)
    const profile = await service.createProfile(req.user.tenantId, system, req.body || {})
    res.json({ success: true, profile })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateProfile = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system || req.query?.system)
    const profile = await service.updateProfile(req.user.tenantId, system, req.params.id, req.body || {})
    res.json({ success: true, profile })
  } catch (err) {
    sendError(res, err)
  }
}

export const listStations = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system)
    const stations = await service.listStations(req.user.tenantId, system)
    res.json({ success: true, stations })
  } catch (err) {
    sendError(res, err)
  }
}

export const createStation = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system)
    const station = await service.createStation(req.user.tenantId, system, req.body || {})
    res.json({ success: true, station })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateStation = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system || req.query?.system)
    const station = await service.updateStation(req.user.tenantId, system, req.params.id, req.body || {})
    res.json({ success: true, station })
  } catch (err) {
    sendError(res, err)
  }
}

export const listJobs = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system)
    const limit = Number(req.query?.limit || 50)
    const jobs = await service.listJobs(req.user.tenantId, system, limit)
    res.json({ success: true, jobs })
  } catch (err) {
    sendError(res, err)
  }
}

export const listStationPrinters = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system)
    const printers = await service.listStationPrinters(req.user.tenantId, system, req.params.stationId)
    res.json({ success: true, printers })
  } catch (err) {
    sendError(res, err)
  }
}

export const createJob = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system)
    const result = await service.createJob(req.user.tenantId, system, req.user.id, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const claimNext = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system || req.body?.system)
    const stationId = String(req.params.stationId || '').trim()
    const result = await service.claimNextJob(req.user.tenantId, system, stationId, req.body?.meta)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const completeJob = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system || req.body?.system)
    const stationId = String(req.body?.stationId || '').trim()
    const result = await service.completeJob(req.user.tenantId, system, stationId, req.params.jobId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const failJob = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system || req.body?.system)
    const stationId = String(req.body?.stationId || '').trim()
    const result = await service.failJob(req.user.tenantId, system, stationId, req.params.jobId, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const cancelJob = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.query?.system || req.body?.system)
    const result = await service.cancelJob(req.user.tenantId, system, req.params.jobId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const rotateStationSecret = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system || req.query?.system)
    const stationId = String(req.params.stationId || '').trim()
    logger.info('[STATION_ROTATE_SECRET]', { requestId: req.requestId, stationId, system, tenantId: String(req.user.tenantId) })
    const result = await service.rotateStationSecret(req.user.tenantId, system, stationId)
    res.json({ success: true, stationId: String(result.stationId), secret: String(result.secret) })
  } catch (err) {
    sendError(res, err)
  }
}

export const deleteStation = async (req, res) => {
  try {
    const system = service.normalizeSystem(req.body?.system || req.query?.system)
    const stationId = String(req.params.stationId || '').trim()
    const result = await service.deleteStation(req.user.tenantId, system, stationId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const pairStation = async (req, res) => {
  try {
    const secret = String(req.body?.secret || '').trim()
    if (!secret) {
      res.status(400).json({ success: false, code: 'invalid_request', message: 'secret required' })
      return
    }

    const stations = await PrintStation.find({ secretHash: { $exists: true, $ne: '' } })
      .select('_id name secretHash')
      .lean()

    let matched = null
    for (const st of (stations || [])) {
      const hash = String(st?.secretHash || '')
      if (!hash) continue
      const ok = await bcrypt.compare(secret, hash)
      if (ok) {
        matched = st
        break
      }
    }

    if (!matched?._id) {
      res.status(404).json({ success: false, code: 'station_not_found', message: 'invalid secret' })
      return
    }

    logger.info(`[PRINTING_PAIR] ok station=${String(matched._id)}`)
    res.json({ success: true, stationId: String(matched._id), stationName: String(matched.name || '') })
  } catch (err) {
    sendError(res, err)
  }
}
