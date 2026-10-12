import { createHash } from 'node:crypto'
import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import Order from '../models/Order.js'
import OrderCounter from '../models/OrderCounter.js'
import WaiterCall from '../models/WaiterCall.js'
import KitchenBulkPrepState from '../models/KitchenBulkPrepState.js'
import DeliveryCustomer from '../models/DeliveryCustomer.js'
import PrintJob from '../models/PrintJob.js'
import CanteenSale from '../modules/canteen/models/CanteenSale.js'
import CanteenQrOrder from '../modules/canteen/models/CanteenQrOrder.js'
import CanteenStockMovement from '../modules/canteen/models/StockMovement.js'
import CanteenStockCountSession from '../modules/canteen/models/StockCountSession.js'
import CanteenStockCountItem from '../modules/canteen/models/StockCountItem.js'
import AuditLog from '../models/AuditLog.js'
import { error } from '../utils/errors.js'
import { normalizeSystemType } from '../utils/systemType.js'
import {
  DATA_MANAGEMENT_ACTIONS,
  getDataManagementPolicy,
  getProductDetailUpdate
} from './dataManagementPolicy.js'
import { isCollectionInSystemScope } from './dataManagementScope.js'
import { getTenantScopeWarnings } from './tenantBackupService.js'

const MODEL_BY_KEY = {
  orders: Order,
  orderCounters: OrderCounter,
  kitchenBulkPrepStates: KitchenBulkPrepState,
  waiterCalls: WaiterCall,
  deliveryCustomers: DeliveryCustomer,
  printJobs: PrintJob,
  canteenSales: CanteenSale,
  canteenQrOrders: CanteenQrOrder,
  stockMovements: CanteenStockMovement,
  stockCountSessions: CanteenStockCountSession,
  stockCountItems: CanteenStockCountItem
}

const PRODUCT_DETAIL_KEYS = new Set(['orders', 'canteenSales', 'canteenQrOrders'])

const getFilter = (key, tenantId, action) => {
  const filter = { tenantId }
  if (action === 'productDetails' && key === 'orders') {
    return {
      tenantId,
      $or: [
        { 'items.0': { $exists: true } },
        { 'payments.itemAllocations.0': { $exists: true } }
      ]
    }
  }
  if (action === 'productDetails' && PRODUCT_DETAIL_KEYS.has(key)) {
    return { tenantId, 'items.0': { $exists: true } }
  }
  return filter
}

const getDescriptors = (system, action, tenantId) => {
  const keys = getDataManagementPolicy(system, action)
  if (!keys) throw error('invalid_data_management_action', 'Geçersiz veri yönetimi işlemi.', 400)
  return keys.map((key) => {
    const model = MODEL_BY_KEY[key]
    if (!model) throw error('invalid_data_management_policy', 'Veri yönetimi kapsamı tanımlı değil.', 500)
    if (!isCollectionInSystemScope(model.collection.collectionName, system)) {
      throw error('invalid_data_management_scope', `${model.collection.collectionName} koleksiyonu bu işletme türünün kapsamına ait değil.`, 500)
    }
    const filter = key === 'printJobs'
      ? { tenantId, system: system === 'canteen' ? 'canteen' : 'kermes' }
      : getFilter(key, tenantId, action)
    return { key, model, filter }
  })
}

const readTenant = async (tenantId, expectedSystem, session) => {
  if (!mongoose.isValidObjectId(tenantId)) throw error('invalid_tenant', 'Firma bilgisi doğrulanamadı.', 400)
  let query = Tenant.findById(tenantId).select('name systemType vertical businessType')
  if (session) query = query.session(session)
  const tenant = await query.lean()
  if (!tenant) throw error('tenant_not_found', 'Firma bulunamadı.', 404)
  if (normalizeSystemType(tenant.systemType) !== expectedSystem) {
    throw error('tenant_system_mismatch', 'Bu işlem bu firma türünde kullanılamaz.', 403)
  }
  return tenant
}

