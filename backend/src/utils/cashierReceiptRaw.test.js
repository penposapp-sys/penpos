import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCashierReceiptLines, buildCashierReceiptRaw } from './cashierReceiptRaw.js'
import { decodeRawPayload } from '../../../print-agent/rawPayload.js'

const logo = Buffer.from('<svg width="1000" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="120" fill="white"/><circle cx="500" cy="60" r="48" fill="black"/></svg>')

const baseReceipt = {
  businessName: 'Pendik Tanitim Etkinlikleri',
  receiptNo: 'FIS-123456',
  orderNo: '20250001',
  createdAt: '2025-03-08T10:15:00.000Z',
  tableName: 'Masa 4',
  cashierName: 'Ayse Yilmaz',
  items: [
    { nameSnapshot: 'Cok Uzun Isimli Izgara Tavuk Urunu', priceSnapshot: 120, qty: 2, subtotal: 240, status: 'sent' },
    { nameSnapshot: 'Ayran', priceSnapshot: 25, qty: 1, subtotal: 25, status: 'sent' }
  ],
  totals: { subtotal: 265, grandTotal: 265 },
  paidTotal: 0,
  balanceDue: 265,
  displayBalance: 0,
  payments: [],
  paymentMethod: '',
  saleSource: 'quick-sale'
}

const contains = (raw, value) => raw.includes(Buffer.from(value, 'ascii'))

test('quick sale RAW is short, branded, and prints an optional note', async () => {
  const receipt = { ...baseReceipt, note: 'Paket olsun', payments: [{ methodLabel: 'Nakit', amount: 265 }] }
  const raw = await buildCashierReceiptRaw(receipt, { widthMm: 80, logoBuffer: logo })
  const lines = buildCashierReceiptLines(receipt, 48)
  assert.deepEqual(decodeRawPayload(raw.toString('base64'), 'base64'), raw)
  assert.ok(contains(raw, 'PENDIK TANITIM ETKINLIKLERI'))
  assert.ok(contains(raw, 'HIZLI SATIS'))
  assert.ok(contains(raw, 'TESEKKUR EDERIZ'))
  assert.ok(contains(raw, 'Not: Paket olsun'))
  assert.ok(contains(raw, 'Nakit: 265.00 TL'))
  assert.ok(!contains(raw, 'Masa:'))
  assert.ok(!contains(raw, 'Kasiyer:'))
  assert.ok(lines.every((line) => line.length <= 48))
  assert.ok(raw.includes(Buffer.from([0x1d, 0x76, 0x30, 0])))
  assert.deepEqual(raw.subarray(-4), Buffer.from([0x1d, 0x56, 0x41, 3]))
})

test('quick sale without note keeps cash and card payment formats distinct', async (t) => {
  for (const method of ['Nakit', 'Kart']) {
    await t.test(method, async () => {
      const raw = await buildCashierReceiptRaw({
        ...baseReceipt,
        note: '',
        payments: [{ methodLabel: method, amount: 265 }]
      }, { widthMm: 58 })
      assert.ok(contains(raw, 'Odeme:'))
      assert.ok(contains(raw, `${method}: 265.00 TL`))
      assert.ok(!contains(raw, 'Not:'))
      assert.ok(contains(raw, 'HIZLI SATIS'))
    })
  }
})

