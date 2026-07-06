import { sendError } from '../utils/errors.js'
import { listWaiterCalls, resolveWaiterCall, resolveWaiterCallsByTable } from '../services/waiterCallService.js'

export const list = async (req, res) => {
  try {
    const status = String(req.query?.status || 'open').trim() || 'open'
    const calls = await listWaiterCalls(req.user.tenantId, { status })
    res.json({ success: true, calls })
  } catch (err) {
    sendError(res, err)
  }
}

export const resolve = async (req, res) => {
  try {
    const call = await resolveWaiterCall(req.user.tenantId, req.params.id, req.user.id)
    res.json({ success: true, call })
  } catch (err) {
    sendError(res, err)
  }
}

export const resolveByTable = async (req, res) => {
  try {
    const result = await resolveWaiterCallsByTable(req.user.tenantId, req.params.tableId, req.user.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
