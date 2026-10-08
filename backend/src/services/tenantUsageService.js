import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import TenantUsageDaily from '../models/TenantUsageDaily.js'
import TenantUsageSession from '../models/TenantUsageSession.js'
import { error } from '../utils/errors.js'
import { error as logError } from '../utils/logger.js'

export const TENANT_USAGE_TIMEOUT_MS = 3 * 60 * 1000
const MAX_HEARTBEAT_DELTA_SECONDS = 90
const BUSINESS_TIME_ZONE = 'Europe/Istanbul'
let cleanupTimer = null

const getBusinessDateParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

const dateKey = (date) => {
  const parts = getBusinessDateParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

const getBusinessDayStart = (date) => {
  const [year, month, day] = dateKey(date).split('-').map(Number)
  const utcMidnight = new Date(Date.UTC(year, month - 1, day))
  const localParts = getBusinessDateParts(utcMidnight)
  const localAsUtc = Date.UTC(
    Number(localParts.year),
    Number(localParts.month) - 1,
    Number(localParts.day),
    Number(localParts.hour),
    Number(localParts.minute),
    Number(localParts.second)
  )
  const offsetMs = localAsUtc - utcMidnight.getTime()
  return new Date(utcMidnight.getTime() - offsetMs)
}

const addDailyUsage = async (tenantId, startedAt, durationSeconds) => {
  if (durationSeconds <= 0) return

  const finishedAt = new Date(startedAt.getTime() + durationSeconds * 1000)
  const dayBuckets = new Map()
  let cursor = new Date(startedAt)

  while (cursor < finishedAt) {
    const [year, month, day] = dateKey(cursor).split('-').map(Number)
    const nextDayDate = new Date(Date.UTC(year, month - 1, day + 1, 12))
    const nextDay = getBusinessDayStart(nextDayDate)
    const segmentEnd = finishedAt < nextDay ? finishedAt : nextDay
    const key = dateKey(cursor)
    dayBuckets.set(key, (dayBuckets.get(key) || 0) + Math.floor((segmentEnd.getTime() - cursor.getTime()) / 1000))
    cursor = segmentEnd
  }

  const allocatedSeconds = [...dayBuckets.values()].reduce((total, seconds) => total + seconds, 0)
  const finalDate = dateKey(new Date(finishedAt.getTime() - 1))
  dayBuckets.set(finalDate, (dayBuckets.get(finalDate) || 0) + durationSeconds - allocatedSeconds)

  await Promise.all([...dayBuckets].filter(([, seconds]) => seconds > 0).map(async ([date, seconds]) => {
    try {
      await TenantUsageDaily.updateOne(
        { tenantId, date },
        { $inc: { durationSeconds: seconds }, $setOnInsert: { tenantId, date } },
        { upsert: true }
      )
    } catch (err) {
      if (err?.code !== 11000) throw err
      await TenantUsageDaily.updateOne({ tenantId, date }, { $inc: { durationSeconds: seconds } })
    }
  }))
}

const createSession = async ({ tenantId, userId, sessionKey, now }) => {
  try {
    return await TenantUsageSession.create({
      tenantId,
      userId,
      sessionKey,
      startedAt: now,
      lastHeartbeatAt: now,
      lastActiveAt: now
    })
  } catch (err) {
    if (err?.code !== 11000) throw err
    const activeSession = await TenantUsageSession.findOne({
      tenantId,
      userId,
      sessionKey,
      endedAt: null
    }).sort({ startedAt: -1 })
    if (!activeSession) throw err
    return activeSession
  }
}

const updateSession = async (session, now, endSession) => {
  const elapsedSeconds = Math.max(0, Math.min(
    MAX_HEARTBEAT_DELTA_SECONDS,
    Math.floor((now.getTime() - session.lastHeartbeatAt.getTime()) / 1000)
  ))
  const update = {
    $set: {
      lastHeartbeatAt: now,
      lastActiveAt: now,
      ...(endSession ? { endedAt: now } : {})
    },
    ...(elapsedSeconds > 0 ? { $inc: { durationSeconds: elapsedSeconds } } : {})
  }
  const updated = await TenantUsageSession.findOneAndUpdate(
    { _id: session._id, lastHeartbeatAt: session.lastHeartbeatAt, endedAt: null },
    update,
    { new: true }
  )
  if (!updated) return false

  await Promise.all([
    elapsedSeconds > 0 ? addDailyUsage(session.tenantId, session.lastHeartbeatAt, elapsedSeconds) : Promise.resolve(),
    Tenant.updateOne({ _id: session.tenantId }, { $max: { lastSeenAt: now } })
  ])
  return true
}

export const recordTenantUsageHeartbeat = async ({ tenantId, userId, sessionKey, event = 'heartbeat' }) => {
  if (!mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(userId)) {
    throw error('validation_error', 'Kullanım oturumu için tenant veya kullanıcı bilgisi geçersiz.', 400)
  }
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(String(sessionKey || ''))) {
    throw error('validation_error', 'Kullanım oturumu anahtarı geçersiz.', 400)
  }
  if (!['heartbeat', 'end'].includes(event)) {
    throw error('validation_error', 'Kullanım oturumu olayı geçersiz.', 400)
  }

  const now = new Date()
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId)
  const userObjectId = new mongoose.Types.ObjectId(userId)
  let session = await TenantUsageSession.findOne({
    tenantId: tenantObjectId,
    userId: userObjectId,
    sessionKey,
    endedAt: null
  }).sort({ startedAt: -1 })

  if (session && now.getTime() - session.lastHeartbeatAt.getTime() > TENANT_USAGE_TIMEOUT_MS) {
    const staleSession = session
    const closed = await TenantUsageSession.updateOne(
      { _id: staleSession._id, lastHeartbeatAt: staleSession.lastHeartbeatAt, endedAt: null },
      { $set: { endedAt: new Date(session.lastHeartbeatAt.getTime() + TENANT_USAGE_TIMEOUT_MS) } }
    )
    session = closed.modifiedCount > 0
      ? null
      : await TenantUsageSession.findOne({
          tenantId: tenantObjectId,
          userId: userObjectId,
          sessionKey,
          endedAt: null
        }).sort({ startedAt: -1 })
  }

  if (!session) {
    if (event === 'end') return { success: true }
    session = await createSession({ tenantId: tenantObjectId, userId: userObjectId, sessionKey, now })
    await Tenant.updateOne({ _id: tenantObjectId }, { $max: { lastSeenAt: now } })
    return { success: true }
  }

  const updated = await updateSession(session, now, event === 'end')
  if (!updated) {
    const latestSession = await TenantUsageSession.findOne({
      tenantId: tenantObjectId,
      userId: userObjectId,
      sessionKey,
      endedAt: null
    }).sort({ startedAt: -1 })
    if (latestSession && event === 'heartbeat') {
      await updateSession(latestSession, now, false)
    }
  }
  return { success: true }
}

