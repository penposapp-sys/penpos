import { useEffect, useState } from 'react'
import packageJson from '../package.json'

const navigation = [
  { id: 'overview', label: 'Genel Bakış', icon: '◫' },
  { id: 'connection', label: 'Cihaz Bağlantısı', icon: '⌁' },
  { id: 'pairing', label: 'Cihaz Eşleştirme', icon: '⌘' },
  { id: 'buttons', label: 'Buton Tanımlama', icon: '▦' },
  { id: 'tables', label: 'Masa Seçimi', icon: '▤' },
  { id: 'settings', label: 'Tuş Ayarları', icon: '☷' },
  { id: 'history', label: 'Çağrı Geçmişi', icon: '◷' },
  { id: 'system', label: 'Sistem Ayarları', icon: '⚙' }
]

const pageTitles = {
  overview: ['Genel Bakış', 'Çağrı sisteminizin anlık bağlantı ve çalışma durumu.'],
  connection: ['Cihaz Bağlantısı', 'USB alıcınızı bir seri port üzerinden bağlayın.'],
  pairing: ['Cihaz Eşleştirme', 'Alıcı ve PenPOS hesabı eşleştirme işlemleri.'],
  buttons: ['Buton Tanımlama', 'Kumanda tuşlarının görevlerini yapılandırın.'],
  tables: ['Masa Seçimi', 'Kumanda tuşlarını kullanacağınız masaları seçin.'],
  settings: ['Tuş Ayarları', 'Çağrı tuşlarının davranışlarını yönetin.'],
  history: ['Çağrı Geçmişi', 'Bu alıcıdan tanınan son fiziksel kumanda işlemleri.'],
  system: ['Sistem Ayarları', 'Ajan ve uygulama tercihleri.']
}

const pendingDescriptions = {
  pairing: 'PenPOS bağlantısı henüz kurulmadı. Hesapla güvenli eşleştirme sonraki aşamada hazırlanacak.',
  tables: 'Önce Çağrı Ajanı’nı PenPOS hesabıyla eşleştirin; ardından bu şubedeki etkin masalardan birini seçin.',
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

function RfCaptureRow({ event }) {
  if (event.eventType === 'invalid') {
    return <div className="error-notice" role="status">{event.error}</div>
  }
  return (
    <details className="rf-capture-row">
      <summary>
        <strong>{event.frequencyMHz} MHz · RX {event.receiverBandwidthKHz} kHz · protokol çözümlenmedi</strong>
        <span>{event.pulseCount} darbe · {formatTimestamp(event.receivedAt)}</span>
        <code>{event.fingerprint.slice(0, 16)}</code>
      </summary>
      <div className="rf-capture-details">
        <span>Alıcı ID: henüz çözümlenmedi</span>
        <span>Tuş: henüz çözümlenmedi</span>
        <code>{event.pulseUs.join(', ')}</code>
      </div>
    </details>
  )
}

function RfCaptureList({ captures }) {
  return captures.length > 0
    ? <div className="event-list">{captures.map((event, index) => <RfCaptureRow event={event} key={`${event.fingerprint || 'invalid'}-${event.receivedAt || index}`} />)}</div>
    : <div className="empty-state"><span className="empty-icon">⌁</span><strong>Henüz RF sinyali yakalanmadı</strong><span>Gerçek kumanda tuşuna basınca ham darbe bilgisi burada görünür. Kimlik veya tuş tahmin edilmez.</span></div>
}

function RfMatchList({ matches }) {
  return matches.length > 0
    ? <div className="event-list compact-event-list">{matches.slice(0, 8).map((event) => (
      <div className="simulator-event-row" key={event.matchId}>
        <div className="event-main">
          <strong>{event.actionName || 'RF tuşu'}</strong>
          <span>{event.tableName ? `Masa: ${event.tableName}` : `Tuş ${event.matchedLabel}`}</span>
        </div>
        <span className={`simulator-badge ${event.actionStatus === 'sent' ? 'rf-action-success' : event.actionStatus === 'error' ? 'rf-action-error' : ''}`}>
          {event.actionStatus === 'sending' ? 'GÖNDERİLİYOR' : event.actionStatus === 'sent'
            ? (event.action === 'cancel' ? `İPTAL · ${event.cancelledCount || 0}` : 'İLETİLDİ')
            : event.actionStatus === 'error' ? 'GÖNDERİLEMEDİ' : 'TANINDI'}
        </span>
        {event.error && <span className="rf-action-error-text">{event.error}</span>}
      </div>
    ))}</div>
    : <div className="empty-state"><span className="empty-icon">⌁</span><strong>Henüz eşleşen tuş yok</strong><span>Kumandaya basınca tanınan işlem burada görünür.</span></div>
}

function Overview({ portState, selectedPort, connection, rfCaptures, rfMatches }) {
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
            <div><h3>Son kumanda işlemleri</h3><p>RF tuşu tanıma ve PenPOS sonucu</p></div>
            <span className="subtle-tag">CANLI</span>
          </div>
          <RfMatchList matches={rfMatches} />
        </section>
        <section className="panel">
          <div className="section-heading">
            <div><h3>Son RF yakalaması</h3><p>USB alıcısından ham sinyal örneği</p></div>
            <span className="subtle-tag">TANILAMA</span>
          </div>
          <RfCaptureList captures={rfCaptures.slice(0, 3)} />
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
      </section>
    </>
  )
}

