import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { error, sendError } from '../utils/errors.js'
import PrintStation from '../models/PrintStation.js'
import { signToken } from '../utils/jwt.js'
import * as printingService from '../services/printingService.js'
import * as stationRepo from '../repositories/printStationRepository.js'
import * as jobRepo from '../repositories/printJobRepository.js'
import * as logger from '../utils/logger.js'
import Order from '../models/Order.js'
import Table from '../models/Table.js'
import Tenant from '../models/Tenant.js'
import PrintProfile from '../models/PrintProfile.js'
import { renderLabelPdfBase64, renderReceiptPdfBase64, renderTextPdfBase64 } from '../services/pdfRenderService.js'

const normalizePrinters = (value) => {
  const arr = Array.isArray(value) ? value : []
  const out = []
  for (const p of arr) {
    if (!p) continue
    if (typeof p === 'string') {
      const n = p.trim()
      if (n) out.push(n)
      continue
    }
    const name = String(p?.name || '').trim()
    if (name) out.push(name)
  }
  return out
}

const lastHeartbeatLogAtByStation = new Map()

const buildAbsoluteUrl = (req, p) => {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim()
  if (!host) return String(p || '')
  return `${proto}://${host}${String(p || '')}`
}

const getStationScope = async (stationId) => {
  const st = await PrintStation.findById(stationId).select('_id tenantId system name').lean()
  return st ? { stationId: String(st._id), tenantId: String(st.tenantId), system: String(st.system), stationName: String(st.name || '') } : null
}

const getJobPdfBase64 = async ({ job, tenantId, system }) => {
  const type = String(job?.type || '')
  const profileId = String(job?.profileId || '').trim()
  const profile = mongoose.isValidObjectId(profileId)
    ? await PrintProfile.findOne({ _id: profileId, tenantId, system }).select('options').lean()
    : null
  const profileOptions = profile?.options && typeof profile.options === 'object' ? profile.options : {}
  const labelWidthMm = Math.max(20, Number(profileOptions.widthMm || 50))
  const labelHeightMm = Math.max(20, Number(profileOptions.heightMm || 30))
  const receiptWidthMm = Math.max(58, Number(profileOptions.widthMm || 80))

  if (String(job?.payload?.type || '') === 'pdf_base64') {
    return String(job?.payload?.content || '')
  }

  if (type === 'receipt') {
    const orderId = String(job?.meta?.orderId || '').trim()
    if (mongoose.isValidObjectId(orderId)) {
      const [tenant, order] = await Promise.all([
        Tenant.findById(tenantId).select('name').lean(),
        Order.findOne({ _id: orderId, tenantId }).lean()
      ])
      const tableName = order?.tableId
        ? String((await Table.findById(order.tableId).select('name').lean())?.name || '')
        : ''
      const items = Array.isArray(order?.items) ? order.items.filter(it => it && it.status !== 'cancelled') : []
      const isPackage = String(order?.saleType || '') === 'delivery' || String(order?.servingType || '') === 'package'
      return await renderReceiptPdfBase64({
        tenantName: String(tenant?.name || ''),
        createdAt: order?.createdAt || job?.createdAt,
        orderNo: order?.orderNo || String(order?._id || ''),
        tableName,
        items,
        totals: order?.totals || { grandTotal: order?.netTotal || 0 },
        paidStatus: String(order?.paymentStatus || ''),
        widthMm: receiptWidthMm,
        isPackage,
        customerName: order?.customerName,
        customerPhone: order?.customerPhone,
        customerAddress: order?.customerAddress
      })
    }
    const payloadText = String(job?.payload?.content || '')
    return await renderTextPdfBase64({ text: payloadText, widthMm: receiptWidthMm, heightMm: 300, fontSize: 10, marginMm: 4 })
  }

  if (type === 'label') {
    const payloadText = String(job?.payload?.content || '')
    const lines = payloadText.split(/\r?\n/g).map(s => s.trim()).filter(Boolean)
    const topText = String(lines[0] || '')
    const productLine = String(lines[1] || '')
    const productText = productLine.replace(/\s+x\d+\s*$/i, '').trim() || productLine
    const qty = Number(job?.meta?.qty || 1)
    return await renderLabelPdfBase64({ topText, productText, qty, widthMm: labelWidthMm, heightMm: labelHeightMm })
  }

  const payloadText = String(job?.payload?.content || '')
  return await renderTextPdfBase64({ text: payloadText, widthMm: 80, heightMm: 300, fontSize: 10, marginMm: 4 })
}

