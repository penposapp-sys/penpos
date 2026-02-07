import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import User from '../src/models/User.js'
import OrderCounter from '../src/models/OrderCounter.js'

import { buildOrderDayKey, getNextOrderSequence } from '../src/services/orderService.js'

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const tenant = await Tenant.findOne({ slug: 'e2e-ordercounter-tenant' })
    .then(async (t) => t || Tenant.create({ name: 'E2E OrderCounter Tenant', slug: 'e2e-ordercounter-tenant', status: 'active', isActive: true, systemType: 'kermes' }))

  const branchA = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube A' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube A', address: '', isActive: true }))
  const branchB = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube B' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube B', address: '', isActive: true }))

  await User.findOne({ tenantId: tenant._id, email: 'e2e-ordercounter@local' })
    .then(async (u) => u || User.create({ tenantId: tenant._id, branchId: branchA._id, branchIds: [branchA._id, branchB._id], systemType: 'kermes', name: 'E2E User', email: 'e2e-ordercounter@local', passwordHash: 'x', role: 'tenant_admin', isActive: true, permissions: ['pos_access'] }))

  const dayKey = buildOrderDayKey(new Date())
  await OrderCounter.deleteMany({ tenantId: tenant._id, dayKey }).catch(() => {})

  const runs = 20
  const tasks = Array.from({ length: runs }, (_, i) => {
    const branchId = (i % 2 === 0) ? branchA._id : branchB._id
    return getNextOrderSequence(String(tenant._id), String(branchId))
  })

  const results = await Promise.all(tasks)
  const nums = results.map(r => Number(r?.orderNo || 0))
  must(nums.every(n => Number.isFinite(n) && n >= 1), 'all orderNos must be >= 1')
  const set = new Set(nums)
  must(set.size === runs, 'orderNos must be unique')
  const sorted = Array.from(set).sort((a, b) => a - b)
  must(sorted[0] === 1 && sorted[sorted.length - 1] === runs, 'orderNos must be sequential 1..N')

  const counterCount = await OrderCounter.countDocuments({ tenantId: tenant._id, dayKey })
  must(counterCount === 1, 'there must be exactly one counter doc per tenant/dayKey')

  console.log(JSON.stringify({ pass: true, orderNos: sorted }, null, 2))
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

