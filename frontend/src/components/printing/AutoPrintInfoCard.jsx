import React from 'react'

const getStationStatus = (lastHeartbeatAt) => {
  if (!lastHeartbeatAt) return { label: 'Henüz bağlanmadı', tone: 'var(--danger-text)', ageSec: null }
  const heartbeatTime = new Date(lastHeartbeatAt).getTime()
  if (!Number.isFinite(heartbeatTime)) return { label: 'Bağlantı bilgisi yok', tone: 'var(--danger-text)', ageSec: null }
  const ageMs = Math.max(0, Date.now() - heartbeatTime)
  if (ageMs <= 15000) return { label: 'Çevrimiçi', tone: 'var(--success-text)', ageSec: ageMs / 1000 }
  if (ageMs <= 60000) return { label: 'Yanıt gecikiyor', tone: 'var(--warning-text)', ageSec: ageMs / 1000 }
  return { label: 'Çevrimdışı', tone: 'var(--danger-text)', ageSec: ageMs / 1000 }
}

const parseVersion = (value) => {
  const match = String(value || '').trim().match(/^v?(\d+(?:\.\d+){0,3})(?:[-+][0-9A-Za-z.-]+)?$/)
  return match ? match[1].split('.').map(Number) : null
}

const compareVersions = (left, right) => {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return null
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0)
    if (difference !== 0) return difference > 0 ? 1 : -1
  }
  return 0
}

export default function AutoPrintInfoCard({ busy, stations = [], latestVersion, onReload }) {
  const list = Array.isArray(stations) ? stations : []

  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800 }}>Bilgisayar Durumları</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>Her istasyonun bağlı bilgisayarı ve bağlantı durumu ayrı gösterilir.</div>
        </div>
        <button className="btn btn--compact" onClick={onReload} disabled={busy}>{busy ? '...' : 'Yenile'}</button>
      </div>

      {list.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 10 }}>
          {list.map((station) => {
            const status = getStationStatus(station?.lastHeartbeatAt)
            const meta = station?.lastHeartbeatMeta || {}
            const machineName = String(meta.hostname || '').trim()
            const version = String(meta.version || '').trim()
            const countFromMeta = Number(meta.printersCount)
            const printerCount = Number.isFinite(countFromMeta)
              ? countFromMeta
              : (Array.isArray(meta.printers) ? meta.printers.length : 0)
            const ruleCount = Array.isArray(station?.printers) ? station.printers.length : 0
            const versionComparison = compareVersions(latestVersion, version)
            const updateLabel = !version
              ? (latestVersion ? `Sürüm bilgisi yok · Güncel sürüm: ${latestVersion}` : '')
              : versionComparison === 1
                ? `Güncelleme var: ${version} → ${latestVersion}`
                : versionComparison === -1
                  ? `Yüklü sürüm ${version} · Sunucudaki sürüm ${latestVersion}`
                  : latestVersion
                    ? versionComparison === 0
                      ? `Güncel sürüm: ${version}`
                      : `Sürüm karşılaştırılamadı · Yüklü: ${version} · Sunucudaki: ${latestVersion}`
                    : ''

            return (
              <section
                key={station.id}
                style={{ display: 'grid', gap: 7, padding: 12, minWidth: 0, border: '1px solid var(--border)', borderLeft: `4px solid ${status.tone}`, borderRadius: 11, background: 'var(--app-surface-2, var(--app-surface-soft))' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0, fontWeight: 900, overflowWrap: 'anywhere' }}>{station?.name || 'Yazdırma İstasyonu'}</div>
                  <div style={{ flex: '0 0 auto', fontSize: 12, fontWeight: 800, color: status.tone }}>{status.label}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', overflowWrap: 'anywhere' }}>
                  Bilgisayar: {machineName || 'Henüz tanımlanmadı'}{version ? ` · Sürüm ${version}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {printerCount} bilgisayar yazıcısı · {ruleCount} tanımlı yazıcı kuralı · {station?.isActive === true ? 'İstasyon aktif' : 'İstasyon pasif'}
                  {status.ageSec !== null && status.label !== 'Çevrimiçi' ? ` · Son görüldü: ${Math.round(status.ageSec)} sn önce` : ''}
                </div>
                {updateLabel && (
                  <div style={{ fontSize: 12, color: versionComparison === 1 ? 'var(--warning-text)' : 'var(--muted)', fontWeight: versionComparison === 1 ? 700 : 500 }}>
                    {updateLabel}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Henüz yazdırma istasyonu eklenmemiş.</div>
      )}
    </div>
  )
}
