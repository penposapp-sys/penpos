import CanteenProductBatch from '../models/CanteenProductBatch.js'

export const create = (data) => CanteenProductBatch.create(data)

export const listByProductIds = (tenantId, branchId, productIds = []) =>
  CanteenProductBatch.find({
    tenantId,
    branchId,
    productId: { $in: Array.isArray(productIds) ? productIds : [] }
  }).sort({ receivedAt: 1, _id: 1 })

export const listByProductId = (tenantId, branchId, productId) =>
  CanteenProductBatch.find({ tenantId, branchId, productId }).sort({ receivedAt: 1, _id: 1 })

export const listOpenByProductId = (tenantId, branchId, productId) =>
  CanteenProductBatch.find({
    tenantId,
    branchId,
    productId,
    remainingQty: { $gt: 0 }
  }).sort({ receivedAt: 1, _id: 1 })

export const findFirstOpenByProductId = (tenantId, branchId, productId) =>
  CanteenProductBatch.findOne({
    tenantId,
    branchId,
    productId,
    remainingQty: { $gt: 0 }
  }).sort({ receivedAt: 1, _id: 1 })

export const updateById = (id, update) =>
  CanteenProductBatch.findByIdAndUpdate(id, update, { new: true })

export const updateOpenByProductId = (tenantId, branchId, productId, update) =>
  CanteenProductBatch.updateMany({
    tenantId,
    branchId,
    productId,
    remainingQty: { $gt: 0 }
  }, update)

export const setRemainingQtyById = (id, remainingQty) =>
  CanteenProductBatch.findByIdAndUpdate(id, { $set: { remainingQty: Number(remainingQty || 0) } }, { new: true })

export const deleteManyByProductId = (tenantId, branchId, productId) =>
  CanteenProductBatch.deleteMany({ tenantId, branchId, productId })
