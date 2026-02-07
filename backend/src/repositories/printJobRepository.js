import PrintJob from '../models/PrintJob.js'

export const listRecentByTenantAndSystem = (tenantId, system, limit = 50) =>
  PrintJob.find({ tenantId, system }).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(200, Number(limit || 50))))

export const create = (data) => PrintJob.create(data)

export const findByIdAndScope = (id, tenantId, system) =>
  PrintJob.findOne({ _id: id, tenantId, system })

export const claimNext = (tenantId, system, stationId) => {
  return PrintJob.findOneAndUpdate(
    { tenantId, system, stationId: { $in: [stationId, null] }, status: 'queued' },
    { $set: { status: 'printing', lockedByStationId: stationId, lockedAt: new Date(), stationId } },
    { sort: { createdAt: 1 }, new: true }
  )
}

export const claimNextAssigned = (tenantId, system, stationId) => {
  return PrintJob.findOneAndUpdate(
    { tenantId, system, stationId: stationId, status: 'queued' },
    { $set: { status: 'printing', lockedByStationId: stationId, lockedAt: new Date() } },
    { sort: { createdAt: 1 }, new: true }
  )
}

export const markPrinted = (id, tenantId, system, stationId) =>
  PrintJob.findOneAndUpdate(
    { _id: id, tenantId, system, status: 'printing', lockedByStationId: stationId },
    { $set: { status: 'printed', printedAt: new Date(), lockedAt: null } },
    { new: true }
  )

export const markCanceled = (id, tenantId, system) =>
  PrintJob.findOneAndUpdate(
    { _id: id, tenantId, system, status: { $in: ['queued', 'failed'] } },
    { $set: { status: 'canceled', lockedByStationId: null, lockedAt: null } },
    { new: true }
  )

export const markFailed = (id, tenantId, system, stationId, nextStatus, lastError) =>
  PrintJob.findOneAndUpdate(
    { _id: id, tenantId, system, status: 'printing', lockedByStationId: stationId },
    { $set: { status: nextStatus, lastError, lockedByStationId: null, lockedAt: null }, $inc: { attempts: 1 } },
    { new: true }
  )

export const markLockedByStationFailed = (tenantId, system, stationId, lastError) =>
  PrintJob.updateMany(
    { tenantId, system, status: 'printing', lockedByStationId: stationId },
    { $set: { status: 'failed', lastError, lockedByStationId: null, lockedAt: null }, $inc: { attempts: 1 } }
  )

export const unassignQueuedByStation = (tenantId, system, stationId) =>
  PrintJob.updateMany(
    { tenantId, system, status: 'queued', stationId: stationId },
    { $set: { stationId: null } }
  )
