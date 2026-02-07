import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenSessionService.js'

export const getSession = async (req, res) => {
  try {
    const session = await service.getSession(req.user)
    res.json({ success: true, ...session })
  } catch (err) {
    sendError(res, err)
  }
}

export const setBranch = async (req, res) => {
  try {
    const result = await service.setActiveBranch(req.user, req.body || {})
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

