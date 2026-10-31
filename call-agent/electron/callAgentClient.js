import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DEVICE_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const ACCESS_REFRESH_MIN_LENGTH = 40
const HEARTBEAT_INTERVAL_MS = 30_000
const PAIRING_POLL_INTERVAL_MS = 2_000
const REQUEST_TIMEOUT_MS = 10_000

export const normalizeBackendUrl = (value) => {
  const raw = String(value || '').trim()
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Geçerli bir PenPOS HTTPS adresi girin.')
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password
      || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('PenPOS adresi yalnızca HTTPS kök adresi olmalıdır (ör. https://pos.example.com).')
  }
  return url.origin
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
    this.backendUrl = ''
    this.deviceId = ''
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
    const configData = await readOptionalFile(configPath)
    if (configData) {
      const config = JSON.parse(configData.toString('utf8'))
      if (config?.backendUrl) this.backendUrl = normalizeBackendUrl(config.backendUrl)
    }

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
    if (this.tokens && nextUrl !== this.backendUrl) {
      throw new Error('Eşleştirilmiş cihazın sunucu adresi değiştirilemez. Önce PenPOS’tan cihaz yetkisini iptal edin.')
    }
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
        headers: { 'x-pairing-secret': this.pairing.pollSecret }
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

  async refreshTokens() {
    if (!this.tokens) throw new Error('Cihaz eşleştirilmemiş.')
    const result = await this.request('/tokens/refresh', {
      body: { refreshToken: this.tokens.refreshToken }
    })
    const tokens = validateTokenPair(result)
    await this.saveTokens(tokens)
    this.tokens = tokens
    return tokens
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
      if (Date.parse(this.tokens.accessExpiresAt) <= Date.now() + 60_000) {
        await this.refreshTokens()
      }
      const sendHeartbeat = () => this.request(`/devices/${encodeURIComponent(this.deviceId)}/heartbeat`, {
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` },
        body: { hostname: os.hostname(), version: '0.1.0' }
      })
      let heartbeatResult
      try {
        heartbeatResult = await sendHeartbeat()
      } catch (error) {
        if (error?.status !== 401) throw error
        await this.refreshTokens()
        heartbeatResult = await sendHeartbeat()
      }
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