test('table receipt includes unpaid, partial, and paid totals on both widths', async (t) => {
  const cases = [
    { paidTotal: 0, balanceDue: 265, payments: [], expected: 'BEKLIYOR' },
    { paidTotal: 100, balanceDue: 165, payments: [{ methodLabel: 'Kart', amount: 100 }], expected: 'KISMI ODENDI' },
    { paidTotal: 265, balanceDue: 0, payments: [{ methodLabel: 'Nakit', amount: 265 }], expected: 'ODENDI' }
  ]
  for (const payment of cases) {
    await t.test(payment.expected, async () => {
      const receipt = {
        ...baseReceipt,
        saleSource: 'standard',
        note: '',
        ...payment
      }
      const raw58 = await buildCashierReceiptRaw(receipt, { widthMm: 58, logoBuffer: logo })
      const raw80 = await buildCashierReceiptRaw(receipt, { widthMm: 80, logoBuffer: logo })
      const lines58 = buildCashierReceiptLines(receipt, 32)
      const lines80 = buildCashierReceiptLines(receipt, 48)
      assert.ok(contains(raw58, 'MASA SIPARISI'))
      assert.ok(contains(raw58, 'Masa:'))
      assert.ok(contains(raw58, 'Fis No:'))
      assert.ok(contains(raw58, 'Siparis No:'))
      assert.ok(contains(raw58, '2 x 120.00 TL'))
      assert.ok(contains(raw58, '1 x 25.00 TL'))
      assert.ok(contains(raw58, '240.00 TL'))
      assert.ok(contains(raw58, '25.00 TL'))
      assert.ok(contains(raw80, '2 x 120.00 TL'))
      assert.ok(contains(raw80, '1 x 25.00 TL'))
      assert.ok(contains(raw80, '240.00 TL'))
      assert.ok(contains(raw80, '25.00 TL'))
      assert.ok(contains(raw58, payment.expected))
      assert.ok(contains(raw58, 'Ara Toplam:'))
      assert.ok(contains(raw58, 'Odenen:'))
      assert.ok(contains(raw58, 'Kalan:'))
      assert.ok(contains(raw58, 'Bakiye:'))
      assert.ok(contains(raw58, 'GENEL TOPLAM:'))
      assert.ok(contains(raw58, 'AFIYET OLSUN'))
      assert.ok(lines58.every((line) => line.length <= 32))
      assert.ok(lines80.every((line) => line.length <= 48))
      const rasterCommand = Buffer.from([0x1d, 0x76, 0x30, 0])
      const logo58 = raw58.indexOf(rasterCommand)
      const logo80 = raw80.indexOf(rasterCommand)
      assert.notEqual(logo58, -1)
      assert.notEqual(logo80, -1)
      assert.deepEqual(raw58.subarray(logo58 + 4, logo58 + 6), Buffer.from([48, 0]))
      assert.deepEqual(raw80.subarray(logo80 + 4, logo80 + 6), Buffer.from([72, 0]))
      const totalLabel = Buffer.from('GENEL TOPLAM:', 'ascii')
      const totalOffset = raw58.indexOf(totalLabel)
      assert.notEqual(totalOffset, -1)
      assert.deepEqual(raw58.subarray(totalOffset - 6, totalOffset), Buffer.from([0x1b, 0x45, 1, 0x1d, 0x21, 1]))
    })
  }
})

test('table receipt binary survives JSON transport and Print Agent decoding', async () => {
  const raw = await buildCashierReceiptRaw({
    ...baseReceipt,
    saleSource: 'standard',
    note: 'Terasta servis',
    payments: [{ methodLabel: 'Kart', amount: 100 }],
    paidTotal: 100,
    balanceDue: 165
  }, { widthMm: 80, logoBuffer: logo })
  const job = JSON.parse(JSON.stringify({
    payloadType: 'raw',
    rawContent: raw.toString('base64'),
    meta: { renderOrderReceiptRaw: true, rawEncoding: 'base64' }
  }))
  const agentBytes = decodeRawPayload(job.rawContent, job.meta.rawEncoding, {
    requireBase64: job.meta.renderOrderReceiptRaw
  })

  assert.ok(Buffer.isBuffer(agentBytes))
  assert.deepEqual(agentBytes, raw)
  assert.ok(agentBytes.includes(Buffer.from([0x1b, 0x40])))
  assert.ok(agentBytes.includes(Buffer.from([0x1d, 0x76, 0x30, 0])))
  assert.ok(agentBytes.includes(Buffer.from('MASA SIPARISI', 'ascii')))
  assert.ok(agentBytes.includes(Buffer.from('KISMI ODENDI', 'ascii')))
  assert.ok(agentBytes.includes(Buffer.from('Terasta servis', 'ascii')))
  assert.ok(!agentBytes.includes(Buffer.from(job.rawContent, 'ascii')))
})

test('missing tenant logo still produces a complete RAW receipt', async () => {
  const raw = await buildCashierReceiptRaw(baseReceipt, { widthMm: 80 })
  assert.ok(contains(raw, 'PENDIK TANITIM ETKINLIKLERI'))
  assert.ok(contains(raw, 'HIZLI SATIS'))
  assert.ok(!raw.includes(Buffer.from([0x1d, 0x76, 0x30, 0])))
})
