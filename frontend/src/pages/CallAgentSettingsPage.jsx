import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import './CallAgentSettingsPage.css'

const formatDate = (value) => {
  if (!value) return 'Henüz bağlanmadı'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Bilinmiyor' : date.toLocaleString('tr-TR')
}

export default function CallAgentSettingsPage() {
  const [branches, setBranches] = useState([])
  const [devices, setDevices] = useState([])
  const [branchId, setBranchId] = useState('')
  const [createdPairing, setCreatedPairing] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('penpos-call-agent-pairing') || 'null')
      return saved?.expiresAt && new Date(saved.expiresAt).getTime() > Date.now() ? saved : null
    } catch {
      return null
    }
  })
  const [deviceName, setDeviceName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [branchResponse, deviceResponse] = await Promise.all([
        api('/api/call-agents/branches', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/call-agents/devices', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' })
      ])
      if (!branchResponse.ok) throw new Error(branchResponse.message || 'Şubeler yüklenemedi.')
      if (!deviceResponse.ok) throw new Error(deviceResponse.message || 'Çağrı ajanı cihazları yüklenemedi.')
      const activeBranches = (branchResponse.branches || []).filter((branch) => branch.isActive !== false)
      setBranches(activeBranches)
      setBranchId((current) => activeBranches.some((branch) => String(branch._id) === current)
        ? current
        : String(activeBranches[0]?._id || ''))
      setDevices(Array.isArray(deviceResponse.devices)
        ? deviceResponse.devices.filter((device) => device.status === 'active')
        : [])
    } catch (loadError) {
      setError(loadError?.message || 'Masa çağrı sistemi bilgileri yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!createdPairing?.deviceId) return undefined

    const checkAgentConnection = async () => {
      try {
        const response = await api('/api/call-agents/devices', {
          silent: true,
          skipBranchHeader: true,
          cacheMode: 'no-store'
        })
        if (!response.ok || !Array.isArray(response.devices)) return

        const activeDevices = response.devices.filter((device) => device.status === 'active')
        setDevices(activeDevices)
        const connected = activeDevices.some((device) => (
          device.deviceId === createdPairing.deviceId && device.lastHeartbeatAt
        ))

        if (connected) {
          setCreatedPairing(null)
          sessionStorage.removeItem('penpos-call-agent-pairing')
          setNotice('Çağrı ajanı bağlandı. Eşleştirme bilgileri gizlendi.')
        }
      } catch {
        // Bağlantı geçici olarak kontrol edilemezse eşleştirme bilgisini koru.
      }
    }

    const intervalId = window.setInterval(checkAgentConnection, 3000)
    checkAgentConnection()
    return () => window.clearInterval(intervalId)
  }, [createdPairing])

  const createPairing = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await api('/api/call-agents/dashboard/pairings', {
        method: 'POST',
        data: { branchId, deviceName: deviceName.trim() },
        silent: true,
        skipBranchHeader: true,
        suppressAuthRedirect: true
      })
      if (!response.success) throw new Error(response.message || 'Eşleştirme kodu oluşturulamadı.')
      setCreatedPairing(response.pairing)
      sessionStorage.setItem('penpos-call-agent-pairing', JSON.stringify(response.pairing))
      setNotice('Cihaz ve tek kullanımlık eşleştirme kodu hazır. Kod 5 dakika geçerlidir.')
      await loadData()
    } catch (pairingError) {
      setError(pairingError?.message || 'Eşleştirme kodu oluşturulamadı.')
    } finally {
      setBusy(false)
    }
  }

  const revokeDevice = async (device) => {
    if (device.status === 'revoked' || !window.confirm(`“${device.name}” cihazının yetkisi kaldırılsın mı?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await api(`/api/call-agents/devices/${encodeURIComponent(device.deviceId)}/revoke`, {
        method: 'POST',
        silent: true,
        skipBranchHeader: true,
        suppressAuthRedirect: true
      })
      if (!response.ok) throw new Error(response.message || 'Cihaz yetkisi kaldırılamadı.')
      setNotice('Cihaz yetkisi kaldırıldı. Cihazın sunucu erişimi reddedilir.')
      await loadData()
    } catch (revokeError) {
      setError(revokeError?.message || 'Cihaz yetkisi kaldırılamadı.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="call-agent-settings">
      <header className="call-agent-settings-heading">
        <div>
          <span className="call-agent-settings-eyebrow">AYARLAR · DONANIMLAR</span>
          <h1>Masa Çağrı Sistemi</h1>
          <p>Çağrı ajanını güvenli şekilde eşleştirin, şube kapsamını belirleyin ve cihaz yetkilerini yönetin.</p>
        </div>
        <button type="button" className="call-agent-settings-refresh" onClick={loadData} disabled={loading || busy}>
          Yenile
        </button>
      </header>

      <section className="call-agent-settings-card">
        <div className="call-agent-settings-card-heading">
          <div>
            <h2>Cihaz eşleştir</h2>
            <p>PenPOS sunucusu sabittir: https://penpos.cloud. Ajan uygulaması bu eşleştirme bilgilerini kullanarak otomatik bağlanır.</p>
          </div>
          <div className="call-agent-settings-quick-actions">
            <a
              className="call-agent-download-button"
              href="/public/downloads/call-agent/PenPOS-Cagri-Ajani-Setup.exe?v=0.1.15"
              download="PenPOS-Call-Agent-Setup-0.1.15.exe"
            >
              Çağrı Ajanını İndir
            </a>
            <span className="call-agent-settings-tag">HTTPS EŞLEŞTİRME</span>
          </div>
        </div>
        <div className="call-agent-pairing-form">
          <label>
            Şube
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)} required disabled={loading}>
              {branches.length === 0 && <option value="">Erişilebilir etkin şube yok</option>}
              {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
          </label>
          <label>
            Cihaz adı <span className="call-agent-optional">(isteğe bağlı)</span>
            <input
              value={deviceName}
              onChange={(event) => setDeviceName(event.target.value)}
              placeholder="Örn. Kasa bilgisayarı"
              maxLength={100}
              autoComplete="off"
            />
          </label>
          <div className="call-agent-pairing-actions">
            <p>Buton cihaz kimliği ve kodu oluşturup cihazı seçili şubeye bağlar. Ardından “Çağrı ajanını aç” bağlantısına basın.</p>
            <button type="button" onClick={createPairing} disabled={busy || loading || !branches.length}>
              {busy ? 'Oluşturuluyor…' : 'Cihaz Eşleştir'}
            </button>
          </div>
        </div>
        {createdPairing && (
          <div className="call-agent-pairing-result" role="status">
            <div><span>Cihaz kimliği</span><code>{createdPairing.deviceId}</code></div>
            <div><span>Eşleştirme kodu</span><code>{createdPairing.pairingCode}</code></div>
            <a
              className="call-agent-pairing-open"
              href={`penpos-call-agent://pair?pairingId=${encodeURIComponent(createdPairing.pairingId)}&deviceId=${encodeURIComponent(createdPairing.deviceId)}&pairingCode=${encodeURIComponent(createdPairing.pairingCode)}&expiresAt=${encodeURIComponent(createdPairing.expiresAt)}`}
            >
              Çağrı ajanını aç
            </a>
          </div>
        )}
      </section>

      {(error || notice) && (
        <div className={`call-agent-settings-message ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>
          {error || notice}
        </div>
      )}

      <section className="call-agent-settings-card">
        <div className="call-agent-settings-card-heading">
          <div>
            <h2>Çağrı ajanı cihazları</h2>
            <p>Yalnızca mevcut işletmenize ve yönetim yetkiniz kapsamındaki şubelere ait kayıtlar gösterilir.</p>
          </div>
          <span className="call-agent-settings-tag">{devices.length} CİHAZ</span>
        </div>
        {loading
          ? <div className="call-agent-settings-empty">Cihazlar yükleniyor…</div>
          : devices.length === 0
            ? <div className="call-agent-settings-empty">Henüz eşleştirilmiş çağrı ajanı yok.</div>
            : (
              <div className="call-agent-device-list">
                {devices.map((device) => {
                  const branch = branches.find((item) => String(item._id) === String(device.branchId))
                  return (
                    <article className="call-agent-device" key={device.deviceId}>
                      <div className="call-agent-device-main">
                        <div className="call-agent-device-title">
                          <strong>{device.name || 'PenPOS Çağrı Ajanı'}</strong>
                          <span className={`call-agent-device-status ${device.status === 'active' ? 'is-active' : 'is-revoked'}`}>
                            {device.status === 'active' ? 'Yetkili' : 'Yetki kaldırıldı'}
                          </span>
                        </div>
                        <span className="call-agent-device-id">{device.deviceId}</span>
                        <div className="call-agent-device-meta">
                          <span>Şube: {branch?.name || 'Erişilebilir şube listesinde yok'}</span>
                          <span>Son heartbeat: {formatDate(device.lastHeartbeatAt)}</span>
                        </div>
                      </div>
                      {device.status === 'active' && (
                        <button type="button" onClick={() => revokeDevice(device)} disabled={busy}>
                          Yetkiyi kaldır
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
      </section>

      <p className="call-agent-settings-note">Yetkisi kaldırılmış cihazlar bu listede gösterilmez.</p>
    </main>
  )
}
