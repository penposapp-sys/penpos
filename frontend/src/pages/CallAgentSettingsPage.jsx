import { useEffect, useState } from 'react'
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
  const [pairingId, setPairingId] = useState('')
  const [pairingCode, setPairingCode] = useState('')
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
      setDevices(Array.isArray(deviceResponse.devices) ? deviceResponse.devices : [])
    } catch (loadError) {
      setError(loadError?.message || 'Masa çağrı sistemi bilgileri yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const approvePairing = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await api(`/api/call-agents/pairings/${encodeURIComponent(pairingId.trim())}/approve`, {
        method: 'POST',
        data: { code: pairingCode.trim().toUpperCase(), branchId, deviceName: deviceName.trim() },
        silent: true,
        skipBranchHeader: true,
        suppressAuthRedirect: true
      })
      if (!response.ok) throw new Error(response.message || 'Cihaz eşleştirilemedi.')
      setPairingId('')
      setPairingCode('')
      setDeviceName('')
      setNotice('Çağrı ajanı cihazı bu işletme ve şubeyle eşleştirildi.')
      await loadData()
    } catch (approvalError) {
      setError(approvalError?.message || 'Cihaz eşleştirilemedi.')
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
            <p>Ajan ekranındaki oturum kimliği ve tek kullanımlık kodu girin; cihazı yalnızca erişiminiz olan etkin şubeye bağlayabilirsiniz.</p>
          </div>
          <span className="call-agent-settings-tag">HTTPS EŞLEŞTİRME</span>
        </div>
        <form className="call-agent-pairing-form" onSubmit={approvePairing}>
          <label>
            Eşleştirme oturum kimliği
            <input
              value={pairingId}
              onChange={(event) => setPairingId(event.target.value)}
              placeholder="Ajan ekranındaki oturum kimliği"
              maxLength={24}
              required
              autoComplete="off"
            />
          </label>
          <label>
            Eşleştirme kodu
            <input
              value={pairingCode}
              onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
              placeholder="12 karakterli kod"
              maxLength={12}
              minLength={12}
              required
              autoComplete="one-time-code"
            />
          </label>
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
            <p>Kod sürelidir ve yalnızca bir kez kullanılabilir. Onay, mevcut PenPOS kullanıcı ve şube yetkileriyle denetlenir.</p>
            <button type="submit" disabled={busy || loading || !branches.length}>
              {busy ? 'İşleniyor…' : 'Cihazı eşleştir'}
            </button>
          </div>
        </form>
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

      <p className="call-agent-settings-note">
        Bu ayar yalnızca ajan cihaz yetkisini yönetir. Kumanda/masa eşleştirmesi, gerçek RF sinyali ve gerçek masa çağrısı bu aşamada etkin değildir.
      </p>
    </main>
  )
}
