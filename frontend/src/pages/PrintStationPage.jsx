import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'

export default function PrintStationPage({ system }) {
  const sys = String(system || 'kermes') === 'canteen' ? 'canteen' : 'kermes'
  const [busy, setBusy] = useState(false)
  const [stations, setStations] = useState([])
  const [printers, setPrinters] = useState([])

  const activeStation = useMemo(() => (stations || []).find(s => s.isActive === true) || null, [stations])
  const online = useMemo(() => {
    const ts = activeStation?.lastHeartbeatAt
    if (!ts) return false
    const t = new Date(ts).getTime()
    if (!Number.isFinite(t)) return false
    return Date.now() - t < 15000
  }, [activeStation?.lastHeartbeatAt])

  const load = async () => {
    setBusy(true)
    try {
      const qs = `?system=${encodeURIComponent(sys)}`
      const res = await api(`/api/printing/stations${qs}`, { silent: true })
      const list = Array.isArray(res?.stations) ? res.stations : []
      setStations(list)
      const active = list.find(s => s.isActive === true) || null
      if (active?.id) {
        const pr = await api(`/api/printing/stations/${encodeURIComponent(active.id)}/printers${qs}`, { silent: true })
        setPrinters(Array.isArray(pr?.printers) ? pr.printers.map(String).filter(Boolean) : [])
      } else {
        setPrinters([])
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
  }, [sys])

  return (
    <div className="main" style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Print Agent Durumu</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {activeStation ? `Aktif istasyon: ${activeStation.name}` : 'Aktif istasyon yok'}
          {activeStation?.lastHeartbeatAt ? ` · Son: ${new Date(activeStation.lastHeartbeatAt).toLocaleString('tr-TR')}` : ''}
        </div>
        <div style={{ fontWeight: 800, color: online ? '#22c55e' : '#ef4444' }}>{online ? 'Agent aktif' : 'Agent bekleniyor'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={load} disabled={busy}>{busy ? '...' : 'Yenile'}</button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 800 }}>Bu PC’de görülen yazıcılar</div>
        {(printers || []).length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {printers.map(p => (
              <div key={p} style={{ fontSize: 13, color: 'var(--muted)' }}>{p}</div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Henüz yazıcı listesi yok (Agent online olmalı).</div>
        )}
      </div>
    </div>
  )
}
