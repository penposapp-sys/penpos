import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPlanGrossTotal,
  getPlanInstallmentAmount,
  validateAnaokuluPlanSchedules
} from '../src/utils/anaokuluPlanValidation.js'

const schedule = [
  { no: 1, dueDate: '2026-09-15', amount: 2000 },
  { no: 2, dueDate: '2026-10-15', amount: 8000 },
  { no: 3, dueDate: '2026-11-15', amount: 5000 },
  { no: 4, dueDate: '2026-12-15', amount: 5000 }
]

const customPlan = {
  name: 'Eğitim',
  total: 20000,
  installments: 4,
  installmentSchedule: schedule,
  skippedInstallments: [{ no: 1, deductionOnly: true, deductedAmount: 1000 }]
}

test('backend accepts a custom schedule whose sum exactly matches net plan total', () => {
  assert.doesNotThrow(() => validateAnaokuluPlanSchedules([{ items: [customPlan] }]))
})

test('backend rejects even a one-kurus schedule difference', () => {
  const invalidPlan = {
    ...customPlan,
    installmentSchedule: [...schedule.slice(0, 3), { ...schedule[3], amount: 4999.99 }]
  }
  assert.throws(
    () => validateAnaokuluPlanSchedules([{ items: [invalidPlan] }]),
    /Fark:.*0,01/
  )
})

test('backend rejects a schedule row count that differs from installment count', () => {
  assert.throws(
    () => validateAnaokuluPlanSchedules([{ items: [{ ...customPlan, installmentSchedule: schedule.slice(0, 3) }] }]),
    /satır.*sayısı/
  )
})

test('legacy plans without a saved schedule remain valid and retain old totals', () => {
  const legacyPlan = {
    total: 19000,
    installments: 4,
    skippedInstallments: [{ no: 1, originalAmount: 5000, deductedAmount: 1000, period: 'half' }]
  }
  assert.doesNotThrow(() => validateAnaokuluPlanSchedules([{ items: [legacyPlan] }]))
  assert.equal(getPlanGrossTotal(legacyPlan), 20000)
  assert.equal(getPlanInstallmentAmount(legacyPlan, 1), 4000)
})
