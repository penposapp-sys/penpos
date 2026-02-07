import { api } from '../../lib/apiClient.js'

export const deleteCustomerPayment = async (customerId, paymentId, reason) => {
  const cid = String(customerId || '').trim()
  const pid = String(paymentId || '').trim()
  return api(`/api/canteen/customers/${encodeURIComponent(cid)}/payments/${encodeURIComponent(pid)}`, {
    method: 'DELETE',
    data: { reason: String(reason || '').trim() },
    silent: true
  })
}

export const getCustomerMovements = async (customerId) => {
  const cid = String(customerId || '').trim()
  return api(`/api/canteen/customers/${encodeURIComponent(cid)}/movements`, { silent: true })
}

export const getStockCounts = async (branchId, params = {}) => {
  const bid = String(branchId || '').trim()
  const q = new URLSearchParams()
  if (params.limit) q.set('limit', String(params.limit))
  if (params.page) q.set('page', String(params.page))
  if (params.from) q.set('from', String(params.from))
  if (params.to) q.set('to', String(params.to))
  const qs = q.toString()
  return api(`/api/canteen/stock-counts${qs ? `?${qs}` : ''}`, { silent: true, headers: { 'x-branch-id': bid } })
}

export const getStockCountDetail = async (branchId, id) => {
  const bid = String(branchId || '').trim()
  const sid = String(id || '').trim()
  return api(`/api/canteen/stock-counts/${encodeURIComponent(sid)}`, { silent: true, headers: { 'x-branch-id': bid } })
}
