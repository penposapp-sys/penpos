import assert from 'node:assert/strict'
import { test } from 'node:test'
import Order from '../src/models/Order.js'
import { completeQuickSaleOrderWhenKitchenReady } from '../src/utils/quickSaleKitchen.js'
import { computePaymentSummary } from '../src/utils/orderFinancial.js'

test('orders persist quick-sale separately from standard sales', () => {
  const sourcePath = Order.schema.path('saleSource')
  assert.ok(sourcePath)
  assert.deepEqual(sourcePath.enumValues, ['standard', 'quick-sale'])

  const standardOrder = new Order()
  assert.equal(standardOrder.saleSource, 'standard')

  const quickSaleOrder = new Order({ saleSource: 'quick-sale' })
  assert.equal(quickSaleOrder.validateSync()?.errors?.saleSource, undefined)

  const kitchenPreferenceOrder = new Order({
    saleSource: 'quick-sale',
    customerName: 'Ahmet',
    tableName: 'Pencere kenarı',
    servingType: 'tray',
    kitchenEnabled: false,
    sendToKitchen: false
  })
  assert.equal(kitchenPreferenceOrder.validateSync()?.errors?.servingType, undefined)
  assert.equal(kitchenPreferenceOrder.tableName, 'Pencere kenarı')
  assert.equal(kitchenPreferenceOrder.customerName, 'Ahmet')
  assert.equal(kitchenPreferenceOrder.servingType, 'tray')
  assert.equal(kitchenPreferenceOrder.kitchenEnabled, false)
  assert.equal(kitchenPreferenceOrder.sendToKitchen, false)

  const invalidOrder = new Order({ saleSource: 'unknown' })
  assert.equal(invalidOrder.validateSync()?.errors?.saleSource?.kind, 'enum')
})

test('quick-sale orders support idempotent request keys and an audit history', () => {
  assert.ok(Order.schema.path('quickSaleRequestId'))
  assert.ok(Order.schema.path('quickSalePayloadHash'))
  assert.ok(Order.schema.path('quickSaleHistory'))
  assert.ok(Order.schema.path('quickSaleAdjustmentRequests'))
  const requestIndex = Order.schema.indexes().find(([keys, options]) => (
    keys.quickSaleRequestId === 1 && options.unique === true
  ))
  assert.ok(requestIndex)
  assert.deepEqual(requestIndex[1].partialFilterExpression, {
    quickSaleRequestId: { $type: 'string' }
  })

  const order = new Order({
    saleType: 'walkin',
    saleSource: 'quick-sale',
    quickSaleRequestId: 'quick-sale-request-123',
    quickSalePayloadHash: 'abc123',
    quickSaleHistory: [{ action: 'sale_created', actorUserName: 'Kasiyer' }]
  })
  assert.equal(order.validateSync()?.errors?.quickSaleHistory, undefined)
})

test('quick-sale discounts and full credit settlement produce a balanced order', () => {
  const order = new Order({
    saleType: 'walkin',
    saleSource: 'quick-sale',
    items: [{ nameSnapshot: 'Ürün', qty: 2, priceSnapshot: 100, subtotal: 200, status: 'open' }],
    discountPercent: 10,
    payments: [],
    settlementType: 'veresiye',
    veresiyeAmount: 180,
    veresiyeEntries: [{
      accountId: new Order.base.Types.ObjectId(),
      amount: 180,
      note: 'Hızlı satış',
      createdAt: new Date()
    }],
    paymentStatus: 'paid'
  })

  const summary = computePaymentSummary(order)
  assert.equal(order.validateSync()?.errors?.veresiyeEntries, undefined)
  assert.equal(summary.total, 200)
  assert.equal(summary.discountTotal, 20)
  assert.equal(summary.netTotal, 180)
  assert.equal(summary.veresiyeTotal, 180)
  assert.equal(summary.balanceDue, 0)
})

test('quick-sale kitchen completion closes the order only after all active items are ready', () => {
  const completedAt = new Date('2026-10-31T12:00:00.000Z')
  const order = {
    saleSource: 'quick-sale',
    status: 'sent',
    currentKitchenBatchId: 'batch-1',
    items: [{ status: 'completed' }, { status: 'sent' }],
    kitchenBatches: [{ batchId: 'batch-1', completedAt: null }]
  }

  assert.equal(completeQuickSaleOrderWhenKitchenReady(order, completedAt), false)
  assert.equal(order.status, 'sent')

  order.items[1].status = 'completed'
  assert.equal(completeQuickSaleOrderWhenKitchenReady(order, completedAt), true)
  assert.equal(order.status, 'completed')
  assert.equal(order.closedAt, completedAt)
  assert.equal(order.currentKitchenBatchId, null)
  assert.equal(order.kitchenBatches[0].completedAt, completedAt)
})

test('kitchen completion leaves regular restaurant orders unchanged', () => {
  const order = { saleSource: 'standard', status: 'sent', items: [{ status: 'completed' }] }
  assert.equal(completeQuickSaleOrderWhenKitchenReady(order), false)
  assert.equal(order.status, 'sent')
  assert.equal(order.closedAt, undefined)
})
