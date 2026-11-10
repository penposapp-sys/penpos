import assert from 'node:assert/strict'
import test from 'node:test'
import { createRfCaptureDeduper, parseSerialLine } from '../electron/serialProtocol.js'

const captureLine = (overrides = {}) => JSON.stringify({
  version: 1,
  type: 'rf.capture',
  eventType: 'raw_capture',
  deviceId: '',
  buttonCode: '',
  protocol: 'unknown',
  captureId: 7,
  frequencyMHz: 433.92,
  receiverBandwidthKHz: 58,
  firstLevel: 'high',
  pulseUs: [350, 1050, 360, 1040, 355, 1055, 345, 1045],
  ...overrides
})

test('parses an undecoded 433 MHz capture without inventing a remote or button', () => {
  const parsed = parseSerialLine(captureLine())

  assert.equal(parsed.kind, 'capture')
  assert.equal(parsed.event.eventType, 'raw_capture')
  assert.equal(parsed.event.protocol, 'unknown')
  assert.equal(parsed.event.deviceId, '')
  assert.equal(parsed.event.buttonCode, '')
  assert.equal(parsed.event.frequencyMHz, 433.92)
  assert.equal(parsed.event.receiverBandwidthKHz, 58)
  assert.equal(parsed.event.pulseCount, 8)
  assert.match(parsed.event.fingerprint, /^[a-f0-9]{64}$/)
})

test('rejects malformed, oversized, unsupported, or unsafe radio messages', () => {
  assert.equal(parseSerialLine('{broken').kind, 'invalid')
  assert.equal(parseSerialLine('x'.repeat(16_385)).kind, 'invalid')
  assert.equal(parseSerialLine('{"type":"rf.error","error":"CC1101 unavailable"}').error, 'CC1101 unavailable')
  assert.equal(parseSerialLine(captureLine({ protocol: 'EV1527' })).kind, 'invalid')
  assert.equal(parseSerialLine(captureLine({ eventType: 'capture' })).kind, 'invalid')
  assert.equal(parseSerialLine(captureLine({ deviceId: 'made-up' })).kind, 'invalid')
  assert.equal(parseSerialLine(captureLine({ buttonCode: 'A' })).kind, 'invalid')
  assert.equal(parseSerialLine(captureLine({ frequencyMHz: 315 })).kind, 'invalid')
  assert.equal(parseSerialLine(captureLine({ receiverBandwidthKHz: 0 })).kind, 'invalid')
  assert.equal(parseSerialLine(captureLine({ pulseUs: [1, 2, 3] })).kind, 'invalid')
  assert.equal(parseSerialLine(captureLine({ pulseUs: [350, 1050, 360, 1040, 355, 1055, 345, 30_001] })).kind, 'invalid')
})

test('ignores blank and non-RF control messages', () => {
  assert.equal(parseSerialLine(' ').kind, 'ignore')
  assert.deepEqual(parseSerialLine('{"ok":true}'), { kind: 'control', message: { ok: true } })
})

test('deduplicates repeat captures inside the configured window and accepts later presses', () => {
  const first = parseSerialLine(captureLine()).event
  const sameSignal = parseSerialLine(captureLine({ captureId: 8, pulseUs: [355, 1054, 365, 1044, 354, 1056, 346, 1046] })).event
  const deduper = createRfCaptureDeduper({ windowMs: 1800 })

  assert.equal(first.fingerprint, sameSignal.fingerprint)
  assert.equal(deduper.accept(first, 1000), true)
  assert.equal(deduper.accept(sameSignal, 1500), false)
  assert.equal(deduper.accept(sameSignal, 3401), true)
})
