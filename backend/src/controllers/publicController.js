import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'
import Table from '../models/Table.js'
import Branch from '../models/Branch.js'
import { mergeBusinessSettings } from '../utils/businessSettings.js'
import { notDeletedFilter } from '../utils/softDelete.js'
import { createWaiterCall } from '../services/waiterCallService.js'
import CanteenTenantSettings from '../modules/canteen/models/CanteenTenantSettings.js'
import CanteenBranch from '../modules/canteen/models/CanteenBranch.js'
import CanteenCategory from '../modules/canteen/models/CanteenCategory.js'
import CanteenProduct from '../modules/canteen/models/CanteenProduct.js'
import { createPublicQrOrder } from '../modules/canteen/services/canteenQrOrderService.js'
import { listPublicQrOrdersByCustomer } from '../modules/canteen/services/canteenQrOrderService.js'
import { createPublicOnlineOrderService } from '../services/orderService.js'
import {
  getCustomer,
  getCustomerFavoriteProductIds,
  loginPublicCustomerAccount,
  listCustomerMovements,
  listCustomerSales,
  registerPublicCustomerAccount,
  updatePublicCustomerAccount,
  updateCustomerFavoriteProductIds,
  upsertPublicCustomerAccount
} from '../modules/canteen/services/canteenCustomerService.js'
import {
  getPublicOnlineCustomerProfile,
  loginPublicOnlineCustomerAccount,
  requestPublicOnlineOrderCancellation,
  registerPublicOnlineCustomerAccount,
  updatePublicOnlineCustomerProfile,
  upsertPublicOnlineCustomerAccount
} from '../services/publicOnlineCustomerService.js'

const buildBaseUrl = (req) => {
  const envBase = String(process.env.BASE_URL || '').trim()
  if (envBase) return envBase.replace(/\/+$/, '')
  try {
    const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const xfHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
    const proto = xfProto || String(req.protocol || 'http')
    const host = xfHost || String(req.get('host') || '')
    if (!host) return ''
    return `${proto}://${host}`
  } catch {
    return ''
  }
}

