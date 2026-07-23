import CanteenProduct from '../models/CanteenProduct.js'

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalizeBarcodeKey = (value) => String(value || '').replace(/\s+/g, '').trim().toLowerCase()

export const listByTenantAndBranch = (tenantId, branchId) =>
  CanteenProduct.find({ tenantId, branchId, isActive: true }).sort({ createdAt: -1 })

export const listByTenantAndBranches = (tenantId, branchIds) =>
  CanteenProduct.find({ tenantId, branchId: { $in: branchIds }, isActive: true }).sort({ createdAt: -1 })

export const listByIdsAndScope = (ids, tenantId, branchId) =>
  CanteenProduct.find({ _id: { $in: ids }, tenantId, branchId, isActive: true })

export const listByIdsAndTenant = (ids, tenantId) =>
  CanteenProduct.find({ _id: { $in: ids }, tenantId, isActive: true })

export const findByIdAndScope = (id, tenantId, branchId) =>
  CanteenProduct.findOne({ _id: id, tenantId, branchId, isActive: true })

export const findByBarcodeAndScope = async (barcode, tenantId, branchId) => {
  const raw = String(barcode || '').trim()
  if (!raw) return null

  const exact = await CanteenProduct.findOne({
    tenantId,
    branchId,
    barcode: raw,
    isActive: true
  })
  if (exact) return exact

  const normalized = normalizeBarcodeKey(raw)
  const candidates = await CanteenProduct.find({
    tenantId,
    branchId,
    isActive: true,
    barcode: { $regex: `^${escapeRegex(raw)}$`, $options: 'i' }
  }).limit(10)

  return (candidates || []).find((item) => normalizeBarcodeKey(item?.barcode) === normalized) || null
}

export const create = (data) => CanteenProduct.create(data)

export const updateByIdAndScope = (id, tenantId, branchId, update) =>
  CanteenProduct.findOneAndUpdate({ _id: id, tenantId, branchId }, update, { new: true })

export const incStockQtyByIdAndScope = (id, tenantId, branchId, delta) =>
  CanteenProduct.findOneAndUpdate({ _id: id, tenantId, branchId, isActive: true }, { $inc: { stockQty: Number(delta || 0) } }, { new: true })

export const setStockQtyByIdAndScope = (id, tenantId, branchId, nextQty) =>
  CanteenProduct.findOneAndUpdate({ _id: id, tenantId, branchId, isActive: true }, { $set: { stockQty: Number(nextQty || 0) } }, { new: true })

export const decStockQtyByIdAndScopeIfEnough = (id, tenantId, branchId, qty) => {
  const n = Number(qty)
  const dec = Number.isFinite(n) && n > 0 ? n : 0
  return CanteenProduct.findOneAndUpdate(
    { _id: id, tenantId, branchId, isActive: true, stockQty: { $gte: dec } },
    { $inc: { stockQty: -dec } },
    { new: true }
  )
}

export const softDeleteByIdAndScope = (id, tenantId, branchId) =>
  CanteenProduct.findOneAndUpdate({ _id: id, tenantId, branchId }, { isActive: false }, { new: true })

export const searchByNameAndScope = (tenantId, branchId, nameRegex, limit) =>
  CanteenProduct.find({
    tenantId,
    branchId,
    isActive: true,
    $or: [
      { name: { $regex: nameRegex, $options: 'i' } },
      { barcode: { $regex: nameRegex, $options: 'i' } }
    ]
  })
    .sort({ nameNormalized: 1, name: 1 })
    .limit(Math.max(1, Math.min(100, Number(limit || 20))))
