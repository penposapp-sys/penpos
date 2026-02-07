import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import Order from '../src/models/Order.js'
import User from '../src/models/User.js'

import { closeOrderService, getWalkInOrdersService } from '../src/services/orderService.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const tenant = await Tenant.findOne({ slug: 'e2e-walkin-filter-tenant' })
    .then(async (t) => t || Tenant.create({ name: 'E2E Walkin Filter Tenant', slug: 'e2e-walkin-filter-tenant', status: 'active', isActive: true, systemType: 'kermes' }))
  const branch = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube', address: '', isActive: true }))

  const user = await User.findOne({ tenantId: tenant._id, email: 'e2e-walkin-filter@local' })
    .then(async (u) => u || User.create({ tenantId: tenant._id, branchId: branch._id, branchIds: [branch._id], systemType: 'kermes', name: 'E2E User', email: 'e2e-walkin-filter@local', passwordHash: 'x', role: 'tenant_admin', isActive: true, permissions: ['pos_access', 'walkin_access'] }))

  await Order.deleteMany({ tenantId: tenant._id, saleType: 'walkin', note: 'e2e-walkin-filter' }).catch(() => {})

  const openOrder = await Order.create({
    tenantId: tenant._id,
    branchId: branch._id,
    createdBy: user._id,
    saleType: 'walkin',
    status: 'open',
    note: 'e2e-walkin-filter',
    customerName: 'Misafir',
    items: [],
    payments: []
  })
  const closableOrder = await Order.create({
    tenantId: tenant._id,
    branchId: branch._id,
    createdBy: user._id,
    saleType: 'walkin',
    status: 'open',
    note: 'e2e-walkin-filter',
    customerName: 'Misafir',
    items: [],
    payments: []
  })

  await closeOrderService(String(tenant._id), String(closableOrder._id))

  const listed = await getWalkInOrdersService(String(tenant._id), { branchIds: [String(branch._id)] }, { status: 'active', limit: 50 })
  const ids = (listed.orders || []).map(o => String(o._id || o.id || ''))

  must(ids.includes(String(openOrder._id)), 'Open walkin order must be listed')
  must(!ids.includes(String(closableOrder._id)), 'Closed/completed walkin order must NOT be listed')

  console.log(JSON.stringify({ pass: true }, null, 2))
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
