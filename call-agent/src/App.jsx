import { useEffect, useState } from 'react'

const navigation = [
  { id: 'overview', label: 'Genel Bakış', icon: '◫' },
  { id: 'connection', label: 'Cihaz Bağlantısı', icon: '⌁' },
  { id: 'simulator', label: 'Sanal Kumanda', icon: '▣' },
  { id: 'pairing', label: 'Cihaz Eşleştirme', icon: '⌘' },
  { id: 'buttons', label: 'Buton Tanımlama', icon: '▦' },
  { id: 'tables', label: 'Masa Eşleştirme', icon: '▤' },
  { id: 'settings', label: 'Tuş Ayarları', icon: '☷' },
  { id: 'history', label: 'Çağrı Geçmişi', icon: '◷' },
  { id: 'system', label: 'Sistem Ayarları', icon: '⚙' }
]

const pageTitles = {
  overview: ['Genel Bakış', 'Çağrı sisteminizin anlık bağlantı ve çalışma durumu.'],
  connection: ['Cihaz Bağlantısı', 'USB alıcınızı bir seri port üzerinden bağlayın.'],
  simulator: ['Sanal Kumanda', 'Donanımdan bağımsız, yerel test olayları oluşturun.'],
  pairing: ['Cihaz Eşleştirme', 'Alıcı ve PenPOS hesabı eşleştirme işlemleri.'],
  buttons: ['Buton Tanımlama', 'Kumanda tuşlarının görevlerini yapılandırın.'],
  tables: ['Masa Eşleştirme', 'Kumandaları restoran masalarıyla eşleştirin.'],
  settings: ['Tuş Ayarları', 'Çağrı tuşlarının davranışlarını yönetin.'],
  history: ['Çağrı Geçmişi', 'Bu aşamada yalnızca sanal kumanda test kayıtları gösterilir.'],
  system: ['Sistem Ayarları', 'Ajan ve uygulama tercihleri.']
}

const pendingDescriptions = {
  pairing: 'PenPOS bağlantısı henüz kurulmadı. Hesapla güvenli eşleştirme sonraki aşamada hazırlanacak.',
  buttons: 'Alıcıdan kumanda veya tuş verisi alınmıyor. Buton tanımlama henüz kullanılamıyor.',
  tables: 'İşletme, şube ve masa listesi henüz bağlı değil. Masa eşleştirme sonraki aşamada hazırlanacak.',
  settings: 'Tuş işlemleri henüz yapılandırılmıyor.',
  system: 'Otomatik başlatma ve uygulama tercihleri henüz yapılandırılmıyor.'
}

function StatusIndicator({ state, children }) {
  return (
    <span className="status">
      <span className={`status-dot ${state}`} />
      {children}
    </span>
  )
}

const formatTimestamp = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Geçersiz tarih'
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function SimulatorEventRow({ event }) {
  return (
    <div className="simulator-event-row">
      <div className="event-main">
        <strong>{event.action}</strong>
        <span>{formatTimestamp(event.timestamp)}</span>
      </div>
      <div className="event-meta">
        <span>{event.remoteId}</span>
        <span className="simulator-badge">SİMÜLATÖR</span>
      </div>
    </div>
  )
}

