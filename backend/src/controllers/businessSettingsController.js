import { getBusinessSettings, listBusinessBranches, updateBusinessSettings } from '../services/businessSettingsService.js'

export const getSettings = async (req, res) => {
  const data = await getBusinessSettings(req.user.tenantId)
  res.json({ success: true, ...data })
}

export const updateSettings = async (req, res) => {
  const data = await updateBusinessSettings(req.user.tenantId, req.body || {}, req.user.id)
  res.json({ success: true, ...data })
}

export const getBranches = async (req, res) => {
  const branches = await listBusinessBranches(req.user.tenantId)
  res.json({ success: true, branches })
}
