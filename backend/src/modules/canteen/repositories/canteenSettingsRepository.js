import CanteenTenantSettings from '../models/CanteenTenantSettings.js'
import CanteenTenantPaymentSettings from '../models/CanteenTenantPaymentSettings.js'

export const findTenantSettings = (tenantId) =>
  CanteenTenantSettings.findOne({ tenantId })

export const upsertTenantSettings = async (tenantId, update) => {
  const next = { ...update, updatedAt: new Date() }
  await CanteenTenantSettings.updateOne(
    { tenantId },
    { $set: next, $setOnInsert: { tenantId } },
    { upsert: true }
  )
  return findTenantSettings(tenantId)
}

export const findTenantPaymentSettings = (tenantId) =>
  CanteenTenantPaymentSettings.findOne({ tenantId })

export const upsertTenantPaymentSettings = async (tenantId, update) => {
  const next = { ...update, updatedAt: new Date() }
  await CanteenTenantPaymentSettings.updateOne(
    { tenantId },
    { $set: next, $setOnInsert: { tenantId } },
    { upsert: true }
  )
  return findTenantPaymentSettings(tenantId)
}
