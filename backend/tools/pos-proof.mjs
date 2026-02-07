import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const API_BASE = process.env.PROOF_API_BASE || 'http://localhost:4000'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

import User from '../src/models/User.js'
import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import Table from '../src/models/Table.js'
import { PERMISSIONS } from '../src/constants/permissions.js'

const asJson = async (res) => {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const http = async (method, path, { token, headers, body } = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await asJson(res)
  return { status: res.status, data }
}

const ensurePlatformAdmin = async ({ email, password }) => {
  const passwordHash = await bcrypt.hash(password, 10)
  let u = await User.findOne({ role: 'platform_admin' })
  if (!u) {
    u = await User.create({
      tenantId: null,
      branchId: null,
      name: 'Platform Admin',
      email,
      passwordHash,
      role: 'platform_admin',
      isActive: true
    })
    return u
  }
  u.email = email
  u.passwordHash = passwordHash
  u.isActive = true
  await u.save()
  return u
}

const login = async ({ email, password, portal }) => {
  const res = await http('POST', '/api/auth/login', { body: { email, password, portal } })
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed (${portal}) status=${res.status} body=${JSON.stringify(res.data)}`)
  }
  return res.data.token
}

const ensureTenant = async ({ name, systemType, ownerEmail, ownerPassword, platformEmail, platformPassword }) => {
  const existing = await Tenant.findOne({ name }).lean()
  if (existing) {
    return { tenantId: String(existing._id), ownerEmail, ownerPassword }
  }

  const platformToken = await login({ email: platformEmail, password: platformPassword, portal: 'platform' })

  const createRes = await http('POST', '/api/platform/tenants', {
    token: platformToken,
    body: { name, ownerName: 'E2E Owner', ownerEmail, ownerPassword, systemType }
  })

  if (createRes.status !== 200 || !createRes.data?.id) {
    throw new Error(`Tenant create failed status=${createRes.status} body=${JSON.stringify(createRes.data)}`)
  }

  return { tenantId: String(createRes.data.id), ownerEmail, ownerPassword }
}

const ensureBranchesAndTables = async ({ tenantId }) => {
  let branchMain = await Branch.findOne({ tenantId, name: 'Merkez Şube' }).lean()
  if (!branchMain) {
    branchMain = await Branch.create({ tenantId, name: 'Merkez Şube', address: '', isActive: true })
  }
  let branchOther = await Branch.findOne({ tenantId, name: 'Diğer Şube' }).lean()
  if (!branchOther) {
    branchOther = await Branch.create({ tenantId, name: 'Diğer Şube', address: '', isActive: true })
  }

  try {
    const t = await Tenant.findById(tenantId)
    if (t) {
      const set = new Set([...(t.allowedBranchIds || []).map(String), String(branchMain._id), String(branchOther._id)])
      t.allowedBranchIds = Array.from(set).map(id => new mongoose.Types.ObjectId(id))
      await t.save()
    }
  } catch {}

  let tableA = await Table.findOne({ tenantId, name: 'E2E Masa A' }).lean()
  if (!tableA) {
    tableA = await Table.create({ tenantId, branchId: branchMain._id, name: 'E2E Masa A', status: 'empty', isActive: true, activeOrderId: null })
  }
  let tableB = await Table.findOne({ tenantId, name: 'E2E Masa B' }).lean()
  if (!tableB) {
    tableB = await Table.create({ tenantId, branchId: branchMain._id, name: 'E2E Masa B', status: 'empty', isActive: true, activeOrderId: null })
  }

  return {
    branchMainId: String(branchMain._id),
    branchOtherId: String(branchOther._id),
    tableAId: String(tableA._id),
    tableBId: String(tableB._id)
  }
}

const ensureStaff = async ({ tenantId, email, password, branchIds, permissions }) => {
  const passwordHash = await bcrypt.hash(password, 10)
  let u = await User.findOne({ tenantId, email })
  const branchObjectIds = branchIds.map(id => new mongoose.Types.ObjectId(id))
  if (!u) {
    u = await User.create({
      tenantId,
      name: email.split('@')[0],
      email,
      passwordHash,
      role: 'staff',
      isActive: true,
      systemType: 'kermes',
      branchIds: branchObjectIds,
      branchId: branchIds.length === 1 ? branchObjectIds[0] : null,
      permissions
    })
  } else {
    u.passwordHash = passwordHash
    u.isActive = true
    u.role = 'staff'
    u.systemType = 'kermes'
    u.branchIds = branchObjectIds
    u.branchId = branchIds.length === 1 ? branchObjectIds[0] : null
    u.permissions = permissions
    await u.save()
  }
  return u
}

const ensureOwnerPermissions = async ({ ownerEmail }) => {
  const u = await User.findOne({ email: ownerEmail })
  if (!u) return
  const all = Object.values(PERMISSIONS)
  u.permissions = Array.from(new Set([...(u.permissions || []), ...all]))
  await u.save()
}

const pickTableRow = (overviewBody, tableId) => {
  const tables = Array.isArray(overviewBody?.tables) ? overviewBody.tables : []
  return tables.find(t => String(t.id || t._id) === String(tableId)) || null
}

const main = async () => {
  const platformEmail = process.env.PROOF_PLATFORM_EMAIL || 'platform@example.com'
  const platformPassword = process.env.PROOF_PLATFORM_PASSWORD || 'platform123'
  const ownerEmail = process.env.PROOF_OWNER_EMAIL || 'owner.kermes@example.com'
  const ownerPassword = process.env.PROOF_OWNER_PASSWORD || 'owner123'

  await mongoose.connect(MONGODB_URI)

  await ensurePlatformAdmin({ email: platformEmail, password: platformPassword })

  const { tenantId } = await ensureTenant({
    name: 'E2E Kermes Tenant',
    systemType: 'kermes',
    ownerEmail,
    ownerPassword,
    platformEmail,
    platformPassword
  })

  await ensureOwnerPermissions({ ownerEmail })

  const { branchMainId, branchOtherId, tableAId, tableBId } = await ensureBranchesAndTables({ tenantId })

  const allPerms = Object.values(PERMISSIONS)
  await ensureStaff({ tenantId, email: 'staff.allowed@example.com', password: 'staff123', branchIds: [branchMainId], permissions: allPerms })
  await ensureStaff({ tenantId, email: 'staff.denied@example.com', password: 'staff123', branchIds: [branchOtherId], permissions: allPerms })

  const tokenAllowed = await login({ email: 'staff.allowed@example.com', password: 'staff123', portal: 'kermes' })
  const tokenDenied = await login({ email: 'staff.denied@example.com', password: 'staff123', portal: 'kermes' })

  const wrongHeaderBranchId = '000000000000000000000000'

  const results = {}

  // TEST-A
  await http('GET', `/api/pos/tables/${tableAId}/meta`, { token: tokenDenied, headers: { 'x-branch-id': wrongHeaderBranchId } })
  const aOrder = await http('GET', `/api/pos/tables/${tableAId}/order`, { token: tokenDenied, headers: { 'x-branch-id': wrongHeaderBranchId } })
  results.A1 = {
    requestUrl: `${API_BASE}/api/pos/tables/${tableAId}/order`,
    status: aOrder.status,
    body: aOrder.data,
    pass: aOrder.status === 403
      && aOrder.data?.details
      && Object.prototype.hasOwnProperty.call(aOrder.data.details, 'headerBranchId')
      && Object.prototype.hasOwnProperty.call(aOrder.data.details, 'tokenBranchId')
      && Object.prototype.hasOwnProperty.call(aOrder.data.details, 'resolvedBranchId')
      && Object.prototype.hasOwnProperty.call(aOrder.data.details, 'allowedBranchIds')
      && Object.prototype.hasOwnProperty.call(aOrder.data.details, 'reason')
      && Object.prototype.hasOwnProperty.call(aOrder.data.details, 'branchSource')
  }

  // TEST-B
  await http('POST', `/api/pos/tables/${tableBId}/start`, { token: tokenAllowed })
  const bStart = await http('POST', `/api/pos/tables/${tableBId}/start`, { token: tokenAllowed })
  results.B1 = {
    requestUrl: `${API_BASE}/api/pos/tables/${tableBId}/start`,
    status: bStart.status,
    body: bStart.data,
    pass: bStart.status === 409 && !!bStart.data?.details?.orderId
  }
  const occupiedOrderId = bStart.data?.details?.orderId
  const bOrder = occupiedOrderId
    ? await http('GET', `/api/pos/orders/${occupiedOrderId}`, { token: tokenAllowed })
    : { status: 0, data: { message: 'missing_occupied_orderId' } }
  results.B2 = {
    requestUrl: occupiedOrderId ? `${API_BASE}/api/pos/orders/${occupiedOrderId}` : null,
    status: bOrder.status,
    body: bOrder.data,
    pass: occupiedOrderId ? bOrder.status === 200 : false
  }

  // TEST-C
  const cClose = await http('PUT', `/api/pos/tables/${tableBId}/close`, { token: tokenAllowed })
  results.C1 = {
    requestUrl: `${API_BASE}/api/pos/tables/${tableBId}/close`,
    status: cClose.status,
    body: cClose.data,
    pass: cClose.status === 200
  }

  const cOverview = await http('GET', '/api/pos/tables/overview', { token: tokenAllowed })
  const row = pickTableRow(cOverview.data, tableBId)
  results.C2 = {
    requestUrl: `${API_BASE}/api/pos/tables/overview`,
    status: cOverview.status,
    body: row,
    pass: cOverview.status === 200 && row && row.activeOrderId === null && String(row.status) === 'empty'
  }

  results._meta = {
    apiBase: API_BASE,
    tenantId,
    tableAId,
    tableBId,
    note: 'A1: 403 uses staff.denied (different branch). B: 409 produced by double-start. C: close verifies overview.'
  }

  console.log(JSON.stringify(results, null, 2))
  await mongoose.disconnect()
}

main().catch(async (e) => {
  try {
    console.error('FAILED', e?.message || e)
  } finally {
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  }
})