const getPrintAgentVersion = () => {
  const envVersion = String(process.env.PRINT_AGENT_WINDOWS_VERSION || '').trim()
  if (envVersion) return envVersion
  try {
    const packageJsonPath = path.join(process.cwd(), 'print-agent', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return String(packageJson?.version || '0.1.0').trim() || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

const UNCATEGORIZED_CATEGORY = {
  id: 'uncategorized',
  name: 'Diğer Ürünler',
  description: '',
  imageUrl: '',
  sortOrder: 9999
}

const withAssetVersion = (url, versionSource) => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const version = versionSource ? new Date(versionSource).getTime() : 0
  if (!version) return raw
  return `${raw}${raw.includes('?') ? '&' : '?'}v=${version}`
}

const toAbsoluteAssetUrl = (req, url, versionSource) => {
  const versioned = withAssetVersion(url, versionSource)
  if (!versioned) return ''
  const normalized = versioned.startsWith('/uploads/')
    ? `/api${versioned}`
    : versioned
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('//')) return normalized
  const base = buildBaseUrl(req)
  if (!base) return normalized
  return `${base}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
}

const normalizeCanteenBranchQueryKey = (value) =>
  String(value || '').trim().toLocaleLowerCase('tr-TR')

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100

const computeCanteenSalePrice = (price, vatRate, vatIncluded) => {
  const basePrice = Number(price || 0)
  const rate = Number(vatRate || 0)
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0
  if (vatIncluded === false && Number.isFinite(rate) && rate > 0) {
    return roundMoney(basePrice * (1 + (rate / 100)))
  }
  return roundMoney(basePrice)
}

const resolvePrintAgentWindowsBinary = () => {
  const envPath = String(process.env.PRINT_AGENT_WINDOWS_FILE || '').trim()
  const version = getPrintAgentVersion()
  const exeFileName = String(process.env.PRINT_AGENT_WINDOWS_FILENAME || 'PenPOS_PrintAgent.exe').trim() || 'PenPOS_PrintAgent.exe'
  const setupFileName = `PenPOS_PrintAgent_Setup_${version}.exe`
  const candidates = [
    envPath,
    path.join(process.cwd(), 'backend', 'public', 'downloads', 'print-agent', 'windows', exeFileName),
    path.join(process.cwd(), 'public', 'downloads', 'print-agent', 'windows', exeFileName),
    path.join(process.cwd(), 'backend', 'public', 'downloads', setupFileName),
    path.join(process.cwd(), 'public', 'downloads', setupFileName)
  ].filter(Boolean)

  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate)
    } catch {
      return false
    }
  })

  let publishedAt = null
  if (existing) {
    try {
      publishedAt = fs.statSync(existing).mtime.toISOString()
    } catch {
      publishedAt = null
    }
  }

  return {
    version,
    fileName: existing ? path.basename(existing) : exeFileName,
    filePath: existing || '',
    publishedAt
  }
}

export const getPublicMenu = async (req, res) => {
  const tenantSlug = String(req.query?.tenantSlug || '').trim()
  const tenantIdRaw = String(req.query?.tenantId || '').trim()
  const requestedTableId = String(req.query?.tableId || '').trim()
  const requestedTableName = String(req.query?.table || req.query?.tableName || '').trim()

  const tenant = tenantSlug
    ? await Tenant.findOne({ slug: tenantSlug, isActive: true, status: 'active' }).lean()
    : (mongoose.Types.ObjectId.isValid(tenantIdRaw)
      ? await Tenant.findOne({ _id: tenantIdRaw, isActive: true, status: 'active' }).lean()
      : null)

  if (!tenant) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  const mergedSettings = mergeBusinessSettings(tenant?.settings || {})
  if (mergedSettings.qrMenu.enabled === false) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  const [categories, items] = await Promise.all([
    Category.find(notDeletedFilter({ tenantId: tenant._id, isActive: true, qrMenuVisible: { $ne: false } })).sort({ sortOrder: 1, name: 1 }).lean(),
    MenuItem.find(notDeletedFilter({ tenantId: tenant._id, isActive: true })).sort({ sortOrder: 1, name: 1 }).lean()
  ])

  const visibleCategoryIds = new Set((categories || []).map((category) => String(category._id)))
  const visibleItems = (items || []).filter((item) => {
    if (!visibleCategoryIds.has(String(item?.categoryId || ''))) return false
    const itemSettings = item?.settings && typeof item.settings === 'object' && !Array.isArray(item.settings)
      ? item.settings
      : {}
    return itemSettings.qrMenuVisible !== false
  })

  let selectedTable = null
  let availableTables = []
  if (mergedSettings.qrMenu?.tableQrEnabled === true) {
    const activeBranches = await Branch.find({
      tenantId: tenant._id,
      isActive: true,
      isDeleted: { $ne: true },
      status: { $ne: 'deleted' }
    }).select('_id').lean()
    const activeBranchIds = activeBranches.map((branch) => branch._id).filter(Boolean)
    const tables = activeBranchIds.length > 0
      ? await Table.find({ tenantId: tenant._id, branchId: { $in: activeBranchIds }, isActive: true }).select('_id name').sort({ name: 1 }).lean()
      : []
    availableTables = tables.map((table) => ({
      id: String(table._id),
      name: String(table.name || ''),
    }))
    if (requestedTableId && mongoose.Types.ObjectId.isValid(requestedTableId)) {
      const table = activeBranchIds.length > 0
        ? await Table.findOne({ _id: requestedTableId, tenantId: tenant._id, branchId: { $in: activeBranchIds }, isActive: true }).select('_id name').lean()
        : null
      if (table) {
        selectedTable = {
          id: String(table._id),
          name: String(table.name || ''),
        }
      }
    } else if (requestedTableName) {
      selectedTable = {
        id: '',
        name: requestedTableName,
      }
    }
  }

  return res.json({
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: toAbsoluteAssetUrl(req, tenant.logoUrl, tenant.updatedAt),
      settings: {
        qrMenu: mergedSettings.qrMenu,
      },
    },
    table: selectedTable,
    availableTables,
    categories: (categories || []).map(c => ({ id: String(c._id), name: c.name, sortOrder: Number(c.sortOrder || 0) })),
    items: visibleItems.map(i => ({
      id: String(i._id),
      categoryId: String(i.categoryId),
      name: i.name,
      price: Number(i.price || 0),
      description: String(i.description || ''),
      imageUrl: String(i.imageUrl || ''),
      sortOrder: Number(i.sortOrder || 0)
    }))
  })
}

export const getPublicOnlineStore = async (req, res) => {
  const tenantSlug = String(req.query?.tenantSlug || '').trim()
  const tenantIdRaw = String(req.query?.tenantId || '').trim()
  const requestedBranchId = String(req.query?.branchId || '').trim()

  const tenant = tenantSlug
    ? await Tenant.findOne({ slug: tenantSlug, isActive: true, status: 'active' }).lean()
    : (mongoose.Types.ObjectId.isValid(tenantIdRaw)
      ? await Tenant.findOne({ _id: tenantIdRaw, isActive: true, status: 'active' }).lean()
      : null)

  if (!tenant) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  const mergedSettings = mergeBusinessSettings(tenant?.settings || {})
  if (mergedSettings.onlineSales?.enabled !== true) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  const [categories, items, branches] = await Promise.all([
    Category.find(notDeletedFilter({ tenantId: tenant._id, isActive: true })).sort({ sortOrder: 1, name: 1 }).lean(),
    MenuItem.find(notDeletedFilter({ tenantId: tenant._id, isActive: true })).sort({ sortOrder: 1, name: 1 }).lean(),
    Branch.find({ tenantId: tenant._id, isDeleted: { $ne: true }, isActive: true, status: { $ne: 'deleted' } }).select('_id name').sort({ name: 1 }).lean()
  ])

  const visibleCategoryIds = new Set((categories || []).map((category) => String(category._id)))
  const visibleItems = (items || []).filter((item) => visibleCategoryIds.has(String(item?.categoryId || '')))
  const branchById = new Map((branches || []).map((branch) => [String(branch?._id || ''), String(branch?.name || '')]))
  const fallbackBranchId = String(mergedSettings?.onlineSales?.branchId || '').trim()
  const selectedBranchId = [requestedBranchId, fallbackBranchId, String(branches?.[0]?._id || '')]
    .find((branchId) => branchById.has(String(branchId || ''))) || ''
  const featuredProductId = String(mergedSettings?.onlineSales?.featuredProductId || '').trim()

  return res.json({
    success: true,
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: toAbsoluteAssetUrl(req, tenant.logoUrl, tenant.updatedAt),
      settings: {
        onlineSales: mergedSettings.onlineSales,
      },
    },
    branch: selectedBranchId
      ? {
          id: selectedBranchId,
          name: branchById.get(selectedBranchId) || ''
        }
      : null,
    branches: (branches || []).map((branch) => ({
      id: String(branch?._id || ''),
      name: String(branch?.name || '')
    })),
    categories: (categories || []).map((category) => ({
      id: String(category._id),
      name: String(category.name || ''),
      sortOrder: Number(category.sortOrder || 0)
    })),
    items: visibleItems.map((item) => {
      const itemSettings = item?.settings && typeof item.settings === 'object' && !Array.isArray(item.settings)
        ? item.settings
        : {}
      return {
        id: String(item._id),
        categoryId: String(item.categoryId),
        name: String(item.name || ''),
        price: Number(item.price || 0),
        basePrice: Number(item.price || 0),
        description: String(item.description || ''),
        imageUrl: String(item.imageUrl || ''),
        galleryImages: Array.isArray(item.galleryImages) ? item.galleryImages : [],
        sortOrder: Number(item.sortOrder || 0),
        isWeightBased: item?.isWeightBased === true,
        weightUnit: String(itemSettings.weightUnit || 'Gram'),
        halfPortionEnabled: itemSettings.halfPortionEnabled === true,
        halfPortionPrice: Number(itemSettings.halfPortionPrice || 0),
        oneAndHalfPortionEnabled: itemSettings.oneAndHalfPortionEnabled === true,
        oneAndHalfPortionPrice: Number(itemSettings.oneAndHalfPortionPrice || 0),
        featured: featuredProductId && featuredProductId === String(item._id),
      }
    }),
    contact: {
      phone: String(mergedSettings?.onlineSales?.phone || mergedSettings?.qrMenu?.phone || ''),
      whatsapp: String(mergedSettings?.onlineSales?.whatsapp || mergedSettings?.qrMenu?.whatsapp || ''),
      email: String(mergedSettings?.onlineSales?.email || mergedSettings?.qrMenu?.email || ''),
      address: String(mergedSettings?.onlineSales?.address || mergedSettings?.qrMenu?.address || ''),
      workingHours: String(mergedSettings?.onlineSales?.workingHours || mergedSettings?.qrMenu?.workingHours || '')
    }
  })
}

export const createPublicOnlineStoreOrder = async (req, res) => {
  try {
    const tenantSlug = String(req.body?.tenantSlug || '').trim()
    if (!tenantSlug) {
      return res.status(400).json({ success: false, code: 'tenant_required', message: 'Isletme bilgisi gerekli' })
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true, status: 'active' }).lean()
    if (!tenant) {
      return res.status(404).json({ success: false, code: 'not_found', message: 'Isletme bulunamadi' })
    }

    const mergedSettings = mergeBusinessSettings(tenant?.settings || {})
    if (mergedSettings.onlineSales?.enabled !== true) {
      return res.status(400).json({ success: false, code: 'feature_disabled', message: 'Online satis aktif degil' })
    }

    const requestedBranchId = String(req.body?.branchId || '').trim()
    const fallbackBranchId = String(mergedSettings.onlineSales?.branchId || '').trim()
    const branchId = requestedBranchId || fallbackBranchId
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ success: false, code: 'branch_required', message: 'Online satis icin sube secilmemis' })
    }
    const branchDoc = await Branch.findOne({
      _id: branchId,
      tenantId: tenant._id,
      isDeleted: { $ne: true },
      isActive: true,
      status: { $ne: 'deleted' }
    }).select('_id').lean()
    if (!branchDoc) {
      return res.status(400).json({ success: false, code: 'branch_not_found', message: 'Secilen sube aktif degil' })
    }

    const orderPayload = {
      branchId,
      customerId: String(req.body?.customerId || '').trim(),
      customerName: String(req.body?.customerName || '').trim(),
      customerLocation: String(req.body?.customerLocation || req.body?.location || '').trim(),
      phone: String(req.body?.phone || '').trim(),
      address: String(req.body?.address || '').trim(),
      note: String(req.body?.note || '').trim(),
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      deliveryPaymentStatus: String(req.body?.deliveryPaymentStatus || '').trim(),
      deliveryPaymentMethod: String(req.body?.deliveryPaymentMethod || '').trim()
    }

    if (!orderPayload.customerName || !orderPayload.phone) {
      return res.status(400).json({ success: false, code: 'missing_fields', message: 'Ad soyad ve telefon zorunlu' })
    }

    const { order } = await createPublicOnlineOrderService(String(tenant._id), orderPayload)
    return res.json({
      success: true,
      order: {
        id: String(order?.id || order?._id || ''),
        orderNo: order?.orderNo ?? null,
        orderDayKey: String(order?.orderDayKey || ''),
        status: String(order?.status || ''),
        deliveryStatus: String(order?.deliveryStatus || ''),
        approvalStatus: String(order?.approvalStatus || ''),
        customerName: String(order?.customerName || ''),
        total: Number(order?.netTotal || order?.totals?.grandTotal || 0)
      }
    })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const upsertPublicOnlineStoreCustomer = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    const branchId = String(req.body?.branchId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(branchId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Isletme bilgisi gecersiz' })
    }
    const result = await upsertPublicOnlineCustomerAccount(tenantId, branchId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const registerPublicOnlineStoreCustomer = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    const branchId = String(req.body?.branchId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(branchId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Isletme bilgisi gecersiz' })
    }
    const result = await registerPublicOnlineCustomerAccount(tenantId, branchId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const loginPublicOnlineStoreCustomer = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    const branchId = String(req.body?.branchId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(branchId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Isletme bilgisi gecersiz' })
    }
    const result = await loginPublicOnlineCustomerAccount(tenantId, branchId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const getPublicOnlineStoreCustomerProfile = async (req, res) => {
  try {
    const tenantId = String(req.query?.tenantId || '').trim()
    const branchId = String(req.query?.branchId || '').trim()
    const customerId = String(req.query?.customerId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(branchId) || !mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Musteri bilgisi gecersiz' })
    }
    const result = await getPublicOnlineCustomerProfile(tenantId, branchId, customerId)
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const requestPublicOnlineStoreOrderCancellation = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    const branchId = String(req.body?.branchId || '').trim()
    const customerId = String(req.body?.customerId || '').trim()
    const orderId = String(req.params?.orderId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(branchId) || !mongoose.isValidObjectId(customerId) || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Siparis bilgisi gecersiz' })
    }
    const result = await requestPublicOnlineOrderCancellation(tenantId, branchId, customerId, orderId)
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const updatePublicOnlineStoreCustomerProfile = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    const branchId = String(req.body?.branchId || '').trim()
    const customerId = String(req.body?.customerId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(branchId) || !mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Musteri bilgisi gecersiz' })
    }
    const result = await updatePublicOnlineCustomerProfile(tenantId, branchId, customerId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const createPublicWaiterCall = async (req, res) => {
  const tenantSlug = String(req.body?.tenantSlug || '').trim()
  const tenantIdRaw = String(req.body?.tenantId || '').trim()
  const requestedTableId = String(req.body?.tableId || '').trim()
  const requestedTableName = String(req.body?.tableName || req.body?.table || '').trim()

  const tenant = tenantSlug
    ? await Tenant.findOne({ slug: tenantSlug, isActive: true, status: 'active' }).lean()
    : (mongoose.Types.ObjectId.isValid(tenantIdRaw)
      ? await Tenant.findOne({ _id: tenantIdRaw, isActive: true, status: 'active' }).lean()
      : null)

  if (!tenant) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  const mergedSettings = mergeBusinessSettings(tenant?.settings || {})
  if (mergedSettings.qrMenu?.enabled === false || mergedSettings.qrMenu?.waiterCall !== true) {
    return res.status(400).json({ success: false, code: 'feature_disabled', message: 'Garson çağır özelliği aktif değil' })
  }

  const created = await createWaiterCall({
    tenantId: tenant._id,
    tableId: mergedSettings.qrMenu?.tableQrEnabled === true ? requestedTableId : '',
    tableName: requestedTableName,
  })

  return res.json({
    success: true,
    message: created?.tableName
      ? `${created.tableName} için garson çağrısı iletildi`
      : 'Garson çağrısı iletildi',
    table: {
      id: String(created?.tableId || ''),
      name: String(created?.tableName || ''),
    },
  })
}

export const getPublicCanteenQr = async (req, res) => {
  const slug = String(req.query?.slug || '').trim()
  let requestedBranchId = String(req.query?.branchId || '').trim()
  const requestedBranchName = String(req.query?.branch || req.query?.branchName || '').trim()
  if (!slug) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  let tenant = await Tenant.findOne({ slug, isActive: true, status: 'active', systemType: 'kantin' }).lean()
  if (!tenant) {
    const branchFromSlug = await CanteenBranch.findOne({ publicSlug: slug, isActive: true }).lean()
    if (branchFromSlug?.tenantId) {
      tenant = await Tenant.findOne({ _id: branchFromSlug.tenantId, isActive: true, status: 'active', systemType: 'kantin' }).lean()
      requestedBranchId = String(branchFromSlug._id || '')
    }
  }
  if (!tenant) {
    return res.status(404).json({ success: false, code: 'not_found', error: 'not_found', message: 'Tenant not found' })
  }

  const settings = await CanteenTenantSettings.findOne({ tenantId: tenant._id }).lean()
  const branches = await CanteenBranch.find({ tenantId: tenant._id, isActive: true }).sort({ createdAt: -1 }).lean()
  const activeBranchIds = (branches || []).map((branch) => String(branch._id))
  const allowedBranchIdsRaw = Array.isArray(settings?.canteenAllowedBranchIds)
    ? settings.canteenAllowedBranchIds.map(String).filter(Boolean)
    : []
  const allowedBranchIds = (allowedBranchIdsRaw.length > 0 ? allowedBranchIdsRaw : activeBranchIds)
    .filter((branchId) => activeBranchIds.includes(branchId))
  const branchByNormalizedName = new Map(
    (branches || []).map((branch) => [normalizeCanteenBranchQueryKey(branch.nameNormalized || branch.name || ''), String(branch._id)])
  )
  const visibleBranches = (branches || [])
    .filter((branch) => allowedBranchIds.includes(String(branch._id)))
    .map((branch) => ({
      id: String(branch._id),
      name: String(branch.name || ''),
      publicSlug: String(branch.publicSlug || ''),
      description: String(branch.description || '')
    }))

  const configuredDefaultBranchId = settings?.canteenDefaultBranchId
    ? String(settings.canteenDefaultBranchId)
    : (settings?.defaultBranchId ? String(settings.defaultBranchId) : '')
  const requestedBranchIdByName = branchByNormalizedName.get(normalizeCanteenBranchQueryKey(requestedBranchName)) || ''
  const resolvedBranchId = requestedBranchId && allowedBranchIds.includes(requestedBranchId)
    ? requestedBranchId
    : (requestedBranchIdByName && allowedBranchIds.includes(requestedBranchIdByName)
      ? requestedBranchIdByName
      : (configuredDefaultBranchId && allowedBranchIds.includes(configuredDefaultBranchId) ? configuredDefaultBranchId : String(allowedBranchIds[0] || '')))
  const selectedBranch = (branches || []).find((branch) => String(branch._id) === resolvedBranchId) || null

  if (allowedBranchIds.length === 0) {
    return res.json({
      success: true,
      tenant: {
        id: String(tenant._id),
        name: String(tenant.name || ''),
        slug: String(tenant.slug || ''),
        description: String(tenant.description || ''),
        logoUrl: String(tenant.logoUrl || '')
      },
      settings: {
        qrTitle: String(settings?.qrTitle || tenant.name || ''),
        qrDescription: String(settings?.qrDescription || tenant.description || ''),
        qrLogoUrl: String(settings?.qrLogoUrl || tenant.logoUrl || ''),
        qrCoverImageUrl: toAbsoluteAssetUrl(req, settings?.qrCoverImageUrl, settings?.updatedAt),
        qrPhone: String(settings?.qrPhone || ''),
        qrWhatsapp: String(settings?.qrWhatsapp || ''),
        qrEmail: String(settings?.qrEmail || ''),
        qrAddress: String(settings?.qrAddress || ''),
        qrWorkingHours: String(settings?.qrWorkingHours || ''),
        qrTheme: String(settings?.qrTheme || 'green')
      },
      branch: null,
      branches: visibleBranches,
      categories: [],
      products: []
    })
  }

  const [products, categories] = await Promise.all([
    CanteenProduct.find({ tenantId: tenant._id, branchId: resolvedBranchId, isActive: true }).sort({ nameNormalized: 1, name: 1 }).lean(),
    CanteenCategory.find({ tenantId: tenant._id, branchId: resolvedBranchId, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean()
  ])

  const categoryMetaById = new Map()
  const visibleCategoryMap = new Map()
  for (const category of (categories || [])) {
    const meta = {
      id: String(category?._id || ''),
      name: String(category?.name || '').trim() || UNCATEGORIZED_CATEGORY.name,
      description: String(category?.description || ''),
      imageUrl: String(category?.imageUrl || ''),
      sortOrder: Number(category?.sortOrder || 0)
    }
    categoryMetaById.set(String(category._id), meta)
  }
  for (const product of (products || [])) {
    const meta = categoryMetaById.get(product?.categoryId ? String(product.categoryId) : '') || UNCATEGORIZED_CATEGORY
    if (!visibleCategoryMap.has(meta.id)) visibleCategoryMap.set(meta.id, meta)
  }
  const visibleCategories = Array.from(visibleCategoryMap.values()).sort((a, b) => {
    if (Number(a.sortOrder || 0) !== Number(b.sortOrder || 0)) return Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
    return String(a.name || '').localeCompare(String(b.name || ''), 'tr')
  })

  return res.json({
    success: true,
    tenant: {
      id: String(tenant._id),
      name: String(tenant.name || ''),
      slug: String(tenant.slug || ''),
      description: String(tenant.description || ''),
      logoUrl: String(tenant.logoUrl || '')
    },
    settings: {
      qrTitle: String(settings?.qrTitle || tenant.name || ''),
      qrDescription: String(settings?.qrDescription || tenant.description || ''),
      qrLogoUrl: String(settings?.qrLogoUrl || tenant.logoUrl || ''),
      qrCoverImageUrl: toAbsoluteAssetUrl(req, settings?.qrCoverImageUrl, settings?.updatedAt),
      qrPhone: String(settings?.qrPhone || ''),
      qrWhatsapp: String(settings?.qrWhatsapp || ''),
      qrEmail: String(settings?.qrEmail || ''),
      qrAddress: String(settings?.qrAddress || ''),
      qrWorkingHours: String(settings?.qrWorkingHours || ''),
      qrTheme: String(settings?.qrTheme || 'green')
    },
    branch: selectedBranch ? {
      id: String(selectedBranch._id),
      name: String(selectedBranch.name || ''),
      description: String(selectedBranch.description || '')
    } : null,
    branches: visibleBranches,
    categories: visibleCategories,
    products: (products || []).map((product) => ({
      id: String(product._id),
      branchId: product.branchId ? String(product.branchId) : '',
      categoryId: categoryMetaById.get(product.categoryId ? String(product.categoryId) : '')?.id || UNCATEGORIZED_CATEGORY.id,
      categoryName: categoryMetaById.get(product.categoryId ? String(product.categoryId) : '')?.name || UNCATEGORIZED_CATEGORY.name,
      name: String(product.name || ''),
      description: String(product.description || ''),
      imageUrl: String(product.imageUrl || ''),
      galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
      price: computeCanteenSalePrice(product.price, product.vatRate, product.vatIncluded !== false),
      rawPrice: Number(product.price || 0),
      vatRate: Number(product.vatRate || 0),
      vatIncluded: product.vatIncluded !== false,
      stockTrackingEnabled: product.stockTrackingEnabled === true,
      stockQty: Number(product.stockQty || 0)
    }))
  })
}

export const createPublicCanteenQrOrder = async (req, res) => {
  try {
    const order = await createPublicQrOrder(req.body || {})
    return res.json({ success: true, order })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'İşlem başarısız' }) }
    return res.status(status).json(payload)
  }
}

export const upsertPublicQrCustomer = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    if (!mongoose.isValidObjectId(tenantId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'İşletme bilgisi geçersiz' })
    }
    const result = await upsertPublicCustomerAccount(tenantId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'İşlem başarısız' }) }
    return res.status(status).json(payload)
  }
}

export const registerPublicQrCustomer = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    if (!mongoose.isValidObjectId(tenantId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'İşletme bilgisi geçersiz' })
    }
    const result = await registerPublicCustomerAccount(tenantId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'İşlem başarısız' }) }
    return res.status(status).json(payload)
  }
}

export const loginPublicQrCustomer = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    if (!mongoose.isValidObjectId(tenantId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'İşletme bilgisi geçersiz' })
    }
    const result = await loginPublicCustomerAccount(tenantId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'İşlem başarısız' }) }
    return res.status(status).json(payload)
  }
}

export const getPublicQrCustomerProfile = async (req, res) => {
  try {
    const tenantId = String(req.query?.tenantId || '').trim()
    const customerId = String(req.query?.customerId || '').trim()
    if (!mongoose.isValidObjectId(tenantId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'İşletme bilgisi geçersiz' })
    }
    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(404).json({ success: false, code: 'not_found', message: 'Müşteri hesabı bulunamadı' })
    }

    const [customer, movements, sales, qrOrders, favoriteProductIds] = await Promise.all([
      getCustomer(tenantId, customerId),
      listCustomerMovements(tenantId, customerId),
      listCustomerSales(tenantId, customerId),
      listPublicQrOrdersByCustomer(tenantId, customerId),
      getCustomerFavoriteProductIds(tenantId, customerId)
    ])

    return res.json({
      success: true,
      customer,
      balance: Number(movements?.balance || customer?.balance || 0),
      movements: Array.isArray(movements?.movements) ? movements.movements : [],
      sales: Array.isArray(sales) ? sales : [],
      qrOrders: Array.isArray(qrOrders) ? qrOrders : [],
      favoriteProductIds
    })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'İşlem başarısız' }) }
    return res.status(status).json(payload)
  }
}

export const updatePublicQrCustomerProfile = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    const customerId = String(req.body?.customerId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Musteri bilgisi gecersiz' })
    }

    const result = await updatePublicCustomerAccount(tenantId, customerId, req.body || {})
    return res.json({ success: true, ...result })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'Islem basarisiz' }) }
    return res.status(status).json(payload)
  }
}

export const updatePublicQrCustomerFavorites = async (req, res) => {
  try {
    const tenantId = String(req.body?.tenantId || '').trim()
    const customerId = String(req.body?.customerId || '').trim()
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ success: false, code: 'invalid_request', message: 'Müşteri bilgisi geçersiz' })
    }
    const favoriteProductIds = await updateCustomerFavoriteProductIds(tenantId, customerId, req.body?.favoriteProductIds)
    return res.json({ success: true, favoriteProductIds })
  } catch (err) {
    const status = err?.status || 500
    const payload = status >= 500
      ? { success: false, code: 'internal_error', message: 'Internal server error' }
      : { success: false, ...(err.payload || { code: 'error', message: err.message || 'İşlem başarısız' }) }
    return res.status(status).json(payload)
  }
}

export const downloadPrintAgentSetup = async (req, res) => {
  const resolved = resolvePrintAgentWindowsBinary()
  if (!resolved.filePath) {
    return res.status(404).json({
      success: false,
      code: 'print_agent_not_found',
      error: 'print_agent_not_found',
      message: 'Print Agent dosyasi bulunamadı'
    })
  }

  return res.download(resolved.filePath, resolved.fileName)
}

export const getPrintAgentWindowsManifest = async (req, res) => {
  const resolved = resolvePrintAgentWindowsBinary()
  if (!resolved.filePath) {
    return res.status(404).json({
      success: false,
      code: 'print_agent_not_found',
      error: 'print_agent_not_found',
      message: 'Print Agent dosyasi bulunamadı'
    })
  }

  const fallbackPath = '/api/public/downloads/print-agent/windows'
  const base = buildBaseUrl(req)
  const downloadUrl = String(process.env.PRINT_AGENT_WINDOWS_URL || (base ? new URL(fallbackPath, base).toString() : fallbackPath)).trim()

  return res.json({
    success: true,
    platform: 'windows',
    version: resolved.version,
    fileName: resolved.fileName,
    downloadUrl,
    required: false,
    notes: String(process.env.PRINT_AGENT_WINDOWS_NOTES || '').trim(),
    publishedAt: resolved.publishedAt
  })
}
