import { sendError } from '../utils/errors.js'
import {
  getTenantWebsiteSettingsService,
  updateTenantWebsiteSettingsService,
  publishTenantWebsiteService,
  unpublishTenantWebsiteService,
  getPublicTenantWebsiteBySlugService,
  getPublicWebsiteByHostService
} from '../services/tenantWebsiteService.js'

export const getTenantWebsiteSettings = async (req, res) => {
  try {
    const result = await getTenantWebsiteSettingsService(req.user.tenantId, req.query?.siteType || '')
    res.json({ success: true, tenant: result.tenant, settings: result.settings })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateTenantWebsiteSettings = async (req, res) => {
  try {
    const result = await updateTenantWebsiteSettingsService({
      tenantId: req.user.tenantId,
      actorUserId: req.user.id,
      payload: req.body || {},
      siteType: req.query?.siteType || ''
    })
    res.json({ success: true, tenant: result.tenant, settings: result.settings, message: 'Website settings updated' })
  } catch (err) {
    sendError(res, err)
  }
}

export const publishTenantWebsite = async (req, res) => {
  try {
    const result = await publishTenantWebsiteService({
      tenantId: req.user.tenantId,
      actorUserId: req.user.id,
      siteType: req.query?.siteType || ''
    })
    res.json({ success: true, tenant: result.tenant, settings: result.settings, message: 'Website published' })
  } catch (err) {
    sendError(res, err)
  }
}

export const unpublishTenantWebsite = async (req, res) => {
  try {
    const result = await unpublishTenantWebsiteService({
      tenantId: req.user.tenantId,
      actorUserId: req.user.id,
      siteType: req.query?.siteType || ''
    })
    res.json({ success: true, tenant: result.tenant, settings: result.settings, message: 'Website unpublished' })
  } catch (err) {
    sendError(res, err)
  }
}

export const getPublicTenantWebsite = async (req, res) => {
  try {
    const result = await getPublicTenantWebsiteBySlugService(req.params.slug, req.query?.siteType || '')
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const getPublicWebsiteByHost = async (req, res) => {
  try {
    const result = await getPublicWebsiteByHostService(req.query?.host || req.get('host') || '')
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
