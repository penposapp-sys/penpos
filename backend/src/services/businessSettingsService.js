import fs from 'fs/promises'
import path from 'path'
import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import TenantWebsiteSettings from '../models/TenantWebsiteSettings.js'
import Branch from '../models/Branch.js'
import { error } from '../utils/errors.js'
import { buildIncomingBusinessSettings, mergeBusinessSettings } from '../utils/businessSettings.js'
import { resolveUploadDir } from '../utils/uploads.js'
import { listTablesService } from './tableService.js'
import {
  normalizeTenantWebsiteSlug,
  syncTenantWebsiteSlugForBusinessName
} from './tenantWebsiteService.js'

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

const dedupeIds = (input) => Array.from(new Set((Array.isArray(input) ? input : []).map((value) => String(value || '').trim()).filter(Boolean)))

const pickDefaultBranchIds = (activeBranches = [], allBranches = []) => {
  const activeIds = dedupeIds(activeBranches.map((branch) => branch.id || branch._id))
  if (activeIds.length > 0) return activeIds
  return dedupeIds(allBranches.map((branch) => branch.id || branch._id))
}

const syncTenantPublicSlug = async (tenant, businessName) => {
  const desiredSlug = normalizeTenantWebsiteSlug(businessName)
  const [tenantConflict, websiteConflict] = await Promise.all([
    Tenant.findOne({
      _id: { $ne: tenant._id },
      $or: [{ slug: desiredSlug }, { publicSlug: desiredSlug }]
    }).select('_id').lean(),
    TenantWebsiteSettings.findOne({
      tenantId: { $ne: tenant._id },
      $or: [{ slug: desiredSlug }, { legacySlugs: desiredSlug }]
    }).select('_id').lean()
  ])
  const nextSlug = tenantConflict || websiteConflict
    ? normalizeTenantWebsiteSlug(tenant.slug)
    : desiredSlug
  if (tenant.publicSlug !== nextSlug) {
    tenant.publicSlug = nextSlug
    await tenant.save()
  }
  return nextSlug
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

export const listBusinessQrTables = async (tenantId) => {
  const tables = await listTablesService(tenantId, null)
  return tables
    .filter((table) => table?.isActive !== false)
    .map((table) => ({
      id: String(table.id || ''),
      name: String(table.name || ''),
      branchId: table?.branchId ? String(table.branchId) : '',
    }))
}

export const getBusinessSettings = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  const currentBusinessName = String(tenant.settings?.business?.businessName || tenant.name || '').trim()
  const currentPublicSlug = await syncTenantPublicSlug(tenant, currentBusinessName)

  const [activeBranches, allBranches] = await Promise.all([
    listBusinessBranches(tenantId),
    Branch.find({ tenantId, isDeleted: { $ne: true }, status: { $ne: 'deleted' } }).sort({ name: 1 }).lean(),
  ])
  await syncTenantWebsiteSlugForBusinessName(tenant)

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
      publicSlug: currentPublicSlug,
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
  const previousTenantName = String(tenant.name || '').trim()
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
  await syncTenantPublicSlug(tenant,
    mergedSettings.business.businessName || nextTenantName || tenant.name
  )
  tenant.description = nextDescription
  tenant.settings = {
    ...(tenant.settings || {}),
    ...mergedSettings,
  }
  tenant.allowedBranchIds = mergedSettings.authorizedBranches.branchIds
  await tenant.save()

  const nextAutoSlug = normalizeTenantWebsiteSlug(nextTenantName)
  if (previousTenantName && nextTenantName && previousTenantName !== nextTenantName && payload?.name !== undefined) {
    const currentWebsite = await TenantWebsiteSettings.findOne({ tenantId: tenant._id })
      .select('slug seo.title storeVariant.seo.title')
      .lean()
    const update = { $set: {} }
    const websiteSlug = String(currentWebsite?.slug || '').trim()
    const currentTenantSlug = String(tenant.slug || '').trim()
    const previousAutoSlug = normalizeTenantWebsiteSlug(previousTenantName)
    const websiteSlugFollowsName = normalizeTenantWebsiteSlug(websiteSlug) === normalizeTenantWebsiteSlug(currentTenantSlug)
      || normalizeTenantWebsiteSlug(websiteSlug) === previousAutoSlug

    if (String(currentWebsite?.seo?.title || '').trim() === previousTenantName) {
      update.$set['seo.title'] = nextTenantName
    }
    if (String(currentWebsite?.storeVariant?.seo?.title || '').trim() === previousTenantName) {
      update.$set['storeVariant.seo.title'] = nextTenantName
    }

    if (websiteSlugFollowsName && nextAutoSlug !== previousAutoSlug) {
      const slugConflict = await Tenant.findOne({
        _id: { $ne: tenant._id },
        $or: [{ slug: nextAutoSlug }, { publicSlug: nextAutoSlug }]
      }).select('_id').lean()
      const websiteSlugConflict = await TenantWebsiteSettings.findOne({
        tenantId: { $ne: tenant._id },
        $or: [{ slug: nextAutoSlug }, { legacySlugs: nextAutoSlug }]
      }).select('_id').lean()
      if (!slugConflict && !websiteSlugConflict) {
        if (currentWebsite && websiteSlug !== nextAutoSlug) {
          update.$set.slug = nextAutoSlug
          update.$addToSet = { legacySlugs: normalizeTenantWebsiteSlug(websiteSlug) }
        }
      }
    }

    if (currentWebsite && Object.keys(update.$set).length > 0) {
      await TenantWebsiteSettings.updateOne({ tenantId: tenant._id, slug: websiteSlug }, update)
    }
  }

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
  const dir = resolveUploadDir(`tenant-${tenantId}`)
  await Promise.all(['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp'].map(async (fileName) => {
    try {
      await fs.unlink(path.join(dir, fileName))
    } catch {}
  }))
}