function Overview({ portState, selectedPort, events, connection }) {
  const latestEvent = events[0]
  const isConnected = connection?.connectionStatus === 'connected'
  const cards = [
    { label: 'Ajan durumu', value: 'Çalışıyor', state: 'online', detail: 'Masaüstü uygulaması hazır' },
    {
      label: 'PenPOS bağlantısı',
      value: isConnected ? 'Bağlı' : 'Bağlantı bekleniyor',
      state: isConnected ? 'online' : connection?.connectionStatus === 'error' ? 'offline' : 'idle',
      detail: isConnected
        ? connection.lastHeartbeatAt ? `Son heartbeat: ${formatTimestamp(connection.lastHeartbeatAt)}` : 'Heartbeat alındı'
        : connection?.lastError || 'Güvenli cihaz eşleştirmesi bekleniyor'
    },
    { label: 'Alıcı cihaz', value: portState === 'connected' ? 'Bağlı' : 'Bağlantı bekleniyor', state: portState === 'connected' ? 'online' : 'idle', detail: selectedPort || 'COM portu seçilmedi' }
  ]

  return (
    <>
      <div className="welcome-panel">
        <div>
          <div className="eyebrow">AJAN DURUMU</div>
          <h2>Çağrı sisteminiz hazır olsun.</h2>
          <p>Bağlantı bilgileri burada görünür. Henüz kurulmayan bağlantılar açıkça beklemede gösterilir.</p>
        </div>
        <div className="welcome-mark" aria-hidden="true">P</div>
      </div>

      <div className="status-grid">
        {cards.map((card) => (
          <section className="panel status-card" key={card.label}>
            <div className="card-label">{card.label}</div>
            <StatusIndicator state={card.state}>{card.value}</StatusIndicator>
            <div className="card-detail">{card.detail}</div>
          </section>
        ))}
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="section-heading">
            <div><h3>Son alınan sinyal</h3><p>Alıcıdan gelen son veri</p></div>
            <span className="subtle-tag">CANLI VERİ</span>
          </div>
          <div className="empty-state">
            <span className="empty-icon">⌁</span>
            <strong>Henüz veri yok</strong>
            <span>Alıcı cihaz bağlandığında sinyal bilgisi burada görüntülenir.</span>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div><h3>Son test çağrıları</h3><p>Sanal kumandadan oluşturulan yerel olaylar</p></div>
            <span className="simulator-badge">TEST · {events.length}</span>
          </div>
          {events.length > 0
            ? <div className="event-list compact-event-list">{events.slice(0, 3).map((event) => <SimulatorEventRow event={event} key={event.eventId} />)}</div>
            : <div className="empty-state"><span className="empty-icon">◷</span><strong>Henüz test olayı yok</strong><span>Gerçek cihaz sinyalleri bu test geçmişine eklenmez.</span></div>}
        </section>
      </div>

      <section className="panel system-panel">
        <div className="section-heading">
          <div><h3>Sistem durumu</h3><p>Mevcut ajan ve bağlantı özeti</p></div>
          <StatusIndicator state="online">Uygulama çalışıyor</StatusIndicator>
        </div>
        <div className="system-row"><span>Seçili COM port</span><strong>{selectedPort || 'Seçilmedi'}</strong></div>
        <div className="system-row"><span>İşletme / şube</span><strong className="muted-value">{isConnected ? [connection.tenantName, connection.branchName].filter(Boolean).join(' / ') || 'Bilgi alınıyor' : 'PenPOS bağlantısı bekleniyor'}</strong></div>
        <div className="system-row"><span>Çağrı ajanı cihaz kimliği</span><strong>{connection?.deviceId || 'Yükleniyor'}</strong></div>
        <div className="system-row"><span>Son test olayı</span><strong>{latestEvent ? `${latestEvent.action} · ${formatTimestamp(latestEvent.timestamp)}` : 'Henüz veri yok'}</strong></div>
      </section>
    </>
  )
}