export const closeExpiredTenantUsageSessions = async (now = new Date()) => {
  const timeoutBefore = new Date(now.getTime() - TENANT_USAGE_TIMEOUT_MS)
  const expiredSessions = await TenantUsageSession.find({
    endedAt: null,
    lastHeartbeatAt: { $lte: timeoutBefore }
  }).select('_id lastHeartbeatAt').lean()
  if (expiredSessions.length === 0) return { modifiedCount: 0 }
  return TenantUsageSession.bulkWrite(expiredSessions.map((session) => ({
    updateOne: {
      filter: { _id: session._id, lastHeartbeatAt: session.lastHeartbeatAt, endedAt: null },
      update: { $set: { endedAt: new Date(session.lastHeartbeatAt.getTime() + TENANT_USAGE_TIMEOUT_MS) } }
    }
  })), { ordered: false })
}

export const startTenantUsageCleanup = () => {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    closeExpiredTenantUsageSessions().catch((err) => {
      logError('[TENANT_USAGE_CLEANUP_FAILED]', { message: String(err?.message || 'Session cleanup failed') })
    })
  }, 60 * 1000)
  cleanupTimer.unref?.()
}

export const getTenantUsageMetrics = async (tenantIds, now = new Date()) => {
  const validIds = tenantIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
  if (validIds.length === 0) return new Map()

  await closeExpiredTenantUsageSessions(now)
  const tenantObjectIds = validIds.map((id) => new mongoose.Types.ObjectId(String(id)))
  const [year, month, day] = dateKey(now).split('-').map(Number)
  const weekStart = new Date(Date.UTC(year, month - 1, day - 6, 12))
  const weekStartKey = dateKey(weekStart)
  const todayKey = dateKey(now)

  const [sessionMetrics, dailyMetrics] = await Promise.all([
    TenantUsageSession.aggregate([
      { $match: { tenantId: { $in: tenantObjectIds } } },
      {
        $group: {
          _id: '$tenantId',
          lastSeenAt: { $max: '$lastHeartbeatAt' },
          lastActiveAt: { $max: { $ifNull: ['$lastActiveAt', '$lastHeartbeatAt'] } },
          totalUsageSeconds: { $sum: '$durationSeconds' }
        }
      }
    ]),
    TenantUsageDaily.aggregate([
      { $match: { tenantId: { $in: tenantObjectIds }, date: { $gte: weekStartKey, $lte: todayKey } } },
      { $group: { _id: { tenantId: '$tenantId', date: '$date' }, durationSeconds: { $sum: '$durationSeconds' } } }
    ])
  ])

  const metrics = new Map()
  for (const id of tenantObjectIds) {
    metrics.set(String(id), {
      lastSeenAt: null,
      lastActiveAt: null,
      isOnline: false,
      todayUsageSeconds: 0,
      weekUsageSeconds: 0,
      totalUsageSeconds: 0
    })
  }
  for (const row of sessionMetrics) {
    const metric = metrics.get(String(row._id))
    if (!metric) continue
    metric.lastSeenAt = row.lastSeenAt || null
    metric.lastActiveAt = row.lastActiveAt || null
    metric.isOnline = Boolean(row.lastSeenAt && now.getTime() - new Date(row.lastSeenAt).getTime() <= TENANT_USAGE_TIMEOUT_MS)
    metric.totalUsageSeconds = Number(row.totalUsageSeconds || 0)
  }
  for (const row of dailyMetrics) {
    const metric = metrics.get(String(row._id.tenantId))
    if (!metric) continue
    const seconds = Number(row.durationSeconds || 0)
    metric.weekUsageSeconds += seconds
    if (row._id.date === todayKey) metric.todayUsageSeconds += seconds
  }
  return metrics
}