export const stationAuth = async (req, res) => {
  try {
    const stationId = String(req.params.stationId || '').trim()
    if (!mongoose.isValidObjectId(stationId)) throw error('invalid_request', 'Invalid stationId', 400)
    const secret = String(req.body?.secret || req.body?.stationSecret || req.body?.station_secret || '')
    if (!secret) throw error('invalid_request', 'secret zorunlu', 400)
    const st = await PrintStation.findById(stationId)
    if (!st) throw error('not_found', 'İstasyon bulunamadı', 404)
    if (!String(st.secretHash || '').trim()) throw error('station_secret_missing', 'İstasyon secret ayarlı değil', 400)
    const ok = await bcrypt.compare(secret, String(st.secretHash || ''))
    if (!ok) throw error('unauthorized', 'Secret yanlış', 401)
    const token = signToken({ type: 'station', stationId: String(st.id), tenantId: String(st.tenantId), system: String(st.system) })
    res.json({ success: true, token })
  } catch (err) {
    sendError(res, err)
  }
}

export const heartbeat = async (req, res) => {
  try {
    const stationId = String(req.params.stationId || '').trim()
    if (!mongoose.isValidObjectId(stationId)) throw error('invalid_request', 'Invalid stationId', 400)
    const auth = req.stationAuth
    const scope = auth?.stationId === stationId ? { tenantId: auth.tenantId, system: auth.system } : await getStationScope(stationId)
    if (!scope?.tenantId) throw error('not_found', 'İstasyon bulunamadı', 404)
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const nextMeta = {
      printers: normalizePrinters(body.printers),
      hostname: String(body.hostname || ''),
      version: String(body.version || '')
    }
    const update = { lastHeartbeatAt: new Date(), lastHeartbeatMeta: nextMeta }
    const st = await stationRepo.updateByIdAndScope(stationId, scope.tenantId, scope.system, update)
    if (!st) throw error('not_found', 'İstasyon bulunamadı', 404)
    if (process.env.PRINTING_HEARTBEAT_DEBUG === '1') {
      const key = String(stationId)
      const now = Date.now()
      const last = Number(lastHeartbeatLogAtByStation.get(key) || 0)
      if (now - last >= 60000) {
        lastHeartbeatLogAtByStation.set(key, now)
        logger.info(`[PRINTING_HEARTBEAT] station=${key}`)
      }
    }
    res.json({ success: true })
  } catch (err) {
    sendError(res, err)
  }
}

export const claimNext = async (req, res) => {
  try {
    const stationId = String(req.params.stationId || '').trim()
    if (!mongoose.isValidObjectId(stationId)) throw error('invalid_request', 'Invalid stationId', 400)

    const auth = req.stationAuth
    const scope = auth?.stationId === stationId ? { tenantId: auth.tenantId, system: auth.system } : await getStationScope(stationId)
    if (!scope?.tenantId) throw error('not_found', 'İstasyon bulunamadı', 404)

    const job = await jobRepo.claimNextAssigned(scope.tenantId, scope.system, stationId)
    const jobId = String(job?._id || job?.id || '').trim()
    if (!jobId) {
      if (process.env.PRINTING_CLAIM_DEBUG === '1') {
        logger.info(`[PRINTING_CLAIM] station=${stationId} job=null`)
      }
      res.json({ job: null })
      return
    }

    const filePath = `/api/printing/jobs/${encodeURIComponent(jobId)}/file?stationId=${encodeURIComponent(stationId)}`
    const fileUrl = buildAbsoluteUrl(req, filePath)
    logger.info(`[PRINTING_CLAIM] station=${stationId} job=${jobId}`)
    res.json({ job: { id: jobId, type: String(job.type || ''), fileUrl } })
  } catch (err) {
    sendError(res, err)
  }
}

