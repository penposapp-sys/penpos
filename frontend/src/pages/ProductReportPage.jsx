import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams, normalizeBranchIds } from '../lib/branchQuery.js'

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

export default function ProductReportPage() {
  const { user, allowedBranchIds } = useAuth()

  const allowedIds = useMemo(() => normalizeBranchIds(allowedBranchIds), [allowedBranchIds])
  const [period, setPeriod] = useState('today')
  const [rangeStart, setRangeStart] = useState(todayYmd())
  const [rangeEnd, setRangeEnd] = useState(todayYmd())

  const [selectedBranches, setSelectedBranches] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const initBranchesRef = useRef(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

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
    const { params } = buildBranchQueryParams(selectedBranches)
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
      const res = await api(`/api/reports/products?${query.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true })
      if (!res?.ok) {
        setError(String(res?.message || 'Rapor yüklenemedi'))
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

  const items = Array.isArray(data?.items) ? data.items : []
  const cancelledItems = Array.isArray(data?.cancelledItems) ? data.cancelledItems : []

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="stickyTop" style={{ paddingBottom: 12 }}>
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
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            {data?.range?.start && data?.range?.end ? `Aralık: ${data.range.start} → ${data.range.end}` : ''}
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
      </div>

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Ürün Raporu</div>
        {error && <div style={{ color: '#b91c1c', marginBottom: 10 }}>{error}</div>}
        {loading && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
        {!loading && !error && (
          items.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>Bu aralıkta satış yapılan ürün yok.</div>
          ) : (
            <>
              <div className="onlyDesktop desktop-only reportsTableWrap">
                <table className="table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th style={{ textAlign: 'right' }}>Adet</th>
                      <th style={{ textAlign: 'right' }}>Ciro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={`${r.productId || r.menuItemId}-${r.name}`}>
                        <td style={{ fontWeight: 700 }}>{r.name}</td>
                        <td style={{ textAlign: 'right' }}>{Number(r.qty || 0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmtTl(r.revenue || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="onlyMobile mobile-only" style={{ display: 'grid', gap: 10 }}>
                {items.map((r) => (
                  <div key={`${r.productId || r.menuItemId}-${r.name}`} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--app-surface, var(--panel))', display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 800 }}>{r.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Adet</div>
                      <div style={{ fontWeight: 800 }}>{Number(r.qty || 0)}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Ciro</div>
                      <div style={{ fontWeight: 900 }}>{fmtTl(r.revenue || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>İptal Olan Urunler Raporu</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
          Hazir/onay sonrasi iptal edilen urunler. Tarih filtresi iptal zamanina gore uygulanir.
        </div>
        {error && <div style={{ color: '#b91c1c', marginBottom: 10 }}>{error}</div>}
        {loading && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
        {!loading && !error && (
          cancelledItems.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>Bu aralikta hazır olduktan sonra iptal edilen ürün yok.</div>
          ) : (
            <>
              <div className="onlyDesktop desktop-only reportsTableWrap">
                <table className="table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th style={{ textAlign: 'right' }}>İptal Adedi</th>
                      <th style={{ textAlign: 'right' }}>İptal Tutari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledItems.map((r) => (
                      <tr key={`cancelled-${r.productId || r.menuItemId}-${r.name}`}>
                        <td style={{ fontWeight: 700 }}>{r.name}</td>
                        <td style={{ textAlign: 'right' }}>{Number(r.qty || 0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#b91c1c' }}>{fmtTl(r.revenue || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="onlyMobile mobile-only" style={{ display: 'grid', gap: 10 }}>
                {cancelledItems.map((r) => (
                  <div key={`cancelled-${r.productId || r.menuItemId}-${r.name}`} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--app-surface, var(--panel))', display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 800 }}>{r.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>İptal Adedi</div>
                      <div style={{ fontWeight: 800 }}>{Number(r.qty || 0)}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>İptal Tutari</div>
                      <div style={{ fontWeight: 900, color: '#b91c1c' }}>{fmtTl(r.revenue || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