function DeviceConnection({ ports, selectedPort, setSelectedPort, onRefresh, refreshing, portState, onConnect, onDisconnect, error, rfCaptures, rfMatches }) {
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
        <p>Öğrenilmiş A/B/C ham sinyal eşleşmeleri, cihaz PenPOS’a eşleştirildiğinde ve bir masa seçildiğinde ilgili çağrı işlemini gönderir.</p>
      </div>
      <section className="rf-capture-panel" aria-live="polite">
        <div className="section-heading">
          <div><h3>Tanınan kumanda işlemleri</h3><p>Seçili masaya gönderilen son A/B/C işlemleri</p></div>
          <span className="simulator-badge">{rfMatches.length} İŞLEM</span>
        </div>
        <RfMatchList matches={rfMatches} />
      </section>
      <section className="rf-capture-panel" aria-live="polite">
        <div className="section-heading">
          <div><h3>Yakalanan RF sinyalleri</h3><p>Tekrarlanan aynı sinyal 1,8 saniye içinde tek örneğe indirilir.</p></div>
          <span className="simulator-badge">{rfCaptures.length} ÖRNEK</span>
        </div>
        <RfCaptureList captures={rfCaptures} />
      </section>
    </section>
  )
}

function RfTablePage({ connection, tables, selectedTableIds, onToggle, onRefresh, loading, error }) {
  const selectedCount = selectedTableIds.length
  return (
    <section className="panel connection-panel">
      <div className="section-heading">
        <div><h3>Kumanda kullanılacak masaları seçin</h3><p>Birden fazla masa seçebilirsiniz. Her masa için ayrı A/B/C tuşları tanımlanır.</p></div>
        <StatusIndicator state={selectedCount ? 'online' : 'idle'}>{selectedCount} masa seçildi</StatusIndicator>
      </div>
      {!connection?.paired ? (
        <div className="inline-notice">Önce Cihaz Eşleştirme ekranından bu alıcıyı PenPOS hesabınıza bağlayın.</div>
      ) : (
        <>
          <div className="system-row"><span>Şube</span><strong>{connection.branchName || 'Bilgi alınıyor'}</strong></div>
          <div className="rf-table-toolbar">
            <span className="field-label">Etkin masalar · seçmek için anahtarı açın</span>
            <button className="button secondary" type="button" onClick={onRefresh} disabled={loading}>{loading ? 'Yükleniyor…' : 'Masaları yenile'}</button>
          </div>
          {tables.length === 0 && !loading && <div className="inline-notice">Bu şubede etkin masa bulunamadı.</div>}
          <div className="rf-table-grid">
            {tables.map((table) => {
              const selected = selectedTableIds.includes(table.id)
              return (
                <button type="button" className={`rf-table-option ${selected ? 'selected' : ''}`} key={table.id} onClick={() => onToggle(table.id)} aria-pressed={selected}>
                  <span><strong>{table.name}</strong><small>{[table.branchName, selected ? 'Tuş tanımlaması açık' : 'Tuş tanımlaması kapalı'].filter(Boolean).join(' · ')}</small></span>
                  <span className={`rf-toggle ${selected ? 'on' : ''}`} aria-hidden="true"><i /></span>
                </button>
              )
            })}
          </div>
        </>
      )}
      {error && <div className="error-notice" role="alert">{error}</div>}
      <div className="notice-box"><span className="notice-icon">i</span><p>Seçtiğiniz masalar Buton Tanımlama sayfasında listelenir. A garson çağırır, B servis talebi açar, C bu alıcının ilgili masada açtığı bekleyen çağrıları iptal eder.</p></div>
    </section>
  )
}

const RF_BUTTON_ACTIONS = [
  { label: 'A', actionName: 'Garson çağır' },
  { label: 'B', actionName: 'Servis talebi' },
  { label: 'C', actionName: 'İptal' }
]

