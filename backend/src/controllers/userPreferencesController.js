import mongoose from 'mongoose'
import UserPreferences from '../models/UserPreferences.js'
import AccountAppearancePreference from '../models/AccountAppearancePreference.js'
import { sendError, error } from '../utils/errors.js'

const DEFAULT_APPEARANCE = { themeKey: 'white', darkMode: false, fontSize: null }

export const getAppearancePreferences = async (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim()
    if (!mongoose.Types.ObjectId.isValid(userId)) throw error('unauthorized', 'Oturum kullanıcısı geçersiz', 401)

    const preference = await AccountAppearancePreference.findOne({ userId }).select('themeKey darkMode fontSize').lean()
    res.json({
      success: true,
      preferences: preference
        ? { themeKey: preference.themeKey, darkMode: preference.darkMode, fontSize: preference.fontSize }
        : DEFAULT_APPEARANCE
    })
  } catch (err) {
    sendError(res, err)
  }
}

export const putAppearancePreferences = async (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim()
    if (!mongoose.Types.ObjectId.isValid(userId)) throw error('unauthorized', 'Oturum kullanıcısı geçersiz', 401)

    const { themeKey, darkMode, fontSize } = req.body || {}
    if (themeKey !== 'white') throw error('invalid_theme', 'Geçersiz görünüm teması', 400)
    if (typeof darkMode !== 'boolean') throw error('invalid_dark_mode', 'Koyu mod tercihi geçersiz', 400)
    if (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 24) {
      throw error('invalid_font_size', 'Yazı boyutu 8 ile 24 piksel arasında olmalıdır', 400)
    }

    const preference = await AccountAppearancePreference.findOneAndUpdate(
      { userId },
      { $set: { userId, themeKey, darkMode, fontSize } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).select('themeKey darkMode fontSize').lean()

    res.json({
      success: true,
      preferences: { themeKey: preference.themeKey, darkMode: preference.darkMode, fontSize: preference.fontSize }
    })
  } catch (err) {
    sendError(res, err)
  }
}

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
