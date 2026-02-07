import mongoose from 'mongoose'
import UserPreferences from '../models/UserPreferences.js'
import { sendError, error } from '../utils/errors.js'

const normalizeScope = (v) => {
  const s = String(v || '').trim()
  if (s === 'kitchen_normal' || s === 'kitchen_bulk') return s
  return null
}

export const getKitchenFilters = async (req, res) => {
  try {
    const scope = normalizeScope(req.query?.scope)
    if (!scope) throw error('invalid_request', 'Invalid scope', 400)

    const doc = await UserPreferences.findOne({ tenantId: req.user.tenantId, userId: req.user.id }).lean()
    const hidden = (doc?.kitchenFilters?.[scope]?.hiddenMenuItemIds || []).map(String).filter(Boolean)

    res.json({
      success: true,
      scope,
      hiddenMenuItemIds: hidden
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const putKitchenFilters = async (req, res) => {
  try {
    const scope = normalizeScope(req.body?.scope || req.query?.scope)
    if (!scope) throw error('invalid_request', 'Invalid scope', 400)

    const incoming = Array.isArray(req.body?.hiddenMenuItemIds) ? req.body.hiddenMenuItemIds : []
    const filtered = incoming
      .map(x => String(x || '').trim())
      .filter(x => mongoose.Types.ObjectId.isValid(x))
      .slice(0, 5000)
      .map(x => new mongoose.Types.ObjectId(x))

    const path = `kitchenFilters.${scope}.hiddenMenuItemIds`
    const updated = await UserPreferences.findOneAndUpdate(
      { tenantId: req.user.tenantId, userId: req.user.id },
      {
        $set: {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          [path]: filtered
        }
      },
      { upsert: true, new: true }
    ).lean()

    const hidden = (updated?.kitchenFilters?.[scope]?.hiddenMenuItemIds || []).map(String).filter(Boolean)
    res.json({ success: true, scope, hiddenMenuItemIds: hidden })
  } catch (err) {
    sendError(res, err)
  }
}

