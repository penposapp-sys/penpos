import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiDownload } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams, normalizeBranchIds } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { downloadBlob } from '../lib/download.js'

const toMoney = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmtTl = (v) => {
  const n = toMoney(v)
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
}

const todayYmd = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const SkeletonCard = ({ height = 120 }) => (
  <div className="card" style={{ height, display: 'grid', gap: 8 }}>
    <div style={{ height: 14, width: '40%', background: '#f3f4f6', borderRadius: 8 }} />
    <div style={{ height: 28, width: '55%', background: '#f3f4f6', borderRadius: 8 }} />
    <div style={{ height: 14, width: '70%', background: '#f3f4f6', borderRadius: 8 }} />
  </div>
)

export default function Dashboard() {
  const { tenantCtx, user, allowedBranchIds } = useAuth()
  const { isMobilePortrait } = useResponsiveFlags()

  const allowedIds = useMemo(() => normalizeBranchIds(allowedBranchIds), [allowedBranchIds])
  const [period, setPeriod] = useState('today')
  const [rangeStart, setRangeStart] = useState(todayYmd())
  const [rangeEnd, setRangeEnd] = useState(todayYmd())
  const [selectedBranches, setSelectedBranches] = useState([])
  const [branchOptions, setBranchOptions] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [exporting, setExporting] = useState(false)
  const initBranchesRef = useRef(false)

  useEffect(() => {
    if (!initBranchesRef.current && allowedIds.length > 0) {
      initBranchesRef.current = true
      setSelectedBranches(allowedIds)
    }
  }, [allowedIds.join(',')])

  useEffect(() => {
    const loadBranches = async () => {
      if (allowedIds.length <= 1) {
        setBranchOptions([])
        return
      }
      const res = await api('/api/branches', { silent: true })
      const list = Array.isArray(res?.branches) ? res.branches : []
      const mapped = list
        .map(b => ({ id: String(b._id || b.id || ''), name: String(b.name || '') }))
        .filter(b => b.id && allowedIds.includes(b.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      setBranchOptions(mapped)
    }
    loadBranches()
  }, [allowedIds.join(',')])

  const selectedBranchesKey = selectedBranches.join(',')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set('period', period)
    if (period === 'range') {
      p.set('start', rangeStart)
      p.set('end', rangeEnd)
    }
    const { ids, params } = buildBranchQueryParams(selectedBranches)
    if (params) {
      for (const [k, v] of params.entries()) p.set(k, v)
    }
    return p
  }, [period, rangeStart, rangeEnd, selectedBranchesKey])

  useEffect(() => {
    const run = async () => {
      if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) {
        setData(null)
        setError('Şube seçiniz')
        return
      }
      if (period === 'range') {
        if (!rangeStart || !rangeEnd) return
        if (rangeStart > rangeEnd) {
          setData(null)
          setError('Başlangıç tarihi, bitiş tarihinden büyük olamaz')
          return
        }
      }

      setLoading(true)
      setError('')
      const res = await api(`/api/reports/dashboard?${query.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true })
      if (!res?.ok) {
        const msg = String(res?.message || 'Rapor yüklenemedi')
        setError(msg)
        setData(null)
        setLoading(false)
        return
      }
      setData(res)
      setLoading(false)
    }
    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [query.toString()])

  const sales = data?.sales || null
  const products = Array.isArray(data?.products) ? data.products : []
  const customers = data?.customers || null
  const hourly = Array.isArray(customers?.hourly) ? customers.hourly : []
  const cancelled = data?.cancelled || null

  const onExport = async () => {
    if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) {
      toast.error('Şube seçiniz')
      return
    }
    if (period === 'range') {
      if (!rangeStart || !rangeEnd) return
      if (rangeStart > rangeEnd) {
        toast.error('Başlangıç tarihi, bitiş tarihinden büyük olamaz')
        return
      }
    }
    setExporting(true)
    try {
      const res = await apiDownload(`/api/reports/export?${query.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true })
      if (!res?.ok || !res?.blob) {
        toast.error(String(res?.error?.message || 'Rapor indirilemedi'))
        setExporting(false)
        return
      }
      const filename = res.filename || `rapor_${todayYmd().replaceAll('-', '')}.xlsx`
      downloadBlob(res.blob, filename)
      toast.success('Rapor indirildi')
    } catch (err) {
      toast.error(String(err?.message || 'Rapor indirilemedi'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="main" style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'today', label: 'Bugün' },
              { key: 'week', label: 'Bu Hafta' },
              { key: 'month', label: 'Bu Ay' },
              { key: 'year', label: 'Bu Yıl' },
              { key: 'range', label: 'Aralık' }
            ].map(b => {
              const active = period === b.key
              return (
                <button
                  key={b.key}
                  className="btn"
                  aria-pressed={active}
                  onClick={() => {
                    setPeriod(b.key)
                    if (b.key !== 'range') {
                      setRangeStart(todayYmd())
                      setRangeEnd(todayYmd())
                    }
                  }}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              {data?.range?.start && data?.range?.end ? `Aralık: ${data.range.start} → ${data.range.end}` : ''}
            </div>
            <button className="btn" onClick={onExport} disabled={exporting || loading}>
              {exporting ? 'İndiriliyor...' : 'Rapor İndir'}
            </button>
          </div>
        </div>

        {period === 'range' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Başlangıç</div>
              <input type="date" className="input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bitiş</div>
              <input type="date" className="input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </label>
          </div>
        )}

        {branchOptions.length > 1 && (user?.role === 'tenant_admin' || user?.role === 'superadmin') && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şubeler</div>
            <select
              className="input"
              multiple
              value={selectedBranches}
              onChange={(e) => {
                const next = Array.from(e.target.selectedOptions).map(o => o.value)
                setSelectedBranches(next)
              }}
              style={{ height: 96 }}
            >
              {branchOptions.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Rapor yüklenemedi</div>
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>{error}</div>
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => toast.error(error)}>Detay</button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <SkeletonCard />
          {!isMobilePortrait && <SkeletonCard />}
          {!isMobilePortrait && <SkeletonCard />}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(12, minmax(0, 1fr))', gap: 12 }}>
          <div className="card" style={{ gridColumn: isMobilePortrait ? undefined : 'span 4', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800 }}>Satış Özeti</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sipariş: {sales ? Number(sales.orderCount || 0) : 0}</div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Toplam Ciro</div>
              <div style={{ fontWeight: 900, fontSize: 28 }}>{fmtTl(sales?.totalRevenue || 0)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Toplam Tahsilat</div>
                <div style={{ fontWeight: 800 }}>{fmtTl(sales?.totalPaid || 0)}</div>
              </div>
              {toMoney(sales?.overpayTotal || 0) > 0.01 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: '#b91c1c' }}>Fazla Tahsilat</div>
                  <div style={{ fontWeight: 900, color: '#b91c1c' }}>{fmtTl(sales?.overpayTotal || 0)}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Nakit</div>
                <div style={{ fontWeight: 700 }}>{fmtTl(sales?.byMethod?.cash || 0)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>POS/Kart</div>
                <div style={{ fontWeight: 700 }}>{fmtTl(sales?.byMethod?.pos || 0)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Banka</div>
                <div style={{ fontWeight: 700 }}>{fmtTl(sales?.byMethod?.bank || 0)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Cari</div>
                <div style={{ fontWeight: 700 }}>{fmtTl(sales?.byMethod?.account || 0)}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ gridColumn: isMobilePortrait ? undefined : 'span 3', display: 'grid', gap: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800 }}>Ürün Raporu (Top 10)</div>
              <Link to="/kermes/app/product-report" style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Tümünü Gör</Link>
            </div>
            {products.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>
            ) : isMobilePortrait ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {(products || []).map((p) => (
                  <div key={`${p.menuItemId}-${p.name}`} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: '#ffffff', display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 800 }} className="breakAny">{p.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                      <div style={{ color: 'var(--muted)' }}>Adet</div>
                      <div style={{ fontWeight: 800 }}>{Number(p.qty || 0)}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                      <div style={{ color: 'var(--muted)' }}>Ciro</div>
                      <div style={{ fontWeight: 900 }}>{fmtTl(p.revenue || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                  <div>Ürün</div>
                  <div style={{ textAlign: 'right' }}>Adet</div>
                  <div style={{ textAlign: 'right' }}>Ciro</div>
                </div>
                {(products || []).map((p) => (
                  <div key={`${p.menuItemId}-${p.name}`} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(p.qty || 0)}</div>
                    <div style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtTl(p.revenue || 0)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ gridColumn: isMobilePortrait ? undefined : 'span 2', display: 'grid', gap: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800 }}>Iptal Urunler</div>
              <Link to="/kermes/app/product-report" style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Detay</Link>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Hazir sonrasi iptal tutari</div>
              <div style={{ fontWeight: 900, fontSize: 24, color: '#b91c1c' }}>{fmtTl(cancelled?.totalRevenue || 0)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Iptal Adedi</div>
                <div style={{ fontWeight: 800 }}>{Number(cancelled?.totalQty || 0)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Urun Cesidi</div>
                <div style={{ fontWeight: 800 }}>{Number(cancelled?.itemCount || 0)}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ gridColumn: isMobilePortrait ? undefined : 'span 3', display: 'grid', gap: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800 }}>Müşteri Yoğunluğu</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Toplam: {Number(customers?.totalCustomers || 0)}</div>
            </div>
            <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
              {hourly.map((h) => {
                const max = hourly.reduce((m, x) => Math.max(m, Number(x.count || 0)), 0) || 1
                const w = Math.round((Number(h.count || 0) / max) * 100)
                return (
                  <div key={h.hour} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 32px', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{h.hour}</div>
                    <div style={{ height: 10, borderRadius: 999, background: '#eef2ff', overflow: 'hidden' }}>
                      <div style={{ width: `${w}%`, height: '100%', background: '#2563eb' }} />
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{Number(h.count || 0)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
