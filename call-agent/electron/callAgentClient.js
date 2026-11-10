import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DEVICE_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const PAIRING_ID_PATTERN = /^[a-f\d]{24}$/i
const PAIRING_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{12}$/i
const PENPOS_BACKEND_URL = 'https://penpos.cloud'
const ACCESS_REFRESH_MIN_LENGTH = 40
const HEARTBEAT_INTERVAL_MS = 30_000
const PAIRING_POLL_INTERVAL_MS = 2_000
const REQUEST_TIMEOUT_MS = 10_000
const RF_LABELS = new Set(['A', 'B', 'C'])
const RF_ACTIONS = {
  A: { action: 'waiter_call', actionName: 'Garson çağır' },
  B: { action: 'service_request', actionName: 'Servis talebi' },
  C: { action: 'cancel', actionName: 'İptal' }
}
const TABLE_ID_PATTERN = /^[a-f\d]{24}$/i

const compareRfTemplate = (template, capture) => {
  if (!template || template.frequencyMHz !== capture.frequencyMHz
      || template.firstLevel !== capture.firstLevel
      || template.pulseUs.length !== capture.pulseUs.length) return 0
  let totalQuality = 0
  for (let index = 0; index < template.pulseUs.length; index++) {
    const expected = template.pulseUs[index]
    const actual = capture.pulseUs[index]
    const difference = Math.abs(expected - actual)
    if (difference > Math.max(160, Math.floor(expected / 3))) return 0
    totalQuality += Math.max(0, 100 - Math.floor((difference * 100) / Math.max(expected, 1)))
  }
  return Math.floor(totalQuality / template.pulseUs.length)
}

export const normalizeBackendUrl = (value) => {
  const raw = String(value || PENPOS_BACKEND_URL).trim()
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Geçerli bir PenPOS HTTPS adresi girin.')
  }
  if (url.origin !== PENPOS_BACKEND_URL || url.username || url.password || url.search || url.hash
      || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error(`PenPOS sunucu adresi değiştirilemez: ${PENPOS_BACKEND_URL}`)
  }
  return PENPOS_BACKEND_URL
}

