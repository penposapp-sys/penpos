import fs from 'fs/promises'
import path from 'path'
import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import Branch from '../models/Branch.js'
import { error } from '../utils/errors.js'
import { buildIncomingBusinessSettings, mergeBusinessSettings } from '../utils/businessSettings.js'

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

const dedupeIds = (input) => Array.from(new Set((Array.isArray(input) ? input : []).map((value) => String(value || '').trim()).filter(Boolean)))

const pickDefaultBranchIds = (activeBranches = [], allBranches = []) => {
  const activeIds = dedupeIds(activeBranches.map((branch) => branch.id || branch._id))
  if (activeIds.length > 0) return activeIds
  return dedupeIds(allBranches.map((branch) => branch.id || branch._id))
}

const normalizeLogoMeta = (tenant, settings) => {
  const currentLogo = isPlainObject(settings?.logo) ? settings.logo : {}
  const url = String(currentLogo.url || tenant?.logoUrl || '').trim()
  return {
    ...currentLogo,
    url,
    fileName: String(currentLogo.fileName || (url ? path.basename(url) : '')).trim(),
    mimeType: String(currentLogo.mimeType || '').trim(),
    size: Number(currentLogo.size || 0) || 0,
  }
}

const toBranchDto = (branch) => ({
  id: String(branch.id || branch._id),
  _id: String(branch.id || branch._id),
  name: branch.name,
  description: branch.description || '',
  address: branch.address || '',
  isActive: branch.isActive !== false,
  active: branch.active !== false,
  status: branch.status || (branch.isActive === false ? 'inactive' : 'active'),
})

export const listBusinessBranches = async (tenantId) => {
  const branches = await Branch.find({
    tenantId,
    isDeleted: { $ne: true },
    status: { $ne: 'deleted' },
    isActive: true,
  }).sort({ name: 1 }).lean()

  return branches.map(toBranchDto)
}

export const getBusinessSettings = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).lean()
  if (!tenant) throw error('not_found', 'Tenant not found', 404)

  const [activeBranches, allBranches] = await Promise.all([
    listBusinessBranches(tenantId),
    Branch.find({ tenantId, isDeleted: { $ne: true }, status: { $ne: 'deleted' } }).sort({ name: 1 }).lean(),
  ])

  const fallbackBranchIds = pickDefaultBranchIds(activeBranches, allBranches)
  const mergedSettings = mergeBusinessSettings({
    ...(tenant.settings || {}),
    logo: normalizeLogoMeta(tenant, tenant.settings || {}),
  }, { activeBranchIds: fallbackBranchIds })
  if (!String(mergedSettings.business.businessName || '').trim()) {
    mergedSettings.business.businessName = String(tenant.name || '').trim()
  }

  if (!Array.isArray(mergedSettings.authorizedBranches?.branchIds) || mergedSettings.authorizedBranches.branchIds.length === 0) {
    mergedSettings.authorizedBranches.branchIds = fallbackBranchIds
    mergedSettings.allowedBranchIds = fallbackBranchIds
  }

  return {
    tenant: {
      _id: String(tenant._id),
      id: String(tenant._id),
      name: tenant.name || '',
      description: tenant.description || '',
      logoUrl: tenant.logoUrl || '',
      allowedBranchIds: mergedSettings.authorizedBranches.branchIds,
    },
    settings: mergedSettings,
    branches: activeBranches,
  }
}

export const updateBusinessSettings = async (tenantId, payload = {}, actorUserId = null) => {
  const tenant = await Tenant.findById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)

  const incoming = buildIncomingBusinessSettings(payload)
  const nextTenantName = String(payload?.name ?? tenant.name ?? '').trim()
  const nextDescription = String(payload?.description ?? tenant.description ?? '').trim()
  const allBranches = await Branch.find({ tenantId, isDeleted: { $ne: true }, status: { $ne: 'deleted' } }).select('_id isActive').lean()
  const fallbackBranchIds = pickDefaultBranchIds(
    allBranches.filter((branch) => branch.isActive !== false),
    allBranches
  )

  const branchIdsCandidate = dedupeIds(
    incoming?.authorizedBranches?.branchIds,
    fallbackBranchIds
  )
  if (isPlainObject(incoming.authorizedBranches)) {
    if (branchIdsCandidate.length === 0) {
      throw error('invalid_request', 'En az bir şube seçmelisiniz', 400)
    }
    const validIds = new Set(allBranches.map((branch) => String(branch._id)))
    const invalidIds = branchIdsCandidate.filter((id) => !validIds.has(String(id)))
    if (invalidIds.length > 0) {
      throw error('invalid_branch', 'Invalid branch', 400)
    }
    incoming.authorizedBranches = { ...incoming.authorizedBranches, branchIds: branchIdsCandidate }
  }

  const mergedSettings = mergeBusinessSettings({
    ...(tenant.settings || {}),
    ...incoming,
    business: {
      ...(tenant.settings?.business || {}),
      ...(incoming.business || {}),
      businessName: String(incoming?.business?.businessName ?? nextTenantName).trim(),
    },
    logo: normalizeLogoMeta(tenant, {
      ...(tenant.settings || {}),
      ...(incoming || {}),
    }),
  }, { activeBranchIds: fallbackBranchIds })

  tenant.name = nextTenantName || tenant.name
  tenant.description = nextDescription
  tenant.settings = {
    ...(tenant.settings || {}),
    ...mergedSettings,
  }
  tenant.allowedBranchIds = mergedSettings.authorizedBranches.branchIds
  await tenant.save()

  await (await import('./auditService.js')).log(tenantId, actorUserId || tenantId, 'tenant_business_settings_update', 'Tenant', tenant.id, {})

  return getBusinessSettings(tenantId)
}

export const syncTenantLogoSettings = async (tenantId, { url = '', fileName = '', mimeType = '', size = 0 } = {}) => {
  const tenant = await Tenant.findById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)

  const nextSettings = mergeBusinessSettings({
    ...(tenant.settings || {}),
    logo: {
      url: String(url || '').trim(),
      fileName: String(fileName || '').trim(),
      mimeType: String(mimeType || '').trim(),
      size: Number(size || 0) || 0,
    },
  })

  tenant.logoUrl = String(url || '').trim()
  tenant.settings = {
    ...(tenant.settings || {}),
    ...nextSettings,
  }
  await tenant.save()
  return nextSettings.logo
}

export const removeTenantLogoFiles = async (tenantId) => {
  const dir = path.join(process.cwd(), 'uploads', `tenant-${tenantId}`)
  await Promise.all(['logo.png', 'logo.jpg', 'logo.webp'].map(async (fileName) => {
    try {
      await fs.unlink(path.join(dir, fileName))
    } catch {}
  }))
}
