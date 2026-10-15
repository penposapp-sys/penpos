import { error, sendError } from '../utils/errors.js'
import {
  arriveAndOpenReservation,
  changeReservationStatus,
  createPublicReservation,
  createStaffReservation,
  getBranchDailyAvailability,
  getPendingReservationCount,
  getReservationAvailability,
  getReservationNotifications,
  getReservationSettings,
  listReservations,
  markReservationNotificationsRead,
  updateReservation,
  updateReservationSettings
} from '../services/reservationService.js'

export const list = async (req, res) => {
  try {
    const result = await listReservations({
      tenantId: req.user.tenantId,
      branchIds: req.branchIds,
      actor: req.user,
      date: req.query?.date,
      status: req.query?.status
    })
    res.json({ success: true, ...result })
  } catch (err) { sendError(res, err) }
}

export const pendingCount = async (req, res) => {
  try {
    res.json({ success: true, ...(await getPendingReservationCount({ tenantId: req.user.tenantId, branchIds: req.branchIds })) })
  } catch (err) { sendError(res, err) }
}

export const create = async (req, res) => {
  try {
    if (!req.branch?.id) throw error('branch_required', 'Şube seçilmelidir.', 400)
    const reservation = await createStaffReservation({
      tenantId: req.user.tenantId,
      branchId: req.branch.id,
      actor: req.user,
      payload: req.body || {}
    })
    res.status(201).json({ success: true, reservation })
  } catch (err) { sendError(res, err) }
}

export const update = async (req, res) => {
  try {
    const reservation = await updateReservation({
      tenantId: req.user.tenantId,
      id: req.params.id,
      branchIds: req.branchIds,
      actor: req.user,
      payload: req.body || {}
    })
    res.json({ success: true, reservation })
  } catch (err) { sendError(res, err) }
}

export const setStatus = async (req, res) => {
  try {
    const reservation = await changeReservationStatus({
      tenantId: req.user.tenantId,
      id: req.params.id,
      branchIds: req.branchIds,
      actor: req.user,
      status: req.body?.status
    })
    res.json({ success: true, reservation })
  } catch (err) { sendError(res, err) }
}

export const arrive = async (req, res) => {
  try {
    const result = await arriveAndOpenReservation({
      tenantId: req.user.tenantId,
      id: req.params.id,
      branchIds: req.branchIds,
      actor: req.user
    })
    res.json({ success: true, ...result })
  } catch (err) { sendError(res, err) }
}

export const settings = async (req, res) => {
  try {
    const result = req.method === 'GET'
      ? await getReservationSettings({ tenantId: req.user.tenantId, branchId: req.branch?.id || req.branchIds?.[0], actor: req.user })
      : await updateReservationSettings({ tenantId: req.user.tenantId, branchId: req.branch?.id || req.branchIds?.[0], actor: req.user, input: req.body || {} })
    res.json({ success: true, ...result })
  } catch (err) { sendError(res, err) }
}

export const branchAvailability = async (req, res) => {
  try {
    const result = await getBranchDailyAvailability({
      tenantId: req.user.tenantId,
      branchId: req.branch?.id || req.branchIds?.[0],
      actor: req.user,
      date: req.query?.date,
      guestCount: Number(req.query?.guestCount || 1)
    })
    res.json({ success: true, slots: result.slots })
  } catch (err) { sendError(res, err) }
}

export const notifications = async (req, res) => {
  try {
    const items = await getReservationNotifications({
      tenantId: req.user.tenantId,
      branchIds: req.branchIds,
      userId: req.user.id
    })
    res.json({ success: true, notifications: items })
  } catch (err) { sendError(res, err) }
}

export const readNotifications = async (req, res) => {
  try {
    const result = await markReservationNotificationsRead({
      tenantId: req.user.tenantId,
      branchIds: req.branchIds,
      userId: req.user.id,
      notificationId: req.params.id || ''
    })
    res.json({ success: true, ...result })
  } catch (err) { sendError(res, err) }
}

export const publicAvailability = async (req, res) => {
  try {
    const result = await getReservationAvailability({
      slug: req.params.slug,
      date: req.query?.date,
      guestCount: req.query?.guestCount
    })
    res.set('Cache-Control', 'no-store')
    res.json({ success: true, ...result })
  } catch (err) { sendError(res, err) }
}

export const publicCreate = async (req, res) => {
  try {
    const result = await createPublicReservation({ slug: req.params.slug, payload: req.body || {} })
    res.status(201).set('Cache-Control', 'no-store').json({ success: true, ...result })
  } catch (err) { sendError(res, err) }
}
