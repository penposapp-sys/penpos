import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import Order from '../src/models/Order.js'
import User from '../src/models/User.js'

import { sendOrderService, setKitchenModeService, listKitchenOrdersService } from '../src/services/orderService.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const tenant = await Tenant.findOne({ slug: 'e2e-kitchen-mode-tenant' })
    .then(async (t) => t || Tenant.create({ name: 'E2E Kitchen Mode Tenant', slug: 'e2e-kitchen-mode-tenant', status: 'active', isActive: true, systemType: 'kermes' }))
  const branch = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube', address: '', isActive: true }))
  const user = await User.findOne({ tenantId: tenant._id, email: 'e2e-kitchen-mode@local' })
    .then(async (u) => u || User.create({ tenantId: tenant._id, branchId: branch._id, branchIds: [branch._id], systemType: 'kermes', name: 'E2E User', email: 'e2e-kitchen-mode@local', passwordHash: 'x', role: 'tenant_admin', isActive: true, permissions: ['pos_access'] }))

  await Order.deleteMany({ tenantId: tenant._id, note: 'e2e-kitchen-mode' }).catch(() => {})

  const order = await Order.create({
    tenantId: tenant._id,
    branchId: branch._id,
    createdBy: user._id,
    status: 'open',
    saleType: 'walkin',
    customerName: 'Misafir',
    note: 'e2e-kitchen-mode',
    sendToKitchen: true,
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
    payments: []
  })

  await setKitchenModeService(String(tenant._id), String(order._id), { sendToKitchen: false })

  const sent = await sendOrderService(String(tenant._id), String(order._id), { servingType: 'plate' })
  must(sent?.order?.status === 'sent', 'order must be sent even when kitchen disabled')

  const fresh = await Order.findById(order._id).lean()
  must(fresh.sendToKitchen === false, 'sendToKitchen must be false in db')
  must((fresh.items || []).some(it => it.status === 'sent'), 'items must become sent')

  const kitchen = await listKitchenOrdersService(String(tenant._id), { branchIds: [String(branch._id)] })
  const ids = (kitchen || []).map(o => String(o.id || o._id || ''))
  must(!ids.includes(String(order._id)), 'kitchen list must not include kitchen-disabled orders')

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
