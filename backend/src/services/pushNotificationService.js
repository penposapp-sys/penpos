import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import User from '../models/User.js'
import { getUserAccessibleBranchIds } from '../utils/branchVisibility.js'
import { error as logError, info } from '../utils/logger.js'

let appInstance = null
let initAttempted = false

const normalizeText = (value) => String(value || '').trim()

const parseFirebaseCredentials = () => {
  const inlineJson = normalizeText(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson)
    } catch (err) {
      logError('[PUSH_FIREBASE_JSON_PARSE_ERROR]', { message: String(err?.message || err) })
      return null
    }
  }

  const projectId = normalizeText(process.env.FIREBASE_PROJECT_ID)
  const clientEmail = normalizeText(process.env.FIREBASE_CLIENT_EMAIL)
  const privateKey = normalizeText(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) return null

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey
  }
}

const getFirebaseApp = () => {
  if (appInstance) return appInstance
  if (initAttempted) return null
  initAttempted = true

  const credentials = parseFirebaseCredentials()
  if (!credentials) {
    info('[PUSH_FIREBASE_NOT_CONFIGURED]', { configured: false })
    return null
  }

  try {
    appInstance = getApps()[0] || initializeApp({
      credential: cert(credentials)
    })
    return appInstance
  } catch (err) {
    logError('[PUSH_FIREBASE_INIT_ERROR]', { message: String(err?.message || err) })
    return null
  }
}

const getMessagingClient = () => {
  const app = getFirebaseApp()
  return app ? getMessaging(app) : null
}

const normalizePlatform = (value) => {
  const raw = normalizeText(value).toLowerCase()
  if (raw === 'android' || raw === 'ios' || raw === 'web') return raw
  return 'unknown'
}

const mapPushDevice = (device = {}) => ({
  token: normalizeText(device.token),
  platform: normalizePlatform(device.platform),
  deviceId: normalizeText(device.deviceId),
  appVersion: normalizeText(device.appVersion),
  lastSeenAt: new Date(),
  disabledAt: null
})

const uniquePushDevices = (devices = []) => {
  const seen = new Set()
  const out = []
  for (const rawDevice of Array.isArray(devices) ? devices : []) {
    const device = mapPushDevice(rawDevice)
    if (!device.token || seen.has(device.token)) continue
    seen.add(device.token)
    out.push(device)
  }
  return out
}

export const registerPushDevice = async (userId, payload = {}) => {
  const token = normalizeText(payload.token)
  if (!token) return { ok: false, registered: false }

  await User.updateMany(
    { _id: { $ne: userId }, 'pushDevices.token': token },
    { $pull: { pushDevices: { token } } }
  )

  const user = await User.findById(userId).select('pushDevices')
  if (!user) return { ok: false, registered: false }

  const devices = (Array.isArray(user.pushDevices) ? user.pushDevices : []).filter((device) => normalizeText(device?.token) !== token)
  user.pushDevices = uniquePushDevices([
    ...devices,
    {
      token,
      platform: payload.platform,
      deviceId: payload.deviceId,
      appVersion: payload.appVersion
    }
  ])
  await user.save()

  return { ok: true, registered: true }
}

export const unregisterPushDevice = async (userId, payload = {}) => {
  const token = normalizeText(payload.token)
  if (!token) return { ok: false, unregistered: false }

  await User.updateOne(
    { _id: userId },
    { $pull: { pushDevices: { token } } }
  )
  return { ok: true, unregistered: true }
}

const disableInvalidTokens = async (tokens = []) => {
  const list = Array.from(new Set((Array.isArray(tokens) ? tokens : []).map(normalizeText).filter(Boolean)))
  if (list.length === 0) return

  await User.updateMany(
    { 'pushDevices.token': { $in: list } },
    { $set: { 'pushDevices.$[device].disabledAt': new Date() } },
    { arrayFilters: [{ 'device.token': { $in: list } }] }
  )
}

const extractActiveTokens = (users = []) => {
  const tokens = []
  for (const user of Array.isArray(users) ? users : []) {
    for (const device of Array.isArray(user?.pushDevices) ? user.pushDevices : []) {
      const token = normalizeText(device?.token)
      if (!token || device?.disabledAt) continue
      tokens.push(token)
    }
  }
  return Array.from(new Set(tokens))
}

export const sendPushToUsers = async (users = [], payload = {}) => {
  const messaging = getMessagingClient()
  const tokens = extractActiveTokens(users)
  if (!messaging || tokens.length === 0) {
    const result = { sent: 0, skipped: tokens.length === 0 ? 'no_tokens' : 'firebase_not_configured' }
    info('[PUSH_SEND_RESULT]', { tokenCount: tokens.length, ...result })
    return result
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: normalizeText(payload.title),
      body: normalizeText(payload.body)
    },
    data: Object.fromEntries(
      Object.entries(payload.data || {}).map(([key, value]) => [key, String(value ?? '')])
    ),
    android: {
      priority: 'high',
      notification: {
        channelId: normalizeText(payload.channelId) || 'penpos-alerts',
        sound: 'default'
      }
    }
  })

  const invalidTokens = []
  response.responses.forEach((item, index) => {
    if (item.success) return
    const code = String(item.error?.code || '')
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      invalidTokens.push(tokens[index])
    }
  })
  if (invalidTokens.length > 0) await disableInvalidTokens(invalidTokens)

  const result = {
    sent: Number(response.successCount || 0),
    failed: Number(response.failureCount || 0)
  }
  info('[PUSH_SEND_RESULT]', {
    tokenCount: tokens.length,
    ...result,
    failureCodes: response.responses
      .filter((item) => !item.success)
      .map((item) => String(item.error?.code || 'unknown'))
      .slice(0, 10)
  })
  return result
}

