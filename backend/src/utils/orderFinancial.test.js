import assert from 'node:assert/strict'
import test from 'node:test'
import { computePaymentSummary, hasPaymentExcess } from './orderFinancial.js'

test('quick-sale cancellation requires deleting payments that exceed the remaining total', () => {
  const orderAfterCancel = {
    items: [
      { qty: 1, subtotal: 50, status: 'sent' },
      { qty: 1, subtotal: 40, status: 'sent' },
      { qty: 1, subtotal: 50, status: 'cancelled' }
    ],
    payments: [{ amount: 120 }]
  }

  assert.equal(computePaymentSummary(orderAfterCancel).netTotal, 90)
  assert.equal(hasPaymentExcess(orderAfterCancel), true)

  const afterPaymentDeleted = { ...orderAfterCancel, payments: [] }
  const afterCreditEntry = {
    ...afterPaymentDeleted,
    settlementType: 'veresiye',
    veresiyeAmount: 90
  }
  const finalSummary = computePaymentSummary(afterCreditEntry)
  assert.equal(finalSummary.balanceDue, 0)
  assert.equal(hasPaymentExcess(afterCreditEntry), false)
})

test('removing an unsent quick-sale addition restores the paid total', () => {
  const orderAfterAddition = {
    items: [
      { qty: 2, subtotal: 100, status: 'sent' },
      { qty: 1, subtotal: 40, status: 'sent' },
      { qty: 1, subtotal: 15, status: 'open' }
    ],
    payments: [{ amount: 120 }]
  }
  const orderAfterRemovingAddition = {
    ...orderAfterAddition,
    items: orderAfterAddition.items.filter((item) => item.status !== 'open')
  }

  assert.equal(computePaymentSummary(orderAfterAddition).balanceDue, 35)
  assert.equal(computePaymentSummary(orderAfterRemovingAddition).balanceDue, 20)
  assert.equal(hasPaymentExcess(orderAfterRemovingAddition), false)
})
