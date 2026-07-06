import mongoose from 'mongoose'
import WaiterCall from '../models/WaiterCall.js'
import Table from '../models/Table.js'
import { error } from '../utils/errors.js'
import { notifyWaiterCallUsers } from './pushNotificationService.js'

const toDto = (call) => ({
  id: String(call?._id || ''),
  tableId: call?.tableId ? String(call.tableId) : '',
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
  } catch {
  }

  return toDto(created)
}

export const listWaiterCalls = async (tenantId, { status = 'open' } = {}) => {
  const filter = { tenantId }
  if (status) filter.status = status
  const items = await WaiterCall.find(filter).sort({ createdAt: -1 }).lean()
  return items.map(toDto)
}

export const resolveWaiterCall = async (tenantId, waiterCallId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(waiterCallId)) {
    throw error('invalid_request', 'Gecersiz garson cagri kaydi', 400)
  }
  const updated = await WaiterCall.findOneAndUpdate(
    { _id: waiterCallId, tenantId, status: 'open' },
    { $set: { status: 'resolved', resolvedAt: new Date(), resolvedByUserId: userId || null } },
    { new: true }
  ).lean()
  if (!updated) {
    throw error('not_found', 'Garson cagrisi bulunamadi', 404)
  }
  return toDto(updated)
}

export const resolveWaiterCallsByTable = async (tenantId, tableId, userId) => {
  const normalizedTableId = String(tableId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(normalizedTableId)) {
    throw error('invalid_request', 'Gecersiz masa secimi', 400)
  }

  const table = await Table.findOne({ _id: normalizedTableId, tenantId, isActive: true }).select('_id').lean()
  if (!table) {
    throw error('not_found', 'Masa bulunamadi', 404)
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
