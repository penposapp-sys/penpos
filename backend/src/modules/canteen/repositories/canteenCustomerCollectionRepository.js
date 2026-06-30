import mongoose from 'mongoose'
import CanteenCustomerCollection from '../models/CanteenCustomerCollection.js'

const toObjectId = (value) => {
  const v = String(value || '').trim()
  return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null
}

const signedAmountExpr = {
  $cond: [
    { $eq: ['$direction', 'debit'] },
    { $multiply: ['$amount', -1] },
    '$amount'
  ]
}

export const create = (data) => CanteenCustomerCollection.create(data)

export const listByCustomer = (tenantId, branchId, customerId, { limit = 50 } = {}) =>
  CanteenCustomerCollection.find({ tenantId, branchId, customerId, isActive: true, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(Number(limit || 50))

export const sumByCustomer = async (tenantId, branchId, customerId) => {
  const tid = toObjectId(tenantId)
  const bid = toObjectId(branchId)
  const cid = toObjectId(customerId)
  if (!tid || !bid || !cid) return 0
  const rows = await CanteenCustomerCollection.aggregate([
    { $match: { tenantId: tid, branchId: bid, customerId: cid, isActive: true, isDeleted: { $ne: true } } },
    { $group: { _id: null, total: { $sum: signedAmountExpr } } }
  ])
  return Number(rows?.[0]?.total || 0)
}

export const listByCustomerAllBranches = (tenantId, customerId, { limit = 50 } = {}) =>
  CanteenCustomerCollection.find({ tenantId, customerId, isActive: true, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(Number(limit || 50))

export const listByCustomersAllBranches = (tenantId, customerIds = [], { limit = 500 } = {}) => {
  const ids = (Array.isArray(customerIds) ? customerIds : [])
    .map((value) => toObjectId(value))
    .filter(Boolean)
  const tid = toObjectId(tenantId)
  if (!tid || ids.length === 0) return Promise.resolve([])
  return CanteenCustomerCollection.find({
    tenantId: tid,
    customerId: { $in: ids },
    isActive: true,
    isDeleted: { $ne: true }
  }).sort({ createdAt: -1 }).limit(Number(limit || 500))
}

export const listRangeByTenantAndBranches = (tenantId, branchIds = [], from, to) => {
  const tid = toObjectId(tenantId)
  const ids = (Array.isArray(branchIds) ? branchIds : [])
    .map((value) => toObjectId(value))
    .filter(Boolean)
  if (!tid || ids.length === 0 || !(from instanceof Date) || !(to instanceof Date)) return Promise.resolve([])

  return CanteenCustomerCollection.find({
    tenantId: tid,
    $or: [
      { branchId: { $in: ids } },
      { branchId: null }
    ],
    isActive: true,
    isDeleted: { $ne: true },
    createdAt: { $gte: from, $lt: to }
  }).sort({ createdAt: -1 })
}

export const sumByCustomerAllBranches = async (tenantId, customerId) => {
  const tid = toObjectId(tenantId)
  const cid = toObjectId(customerId)
  if (!tid || !cid) return 0
  const rows = await CanteenCustomerCollection.aggregate([
    { $match: { tenantId: tid, customerId: cid, isActive: true, isDeleted: { $ne: true } } },
    { $group: { _id: null, total: { $sum: signedAmountExpr } } }
  ])
  return Number(rows?.[0]?.total || 0)
}

export const findByIdAndTenant = (tenantId, id) =>
  CanteenCustomerCollection.findOne({ _id: id, tenantId })

export const softDeleteByIdAndTenant = (tenantId, id, patch) =>
  CanteenCustomerCollection.findOneAndUpdate({ _id: id, tenantId }, patch, { new: true })
