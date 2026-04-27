import React from 'react'

export default function AutoPrintInfoCard({
  busy,
  status,
  printerCount,
  hostname,
  version,
  latestVersion,
  updateAvailable,
  lastSeenSec,
  onReload,
  error,
  hint
}) {
  const st = String(status || '')
  const isOnline = st === 'online'
  const isStale = st === 'stale'
  const isOffline = st === 'offline'
  const statusText =
    st === 'no_station' ? 'Print Station yok'
      : st === 'no_active_station' ? 'Aktif istasyon yok'
        : st === 'no_heartbeat' ? 'Heartbeat yok'
          : isOnline ? 'Agent online'
            : isStale ? 'Agent stale'
              : isOffline ? 'Agent offline'
                : 'Agent bekleniyor'
  const statusColor = isOnline ? '#22c55e' : isStale ? '#f59e0b' : '#ef4444'

  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Print Agent</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Otomatik yazdirma icin bu bilgisayarda PenPOS Print Agent calismalidir.</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, color: statusColor }}>{statusText}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yazicilar: {Number(printerCount || 0)}</div>
            {typeof lastSeenSec === 'number' && !Number.isNaN(lastSeenSec) && !isOnline ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Son goruldu: {Math.max(0, Math.round(lastSeenSec))} sn once</div>
            ) : null}
          </div>
          {(String(hostname || '').trim() || String(version || '').trim()) ? (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              {String(hostname || '').trim() ? `Host: ${String(hostname).trim()}` : ''}
              {String(hostname || '').trim() && String(version || '').trim() ? ' · ' : ''}
              {String(version || '').trim() ? `Versiyon: ${String(version).trim()}` : ''}
            </div>
          ) : null}
          {!!String(latestVersion || '').trim() && (
            <div style={{ marginTop: 4, fontSize: 12, color: updateAvailable ? '#f59e0b' : 'var(--muted)', fontWeight: updateAvailable ? 700 : 500 }}>
              {updateAvailable ? `Guncelleme var: ${latestVersion}` : `Guncel surum: ${latestVersion}`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn--compact" onClick={onReload} disabled={busy}>{busy ? '...' : 'Yenile'}</button>
        </div>
      </div>

      {!!String(error || '').trim() && (
        <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>{error}</div>
      )}

      {!!String(hint || '').trim() && (
        <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>{hint}</div>
      )}
    </div>
  )
}
