import { sendError } from '../utils/errors.js'
import { getWebsiteSettingsService, updateWebsiteSettingsService } from '../services/websiteSettingsService.js'

export const getPublicWebsiteSettings = async (_req, res) => {
  try {
    const settings = await getWebsiteSettingsService()
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const getPlatformWebsiteSettings = async (_req, res) => {
  try {
    const settings = await getWebsiteSettingsService()
    res.json({ success: true, settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updatePlatformWebsiteSettings = async (req, res) => {
  try {
    const settings = await updateWebsiteSettingsService(req.body || {})
    res.json({ success: true, settings, message: 'Website settings updated' })
  } catch (err) {
    sendError(res, err)
  }
}
