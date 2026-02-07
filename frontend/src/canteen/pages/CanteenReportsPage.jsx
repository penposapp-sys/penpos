import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { buildBranchQueryParams } from '../../lib/branchQuery.js'
import { paymentLabel } from '../utils/paymentLabels.js'

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const toYmd = (d) => {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CanteenReportsPage() {
  const { me, session } = useOutletContext()
  const canView = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('canteen_reports_view'))
  const canExport = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_reports_export') || me.permissions.includes('canteen_reports_view')))

  const [period, setPeriod] = useState('today')
  const [start, setStart] = useState(toYmd(new Date()))
  const [end, setEnd] = useState(toYmd(new Date()))
  const [tab, setTab] = useState('summary')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const backendBase = () => {
    try {
      const raw = String(import.meta.env.VITE_API_URL || '').trim()
      if (raw) {
        const u = new URL(raw)
        u.port = '4000'
        u.pathname = ''
        u.search = ''
        u.hash = ''
        return u.toString().replace(/\/+$/, '')
      }
    } catch {
    }
    try {
      const host = String(window.location?.hostname || '').trim()
      if (host) return `http://${host}:4000`
    } catch {
    }
    return '/api'
  }

  const downloadAllExcel = async () => {
    if (!canExport) return
    setExporting(true)
    setError('')
    try {
      const token = (() => {
        try { return String(localStorage.getItem('token_canteen') || '') } catch { return '' }
      })()
      const url = `${backendBase()}/api/canteen/reports/export?${qs}`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      if (!res.ok) {
        let msg = 'İşlem başarısız'
        try {
          const data = await res.json()
          msg = String(data?.message || data?.error || msg)
        } catch {
        }
        setError(msg)
        setExporting(false)
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') || ''
      const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd)
      const filename = decodeURIComponent(m?.[1] || m?.[2] || 'raporlar.xlsx')
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => {
        try { URL.revokeObjectURL(objectUrl) } catch {}
      }, 2000)
    } catch (e) {
      setError('İşlem başarısız')
    } finally {
      setExporting(false)
    }
  }

  const qs = useMemo(() => {
    const base = new URLSearchParams()
    const branch = buildBranchQueryParams(session?.allowedBranchIds)
    if (branch.params) {
      for (const [k, v] of branch.params.entries()) base.set(k, v)
    }
    base.set('period', period)
    if (period === 'range') {
      base.set('start', start)
      base.set('end', end)
    }
    return base.toString()
  }, [period, start, end, session?.allowedBranchIds])

  const load = async () => {
    setLoading(true)
    setError('')
    const s = await api(`/api/canteen/reports/summary?${qs}`, { silent: true })
    const p = await api(`/api/canteen/reports/products?${qs}`, { silent: true })
    const c = await api(`/api/canteen/reports/customers?${qs}`, { silent: true })
    if (!s?.ok) setError(s?.message || 'Rapor alınamadı')
    setSummary(s?.ok ? (s.summary || null) : null)
    setProducts(Array.isArray(p?.items) ? p.items : [])
    setCustomers(Array.isArray(c?.items) ? c.items : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [qs])

  if (!canView) return <div className="card">403 – Bu sayfaya yetkin yok</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="stickyTop" style={{ display: 'grid', gap: 10, paddingBottom: 12 }}>
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Raporlar</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Dönem filtreleriyle özet ve kırılımlar.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn--compact" type="button" onClick={load} disabled={loading || exporting}>{loading ? '...' : 'Yenile'}</button>
              {canExport && (
                <button className="btn btn--compact btn--primary" type="button" onClick={downloadAllExcel} disabled={exporting || loading}>
                  {exporting ? '...' : 'Excel İndir (Tümü)'}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {[
              { key: 'today', label: 'Bugün' },
              { key: 'week', label: 'Hafta' },
              { key: 'month', label: 'Ay' },
              { key: 'year', label: 'Yıl' },
              { key: 'range', label: 'Aralık' }
            ].map(p => (
              <button key={p.key} className="btn" type="button" onClick={() => setPeriod(p.key)} aria-pressed={period === p.key}>{p.label}</button>
            ))}
            {period === 'range' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ height: 34, minWidth: 160 }} />
                <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ height: 34, minWidth: 160 }} />
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'summary', label: 'Satış raporu' },
            { key: 'products', label: 'En çok satan ürünler' },
            { key: 'customers', label: 'Cariler' }
          ].map(t => (
            <button key={t.key} className="btn" type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}>{t.label}</button>
          ))}
        </div>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      {tab === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div className="card">
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Ciro</div>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{money(summary?.totalRevenue || 0)} ₺</div>
          </div>
          <div className="card">
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>İşlem</div>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{Number(summary?.saleCount || 0)}</div>
          </div>
          <div className="card">
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Ortalama Sepet</div>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{money(summary?.avgBasket || 0)} ₺</div>
          </div>
          <div className="card">
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Ödeme Kırılımı</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {Object.entries(summary?.byMethod || {}).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ color: 'var(--muted)' }}>{paymentLabel(k)}</div>
                  <div style={{ fontWeight: 700 }}>{money(v)} ₺</div>
                </div>
              ))}
              {(!summary?.byMethod || Object.keys(summary.byMethod).length === 0) && <div style={{ color: 'var(--muted)' }}>-</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="card" style={{ display: 'grid', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
          {products.map(p => (
            <div key={p.productId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ color: 'var(--muted)' }}>{Number(p.qty || 0)} adet</div>
              <div style={{ fontWeight: 700 }}>{money(p.total || 0)} ₺</div>
            </div>
          ))}
          {!loading && products.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      )}

      {tab === 'customers' && (
        <div className="card" style={{ display: 'grid', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
          {customers.map(c => (
            <div key={c.customerId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{c.phone || ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Borç</div>
                <div style={{ fontWeight: 800, color: Number(c.balance || 0) > 0 ? '#ef4444' : 'var(--text)' }}>{money(c.balance)} ₺</div>
              </div>
            </div>
          ))}
          {!loading && customers.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      )}
    </div>
  )
}
