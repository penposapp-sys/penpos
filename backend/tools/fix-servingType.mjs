import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

import Order from '../src/models/Order.js'

const normalizeServingType = (value) => {
  if (value === undefined || value === null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const simplified = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (simplified === 'tray' || simplified === 'plate' || simplified === 'package') return simplified
  if (simplified === 'tepside') return 'tray'
  if (simplified === 'tabakta') return 'plate'
  if (simplified === 'paket') return 'package'
  return null
}

const defaultServingTypeForOrder = (saleType) => (String(saleType || '').trim() === 'delivery' ? 'package' : 'plate')

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  let scanned = 0
  let updatedOrders = 0
  let updatedItems = 0
  let updatedBatches = 0

  const cursor = Order.find({}).select('_id saleType servingType items.servingType kitchenBatches.servingType').lean().cursor()
  const ops = []

  for await (const o of cursor) {
    scanned += 1
    const saleType = o?.saleType
    const defaultServing = defaultServingTypeForOrder(saleType)

    const nextOrderServing = String(saleType || '').trim() === 'delivery'
      ? 'package'
      : (normalizeServingType(o?.servingType) || defaultServing)
    const set = {}
    let changed = false

    if (String(o?.servingType || '') !== nextOrderServing) {
      set.servingType = nextOrderServing
      changed = true
      updatedOrders += 1
    }

    const items = Array.isArray(o?.items) ? o.items : []
    let nextItems = null
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      if (!it) continue
      const next = normalizeServingType(it.servingType) || nextOrderServing
      if (String(it.servingType || '') !== next) {
        if (!nextItems) nextItems = items.map(x => ({ ...x }))
        nextItems[i].servingType = next
        changed = true
        updatedItems += 1
      }
    }
    if (nextItems) set.items = nextItems

    const batches = Array.isArray(o?.kitchenBatches) ? o.kitchenBatches : []
    let nextBatches = null
    for (let i = 0; i < batches.length; i += 1) {
      const b = batches[i]
      if (!b) continue
      const next = normalizeServingType(b.servingType) || nextOrderServing
      if (String(b.servingType || '') !== next) {
        if (!nextBatches) nextBatches = batches.map(x => ({ ...x }))
        nextBatches[i].servingType = next
        changed = true
        updatedBatches += 1
      }
    }
    if (nextBatches) set.kitchenBatches = nextBatches

    if (changed) {
      ops.push({
        updateOne: {
          filter: { _id: o._id },
          update: { $set: set }
        }
      })
    }

    if (ops.length >= 250) {
      await Order.bulkWrite(ops, { ordered: false })
      ops.length = 0
    }
  }

  if (ops.length > 0) {
    await Order.bulkWrite(ops, { ordered: false })
  }

  console.log('[fix-servingType] done', { scanned, updatedOrderServingType: updatedOrders, updatedItemServingType: updatedItems, updatedBatchServingType: updatedBatches })

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('[fix-servingType] failed', e)
  process.exit(1)
})