export const downloadJobFile = async (req, res) => {
  try {
    const jobId = String(req.params.jobId || '').trim()
    const stationId = String(req.query?.stationId || '').trim()
    if (!mongoose.isValidObjectId(jobId)) throw error('invalid_request', 'Invalid jobId', 400)
    if (!mongoose.isValidObjectId(stationId)) throw error('invalid_request', 'Invalid stationId', 400)

    const job = await (await import('../models/PrintJob.js')).default.findById(jobId).lean()
    if (!job) throw error('not_found', 'Job bulunamadı', 404)
    if (String(job.lockedByStationId || '') !== String(stationId)) throw error('unauthorized', 'Invalid station', 401)

    const scope = await getStationScope(stationId)
    if (!scope?.tenantId) throw error('not_found', 'İstasyon bulunamadı', 404)

    const b64 = await getJobPdfBase64({ job, tenantId: scope.tenantId, system: scope.system })
    const buf = Buffer.from(String(b64 || ''), 'base64')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(buf)
  } catch (err) {
    sendError(res, err)
  }
}

export const completeJob = async (req, res) => {
  try {
    const jobId = String(req.params.jobId || '').trim()
    if (!mongoose.isValidObjectId(jobId)) throw error('invalid_request', 'Invalid jobId', 400)

    const auth = req.stationAuth
    if (auth?.tenantId && auth?.stationId) {
      const result = await printingService.completeJob(auth.tenantId, auth.system, auth.stationId, jobId)
      res.json({ success: true, ...result })
      return
    }

    const PrintJob = (await import('../models/PrintJob.js')).default
    const job = await PrintJob.findById(jobId).select('lockedByStationId').lean()
    if (!job) throw error('not_found', 'Job bulunamadı', 404)
    const stationId = String(job.lockedByStationId || '').trim()
    if (!mongoose.isValidObjectId(stationId)) throw error('unauthorized', 'Invalid station', 401)

    const scope = await getStationScope(stationId)
    if (!scope?.tenantId) throw error('not_found', 'İstasyon bulunamadı', 404)
    const result = await printingService.completeJob(scope.tenantId, scope.system, stationId, jobId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const failJob = async (req, res) => {
  try {
    const jobId = String(req.params.jobId || '').trim()
    if (!mongoose.isValidObjectId(jobId)) throw error('invalid_request', 'Invalid jobId', 400)

    const auth = req.stationAuth
    if (auth?.tenantId && auth?.stationId) {
      const result = await printingService.failJob(auth.tenantId, auth.system, auth.stationId, jobId, req.body || {})
      res.json({ success: true, ...result })
      return
    }

    const PrintJob = (await import('../models/PrintJob.js')).default
    const job = await PrintJob.findById(jobId).select('lockedByStationId').lean()
    if (!job) throw error('not_found', 'Job bulunamadı', 404)
    const stationId = String(job.lockedByStationId || '').trim()
    if (!mongoose.isValidObjectId(stationId)) throw error('unauthorized', 'Invalid station', 401)

    const scope = await getStationScope(stationId)
    if (!scope?.tenantId) throw error('not_found', 'İstasyon bulunamadı', 404)

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const code = String(body.code || '').trim()
    const message = String(body.message || '').trim()
    const input = { retry: false, error: { code, message } }
    const result = await printingService.failJob(scope.tenantId, scope.system, stationId, jobId, input)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