function SimulatorPage({ events, onPress, error }) {
  const buttons = [
    { code: 'BTN_1', label: 'Garson Çağır', icon: '♧', description: 'Masaya garson çağırma test olayı oluşturur.' },
    { code: 'BTN_2', label: 'Su İste', icon: '◉', description: 'Masaya su isteği test olayı oluşturur.' },
    { code: 'BTN_3', label: 'İptal', icon: '×', description: 'İptal tuşu test olayı oluşturur; kayıt silmez.' }
  ]

  return (
    <div className="simulator-page">
      <section className="simulator-warning">
        <span className="simulator-warning-icon">!</span>
        <div>
          <strong>TEST MODU · YEREL SİMÜLASYON</strong>
          <p>Bu kumanda yalnızca bilgisayarınızda test kaydı oluşturur. Olaylar PenPOS’a veya üretim backend’ine gönderilmez ve gerçek donanım sinyali değildir.</p>
        </div>
        <span className="simulator-badge">GERÇEK CİHAZDAN AYRI</span>
      </section>

      <section className="panel simulator-panel">
        <div className="section-heading">
          <div><h3>Sanal masa kumandası</h3><p>Her basış yeni ve ayrı bir test olayı oluşturur.</p></div>
          <div className="simulator-device"><span className="mini-dot live" /> TEST-001</div>
        </div>
        <div className="simulator-buttons">
          {buttons.map((button) => (
            <button className={`simulator-button ${button.code.toLowerCase()}`} key={button.code} type="button" onClick={() => onPress(button.code)}>
              <span className="simulator-button-icon" aria-hidden="true">{button.icon}</span>
              <strong>{button.label}</strong>
              <span>{button.description}</span>
            </button>
          ))}
        </div>
        {error && <div className="error-notice" role="alert">{error}</div>}
        <div className="notice-box">
          <span className="notice-icon">i</span>
          <p>Test olaylarının kaynağı her zaman “simulator” olarak kaydedilir. İptal tuşu yalnızca test olayı oluşturur; geçmiş kaydını silmez.</p>
        </div>
      </section>

      <section className="panel simulator-summary">
        <div><span className="eyebrow">YEREL TEST GEÇMİŞİ</span><strong>{events.length} olay</strong></div>
        <span>Son test: {events[0] ? `${events[0].action} · ${formatTimestamp(events[0].timestamp)}` : 'Henüz test olayı yok'}</span>
      </section>
    </div>
  )
}

function SimulatorHistory({ events, loading, error }) {
  return (
    <section className="panel history-panel">
      <div className="section-heading">
        <div><h3>Sanal kumanda test geçmişi</h3><p>Kayıtlar bu bilgisayarda saklanır; gerçek çağrılar bu aşamada alınmaz.</p></div>
        <span className="simulator-badge">SİMÜLATÖR · {events.length}</span>
      </div>
      {error && <div className="error-notice" role="alert">{error}</div>}
      {loading
        ? <div className="empty-state"><strong>Geçmiş yükleniyor…</strong></div>
        : events.length > 0
          ? <div className="event-list history-event-list">{events.map((event) => <SimulatorEventRow event={event} key={event.eventId} />)}</div>
          : <div className="empty-state"><span className="empty-icon">◷</span><strong>Henüz test olayı yok</strong><span>Sanal kumandadaki tuşlara basıldığında olaylar burada görünür.</span></div>}
    </section>
  )
}

function DeviceConnection({ ports, selectedPort, setSelectedPort, onRefresh, refreshing, portState, onConnect, onDisconnect, error }) {
  const connected = portState === 'connected'
  return (
    <section className="panel connection-panel">
      <div className="section-heading">
        <div><h3>Seri port bağlantısı</h3><p>USB alıcınızın bağlı olduğu Windows COM portunu seçin.</p></div>
        <StatusIndicator state={connected ? 'online' : portState === 'error' ? 'offline' : 'idle'}>
          {connected ? 'Bağlı' : portState === 'error' ? 'Bağlantı hatası' : 'Bağlantı bekleniyor'}
        </StatusIndicator>
      </div>

      <label className="field-label" htmlFor="serial-port">Bulunan seri portlar</label>
      <div className="port-controls">
        <select
          id="serial-port"
          value={selectedPort}
          onChange={(event) => setSelectedPort(event.target.value)}
          disabled={connected || refreshing}
        >
          <option value="">COM portu seçin</option>
          {ports.map((port) => (
            <option value={port.path} key={port.path}>
              {port.path}{port.label ? ` — ${port.label}` : ''}
            </option>
          ))}
        </select>
        <button className="button secondary" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Taranıyor…' : 'Portları Yenile'}
        </button>
      </div>

      {ports.length === 0 && !refreshing && (
        <div className="inline-notice">Kullanılabilir COM portu bulunamadı. Donanım bağlı değilse bu normaldir.</div>
      )}
      {error && <div className="error-notice" role="alert">{error}</div>}

      <div className="connection-actions">
        <button className="button primary" type="button" onClick={onConnect} disabled={!selectedPort || connected}>
          Cihaza Bağlan
        </button>
        <button className="button secondary" type="button" onClick={onDisconnect} disabled={!connected}>
          Bağlantıyı Kes
        </button>
      </div>

      <div className="notice-box">
        <span className="notice-icon">i</span>
        <p>Bu aşamada seri bağlantı durumu kontrol edilir. Kumanda sinyali okunmaz veya çözülmez.</p>
      </div>
    </section>
  )
}

