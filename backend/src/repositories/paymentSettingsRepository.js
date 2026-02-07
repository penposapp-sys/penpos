import PaymentSettings from '../models/PaymentSettings.js'

export const findByTenantAndBranch = async (tenantId, branchId) => {
  const filter = { tenantId, branchId: branchId || null }
  let s = await PaymentSettings.findOne(filter)
  return s
}

export const upsert = async (tenantId, branchId, methods) => {
  const filter = { tenantId, branchId: branchId || null }
  const update = { methods }
  const opts = { new: true, upsert: true }
  const s = await PaymentSettings.findOneAndUpdate(filter, update, opts)
  return s
}