const getSnapshot = async ({ tenantId, tenantName, system, action, session }) => {
  const descriptors = getDescriptors(system, action, tenantId)
  const collections = {}
  const counts = {}

  for (const { key, model, filter } of descriptors) {
    let query = model.find(filter).sort({ _id: 1 }).lean()
    if (session) query = query.session(session)
    const records = await query
    collections[key] = records
    counts[key] = records.length
  }

  const content = {
    formatVersion: 1,
    action,
    system,
    tenantId: String(tenantId),
    tenantName,
    counts,
    collections
  }
  const backupHash = createHash('sha256').update(JSON.stringify(content)).digest('hex')
  return { content, counts, backupHash }
}

const validateAction = (action) => {
  if (!DATA_MANAGEMENT_ACTIONS.includes(action)) {
    throw error('invalid_data_management_action', 'Geçersiz veri yönetimi işlemi.', 400)
  }
}

const transactionOptions = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' }
}

export const previewTenantDataManagement = async ({ tenantId, system, action }) => {
  validateAction(action)
  const session = await mongoose.startSession()
  try {
    let preview
    await session.withTransaction(async () => {
      const tenant = await readTenant(tenantId, system, session)
      const snapshot = await getSnapshot({
        tenantId: tenant._id,
        tenantName: tenant.name,
        system,
        action,
        session
      })
      const warnings = await getTenantScopeWarnings(tenant._id, system, session)
      preview = {
        action,
        system,
        tenantName: tenant.name,
        counts: snapshot.counts,
        warnings,
        totalCount: Object.values(snapshot.counts).reduce((sum, count) => sum + count, 0),
        backupHash: snapshot.backupHash,
        backup: {
          ...snapshot.content,
          exportedAt: new Date().toISOString()
        }
      }
    }, transactionOptions)
    return preview
  } finally {
    await session.endSession()
  }
}

const countsMatch = (expected, actual) => {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return false
  const expectedKeys = Object.keys(expected).sort()
  const actualKeys = Object.keys(actual).sort()
  return expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && Number(expected[key]) === actual[key])
}

const clearProductDetails = async ({ key, model, filter, session }) => {
  const update = getProductDetailUpdate(key)
  if (!update) throw error('invalid_data_management_policy', 'Ürün verisi temizleme kapsamı tanımlı değil.', 500)
  return model.updateMany(filter, update, { session })
}

export const executeTenantDataManagement = async ({
  tenantId,
  actorUserId,
  system,
  action,
  confirmationName,
  backupHash,
  counts
}) => {
  validateAction(action)
  if (typeof backupHash !== 'string' || !/^[a-f0-9]{64}$/i.test(backupHash)) {
    throw error('backup_required', 'İşlem için geçerli bir yedek önizlemesi oluşturun.', 400)
  }

  const session = await mongoose.startSession()
  let result
  try {
    await session.withTransaction(async () => {
      const tenant = await readTenant(tenantId, system, session)
      if (String(confirmationName || '') !== tenant.name) {
        throw error('confirmation_mismatch', 'Firma adını eksiksiz ve aynı şekilde yazın.', 400)
      }

      const snapshot = await getSnapshot({
        tenantId: tenant._id,
        tenantName: tenant.name,
        system,
        action,
        session
      })
      if (
        snapshot.backupHash !== backupHash ||
        !countsMatch(counts, snapshot.counts)
      ) {
        throw error('data_changed_since_backup', 'Veriler önizleme sonrasında değişti. Yeni bir yedek oluşturup tekrar deneyin.', 409)
      }

      const affectedCounts = {}
      const descriptors = getDescriptors(system, action, tenant._id)
      for (const descriptor of descriptors) {
        if (action === 'productDetails') {
          const update = await clearProductDetails({ ...descriptor, session })
          affectedCounts[descriptor.key] = update.modifiedCount || 0
        } else {
          const deletion = await descriptor.model.deleteMany(descriptor.filter, { session })
          affectedCounts[descriptor.key] = deletion.deletedCount || 0
        }
      }

      await AuditLog.create([{
        tenantId: tenant._id,
        actorUserId,
        action: `tenant_data_${action}`,
        entityType: 'Tenant',
        entityId: tenant._id,
        meta: { system, businessName: tenant.name, affectedCounts, backupHash }
      }], { session })

      result = {
        action,
        system,
        tenantName: tenant.name,
        affectedCounts,
        totalAffected: Object.values(affectedCounts).reduce((sum, count) => sum + count, 0)
      }
    }, transactionOptions)
    return result
  } finally {
    await session.endSession()
  }
}
