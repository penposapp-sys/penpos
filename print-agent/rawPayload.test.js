import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeRawPayload } from './rawPayload.js'

test('decodes base64 RAW bytes without text conversion', () => {
  const source = Buffer.from([0x1b, 0x40, 0x1d, 0x76, 0x30, 0, 0xff])
  assert.deepEqual(decodeRawPayload(source.toString('base64'), 'base64'), source)
})

test('leaves existing text RAW payloads unchanged', () => {
  assert.equal(decodeRawPayload('Nakit 10.00 TL', 'cp857'), 'Nakit 10.00 TL')
})

test('rejects malformed base64 RAW payloads', () => {
  assert.throws(() => decodeRawPayload('not valid base64!', 'base64'), /Invalid base64 raw payload/)
})

test('requires binary encoding for designed order receipts', () => {
  assert.throws(
    () => decodeRawPayload('SGVsbG8=', 'cp857', { requireBase64: true }),
    /Binary RAW payload requires base64 encoding/
  )
})

test('decodes designed order receipts to bytes when encoding is declared', () => {
  const source = Buffer.from([0x1b, 0x40, 0x1d, 0x76, 0x30, 0, 0x41, 0x00, 0xff])
  const decoded = decodeRawPayload(source.toString('base64'), 'base64', { requireBase64: true })
  assert.ok(Buffer.isBuffer(decoded))
  assert.deepEqual(decoded, source)
})
