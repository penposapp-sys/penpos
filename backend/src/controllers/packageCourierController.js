import { sendError, error } from '../utils/errors.js'
import {
  approveOnlinePackageOrderService,
  approveOnlineCancelRequestService,
  assignCourierService,
  countPendingOnlineOrdersService,
  collectPackageOrderPaymentService,
  getPackageOrderDetailService,
  getCourierReportService,
  listCouriersService,
  listPackageOrdersService,
  updatePackageOrderPaymentStatusService,
  updatePackageOrderStatusService
} from '../services/packageCourierService.js'

export const listPackageOrders = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) throw error('missing_tenant', 'Tenant gerekli', 403)
    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    const result = await listPackageOrdersService(tenantId, req.user, branchIds, {
      date: req.query.date,
      status: req.query.status,
      paymentStatus: req.query.paymentStatus,
      courierId: req.query.courierId,
      branchId: req.query.branchId,
      search: req.query.search
    })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const assignCourier = async (req, res) => {
  try {
    const result = await assignCourierService(req.user.tenantId, req.user, req.params.id, req.body?.courierId)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const approveOnlinePackageOrder = async (req, res) => {
  try {
    const result = await approveOnlinePackageOrderService(req.user.tenantId, req.user, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const approveOnlineCancelRequest = async (req, res) => {
  try {
    const result = await approveOnlineCancelRequestService(req.user.tenantId, req.user, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const getPackageOrderDetail = async (req, res) => {
  try {
    const result = await getPackageOrderDetailService(req.user.tenantId, req.user, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const updatePackageStatus = async (req, res) => {
  try {
    const result = await updatePackageOrderStatusService(req.user.tenantId, req.user, req.params.id, req.body?.deliveryStatus, req.body?.note)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const updatePackagePaymentStatus = async (req, res) => {
  try {
    const result = await updatePackageOrderPaymentStatusService(req.user.tenantId, req.user, req.params.id, req.body?.deliveryPaymentStatus)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const collectPackageOrderPayment = async (req, res) => {
  try {
    const result = await collectPackageOrderPaymentService(req.user.tenantId, req.user, req.params.id, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const listCouriers = async (req, res) => {
  try {
    const couriers = await listCouriersService(req.user.tenantId)
    res.json({ success: true, couriers })
  } catch (err) {
    sendError(res, err)
  }
}

export const getPendingOnlineOrdersCount = async (req, res) => {
  try {
    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    const result = await countPendingOnlineOrdersService(req.user.tenantId, branchIds)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const courierReport = async (req, res) => {
  try {
    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    const result = await getCourierReportService(req.user.tenantId, branchIds, {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      courierId: req.query.courierId,
      branchId: req.query.branchId
    })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
