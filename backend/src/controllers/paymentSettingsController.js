import { sendError } from '../utils/errors.js'
import {
  createPaymentMethodService,
  deletePaymentMethodService,
  getPaymentMethodsService,
  patchPaymentMethodService,
  updatePaymentMethodsService,
} from '../services/paymentSettingsService.js'

const parseIncludeDeleted = (value) => ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase())

const applyNoStore = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export const getSettings = async (req, res) => {
  try {
    applyNoStore(res)
    const result = await getPaymentMethodsService(req.user.tenantId, {
      includeDeleted: parseIncludeDeleted(req.query?.includeDeleted),
    })
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const updateSettings = async (req, res) => {
  try {
    applyNoStore(res)
    const methods = req.body?.paymentMethods || req.body?.methods || []
    const result = await updatePaymentMethodsService(req.user.tenantId, methods, req.user?.id || null)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const createPaymentMethod = async (req, res) => {
  try {
    applyNoStore(res)
    const result = await createPaymentMethodService(req.user.tenantId, req.body?.name, req.user?.id || null)
    res.status(201).json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const patchPaymentMethod = async (req, res) => {
  try {
    applyNoStore(res)
    const result = await patchPaymentMethodService(req.user.tenantId, req.params.id, req.body || {}, req.user?.id || null)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const deletePaymentMethod = async (req, res) => {
  try {
    applyNoStore(res)
    const result = await deletePaymentMethodService(req.user.tenantId, req.params.id, req.user?.id || null)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}
