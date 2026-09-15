import assert from 'node:assert/strict'

const students = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }))
const invoices = Array.from({ length: 15 }, (_, index) => ({ studentId: index + 1, date: '2026-09-15', total: 1000 }))
const invoicedStudentCount = new Set(invoices.map((invoice) => String(invoice.studentId))).size
const invoiceCount = invoices.length
const uninvoicedStudentCount = students.length - invoicedStudentCount

assert.equal(invoiceCount, 15)
assert.equal(invoicedStudentCount, 15)
assert.equal(uninvoicedStudentCount, 35)
console.log('Anaokulu invoice fixture passed: 50 students, 15 invoiced students, 35 uninvoiced students, 15 invoices')