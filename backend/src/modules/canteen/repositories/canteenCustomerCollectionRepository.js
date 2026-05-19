import mongoose from 'mongoose'
import CanteenCustomerCollection from '../models/CanteenCustomerCollection.js'

const toObjectId = (value) => {
  const v = String(value || '').trim()
  return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null
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
    { $group: { _id: null, total: { $sum: '$amount' } } }
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

export const sumByCustomerAllBranches = async (tenantId, customerId) => {
  const tid = toObjectId(tenantId)
  const cid = toObjectId(customerId)
  if (!tid || !cid) return 0
  const rows = await CanteenCustomerCollection.aggregate([
    { $match: { tenantId: tid, customerId: cid, isActive: true, isDeleted: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  return Number(rows?.[0]?.total || 0)
}

export const findByIdAndTenant = (tenantId, id) =>
  CanteenCustomerCollection.findOne({ _id: id, tenantId })

export const softDeleteByIdAndTenant = (tenantId, id, patch) =>
  CanteenCustomerCollection.findOneAndUpdate({ _id: id, tenantId }, patch, { new: true })
