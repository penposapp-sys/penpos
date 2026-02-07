import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import Order from '../src/models/Order.js'
import User from '../src/models/User.js'

import { getWalkInOrdersService } from '../src/services/orderService.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const tenant = await Tenant.findOne({ slug: 'e2e-walkin-totals-tenant' })
    .then(async (t) => t || Tenant.create({ name: 'E2E Walkin Totals Tenant', slug: 'e2e-walkin-totals-tenant', status: 'active', isActive: true, systemType: 'kermes' }))
  const branch = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube', address: '', isActive: true }))

  const user = await User.findOne({ tenantId: tenant._id, email: 'e2e-walkin-totals@local' })
    .then(async (u) => u || User.create({ tenantId: tenant._id, branchId: branch._id, branchIds: [branch._id], systemType: 'kermes', name: 'E2E User', email: 'e2e-walkin-totals@local', passwordHash: 'x', role: 'tenant_admin', isActive: true, permissions: ['pos_access', 'walkin_access'] }))

  await Order.deleteMany({ tenantId: tenant._id, saleType: 'walkin', note: 'e2e-walkin-totals' }).catch(() => {})

  const paidOrder = await Order.create({
    tenantId: tenant._id,
    branchId: branch._id,
    createdBy: user._id,
    saleType: 'walkin',
    status: 'open',
    note: 'e2e-walkin-totals',
    customerName: 'Misafir',
    discountPercent: 0,
    items: [{
      menuItemId: new mongoose.Types.ObjectId(),
      nameSnapshot: 'E2E Ürün',
      priceSnapshot: 10,
      qty: 1,
      subtotal: 10,
      note: '',
      status: 'open',
      sentAt: null
    }],
    payments: [{ method: 'cash', amount: 10, note: '' }]
  })

  const listed = await getWalkInOrdersService(String(tenant._id), { branchIds: [String(branch._id)] }, { status: 'active', limit: 50 })
  const row = (listed.orders || []).find(o => String(o._id || o.id || '') === String(paidOrder._id))
  must(row, 'Paid (open) walkin order must be listed')

  const totals = row.totals || {}
  must(Number.isFinite(Number(totals.netTotal)), 'netTotal must be present')
  must(Number.isFinite(Number(totals.paidTotal)), 'paidTotal must be present')
  must(Number.isFinite(Number(totals.balanceDue)), 'balanceDue must be present')
  must(Math.abs(Number(totals.balanceDue)) <= 0.01, 'balanceDue must be 0 after full payment')

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