function ButtonDefinitionPage({ portState, tables, selectedTableIds, profiles, pendingTarget, learningMessage, error, onLearn, onCancel, onDelete }) {
  const connected = portState === 'connected'
  return (
    <section className="panel connection-panel">
      <div className="section-heading">
        <div><h3>Kumanda tuşlarını tanıtın</h3><p>USB alıcısı üzerinden her tuşun ham sinyalini kaydedin.</p></div>
        <StatusIndicator state={connected ? 'online' : 'idle'}>{connected ? 'Alıcı bağlı' : 'Önce alıcıya bağlanın'}</StatusIndicator>
      </div>
      <div className="notice-box"><span className="notice-icon">i</span><p>Önce Masa Seçimi’nde masaları açın. Her masanın A/B/C tuşlarını ayrı ayrı tanıtın; kumanda tuşuna birkaç kez basınca eşleşme bu bilgisayarda saklanır.</p></div>
      {learningMessage && <div className="inline-notice" role="status">{learningMessage}</div>}
      {error && <div className="error-notice" role="alert">{error}</div>}
      {!selectedTableIds.length && <div className="empty-state"><strong>Henüz masa seçilmedi</strong><span>Önce Masa Seçimi sayfasından kumandanın kullanılacağı masaları açın.</span></div>}
      <div className="rf-table-profile-list">
        {tables.filter((table) => selectedTableIds.includes(table.id)).map((table) => (
          <section className="rf-table-profile" key={table.id}>
            <div className="section-heading"><div><h3>{table.name}</h3><p>{[table.branchName, 'Bu masaya ait bağımsız kumanda tuşları'].filter(Boolean).join(' · ')}</p></div><span className="simulator-badge">3 TUŞ</span></div>
            <div className="rf-button-grid">
              {RF_BUTTON_ACTIONS.map(({ label, actionName }) => {
                const key = `${table.id}:${label}`
                const stored = !!profiles?.[key]
                const learning = pendingTarget?.tableId === table.id && pendingTarget?.label === label
                const anotherLearning = !!pendingTarget && !learning
                return (
                  <article className="rf-button-card" key={label}>
                    <div className="rf-button-card-heading"><span className="rf-button-letter">{label}</span><StatusIndicator state={stored ? 'online' : learning ? 'idle' : 'idle'}>{learning ? 'Sinyal bekleniyor' : stored ? 'Tanımlı' : 'Tanımlı değil'}</StatusIndicator></div>
                    <h3>{actionName}</h3>
                    <p>{learning ? 'Yalnızca bu masanın kumandasında bu tuşa basın.' : `Bu masada ${label} tuşu ${actionName.toLocaleLowerCase('tr-TR')} işlemini yapar.`}</p>
                    <button className="button primary" type="button" onClick={() => onLearn(table, label)} disabled={!connected || anotherLearning}>
                      {learning ? 'Sinyal bekleniyor…' : stored ? 'Yeniden tanıt' : 'Tuşu tanıt'}
                    </button>
                    {stored && !learning && <button className="button text-button" type="button" onClick={() => onDelete(table.id, label)}>Kaydı sil</button>}
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      {pendingTarget && <div className="connection-actions"><button className="button secondary" type="button" onClick={onCancel}>Tanıtmayı iptal et</button></div>}
      <div className="notice-box"><span className="notice-icon">i</span><p>Tuş kayıtları masaya ve bu bilgisayardaki çağrı ajanına bağlı saklanır. Farklı masaların sinyalleri benzerse eşleşme belirsiz sayılır ve çağrı gönderilmez.</p></div>
    </section>
  )
}

function ButtonSettingsPage({ tables, selectedTableIds, profiles }) {
  return (
    <section className="panel connection-panel">
      <div className="section-heading"><div><h3>Çağrı tuşlarının davranışı</h3><p>Bu kumanda için etkin işlem eşlemesi.</p></div></div>
      {tables.filter((table) => selectedTableIds.includes(table.id)).map((table) => <div className="rf-settings-row" key={table.id}><strong>{[table.branchName, table.name].filter(Boolean).join(' · ')}</strong><span>{RF_BUTTON_ACTIONS.map(({ label }) => `${label}: ${profiles?.[`${table.id}:${label}`] ? 'Tanımlı' : 'Boş'}`).join(' · ')}</span></div>)}
      <div className="notice-box"><span className="notice-icon">i</span><p>Her sinyal en az üç tekrar ve %80 benzerlik eşiğiyle denetlenir; birden fazla masaya benzer eşleşme çıkarsa yanlış çağrıyı önlemek için işlem yapılmaz.</p></div>
    </section>
  )
}

function RfActionHistory({ matches }) {
  return (
    <section className="panel connection-panel">
      <div className="section-heading"><div><h3>Son kumanda işlemleri</h3><p>Alıcıdan tanınan ve PenPOS’a gönderilen gerçek işlemler.</p></div><span className="simulator-badge">{matches.length} İŞLEM</span></div>
      <RfMatchList matches={matches} />
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

function PairingPage({ connection, onHeartbeat, onStopPairing }) {
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
        <div><h3>PenPOS bağlantısı</h3><p>Ajan yalnızca resmi PenPOS sunucusuna bağlanır.</p></div>
        <StatusIndicator state={paired ? 'online' : pairingPending ? 'idle' : connection?.connectionStatus === 'error' ? 'offline' : 'idle'}>
          {pairingStatusLabel}
        </StatusIndicator>
      </div>

      <label className="field-label" htmlFor="backend-url">PenPOS sunucu adresi · değiştirilemez</label>
      <input id="backend-url" className="text-input" type="url" value="https://penpos.cloud" readOnly />
      <div className="inline-notice">Cihaz eşleştirme kodunu PenPOS Ayarları → Donanımlar → Masa Çağrı Sistemi ekranındaki “Cihaz Eşleştir” butonuyla oluşturun. Ajan kodu otomatik alır.</div>

      {pairingPending && <div className="connection-actions"><button className="button secondary" type="button" onClick={stopPairing} disabled={busy}>Eşleştirmeyi durdur</button></div>}

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
        <p>Gerçek kumanda işlemleri yalnızca PenPOS’a eşleştirilmiş ve Masa Eşleştirme ekranında masa seçilmişse gönderilir.</p>
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
  const [connection, setConnection] = useState(null)
  const [rfCaptures, setRfCaptures] = useState([])
  const [rfMatches, setRfMatches] = useState([])
  const [rfLearningMessage, setRfLearningMessage] = useState('')
  const [rfLearningError, setRfLearningError] = useState('')
  const [rfTables, setRfTables] = useState([])
  const [rfTableIds, setRfTableIds] = useState([])
  const [rfTablesLoading, setRfTablesLoading] = useState(false)
  const [rfTablesError, setRfTablesError] = useState('')

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
    window.callAgent.getSerialState()
      .then((status) => {
        setSelectedPort(status.portPath || '')
        setPortState(status.state || 'disconnected')
        setError(status.error || '')
      })
      .catch(() => {})
      .finally(refreshPorts)
    window.callAgent.getConnectionStatus()
      .then((status) => {
        setConnection(status)
        setRfTableIds(status.rfTableIds || (status.rfTableId ? [status.rfTableId] : []))
      })
      .catch((requestError) => setConnection({ connectionStatus: 'error', lastError: requestError?.message || 'Bağlantı durumu alınamadı.' }))
    const unsubscribeSerial = window.callAgent.onSerialState((state) => {
      setPortState(state.state)
      setError(state.error || '')
    })
    const unsubscribeSerialEvents = window.callAgent.onSerialEvent((event) => {
      if (event.eventType === 'learning_status') return
      if (event.eventType === 'rf_button_learned') {
        const tableName = event.tableName || rfTables.find((table) => table.id === event.tableId)?.name || 'Seçili masa'
        setRfLearningMessage(`${tableName} · ${event.label} tuşu kaydedildi.`)
        setRfLearningError('')
        return
      }
      if (event.eventType === 'button_match') {
        setRfMatches((current) => [event, ...current].slice(0, 20))
        return
      }
      if (event.eventType === 'button_action_result') {
        setRfMatches((current) => current.map((match) => match.matchId === event.matchId
          ? { ...match, actionStatus: event.ok ? 'sent' : 'error', tableName: event.tableName || match.tableName, cancelledCount: event.cancelledCount, error: event.error || '' }
          : match))
        return
      }
      setRfCaptures((current) => [event, ...current].slice(0, 20))
    })
    const unsubscribeConnection = window.callAgent.onConnectionState((status) => {
      setConnection(status)
      setRfTableIds(status.rfTableIds || (status.rfTableId ? [status.rfTableId] : []))
    })
    return () => {
      unsubscribeSerial()
      unsubscribeSerialEvents()
      unsubscribeConnection()
    }
  }, [])

  const refreshRfTables = async () => {
    setRfTablesLoading(true)
    setRfTablesError('')
    try {
      const tables = await window.callAgent.listRfTables()
      setRfTables(tables)
      const validSelection = rfTableIds.filter((tableId) => tables.some((table) => table.id === tableId))
      if (validSelection.length !== rfTableIds.length) {
        const status = await window.callAgent.setRfTableIds(validSelection)
        setConnection(status)
        setRfTableIds(validSelection)
      }
    } catch (requestError) {
      setRfTablesError(requestError?.message || 'Masa listesi alınamadı.')
    } finally {
      setRfTablesLoading(false)
    }
  }

  useEffect(() => {
    if (connection?.paired && connection?.branchId) refreshRfTables()
  }, [connection?.paired, connection?.branchId, rfTableIds])

  const toggleRfTable = async (tableId) => {
    setRfTablesError('')
    try {
      const nextTableIds = rfTableIds.includes(tableId)
        ? rfTableIds.filter((selectedId) => selectedId !== tableId)
        : [...rfTableIds, tableId]
      const status = await window.callAgent.setRfTableIds(nextTableIds)
      setConnection(status)
      setRfTableIds(status.rfTableIds || [])
    } catch (requestError) {
      setRfTablesError(requestError?.message || 'Masa seçimi kaydedilemedi.')
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

  const learnRfButton = async (table, label) => {
    setRfLearningError('')
    setRfLearningMessage(`${table.name} · ${label} tuşu bekleniyor. Kumandada yalnızca bu tuşa birkaç kez basın.`)
    try {
      const status = await window.callAgent.startRfButtonLearning(table.id, label, table.name)
      setConnection(status)
    } catch (requestError) {
      setRfLearningMessage('')
      setRfLearningError(requestError?.message || 'Öğrenme başlatılamadı.')
    }
  }

  const stopRfLearning = async () => {
    setRfLearningError('')
    try {
      const status = await window.callAgent.cancelRfButtonLearning()
      setConnection(status)
      setRfLearningMessage('Tuş tanıtımı iptal edildi.')
    } catch (requestError) {
      setRfLearningError(requestError?.message || 'Öğrenme durdurulamadı.')
    }
  }

  const deleteRfButtonProfile = async (tableId, label) => {
    setRfLearningError('')
    try {
      const status = await window.callAgent.deleteRfButtonProfile(tableId, label)
      setConnection(status)
      setRfLearningMessage('Tuş kaydı silindi.')
    } catch (requestError) {
      setRfLearningError(requestError?.message || 'Tuş kaydı silinemedi.')
    }
  }

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
              {item.id !== 'overview' && item.id !== 'connection' && item.id !== 'history' && item.id !== 'tables' && item.id !== 'buttons' && item.id !== 'settings' && <span className="nav-pending">•</span>}
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
            <div className="version-pill">SÜRÜM {packageJson.version}</div>
          </div>
          {page === 'overview' && <Overview portState={portState} selectedPort={selectedPort} connection={connection} rfCaptures={rfCaptures} rfMatches={rfMatches} />}
          {page === 'pairing' && (
            <PairingPage
              connection={connection}
              onHeartbeat={checkHeartbeat}
              onStopPairing={stopPairing}
            />
          )}
          {page === 'tables' && <RfTablePage connection={connection} tables={rfTables} selectedTableIds={rfTableIds} onToggle={toggleRfTable} onRefresh={refreshRfTables} loading={rfTablesLoading} error={rfTablesError} />}
          {page === 'buttons' && <ButtonDefinitionPage portState={portState} tables={rfTables} selectedTableIds={rfTableIds} profiles={connection?.rfButtonProfiles || {}} pendingTarget={connection?.pendingRfLearning} learningMessage={rfLearningMessage} error={rfLearningError} onLearn={learnRfButton} onCancel={stopRfLearning} onDelete={deleteRfButtonProfile} />}
          {page === 'settings' && <ButtonSettingsPage tables={rfTables} selectedTableIds={rfTableIds} profiles={connection?.rfButtonProfiles || {}} />}
          {page === 'history' && <RfActionHistory matches={rfMatches} />}
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
              rfCaptures={rfCaptures}
              rfMatches={rfMatches}
            />
          )}
          {page !== 'overview' && page !== 'connection' && page !== 'history' && page !== 'pairing' && page !== 'tables' && page !== 'buttons' && page !== 'settings' && <PendingPage page={page} />}
        </div>
        <footer className="footer"><span>PenPOS Çağrı Ajanı</span><span>{portState === 'connected' ? 'USB seri bağlı · RF alıcı hazır' : 'USB seri bağlantı bekleniyor'}</span></footer>
      </main>
    </div>
  )
}
