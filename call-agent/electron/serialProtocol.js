import { createHash } from 'node:crypto'

const MAX_LINE_LENGTH = 16_384
const MIN_PULSE_COUNT = 8
const MAX_PULSE_COUNT = 256
const MIN_PULSE_US = 50
const MAX_PULSE_US = 30_000
const VALID_FREQUENCY_MIN_MHZ = 400
const VALID_FREQUENCY_MAX_MHZ = 500

export const parseSerialLine = (line) => {
  const received = String(line || '').trim()
  if (!received) return { kind: 'ignore' }
  if (received.length > MAX_LINE_LENGTH) {
    return { kind: 'invalid', error: 'Seri mesaj izin verilen boyutu aşıyor.' }
  }
  let raw = received
  const versionedJsonStart = raw.indexOf('{"version":')
  if (versionedJsonStart > 0) {
    const prefix = raw.slice(0, versionedJsonStart)
    // A boot byte can itself equal '{'. Prefer the firmware's JSON marker
    // when binary/control noise precedes it, even if noise contains braces.
    if (/[\u0000-\u001F\u007F-\u009F\uFFFD]/.test(prefix)) {
      raw = raw.slice(versionedJsonStart)
    }
  }
  if (!raw.startsWith('{')) {
    const jsonStart = raw.indexOf('{')
    if (jsonStart < 0) return { kind: 'ignore' }
    const prefix = raw.slice(0, jsonStart)
    // Opening the ESP32 USB serial port can prepend boot-ROM binary bytes
    // to the first firmware JSON line. Recover only when the prefix contains
    // clear binary/control noise; readable non-JSON output remains ignored.
    if (!/[\u0000-\u001F\u007F-\u009F\uFFFD]/.test(prefix)) {
      return { kind: 'ignore' }
    }
    raw = raw.slice(jsonStart)
  }
  // The ESP32 prints readable startup/status lines alongside JSON events.
  // Ignore those lines; malformed JSON-looking records still surface below.

  let message
  try {
    message = JSON.parse(raw)
  } catch {
    return { kind: 'invalid', error: 'Seri mesaj geçerli JSON değil.' }
  }

  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return { kind: 'invalid', error: 'Seri mesaj nesne biçiminde olmalıdır.' }
  }
  if (message.type === 'rf.error') {
    return {
      kind: 'invalid',
      error: String(message.error || 'RF alıcı firmware hatası.').slice(0, 500)
    }
  }
  if (message.type === 'rf.learning') {
    const stored = message.stored && typeof message.stored === 'object' ? message.stored : {}
    const target = ['A', 'B', 'C'].includes(String(message.target || '')) ? String(message.target) : ''
    return {
      kind: 'learning_status',
      event: {
        eventType: 'learning_status',
        message: String(message.message || '').slice(0, 500),
        command: String(message.command || '').slice(0, 40),
        ok: message.ok !== false,
        target,
        stored: {
          A: stored.A === true,
          B: stored.B === true,
          C: stored.C === true
        },
        receivedAt: new Date().toISOString()
      }
    }
  }
  if (message.type === 'rf.match') {
    if (message.version !== 1 || message.eventType !== 'button_match') {
      return { kind: 'invalid', error: 'RF tuş eşleşmesi sürümü veya olay türü desteklenmiyor.' }
    }
    const actions = {
      A: { action: 'waiter_call', actionName: 'Garson çağır' },
      B: { action: 'service_request', actionName: 'Servis' },
      C: { action: 'cancel', actionName: 'İptal' }
    }
    const label = String(message.matchedLabel || '')
    const expected = actions[label]
    const frequencyMHz = Number(message.frequencyMHz)
    const repeatCount = Number(message.repeatCount)
    const matchQualityPct = Number(message.matchQualityPct)
    if (!expected || message.action !== expected.action || message.actionName !== expected.actionName) {
      return { kind: 'invalid', error: 'RF tuşu için tanımsız veya uyuşmayan işlem.' }
    }
    if (message.protocol !== 'unknown' || message.deviceId !== '' || message.buttonCode !== '') {
      return { kind: 'invalid', error: 'RF ham eşleşmesinde protokol ve kod alanları boş/unknown kalmalıdır.' }
    }
    if (!Number.isFinite(frequencyMHz) || frequencyMHz < VALID_FREQUENCY_MIN_MHZ || frequencyMHz > VALID_FREQUENCY_MAX_MHZ
        || !Number.isInteger(repeatCount) || repeatCount < 3 || repeatCount > 255
        || !Number.isInteger(matchQualityPct) || matchQualityPct < 80 || matchQualityPct > 100) {
      return { kind: 'invalid', error: 'RF tuş eşleşmesi güven değerleri geçersiz.' }
    }
    return {
      kind: 'button_match',
      event: {
        version: 1,
        eventType: 'button_match',
        matchedLabel: label,
        action: expected.action,
        actionName: expected.actionName,
        frequencyMHz: Number(frequencyMHz.toFixed(2)),
        repeatCount,
        matchQualityPct,
        receivedAt: new Date().toISOString()
      }
    }
  }
  if (message.type !== 'rf.capture') return { kind: 'control', message }
  if (message.version !== 1 || message.eventType !== 'raw_capture') {
    return { kind: 'invalid', error: 'RF mesaj sürümü veya olay türü desteklenmiyor.' }
  }
  if (message.protocol !== 'unknown') {
    return { kind: 'invalid', error: 'Doğrulanmamış RF protokol tanımı reddedildi.' }
  }
  if (message.deviceId !== '' || message.buttonCode !== '') {
    return { kind: 'invalid', error: 'Ham RF yakalamasında çözülmemiş kimlik ve tuş boş olmalıdır.' }
  }

  const frequencyMHz = Number(message.frequencyMHz)
  if (!Number.isFinite(frequencyMHz)
      || frequencyMHz < VALID_FREQUENCY_MIN_MHZ
      || frequencyMHz > VALID_FREQUENCY_MAX_MHZ) {
    return { kind: 'invalid', error: 'RF frekansı geçersiz.' }
  }
  const receiverBandwidthKHz = Number(message.receiverBandwidthKHz)
  if (!Number.isFinite(receiverBandwidthKHz)
      || receiverBandwidthKHz < 1
      || receiverBandwidthKHz > 1000) {
    return { kind: 'invalid', error: 'RF alım bant genişliği geçersiz.' }
  }
  if (!['high', 'low'].includes(message.firstLevel)) {
    return { kind: 'invalid', error: 'RF sinyal başlangıç seviyesi geçersiz.' }
  }
  if (!Array.isArray(message.pulseUs)
      || message.pulseUs.length < MIN_PULSE_COUNT
      || message.pulseUs.length > MAX_PULSE_COUNT
      || message.pulseUs.some((pulse) => !Number.isInteger(pulse)
        || pulse < MIN_PULSE_US
        || pulse > MAX_PULSE_US)) {
    return { kind: 'invalid', error: 'RF darbe dizisi geçersiz veya sınır dışında.' }
  }

  const pulseUs = [...message.pulseUs]
  const frequency = Number(frequencyMHz.toFixed(2))
  const signature = [
    frequency.toFixed(2),
    message.firstLevel,
    pulseUs.map((pulse) => Math.round(pulse / 100)).join(',')
  ].join('|')
  const fingerprint = createHash('sha256').update(signature).digest('hex')

  return {
    kind: 'capture',
    event: {
      version: 1,
      eventType: 'raw_capture',
      protocol: 'unknown',
      deviceId: '',
      buttonCode: '',
      captureId: Number.isSafeInteger(message.captureId) && message.captureId > 0
        ? message.captureId
        : null,
      frequencyMHz: frequency,
      receiverBandwidthKHz,
      firstLevel: message.firstLevel,
      pulseUs,
      pulseCount: pulseUs.length,
      repeatCount: Number.isInteger(message.repeatCount) ? message.repeatCount : 0,
      phase: message.phase === 'completed' ? 'completed' : 'capture',
      target: ['A', 'B', 'C'].includes(String(message.target || '')) ? String(message.target) : '',
      learnedLabel: ['A', 'B', 'C'].includes(String(message.learnedLabel || '')) ? String(message.learnedLabel) : '',
      accepted: message.accepted === true,
      stored: message.stored && typeof message.stored === 'object'
        ? { A: message.stored.A === true, B: message.stored.B === true, C: message.stored.C === true }
        : null,
      fingerprint,
      receivedAt: new Date().toISOString()
    }
  }
}

export const createRfCaptureDeduper = ({ windowMs = 1800, maxEntries = 256 } = {}) => {
  const recent = new Map()

  return {
    accept(event, now = Date.now()) {
      if (!event?.fingerprint || !Number.isFinite(now)) {
        throw new Error('RF tekrar denetimi için geçerli bir yakalama gerekli.')
      }

      for (const [fingerprint, timestamp] of recent) {
        if (now - timestamp > windowMs) recent.delete(fingerprint)
      }

      const previousAt = recent.get(event.fingerprint)
      if (previousAt !== undefined && now - previousAt <= windowMs) {
        recent.set(event.fingerprint, now)
        return false
      }

      recent.set(event.fingerprint, now)
      while (recent.size > maxEntries) {
        recent.delete(recent.keys().next().value)
      }
      return true
    }
  }
}
