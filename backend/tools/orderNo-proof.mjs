import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import Table from '../src/models/Table.js'
import Category from '../src/models/Category.js'
import MenuItem from '../src/models/MenuItem.js'
import Order from '../src/models/Order.js'
import OrderCounter from '../src/models/OrderCounter.js'

import { startOrderForTableService, abandonIfEmpty } from '../src/services/tableService.js'
import { addItemService, buildOrderDayKey } from '../src/services/orderService.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const dayKey = buildOrderDayKey(new Date())

  const tenant = await Tenant.findOne({ slug: 'e2e-orderno-tenant' })
    .then(async (t) => t || Tenant.create({ name: 'E2E OrderNo Tenant', slug: 'e2e-orderno-tenant', status: 'active', isActive: true, systemType: 'kermes' }))

  const branch = await Branch.findOne({ tenantId: tenant._id, name: 'E2E Şube' })
    .then(async (b) => b || Branch.create({ tenantId: tenant._id, name: 'E2E Şube', address: '', isActive: true }))

  const table = await Table.findOne({ tenantId: tenant._id, name: 'E2E Masa' })
    .then(async (t) => t || Table.create({ tenantId: tenant._id, branchId: branch._id, name: 'E2E Masa', status: 'empty', isActive: true, activeOrderId: null }))

  const category = await Category.findOne({ tenantId: tenant._id, name: 'E2E Kategori' })
    .then(async (c) => c || Category.create({ tenantId: tenant._id, name: 'E2E Kategori', isActive: true, sortOrder: 0 }))

  const menuItem = await MenuItem.findOne({ tenantId: tenant._id, name: 'E2E Ürün' })
    .then(async (m) => m || MenuItem.create({ tenantId: tenant._id, categoryId: category._id, name: 'E2E Ürün', price: 10, isActive: true }))

  await OrderCounter.deleteOne({ tenantId: tenant._id, branchId: branch._id, dayKey }).catch(() => {})
  await Order.deleteMany({ tenantId: tenant._id, tableId: table._id }).catch(() => {})
  await Table.updateOne({ _id: table._id }, { $set: { status: 'empty', activeOrderId: null } }).catch(() => {})

  const start = await startOrderForTableService(String(tenant._id), String(branch._id), String(table._id), String(branch._id))
  const startedOrder = await Order.findById(start.orderId).lean()
  must(startedOrder, 'Order must exist after start')
  must(startedOrder.orderNo == null, 'OrderNo must be null after start')
  must(!startedOrder.orderDayKey, 'orderDayKey must be empty after start')

  const abandonRes = await abandonIfEmpty({ tenantId: String(tenant._id), branchId: String(branch._id), tableId: String(table._id) })
  must(abandonRes.cleared === true, 'abandon must clear empty started order')

  const tableAfterAbandon = await Table.findById(table._id).lean()
  must(String(tableAfterAbandon.status) === 'empty', 'Table must be empty after abandon')
  must(tableAfterAbandon.activeOrderId == null, 'Table activeOrderId must be null after abandon')

  const countersAfterAbandon = await OrderCounter.find({ tenantId: tenant._id, branchId: branch._id, dayKey }).lean()
  must(countersAfterAbandon.length === 0 || Number(countersAfterAbandon[0].seq) >= 0, 'Counter must not be incremented by abandon')
  if (countersAfterAbandon.length > 0) {
    must(Number(countersAfterAbandon[0].seq) === 0, 'Counter seq must remain 0 when only abandon happened')
  }

  const start2 = await startOrderForTableService(String(tenant._id), String(branch._id), String(table._id), String(branch._id))
  const add = await addItemService(String(tenant._id), String(start2.orderId), String(menuItem._id), 1)

  const orderAfterAdd = add?.order
  must(orderAfterAdd && orderAfterAdd.orderNo != null, 'OrderNo must be assigned at first addItem')
  must(orderAfterAdd.orderDayKey === dayKey, 'OrderDayKey must be today when orderNo assigned')

  const counter = await OrderCounter.findOne({ tenantId: tenant._id, branchId: branch._id, dayKey }).lean()
  must(counter && Number(counter.seq) === Number(orderAfterAdd.orderNo), 'Counter seq must equal assigned orderNo')

  const abandonRes2 = await abandonIfEmpty({ tenantId: String(tenant._id), branchId: String(branch._id), tableId: String(table._id) })
  must(abandonRes2.cleared === false, 'abandon must not clear order with items')

  console.log(JSON.stringify({
    pass: true,
    startOrderNo: startedOrder.orderNo,
    afterAddOrderNo: orderAfterAdd.orderNo,
    dayKey,
    counterSeq: counter.seq
  }, null, 2))

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
