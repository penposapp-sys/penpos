import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import Table from '../src/models/Table.js'
import Category from '../src/models/Category.js'
import MenuItem from '../src/models/MenuItem.js'
import Order from '../src/models/Order.js'

import { startOrderForTableService, closeTableService } from '../src/services/tableService.js'
import { addItemService, setItemQuantityByItemIdService } from '../src/services/orderService.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const tenant = await Tenant.findOne({ slug: 'e2e-minus-tenant' })
    .then(async (t) => t || Tenant.create({ name: 'E2E Minus Tenant', slug: 'e2e-minus-tenant', status: 'active', isActive: true, systemType: 'kermes' }))
  const branch = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube', address: '', isActive: true }))
  const table = await Table.findOne({ tenantId: tenant._id, name: 'E2E Masa' })
    .then(async (t) => t || Table.create({ tenantId: tenant._id, branchId: branch._id, name: 'E2E Masa', status: 'empty', isActive: true, activeOrderId: null }))
  const category = await Category.findOne({ tenantId: tenant._id, name: 'E2E Kategori' })
    .then(async (c) => c || Category.create({ tenantId: tenant._id, name: 'E2E Kategori', isActive: true, sortOrder: 0 }))
  const menuItem = await MenuItem.findOne({ tenantId: tenant._id, name: 'E2E Ürün' })
    .then(async (m) => m || MenuItem.create({ tenantId: tenant._id, categoryId: category._id, name: 'E2E Ürün', price: 10, isActive: true }))

  await Order.deleteMany({ tenantId: tenant._id, tableId: table._id }).catch(() => {})
  await Table.updateOne({ _id: table._id }, { $set: { status: 'empty', activeOrderId: null } }).catch(() => {})

  const started = await startOrderForTableService(String(tenant._id), String(branch._id), String(table._id), String(branch._id))
  const added1 = await addItemService(String(tenant._id), String(started.orderId), String(menuItem._id), 1)
  const itemId = added1?.order?.items?.[0]?._id || added1?.order?.items?.[0]?.id
  must(itemId, 'Item id must exist')

  const set2 = await setItemQuantityByItemIdService(String(tenant._id), String(started.orderId), String(itemId), 2)
  must(set2.order.items.find(i => String(i._id) === String(itemId))?.qty === 2, 'Qty must become 2')

  const set1 = await setItemQuantityByItemIdService(String(tenant._id), String(started.orderId), String(itemId), 1)
  must(set1.order.items.find(i => String(i._id) === String(itemId))?.qty === 1, 'Qty must become 1')

  const set0 = await setItemQuantityByItemIdService(String(tenant._id), String(started.orderId), String(itemId), 0)
  must(!set0.order.items.some(i => String(i._id) === String(itemId)), 'Item must be removed on qty 0')

  await closeTableService(String(tenant._id), String(table._id), String(branch._id)).catch(() => {})

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

