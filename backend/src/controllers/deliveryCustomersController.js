import { sendError } from '../utils/errors.js'
import {
  searchDeliveryCustomersService,
  listDeliveryCustomersService,
  getDeliveryCustomerDetailService
} from '../services/deliveryCustomerService.js'

export const searchDeliveryCustomers = async (req, res) => {
  try {
    const q = String(req.query?.q || '').trim()
    const result = await searchDeliveryCustomersService(req.user.tenantId, q, req.query?.limit)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const listDeliveryCustomers = async (req, res) => {
  try {
    const q = String(req.query?.q || '').trim()
    const result = await listDeliveryCustomersService(req.user.tenantId, {
      query: q,
      page: req.query?.page,
      limit: req.query?.limit
    })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const getDeliveryCustomerDetail = async (req, res) => {
  try {
    const result = await getDeliveryCustomerDetailService(req.user.tenantId, req.params.id, { orderLimit: req.query?.orderLimit })
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