function PendingPage({ page }) {
  const [title, description] = pageTitles[page]
  return (
    <section className="panel pending-panel">
      <span className="pending-icon">◌</span>
      <div className="eyebrow">HAZIRLANIYOR</div>
      <h2>{title}</h2>
      <p>{pendingDescriptions[page]}</p>
      <span className="pending-footnote">Bu özellik henüz etkin değil.</span>
    </section>
  )
}

function PairingPage({ connection, onBeginPairing, onHeartbeat, onStopPairing }) {
  const [backendUrl, setBackendUrl] = useState(connection?.backendUrl || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pairingPending = connection?.pairingStatus === 'pending'
  const paired = connection?.paired === true
  const pairingStatusLabel = paired
    ? 'Eşleştirildi'
    : pairingPending
      ? 'Onay bekleniyor'
      : connection?.pairingStatus === 'revoked'
        ? 'Cihaz yetkisi kaldırıldı'
        : connection?.pairingStatus === 'expired'
          ? 'Oturum süresi doldu'
          : connection?.connectionStatus === 'error'
            ? 'Bağlantı hatası'
            : connection?.connectionStatus === 'connected'
              ? 'Bağlı'
              : 'Bağlantı bekleniyor'

  useEffect(() => {
    setBackendUrl(connection?.backendUrl || '')
  }, [connection?.backendUrl])

  const beginPairing = async () => {
    setBusy(true)
    setError('')
    try {
      await onBeginPairing(backendUrl)
    } catch (requestError) {
      setError(requestError?.message || 'PenPOS bağlantısı başlatılamadı.')
    } finally {
      setBusy(false)
    }
  }

  const checkHeartbeat = async () => {
    setBusy(true)
    setError('')
    try {
      await onHeartbeat()
    } catch (requestError) {
      setError(requestError?.message || 'PenPOS bağlantısı kontrol edilemedi.')
    } finally {
      setBusy(false)
    }
  }

  const stopPairing = async () => {
    setBusy(true)
    setError('')
    try {
      await onStopPairing()
    } catch (requestError) {
      setError(requestError?.message || 'Eşleştirme durdurulamadı.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel connection-panel pairing-panel">
      <div className="section-heading">
        <div><h3>Güvenli PenPOS bağlantısı</h3><p>Sunucu adresi HTTPS olmalı ve sertifika doğrulaması geçerli olmalıdır.</p></div>
        <StatusIndicator state={paired ? 'online' : pairingPending ? 'idle' : connection?.connectionStatus === 'error' ? 'offline' : 'idle'}>
          {pairingStatusLabel}
        </StatusIndicator>
      </div>

      <label className="field-label" htmlFor="backend-url">PenPOS sunucu HTTPS adresi</label>
      <input
        id="backend-url"
        className="text-input"
        type="url"
        inputMode="url"
        placeholder="https://pos.example.com"
        value={backendUrl}
        onChange={(event) => setBackendUrl(event.target.value)}
        disabled={paired || pairingPending || busy}
        autoComplete="url"
      />
      <div className="inline-notice">Yalnızca HTTPS kabul edilir. Sertifika doğrulaması kapatılmaz ve HTTP yönlendirmeleri reddedilir.</div>

      {!paired && (
        <div className="connection-actions">
          <button className="button primary" type="button" onClick={beginPairing} disabled={busy || pairingPending}>
            {busy ? 'Bağlanıyor…' : pairingPending ? 'Onay bekleniyor' : 'Güvenli eşleştirme başlat'}
          </button>
          {pairingPending && <button className="button secondary" type="button" onClick={stopPairing} disabled={busy}>Eşleştirmeyi durdur</button>}
        </div>
      )}

      {connection?.pairingCode && pairingPending && (
        <div className="pairing-code" aria-live="polite">
          <span className="field-label">PenPOS Ayarları → Donanımlar → Masa Çağrı Sistemi ekranına girin</span>
          <span className="pairing-id">Eşleştirme oturum kimliği: <code>{connection.pairingId}</code></span>
          <code>{connection.pairingCode}</code>
          <span>Geçerlilik: {connection.pairingExpiresAt ? formatTimestamp(connection.pairingExpiresAt) : 'Süreli'}</span>
        </div>
      )}

      {paired && (
        <div className="system-panel pairing-status-panel">
          <div className="system-row"><span>Cihaz kimliği</span><strong>{connection.deviceId}</strong></div>
          <div className="system-row"><span>İşletme</span><strong>{connection.tenantName || 'Bilgi alınmadı'}</strong></div>
          <div className="system-row"><span>Şube</span><strong>{connection.branchName || 'Bilgi alınmadı'}</strong></div>
          <div className="system-row"><span>Son heartbeat</span><strong>{connection.lastHeartbeatAt ? formatTimestamp(connection.lastHeartbeatAt) : 'Henüz gönderilmedi'}</strong></div>
          <div className="connection-actions">
            <button className="button secondary" type="button" onClick={checkHeartbeat} disabled={busy}>{busy ? 'Kontrol ediliyor…' : 'Şimdi bağlantıyı kontrol et'}</button>
          </div>
        </div>
      )}

      {(error || connection?.lastError) && <div className="error-notice" role="alert">{error || connection.lastError}</div>}
      <div className="notice-box">
        <span className="notice-icon">i</span>
        <p>Sanal kumanda olayları backend’e gönderilmez. Gerçek masa çağrısı oluşturma bu aşamada kapalıdır.</p>
      </div>
    </section>
  )
}

export default function App() {
  const [page, setPage] = useState('overview')
  const [ports, setPorts] = useState([])
  const [selectedPort, setSelectedPort] = useState('')
  const [portState, setPortState] = useState('disconnected')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [simulatorEvents, setSimulatorEvents] = useState([])
  const [simulatorLoading, setSimulatorLoading] = useState(true)
  const [simulatorError, setSimulatorError] = useState('')
  const [connection, setConnection] = useState(null)

  const refreshPorts = async () => {
    setRefreshing(true)
    setError('')
    setLoadError('')
    try {
      const nextPorts = await window.callAgent.listSerialPorts()
      setPorts(nextPorts)
      setSelectedPort((current) => nextPorts.some((port) => port.path === current) ? current : '')
    } catch (requestError) {
      const message = requestError?.message || 'COM portları listelenemedi.'
      setError(message)
      setLoadError(message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshPorts()
    window.callAgent.listSimulatorEvents()
      .then((events) => setSimulatorEvents((current) => {
        const merged = new Map([...events, ...current].map((event) => [event.eventId, event]))
        return [...merged.values()].sort((first, second) => second.timestamp.localeCompare(first.timestamp))
      }))
      .catch((requestError) => setSimulatorError(requestError?.message || 'Test geçmişi yüklenemedi.'))
      .finally(() => setSimulatorLoading(false))
    window.callAgent.getConnectionStatus()
      .then(setConnection)
      .catch((requestError) => setSimulatorError(requestError?.message || 'Bağlantı durumu yüklenemedi.'))
    const unsubscribeSerial = window.callAgent.onSerialState((state) => {
      setPortState(state.state)
      setError(state.error || '')
    })
    const unsubscribeConnection = window.callAgent.onConnectionState(setConnection)
    return () => {
      unsubscribeSerial()
      unsubscribeConnection()
    }
  }, [])

  const pressSimulatorButton = async (buttonCode) => {
    setSimulatorError('')
    try {
      const event = await window.callAgent.pressSimulatorButton(buttonCode)
      setSimulatorEvents((current) => [event, ...current.filter((item) => item.eventId !== event.eventId)])
    } catch (requestError) {
      setSimulatorError(requestError?.message || 'Test olayı kaydedilemedi.')
    }
  }

  const connect = async () => {
    setError('')
    try {
      await window.callAgent.connectSerialPort(selectedPort)
      setPortState('connected')
    } catch (requestError) {
      setPortState('error')
      setError(requestError?.message || 'Seri porta bağlanılamadı.')
    }
  }

  const disconnect = async () => {
    setError('')
    try {
      await window.callAgent.disconnectSerialPort()
      setPortState('disconnected')
    } catch (requestError) {
      setError(requestError?.message || 'Bağlantı kesilemedi.')
    }
  }

  const beginPairing = (backendUrl) => window.callAgent.beginPairing(backendUrl)
  const checkHeartbeat = () => window.callAgent.sendHeartbeat()
  const stopPairing = () => window.callAgent.stopPairing()
  const [title, subtitle] = pageTitles[page]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><strong>PenPOS</strong><span>ÇAĞRI AJANI</span></div>
        </div>
        <div className="nav-caption">ÇALIŞMA ALANI</div>
        <nav className="navigation" aria-label="Ana menü">
          {navigation.map((item) => (
            <button
              type="button"
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => setPage(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.id !== 'overview' && item.id !== 'connection' && item.id !== 'simulator' && item.id !== 'history' && <span className="nav-pending">•</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-avatar">P</div>
          <div><strong>Çağrı Ajanı</strong><span>{connection?.connectionStatus === 'connected' ? 'PenPOS bağlı' : 'Bağlantı bekleniyor'}</span></div>
          <span className={`mini-dot ${connection?.connectionStatus === 'connected' ? 'live' : ''}`} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">PenPOS <span>/</span> {title}</div>
          <div className="topbar-status"><span className={`mini-dot ${connection?.connectionStatus === 'connected' ? 'live' : ''}`} /> {connection?.connectionStatus === 'connected' ? 'PenPOS bağlı' : 'Ajan çalışıyor · PenPOS bekleniyor'}</div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><h1>{title}</h1><p>{subtitle}</p></div>
            <div className="version-pill">SÜRÜM 0.1.0</div>
          </div>
          {page === 'overview' && <Overview portState={portState} selectedPort={selectedPort} events={simulatorEvents} connection={connection} />}
          {page === 'pairing' && (
            <PairingPage
              connection={connection}
              onBeginPairing={beginPairing}
              onHeartbeat={checkHeartbeat}
              onStopPairing={stopPairing}
            />
          )}
          {page === 'simulator' && <SimulatorPage events={simulatorEvents} onPress={pressSimulatorButton} error={simulatorError} />}
          {page === 'history' && <SimulatorHistory events={simulatorEvents} loading={simulatorLoading} error={simulatorError} />}
          {page === 'connection' && (
            <DeviceConnection
              ports={ports}
              selectedPort={selectedPort}
              setSelectedPort={setSelectedPort}
              onRefresh={refreshPorts}
              refreshing={refreshing}
              portState={portState}
              onConnect={connect}
              onDisconnect={disconnect}
              error={error || loadError}
            />
          )}
          {page !== 'overview' && page !== 'connection' && page !== 'simulator' && page !== 'history' && page !== 'pairing' && <PendingPage page={page} />}
        </div>
        <footer className="footer"><span>PenPOS Çağrı Ajanı</span><span>USB seri bağlantı · Kurulum bekleniyor</span></footer>
      </main>
    </div>
  )
}
