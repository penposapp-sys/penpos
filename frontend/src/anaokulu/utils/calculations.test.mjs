import test from 'node:test'
import assert from 'node:assert/strict'
import {
  expectedFor,
  expectedTotalFor,
  getLucaInvoiceDate,
  getPlanInstallmentAmount,
  getPlanInstallmentSchedule,
  getPlanNetTotal
} from './calculations.js'

test('Luca invoice date uses period end for previous month within seven days', () => {
  assert.equal(getLucaInvoiceDate('2026-09', new Date(2026, 9, 1)), '2026-09-30')
  assert.equal(getLucaInvoiceDate('2026-09', new Date(2026, 9, 5)), '2026-09-30')
  assert.equal(getLucaInvoiceDate('2026-09', new Date(2026, 9, 7)), '2026-09-30')
})

test('Luca invoice date uses today when period end is more than seven days old', () => {
  assert.equal(getLucaInvoiceDate('2026-09', new Date(2026, 9, 8)), '2026-10-08')
})

test('Luca invoice date uses today for the current month', () => {
  assert.equal(getLucaInvoiceDate('2026-09', new Date(2026, 8, 15)), '2026-09-15')
})

test('legacy plans retain equal installment amounts', () => {
  const schedule = getPlanInstallmentSchedule({ total: 20000, installments: 4, start: '2026-09-15' })
  assert.deepEqual(schedule.map(row => row.amount), [5000, 5000, 5000, 5000])
})

test('custom installments and attendance reduce only the selected month and total balance', () => {
  const plan = {
    name: 'Eğitim',
    total: 20000,
    installments: 4,
    start: '2026-09-15',
    installmentSchedule: [
      { no: 1, dueDate: '2026-09-15', amount: 2000 },
      { no: 2, dueDate: '2026-10-15', amount: 8000 },
      { no: 3, dueDate: '2026-11-15', amount: 5000 },
      { no: 4, dueDate: '2026-12-15', amount: 5000 }
    ],
    skippedInstallments: [{ no: 1, deductedAmount: 1000, deductionOnly: true }]
  }
  const state = { settings: { yearStart: '2026-09' }, students: [{ id: 1, items: [plan] }] }

  assert.equal(getPlanInstallmentAmount(plan, 1), 1000)
  assert.equal(getPlanInstallmentAmount(plan, 2), 8000)
  assert.equal(expectedFor(state, 1, '2026-09'), 1000)
  assert.equal(expectedFor(state, 1, '2026-10'), 8000)
  assert.equal(expectedTotalFor(state, 1), 19000)
  assert.equal(getPlanNetTotal({ ...plan, skippedInstallments: [] }), 20000)
})

test('legacy attendance reductions can be undone without changing other installments', () => {
  const legacyPlan = {
    total: 19000,
    basePrice: 20000,
    installments: 4,
    start: '2026-09-15',
    skippedInstallments: [{ no: 1, originalAmount: 5000, deductedAmount: 1000, period: 'half' }]
  }

  assert.equal(getPlanNetTotal(legacyPlan), 19000)
  assert.equal(getPlanInstallmentAmount(legacyPlan, 1), 4000)
  assert.equal(getPlanInstallmentAmount({ ...legacyPlan, total: 20000, skippedInstallments: [] }, 1), 5000)
  assert.equal(getPlanInstallmentAmount({ ...legacyPlan, total: 20000, skippedInstallments: [] }, 2), 5000)
})