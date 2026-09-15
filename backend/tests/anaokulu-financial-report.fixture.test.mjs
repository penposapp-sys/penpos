import assert from 'node:assert/strict'
import { financialSummaryForStudent } from '../../frontend/src/anaokulu/utils/calculations.js'

const state = {
  settings: { yearStart: '2026-01' },
  students: [{ id: 1, name: 'Ornek Ogrenci', items: [{ name: 'Yillik Plan', basePrice: 215000, total: 165000, downPayment: 5000, installments: 10, start: '2026-01-15' }] }],
  collections: [
    { id: 1, studentId: 1, item: 'Yillik Plan', installmentNo: 0, amount: 5000, date: '2026-01-15' },
    { id: 2, studentId: 1, item: 'Yillik Plan', installmentNo: 1, amount: 16000, date: '2026-01-20' }
  ],
  invoices: []
}

const result = financialSummaryForStudent(state, 1, '2025-01-01')
assert.equal(result.gross, 215000)
assert.equal(result.discount, 50000)
assert.equal(result.net, 165000)
assert.equal(result.downPayment, 5000)
assert.equal(result.installmentPaid, 16000)
assert.equal(result.paid, 21000)
assert.equal(result.remaining, 144000)
assert.equal(result.paid, result.downPayment + result.installmentPaid)
assert.notEqual(result.paid, 26000)

const overdueResult = financialSummaryForStudent({
  settings: { yearStart: '2024-01' },
  students: [{ id: 2, name: 'Vadesi Gecmis', items: [{ name: 'Plan', basePrice: 215000, total: 165000, downPayment: 5000, installments: 10, start: '2024-01-15' }] }],
  collections: [{ id: 3, studentId: 2, item: 'Plan', installmentNo: 0, amount: 5000, date: '2024-01-15' }]
}, 2, '2026-09-15')
assert.equal(overdueResult.overdue, 16000 * 10)
console.log('Anaokulu overdue fixture passed: each unpaid overdue installment excludes its distributed down-payment share')
console.log('Anaokulu financial fixture passed: gross=215000 discount=50000 net=165000 downPayment=5000 installmentPaid=16000 paid=21000 remaining=144000')