const readOptionalFile = async (filePath) => {
  try {
    return await readFile(filePath)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const validateTokenPair = (tokens) => {
  const accessToken = String(tokens?.accessToken || '')
  const refreshToken = String(tokens?.refreshToken || '')
  const accessExpiresAt = new Date(tokens?.accessExpiresAt)
  const refreshExpiresAt = new Date(tokens?.refreshExpiresAt)
  if (accessToken.length < ACCESS_REFRESH_MIN_LENGTH || accessToken.length > 200
      || refreshToken.length < ACCESS_REFRESH_MIN_LENGTH || refreshToken.length > 200
      || !Number.isFinite(accessExpiresAt.getTime()) || !Number.isFinite(refreshExpiresAt.getTime())) {
    throw new Error('PenPOS tarafından döndürülen cihaz oturumu geçersiz.')
  }
  return {
    accessToken,
    refreshToken,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString()
  }
}

export class CallAgentClient {
  constructor({ storageDirectory, safeStorage, fetchImpl = globalThis.fetch, onStatus = () => {}, autoHeartbeat = true }) {
    if (!storageDirectory) throw new Error('Çağrı ajanı veri klasörü gerekli.')
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function'
        || typeof safeStorage.encryptString !== 'function'
        || typeof safeStorage.decryptString !== 'function') {
      throw new Error('Güvenli Windows token depolama katmanı kullanılamıyor.')
    }
    if (typeof fetchImpl !== 'function') throw new Error('HTTPS bağlantı katmanı kullanılamıyor.')
    this.storageDirectory = storageDirectory
    this.safeStorage = safeStorage
    this.fetchImpl = fetchImpl
    this.onStatus = onStatus
    this.autoHeartbeat = autoHeartbeat
    this.backendUrl = PENPOS_BACKEND_URL
    this.deviceId = ''
    this.rfTableId = ''
    this.rfTableIds = []
    this.rfButtonProfiles = {}
    this.pendingRfLearning = null
    this.tokens = null
    this.pairing = null
    this.pairingTimer = null
    this.heartbeatTimer = null
    this.heartbeatRunning = false
    this.pairingPollRunning = false
    this.state = {
      connectionStatus: 'not-configured',
      pairingStatus: 'idle',
      paired: false,
      lastHeartbeatAt: null,
      tenantId: '',
      tenantName: '',
      branchId: '',
      branchName: '',
      rfTableId: '',
      rfTableIds: [],
      rfButtonProfiles: {},
      pendingRfLearning: null,
      lastError: ''
    }
  }

  async initialize() {
    await mkdir(this.storageDirectory, { recursive: true })
    const identityPath = path.join(this.storageDirectory, 'call-agent-device.json')
    const identityData = await readOptionalFile(identityPath)
    if (identityData) {
      const identity = JSON.parse(identityData.toString('utf8'))
      if (!DEVICE_ID_PATTERN.test(String(identity?.deviceId || ''))) {
        throw new Error('Kalıcı cihaz kimliği bozuk; kimlik güvenli biçimde yüklenemedi.')
      }
      this.deviceId = identity.deviceId
    } else {
      this.deviceId = randomUUID()
      await writeFile(identityPath, `${JSON.stringify({ deviceId: this.deviceId }, null, 2)}\n`, { flag: 'wx' })
    }

    const configPath = path.join(this.storageDirectory, 'call-agent-config.json')
    await writeFile(configPath, `${JSON.stringify({ backendUrl: PENPOS_BACKEND_URL }, null, 2)}\n`, 'utf8')

    const rfTableData = (await readOptionalFile(path.join(this.storageDirectory, 'call-agent-rf-tables.json')))
      || (await readOptionalFile(path.join(this.storageDirectory, 'call-agent-rf-table.json')))
    if (rfTableData) {
      try {
        const saved = JSON.parse(rfTableData.toString('utf8'))
        this.rfTableIds = Array.isArray(saved?.tableIds)
          ? [...new Set(saved.tableIds.map(String).filter((id) => TABLE_ID_PATTERN.test(id)))].slice(0, 200)
          : (TABLE_ID_PATTERN.test(String(saved?.tableId || '')) ? [String(saved.tableId)] : [])
      } catch {
        this.rfTableIds = []
      }
    }
    this.rfTableId = this.rfTableIds[0] || ''
    this.state.rfTableId = this.rfTableId
    this.state.rfTableIds = this.rfTableIds

    const rfProfilesData = await readOptionalFile(path.join(this.storageDirectory, 'call-agent-rf-buttons.json'))
    if (rfProfilesData) {
      try {
        const saved = JSON.parse(rfProfilesData.toString('utf8'))
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
          this.rfButtonProfiles = Object.fromEntries(Object.entries(saved).filter(([key, profile]) => {
            const [tableId, label] = key.split(':')
            return TABLE_ID_PATTERN.test(tableId || '') && RF_LABELS.has(label)
              && Array.isArray(profile?.pulseUs) && profile.pulseUs.length >= 8 && profile.pulseUs.length <= 256
              && profile.pulseUs.every((pulse) => Number.isInteger(pulse) && pulse >= 50 && pulse <= 30000)
              && ['high', 'low'].includes(profile.firstLevel)
          }))
        }
      } catch {
        this.rfButtonProfiles = {}
      }
    }
    this.state.rfButtonProfiles = this.rfButtonProfiles

    const tokenPath = path.join(this.storageDirectory, 'call-agent-token.dat')
    const encryptedTokens = await readOptionalFile(tokenPath)
    if (encryptedTokens) {
      if (!this.safeStorage.isEncryptionAvailable()) {
        throw new Error('Windows güvenli şifrelemesi kullanılamıyor; saklanan oturum açılmadı.')
      }
      const decrypted = this.safeStorage.decryptString(encryptedTokens)
      this.tokens = validateTokenPair(JSON.parse(decrypted))
      this.state.paired = true
    }

    this.state.connectionStatus = this.tokens ? 'disconnected' : 'not-configured'
    this.emitStatus()
    if (this.tokens && this.backendUrl && this.autoHeartbeat) {
      this.startHeartbeatTimer()
      this.heartbeat().catch(() => {})
    }
    return this.getStatus()
  }

  getStatus() {
    return {
      ...this.state,
      rfTableId: this.rfTableId,
      rfTableIds: [...this.rfTableIds],
      rfButtonProfiles: this.rfButtonProfiles,
      pendingRfLearning: this.pendingRfLearning,
      backendUrl: this.backendUrl,
      deviceId: this.deviceId,
      pairingId: this.pairing?.pairingId || '',
      pairingCode: this.pairing?.pairingCode || '',
      pairingExpiresAt: this.pairing?.expiresAt || null
    }
  }

  emitStatus() {
    this.onStatus(this.getStatus())
  }

  setState(update) {
    this.state = { ...this.state, ...update }
    this.emitStatus()
  }

  async setBackendUrl(value) {
    const nextUrl = normalizeBackendUrl(value)
    this.backendUrl = nextUrl
    const configPath = path.join(this.storageDirectory, 'call-agent-config.json')
    await writeFile(configPath, `${JSON.stringify({ backendUrl: nextUrl }, null, 2)}\n`, 'utf8')
    this.setState({ lastError: '', connectionStatus: this.tokens ? this.state.connectionStatus : 'not-configured' })
    return this.getStatus()
  }

  assertEncryptionAvailable() {
    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows güvenli şifrelemesi kullanılamıyor; token saklanmayacak.')
    }
  }

  async request(endpoint, { method = 'POST', headers = {}, body } = {}) {
    if (!this.backendUrl) throw new Error('Önce PenPOS HTTPS adresini kaydedin.')
    const url = `${this.backendUrl}/api/call-agents${endpoint}`
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(new URL(this.backendUrl).protocol === 'http:' ? { 'X-Forwarded-Proto': 'https' } : {}),
        ...headers
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (response.status >= 300 && response.status < 400) {
      throw new Error('PenPOS API yönlendirmesi reddedildi; HTTPS adresini doğrudan kullanın.')
    }
    const responseText = await response.text()
    let responseBody
    try {
      responseBody = responseText ? JSON.parse(responseText) : {}
    } catch {
      throw new Error('PenPOS API yanıtı okunamadı.')
    }
    if (!response.ok) {
      const apiError = new Error(String(responseBody?.message || `PenPOS bağlantısı başarısız (HTTP ${response.status}).`))
      apiError.status = response.status
      throw apiError
    }
    return responseBody
  }

  async authenticatedRequest(endpoint, options = {}) {
    if (!this.tokens) throw new Error('Önce PenPOS cihaz eşleştirmesini tamamlayın.')
    return this.request(endpoint, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${this.tokens.accessToken}` }
    })
  }

  async listRfTables() {
    if (!this.deviceId) throw new Error('Cihaz kimliği hazır değil.')
    const response = await this.authenticatedRequest(`/devices/${encodeURIComponent(this.deviceId)}/tables`, { method: 'GET' })
    return Array.isArray(response?.tables) ? response.tables : []
  }

  async setRfTableIds(values) {
    if (!Array.isArray(values) || values.length > 200) throw new Error('Masa seçimleri geçersiz.')
    const tableIds = [...new Set(values.map((value) => String(value || '').trim()))]
    if (tableIds.some((tableId) => !TABLE_ID_PATTERN.test(tableId))) throw new Error('Masa seçimi geçersiz.')
    this.rfTableIds = tableIds
    this.rfTableId = tableIds[0] || ''
    await writeFile(
      path.join(this.storageDirectory, 'call-agent-rf-tables.json'),
      `${JSON.stringify({ tableIds }, null, 2)}\n`,
      'utf8'
    )
    this.setState({ rfTableId: this.rfTableId, rfTableIds: tableIds })
    return this.getStatus()
  }

  async startRfButtonLearning(tableId, label, tableName = '') {
    const normalizedTableId = String(tableId || '').trim()
    const normalizedLabel = String(label || '').trim().toUpperCase()
    if (!this.rfTableIds.includes(normalizedTableId)) throw new Error('Önce Masa Eşleştirme ekranından bu masayı seçin.')
    if (!RF_LABELS.has(normalizedLabel)) throw new Error('Tuş A, B veya C olmalıdır.')
    this.pendingRfLearning = { tableId: normalizedTableId, label: normalizedLabel, tableName: String(tableName || '').slice(0, 100), startedAt: new Date().toISOString() }
    this.setState({ pendingRfLearning: this.pendingRfLearning, lastError: '' })
    return this.getStatus()
  }

  cancelRfButtonLearning() {
    this.pendingRfLearning = null
    this.setState({ pendingRfLearning: null })
    return this.getStatus()
  }

  async deleteRfButtonProfile(tableId, label) {
    const key = `${String(tableId || '').trim()}:${String(label || '').trim().toUpperCase()}`
    if (!this.rfButtonProfiles[key]) return this.getStatus()
    delete this.rfButtonProfiles[key]
    await writeFile(path.join(this.storageDirectory, 'call-agent-rf-buttons.json'), `${JSON.stringify(this.rfButtonProfiles, null, 2)}\n`, 'utf8')
    this.setState({ rfButtonProfiles: this.rfButtonProfiles })
    return this.getStatus()
  }

  async processRfCapture(capture) {
    const repeatCount = Number(capture?.repeatCount || 0)
    if (repeatCount < 3 || !Array.isArray(capture?.pulseUs)) return { kind: 'ignored' }
    if (this.pendingRfLearning) {
      const target = this.pendingRfLearning
      const profile = {
        tableName: target.tableName,
        frequencyMHz: Number(capture.frequencyMHz),
        firstLevel: capture.firstLevel,
        pulseUs: capture.pulseUs,
        fingerprint: capture.fingerprint,
        capturedAt: new Date().toISOString()
      }
      if (!Number.isFinite(profile.frequencyMHz) || !['high', 'low'].includes(profile.firstLevel)
          || profile.pulseUs.length < 8 || profile.pulseUs.length > 256
          || profile.pulseUs.some((pulse) => !Number.isInteger(pulse) || pulse < 50 || pulse > 30000)) {
        return { kind: 'ignored' }
      }
      const key = `${target.tableId}:${target.label}`
      this.rfButtonProfiles[key] = profile
      this.pendingRfLearning = null
      await writeFile(path.join(this.storageDirectory, 'call-agent-rf-buttons.json'), `${JSON.stringify(this.rfButtonProfiles, null, 2)}\n`, 'utf8')
      this.setState({ rfButtonProfiles: this.rfButtonProfiles, pendingRfLearning: null })
      return { kind: 'learned', ...target }
    }

    const candidates = this.rfTableIds.flatMap((tableId) => [...RF_LABELS].map((label) => {
      const key = `${tableId}:${label}`
      return { tableId, label, key, quality: compareRfTemplate(this.rfButtonProfiles[key], capture) }
    })).filter((candidate) => candidate.quality >= 80).sort((a, b) => b.quality - a.quality)
    if (!candidates.length || (candidates[1] && candidates[0].quality - candidates[1].quality < 10)) return { kind: 'unmatched' }
    const match = candidates[0]
    return { kind: 'match', tableName: this.rfButtonProfiles[match.key]?.tableName || '', ...match, ...RF_ACTIONS[match.label] }
  }

  async performRfAction(action, tableId) {
    if (!['waiter_call', 'service_request', 'cancel'].includes(action)) throw new Error('RF tuş işlemi geçersiz.')
    const selectedTableId = String(tableId || '').trim()
    if (!this.rfTableIds.includes(selectedTableId)) throw new Error('Bu masa Çağrı Ajanı’nda seçili değil.')
    if (!this.deviceId) throw new Error('Cihaz kimliği hazır değil.')
    return this.authenticatedRequest(`/devices/${encodeURIComponent(this.deviceId)}/actions`, {
      body: { action, tableId: selectedTableId }
    })
  }

  async beginPairing(backendUrl) {
    if (this.tokens) throw new Error('Bu cihaz zaten eşleştirilmiş.')
    this.assertEncryptionAvailable()
    if (backendUrl !== undefined) await this.setBackendUrl(backendUrl)
    if (!this.backendUrl) throw new Error('PenPOS HTTPS adresini girin.')
    this.stopPairingTimer()
    this.pairing = null
    this.setState({ pairingStatus: 'starting', connectionStatus: 'connecting', lastError: '' })
    try {
      const result = await this.request('/pairings', {
        body: { deviceId: this.deviceId, deviceName: os.hostname() }
      })
      if (!result?.pairingId || !result?.pairingCode || !result?.pollSecret || !result?.expiresAt) {
        throw new Error('PenPOS geçersiz eşleştirme yanıtı verdi.')
      }
      this.pairing = {
        pairingId: String(result.pairingId),
        pairingCode: String(result.pairingCode),
        pollSecret: String(result.pollSecret),
        expiresAt: String(result.expiresAt)
      }
      this.setState({ pairingStatus: 'pending', connectionStatus: 'pairing', lastError: '' })
      this.startPairingTimer()
      return this.getStatus()
    } catch (error) {
      this.setState({ pairingStatus: 'idle', connectionStatus: 'error', lastError: error.message })
      throw error
    }
  }

  async followDashboardPairing({ pairingId, deviceId, pairingCode, expiresAt }) {
    if (this.tokens) {
      try { await this.heartbeat() } catch {}
      if (this.tokens) throw new Error('Önce PenPOS Ayarları’ndan mevcut cihaz yetkisini kaldırın.')
    }
    if (!PAIRING_ID_PATTERN.test(String(pairingId || ''))
        || !DEVICE_ID_PATTERN.test(String(deviceId || ''))
        || !PAIRING_CODE_PATTERN.test(String(pairingCode || '').toUpperCase())) {
      throw new Error('PenPOS eşleştirme bağlantısı geçersiz.')
    }
    const validUntil = new Date(expiresAt)
    if (!Number.isFinite(validUntil.getTime()) || validUntil.getTime() <= Date.now()) {
      throw new Error('Eşleştirme kodunun süresi dolmuş; PenPOS ayarlarından yeni kod oluşturun.')
    }
    const nextDeviceId = String(deviceId)
    this.deviceId = nextDeviceId
    await writeFile(
      path.join(this.storageDirectory, 'call-agent-device.json'),
      `${JSON.stringify({ deviceId: nextDeviceId }, null, 2)}\n`,
      'utf8'
    )
    this.stopPairingTimer()
    this.pairing = {
      pairingId: String(pairingId),
      deviceId: nextDeviceId,
      pairingCode: String(pairingCode).toUpperCase(),
      pollSecret: '',
      expiresAt: validUntil.toISOString()
    }
    this.setState({ pairingStatus: 'pending', connectionStatus: 'pairing', lastError: '' })
    this.startPairingTimer()
    return this.getStatus()
  }

  startPairingTimer() {
    this.stopPairingTimer()
    this.pairingTimer = setInterval(() => {
      this.pollPairing().catch((error) => {
        this.recordPairingPollError(error)
      })
    }, PAIRING_POLL_INTERVAL_MS)
    this.pairingTimer.unref?.()
    this.pollPairing().catch((error) => {
      this.recordPairingPollError(error)
    })
  }

  recordPairingPollError(error) {
    if (error?.status === 410) {
      this.stopPairingTimer()
      this.pairing = null
      this.setState({
        pairingStatus: 'expired',
        connectionStatus: 'disconnected',
        lastError: 'Eşleştirme oturumunun süresi doldu. Yeni kod oluşturun.'
      })
      return
    }
    if (error?.status === 401 || error?.status === 403) {
      this.stopPairingTimer()
      this.pairing = null
      this.setState({
        pairingStatus: 'error',
        connectionStatus: 'error',
        lastError: `Eşleştirme doğrulanamadı: ${error.message}`
      })
      return
    }
    this.setState({ lastError: `Eşleştirme kontrol edilemedi: ${error.message}` })
  }

  stopPairingTimer() {
    if (this.pairingTimer) clearInterval(this.pairingTimer)
    this.pairingTimer = null
  }

  stopPairing() {
    this.stopPairingTimer()
    this.pairing = null
    this.setState({
      pairingStatus: 'idle',
      connectionStatus: this.tokens ? this.state.connectionStatus : 'not-configured',
      lastError: ''
    })
    return this.getStatus()
  }

  async pollPairing() {
    if (!this.pairing || this.pairingPollRunning) return
    if (Date.parse(this.pairing.expiresAt) <= Date.now()) {
      this.stopPairingTimer()
      this.pairing = null
      this.setState({
        pairingStatus: 'expired',
        connectionStatus: 'disconnected',
        lastError: 'Eşleştirme kodunun süresi doldu. Yeni kod oluşturun.'
      })
      return
    }

    this.pairingPollRunning = true
    try {
      const result = await this.request(`/pairings/${encodeURIComponent(this.pairing.pairingId)}/complete`, {
        headers: this.pairing.pairingCode
          ? { 'x-pairing-code': this.pairing.pairingCode }
          : { 'x-pairing-secret': this.pairing.pollSecret }
      })
      if (result?.status === 'paired') {
        this.assertEncryptionAvailable()
        const tokens = validateTokenPair(result)
        await this.saveTokens(tokens)
        this.tokens = tokens
        this.stopPairingTimer()
        this.pairing = null
        this.setState({
          pairingStatus: 'paired',
          paired: true,
          connectionStatus: 'connected',
          lastError: ''
        })
        this.startHeartbeatTimer()
        await this.heartbeat()
      } else if (result?.status !== 'pending') {
        throw new Error('PenPOS beklenmeyen eşleştirme durumu döndürdü.')
      }
    } finally {
      this.pairingPollRunning = false
    }
  }

  async saveTokens(tokens) {
    this.assertEncryptionAvailable()
    const encrypted = this.safeStorage.encryptString(JSON.stringify(tokens))
    if (!Buffer.isBuffer(encrypted) || encrypted.length === 0) {
      throw new Error('Cihaz oturumu Windows üzerinde güvenli biçimde şifrelenemedi.')
    }
    const tokenPath = path.join(this.storageDirectory, 'call-agent-token.dat')
    await writeFile(tokenPath, encrypted)
  }

  startHeartbeatTimer() {
    if (!this.autoHeartbeat || this.heartbeatTimer || !this.tokens) return
    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)
    this.heartbeatTimer.unref?.()
  }

  async recordHeartbeatError(error) {
    if (error?.status === 401 || error?.status === 403) {
      try {
        await this.clearLocalSession(error)
      } catch (storageError) {
        this.setState({
          connectionStatus: 'error',
          paired: false,
          lastError: `Sunucu cihaz oturumunu reddetti. Yerel oturum dosyası silinemedi: ${storageError.message}`
        })
      }
      return
    }
    this.setState({
      connectionStatus: 'disconnected',
      lastError: `PenPOS bağlantısı başarısız: ${error.message}`
    })
  }

  async clearLocalSession(error) {
    this.tokens = null
    this.stopHeartbeatTimer()
    this.pairing = null
    const tokenPath = path.join(this.storageDirectory, 'call-agent-token.dat')
    try {
      await unlink(tokenPath)
    } catch (storageError) {
      if (storageError?.code !== 'ENOENT') throw storageError
    }
    this.setState({
      connectionStatus: 'error',
      pairingStatus: error?.status === 403 ? 'revoked' : 'expired',
      paired: false,
      tenantId: '',
      tenantName: '',
      branchId: '',
      branchName: '',
      lastError: error?.status === 403
        ? `Cihaz yetkisi kaldırıldı: ${error.message}. Yeniden eşleştirme başlatın.`
        : `Cihaz oturumu geçersiz veya süresi dolmuş: ${error.message}. Yeniden eşleştirme başlatın.`
    })
  }

  async heartbeat() {
    if (!this.tokens || !this.deviceId || this.heartbeatRunning) return this.getStatus()
    this.heartbeatRunning = true
    this.setState({ connectionStatus: 'connecting', lastError: '' })
    try {
      const heartbeatResult = await this.request(`/devices/${encodeURIComponent(this.deviceId)}/heartbeat`, {
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` },
        body: { hostname: os.hostname(), version: '0.1.0' }
      })
      this.setState({
        connectionStatus: 'connected',
        paired: true,
        lastHeartbeatAt: heartbeatResult.lastHeartbeatAt || new Date().toISOString(),
        tenantId: String(heartbeatResult.tenant?.id || this.state.tenantId),
        tenantName: String(heartbeatResult.tenant?.name || this.state.tenantName),
        branchId: String(heartbeatResult.branch?.id || this.state.branchId),
        branchName: String(heartbeatResult.branch?.name || this.state.branchName),
        lastError: ''
      })
    } catch (error) {
      await this.recordHeartbeatError(error)
      throw error
    } finally {
      this.heartbeatRunning = false
    }
    return this.getStatus()
  }

  stop() {
    this.stopPairingTimer()
    this.stopHeartbeatTimer()
  }

  stopHeartbeatTimer() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }
}