export const notifyWaiterCallUsers = async ({ tenantId, branchId = '', tableName = '', waiterCallId = '' } = {}) => {
  const users = await User.find({
    tenantId,
    isDeleted: { $ne: true },
    isActive: true,
    $or: [
      { role: 'tenant_admin' },
      { permissions: { $in: ['manage_tables'] } }
    ]
  }).select('_id role branchId branchIds accessibleBranchIds pushDevices')

  const visibleUsers = users.filter((user) => {
    if (String(user?.role || '') === 'tenant_admin') return true
    const allowed = getUserAccessibleBranchIds(user)
    if (allowed.length === 0) return false
    return allowed.includes(String(branchId))
  })

  return sendPushToUsers(visibleUsers, {
    title: 'Garson Cagrisi',
    body: tableName ? `${tableName} masasi garson cagiriyor.` : 'Yeni garson cagrisi var.',
    channelId: 'penpos-alerts',
    data: {
      type: 'waiter_call',
      waiterCallId,
      branchId: String(branchId || ''),
      tableName: tableName || '',
      targetPath: '/kermes/app/waiter-calls'
    }
  })
}

export const notifyReservationUsers = async ({
  tenantId,
  branchId = '',
  reservationId = '',
  customerName = '',
  guestCount = 0,
  startAt = null,
} = {}) => {
  const users = await User.find({
    tenantId,
    isDeleted: { $ne: true },
    isActive: true,
    $or: [
      { role: 'tenant_admin' },
      { permissions: { $in: ['manage_tables', 'reservations_view'] } }
    ]
  }).select('_id role branchId branchIds accessibleBranchIds pushDevices')
  const visibleUsers = users.filter((user) => {
    if (String(user?.role || '') === 'tenant_admin') return true
    const allowed = getUserAccessibleBranchIds(user)
    return allowed.includes(String(branchId))
  })
  const date = startAt ? new Date(startAt) : null
  const dateLabel = date && Number.isFinite(date.getTime())
    ? `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`
    : ''
  return sendPushToUsers(visibleUsers, {
    title: 'Yeni Rezervasyon',
    body: `${String(customerName || 'Müşteri')} · ${Number(guestCount || 0)} kişi${dateLabel ? ` · ${dateLabel}` : ''}`,
    channelId: 'penpos-alerts',
    data: {
      type: 'reservation',
      reservationId: String(reservationId),
      branchId: String(branchId),
      targetPath: '/restoran/app/reservations'
    }
  })
}

export const notifyCourierAssigned = async ({ courierUserId, order } = {}) => {
  if (!courierUserId || !order) return { sent: 0, skipped: 'missing_data' }
  const users = await User.find({ _id: courierUserId, isDeleted: { $ne: true }, isActive: true }).select('pushDevices')
  return sendPushToUsers(users, {
    title: 'Yeni Kurye Siparisi',
    body: `Size siparis atandi${order?.orderNo ? ` (#${order.orderNo})` : ''}.`,
    channelId: 'penpos-alerts',
    data: {
      type: 'courier_assignment',
      orderId: String(order?._id || order?.id || ''),
      orderNo: String(order?.orderNo || ''),
      targetPath: '/kermes/app/package-courier'
    }
  })
}

export const notifyOnlineOrderUsers = async ({ tenantId, branchId = '', order = null } = {}) => {
  if (!tenantId || !order) return { sent: 0, skipped: 'missing_data' }

  const users = await User.find({
    tenantId,
    isDeleted: { $ne: true },
    isActive: true,
    $or: [
      { role: 'tenant_admin' },
      {
        permissions: {
          $in: [
            'manage_delivery',
            'package_orders_view',
            'package_courier_page_view',
            'package_assign_courier'
          ]
        }
      }
    ]
  }).select('_id role branchId branchIds accessibleBranchIds pushDevices')

  const visibleUsers = users.filter((user) => {
    if (String(user?.role || '') === 'tenant_admin') return true
    const allowed = getUserAccessibleBranchIds(user)
    if (allowed.length === 0) return true
    return allowed.includes(String(branchId))
  })

  return sendPushToUsers(visibleUsers, {
    title: 'Yeni Online Siparis',
    body: order?.orderNo
      ? `Onay bekleyen yeni online siparis var (#${order.orderNo}).`
      : 'Onay bekleyen yeni online siparis var.',
    channelId: 'penpos-alerts',
    data: {
      type: 'online_order',
      orderId: String(order?._id || order?.id || ''),
      orderNo: String(order?.orderNo || ''),
      branchId: String(branchId || order?.branchId || ''),
      targetPath: '/kermes/app/package-courier'
    }
  })
}
