import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { auditActionLabel, auditEntityLabel } from '../kermes/utils/auditLabels.js'

export default function AuditPage() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (action) params.set('action', action)
      if (actorUserId) params.set('actorUserId', actorUserId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await api(`/api/tenant/audit?${params.toString()}`)
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, limit])

  const onFilter = (e) => {
    e.preventDefault()
    setPage(1)
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const shortId = (value) => {
    const s = String(value || '')
    if (!s) return ''
    if (s.length <= 14) return s
    return `${s.slice(0, 7)}...${s.slice(-4)}`
  }

  const toLocalDayKey = (dt) => {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return 'invalid'
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const formatGroupHeader = (dayKey, count) => {
    const base = new Date(`${dayKey}T00:00:00`)
    const dateText = base.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const weekday = base.toLocaleDateString('tr-TR', { weekday: 'long' })
    const w = weekday ? `${weekday[0].toUpperCase()}${weekday.slice(1)}` : ''
    return `${dateText}${w ? ` (${w})` : ''} – toplam kayıt: ${count}`
  }

  const grouped = (() => {
    const map = new Map()
    const orderedKeys = []
    for (const it of (items || [])) {
      const k = toLocalDayKey(it.createdAt)
      if (!map.has(k)) {
        map.set(k, [])
        orderedKeys.push(k)
      }
      map.get(k).push(it)
    }
    return orderedKeys.map(k => ({
      dayKey: k,
      header: formatGroupHeader(k, map.get(k).length),
      rows: map.get(k)
    }))
  })()

  return (
    <div className="main">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Denetim Kayıtları</h3>
      </div>
      <form onSubmit={onFilter} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aksiyon</div>
          <input className="input" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Örn: Ödeme" />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı</div>
          <input className="input" value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} placeholder="Örn: 697628e...0aab" />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Başlangıç</div>
          <input className="input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bitiş</div>
          <input className="input" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button className="btn">Filtrele</button>
        </div>
      </form>
      {error && <div style={{ color: '#ef4444', marginTop: 8 }}>{error}</div>}
      <div className="card">
        {loading ? 'Yükleniyor...' : (
          items.length === 0 ? <div>Kayıt yok</div> : (
            <table className="table">
              <thead>
                <tr><th>Tarih/Saat</th><th>Aksiyon</th><th>Varlık</th><th>Varlık No</th><th>Kullanıcı</th></tr>
              </thead>
              <tbody>
                {grouped.flatMap(g => {
                  const headerRow = (
                    <tr key={`g-${g.dayKey}`}>
                      <td colSpan={5} style={{ fontWeight: 600, background: 'rgba(2,6,23,0.04)' }}>{g.header}</td>
                    </tr>
                  )
                  const rows = g.rows.map(a => {
                    const actor = a.actorUser || a.user || null
                    const actorName = String(actor?.name || '').trim()
                    const actorEmail = String(actor?.email || '').trim()
                    const actorId = actor?.id || a.actorUserId || null
                    const actorShort = shortId(actorId)
                    return (
                      <tr key={a.id}>
                        <td>{new Date(a.createdAt).toLocaleString('tr-TR')}</td>
                        <td>{auditActionLabel(a.action)}</td>
                        <td>{auditEntityLabel(a.entityType)}</td>
                        <td>{shortId(a.entityId)}</td>
                        <td>
                          {actorName ? (
                            <div style={{ display: 'grid', gap: 2 }}>
                              <div style={{ fontWeight: 800 }}>{actorName}</div>
                              {actorEmail ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>{actorEmail}</div> : null}
                            </div>
                          ) : actorEmail ? (
                            <div style={{ fontWeight: 800 }}>{actorEmail}</div>
                          ) : (
                            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{actorShort}</div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                  return [headerRow, ...rows]
                })}
              </tbody>
            </table>
          )
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Önceki</button>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sayfa {page}/{totalPages}</div>
        <button className="btn" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Sonraki</button>
        <select className="input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  )
}
