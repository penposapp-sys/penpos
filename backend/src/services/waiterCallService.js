import mongoose from 'mongoose'
import WaiterCall from '../models/WaiterCall.js'
import Table from '../models/Table.js'
import Branch from '../models/Branch.js'
import { error } from '../utils/errors.js'
import { notifyWaiterCallUsers } from './pushNotificationService.js'

const toDto = (call) => ({
  id: String(call?._id || ''),
  tableId: call?.tableId ? String(call.tableId) : '',
  branchId: call?.branchId ? String(call.branchId) : '',
  tableName: String(call?.tableName || ''),
  status: String(call?.status || 'open'),
  source: String(call?.source || 'public_qr_menu'),
  createdAt: call?.createdAt || null,
  resolvedAt: call?.resolvedAt || null,
})

export const createWaiterCall = async ({ tenantId, tableId = '', tableName = '' }) => {
  const normalizedTableId = String(tableId || '').trim()
  let resolvedTableName = String(tableName || '').trim()
  let resolvedTableId = null
  let resolvedBranchId = ''

  if (normalizedTableId) {
    if (!mongoose.Types.ObjectId.isValid(normalizedTableId)) {
      throw error('invalid_request', 'Gecersiz masa secimi', 400)
    }
    const table = await Table.findOne({ _id: normalizedTableId, tenantId, isActive: true }).select('_id name branchId').lean()
    if (!table) {
      throw error('not_found', 'Masa bulunamadi', 404)
    }
    const branch = await Branch.findOne({
      _id: table.branchId,
      tenantId,
      isActive: true,
      active: { $ne: false },
      isDeleted: { $ne: true },
      status: { $nin: ['inactive', 'deleted'] }
    }).select('_id').lean()
    if (!branch) {
      throw error('not_found', 'Masa bulunamadi', 404)
    }
    resolvedTableId = table._id
    resolvedTableName = String(table.name || '').trim()
    resolvedBranchId = String(table.branchId || '').trim()
  }

  if (!resolvedTableName) {
    throw error('invalid_request', 'Masa secilmeden garson cagirilamaz', 400)
  }

  const existing = await WaiterCall.findOne({
    tenantId,
    status: 'open',
    ...(resolvedTableId ? { tableId: resolvedTableId } : { tableName: resolvedTableName }),
  }).sort({ createdAt: -1 })

  if (existing) return toDto(existing)

  const created = await WaiterCall.create({
    tenantId,
    tableId: resolvedTableId,
    branchId: resolvedBranchId || null,
    tableName: resolvedTableName,
    source: 'public_qr_menu',
    status: 'open',
  })

  try {
    await notifyWaiterCallUsers({
      tenantId,
      branchId: resolvedBranchId,
      tableName: resolvedTableName,
      waiterCallId: String(created?._id || '')
    })
  } catch (notificationError) {
    console.error('Waiter call push notification failed', notificationError)
  }

  return toDto(created)
}

const buildBranchScopeFilter = async (tenantId, branchIds) => {
  if (!Array.isArray(branchIds)) return {}
  if (branchIds.length === 0) return { _id: { $in: [] } }
  const tableIds = await Table.find({ tenantId, branchId: { $in: branchIds } }).distinct('_id')
  return { $or: [{ branchId: { $in: branchIds } }, { tableId: { $in: tableIds } }] }
}

export const listWaiterCalls = async (tenantId, { status = 'open', branchIds } = {}) => {
  const filter = { tenantId, ...(await buildBranchScopeFilter(tenantId, branchIds)) }
  if (status) filter.status = status
  const items = await WaiterCall.find(filter).sort({ createdAt: -1 }).lean()
  return items.map(toDto)
}

export const resolveWaiterCall = async (tenantId, waiterCallId, userId, branchIds) => {
  if (!mongoose.Types.ObjectId.isValid(waiterCallId)) {
    throw error('invalid_request', 'Gecersiz garson cagri kaydi', 400)
  }
  const updated = await WaiterCall.findOneAndUpdate(
    { _id: waiterCallId, tenantId, status: 'open', ...(await buildBranchScopeFilter(tenantId, branchIds)) },
    { $set: { status: 'resolved', resolvedAt: new Date(), resolvedByUserId: userId || null } },
    { new: true }
  ).lean()
  if (!updated) {
    throw error('not_found', 'Garson cagrisi bulunamadi', 404)
  }
  return toDto(updated)
}

export const resolveWaiterCallsByTable = async (tenantId, tableId, userId, branchIds) => {
  const normalizedTableId = String(tableId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(normalizedTableId)) {
    throw error('invalid_request', 'Gecersiz masa secimi', 400)
  }

  const table = await Table.findOne({ _id: normalizedTableId, tenantId, isActive: true }).select('_id branchId').lean()
  if (!table) {
    throw error('not_found', 'Masa bulunamadi', 404)
  }
  if (Array.isArray(branchIds) && !branchIds.includes(String(table.branchId || ''))) {
    throw error('branch_not_allowed', 'Bu şubeye erişim yetkiniz yok.', 403)
  }

  const result = await WaiterCall.updateMany(
    { tenantId, tableId: table._id, status: 'open' },
    { $set: { status: 'resolved', resolvedAt: new Date(), resolvedByUserId: userId || null } }
  )

  return {
    tableId: normalizedTableId,
    resolvedCount: Number(result?.modifiedCount || 0),
  }
}

export const buildWaiterCallsByTable = (calls = []) => {
  return (Array.isArray(calls) ? calls : []).reduce((acc, call) => {
    const tableId = String(call?.tableId || '').trim()
    if (!tableId) return acc
    const current = acc[tableId] || { count: 0, latestAt: null, latestId: '', tableName: String(call?.tableName || '') }
    current.count += 1
    current.latestAt = call?.createdAt || current.latestAt
    current.latestId = String(call?.id || call?._id || current.latestId)
    current.tableName = String(call?.tableName || current.tableName || '')
    acc[tableId] = current
    return acc
  }, {})
}
