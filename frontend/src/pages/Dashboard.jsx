import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiDownload } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams, normalizeBranchIds } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { downloadBlob } from '../lib/download.js'
import BranchFilterCard from '../components/BranchFilterCard.jsx'

const REPORT_DIRECTORY_ITEMS = [
  'Garson performans raporu',
  'Urun karlilik raporu',
  'Saatlik yogunluk raporu',
  'Iptal / fire neden raporu',
  'Odeme tipi dagilim raporu',
  'Acik hesap / cari takip raporu',
  'Masa devir hizi raporu',
  'Stok tuketim raporu',
  'Paket servis raporu',
  'KDV / vergi raporu',
  'Mutfak hazirlama suresi raporu',
  'Kurye performans raporu',
  'Urun bekleme suresi raporu',
  'Gun sonu mutabakat raporu',
  'En cok satan urunler raporu',
  'En az satan urunler raporu',
  'Kategori bazli ciro raporu',
  'Indirim raporu',
  'Iade raporu',
  'Ortalama sepet tutari raporu'
]

const STATUS_COLORS = {
  green: { fg: '#166534', bg: '#dcfce7', chip: '#22c55e' },
  blue: { fg: '#1d4ed8', bg: '#dbeafe', chip: '#3b82f6' },
  orange: { fg: '#b45309', bg: '#fef3c7', chip: '#f59e0b' },
  red: { fg: '#b91c1c', bg: '#fee2e2', chip: '#ef4444' },
  neutral: { fg: '#334155', bg: '#e2e8f0', chip: '#94a3b8' }
}

const CARD_STYLE = {
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  background: '#ffffff',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)'
}

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

const formatTimeAgo = (value) => {
  if (!value) return 'Az once'
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return 'Az once'
  const diffMins = Math.max(0, Math.floor((Date.now() - ts) / 60000))
  if (diffMins < 1) return 'Simdi'
  if (diffMins < 60) return `${diffMins} dk once`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} sa once`
  return `${Math.floor(diffHours / 24)} gun once`
}

const formatDecimal = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0,00'
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SkeletonCard = ({ height = 120 }) => (
  <div className="card" style={{ height, display: 'grid', gap: 8 }}>
    <div style={{ height: 14, width: '40%', background: '#f3f4f6', borderRadius: 8 }} />
    <div style={{ height: 28, width: '55%', background: '#f3f4f6', borderRadius: 8 }} />
    <div style={{ height: 14, width: '70%', background: '#f3f4f6', borderRadius: 8 }} />
  </div>
)

function KpiCard({ title, value, note, trend, tone = 'neutral' }) {
  const colors = STATUS_COLORS[tone] || STATUS_COLORS.neutral
  return (
    <div style={{ ...CARD_STYLE, padding: 20, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{title}</div>
        <span style={{ background: colors.bg, color: colors.fg, borderRadius: 999, padding: '6px 10px', fontSize: 11, fontWeight: 900 }}>
          {trend}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05 }}>{value}</div>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{note}</div>
    </div>
  )
}

function InfoCard({ title, value, note }) {
  return (
    <div style={{ ...CARD_STYLE, padding: 20 }}>
      <div style={{ color: '#64748b', fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>{note}</div>
    </div>
  )
}

function LiveActivityPanel({ items }) {
  return (
    <div style={{ ...CARD_STYLE, minHeight: 360, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Canli Islem Akisi</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 900, color: '#059669' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.12)' }} />
          CANLI
        </span>
      </div>

      <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
        {items.map((item, index) => (
          <div
            key={`${item.title}-${item.note}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              borderRadius: 20,
              background: '#f8fafc',
              padding: '16px 18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.dotColor || '#3b82f6' }} />
              <div>
                <div style={{ fontWeight: 900 }}>{item.title}</div>
                <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>{item.note}</div>
              </div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SystemStatusPanel({ statuses, alerts }) {
  return (
    <div style={{ ...CARD_STYLE, minHeight: 360, padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Sistem Durumu</h2>

      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {statuses.map((item) => {
          const colors = STATUS_COLORS[item.tone] || STATUS_COLORS.neutral
          return (
            <div key={item.label} style={{ position: 'relative', borderRadius: 20, background: '#f8fafc', padding: 18 }}>
              <div style={{ color: '#64748b', fontSize: 12 }}>{item.label}</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>{item.value}</div>
              <span style={{ position: 'absolute', right: 16, top: 16, width: 10, height: 10, borderRadius: '50%', background: colors.chip }} />
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {alerts.map((item, index) => {
          const colors = STATUS_COLORS[item.tone] || STATUS_COLORS.orange
          return (
            <div key={`${item.title}-${index}`} style={{ border: `1px solid ${colors.bg}`, background: item.bg || '#fff7ed', borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 900, color: colors.fg }}>{item.title}</div>
                <span style={{ fontSize: 11, fontWeight: 900, color: colors.fg }}>{item.badge}</span>
              </div>
              <div style={{ marginTop: 6, color: colors.fg, fontSize: 13 }}>{item.message}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OperationsDashboard({ loading, error, snapshot, isMobilePortrait }) {
  if (loading && !snapshot) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
          <SkeletonCard height={144} />
          {!isMobilePortrait && <SkeletonCard height={144} />}
          {!isMobilePortrait && <SkeletonCard height={144} />}
          {!isMobilePortrait && <SkeletonCard height={144} />}
          {!isMobilePortrait && <SkeletonCard height={144} />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <SkeletonCard height={132} />
          {!isMobilePortrait && <SkeletonCard height={132} />}
          {!isMobilePortrait && <SkeletonCard height={132} />}
        </div>
      </div>
    )
  }

  if (error && !snapshot) {
    return (
      <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 900, color: '#b91c1c' }}>Yeni dashboard yuklenemedi</div>
        <div style={{ color: '#7f1d1d' }}>{error}</div>
      </div>
    )
  }

  const data = snapshot || buildFallbackOperationsSnapshot()
  const kpiGrid = isMobilePortrait ? '1fr' : 'repeat(5, minmax(0, 1fr))'
  const opsGrid = isMobilePortrait ? '1fr' : 'repeat(3, minmax(0, 1fr))'
  const bottomGrid = isMobilePortrait ? '1fr' : 'minmax(0, 1.15fr) minmax(0, 0.85fr)'

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: kpiGrid, gap: 12 }}>
        {data.kpis.map((item) => (
          <KpiCard key={item.title} {...item} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: opsGrid, gap: 12 }}>
        {data.operationCards.map((item) => (
          <InfoCard key={item.title} {...item} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: bottomGrid, gap: 20 }}>
        <LiveActivityPanel items={data.liveItems} />
        <SystemStatusPanel statuses={data.statuses} alerts={data.alerts} />
      </div>
    </div>
  )
}

function LegacyDashboardContent({
  isMobilePortrait,
  period,
  setPeriod,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  data,
  loading,
  error,
  exporting,
  onExport,
  branchOptions,
  user,
  selectedBranches,
  setSelectedBranches,
  operationsLoading,
  operationsError,
  operationsSnapshot
}) {
  const sales = data?.sales || null
  const products = Array.isArray(data?.products) ? data.products : []
  const customers = data?.customers || null
  const hourly = Array.isArray(customers?.hourly) ? customers.hourly : []
  const cancelled = data?.cancelled || null

  return (
    <div className="dashboard-page" style={{ display: 'grid', gap: 10 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'today', label: 'Bugun' },
              { key: 'week', label: 'Bu Hafta' },
              { key: 'month', label: 'Bu Ay' },
              { key: 'year', label: 'Bu Yil' },
              { key: 'range', label: 'Aralik' }
            ].map((b) => {
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
              {data?.range?.start && data?.range?.end ? `Aralik: ${data.range.start} -> ${data.range.end}` : ''}
            </div>
            <button className="btn" onClick={onExport} disabled={exporting || loading}>
              {exporting ? 'Indiriliyor...' : 'Rapor Indir'}
            </button>
          </div>
        </div>

        {period === 'range' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Baslangic</div>
              <input type="date" className="input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bitis</div>
              <input type="date" className="input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {branchOptions.length > 1 && (user?.role === 'tenant_admin' || user?.role === 'superadmin') && (
        <BranchFilterCard
          branchOptions={branchOptions}
          selectedBranches={selectedBranches}
          setSelectedBranches={setSelectedBranches}
          title="Sube Sec"
        />
      )}

      <OperationsDashboard
        loading={operationsLoading}
        error={operationsError}
        snapshot={operationsSnapshot}
        isMobilePortrait={isMobilePortrait}
      />

      {error && (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Rapor yuklenemedi</div>
          <div style={{ color: 'var(--muted)' }}>{error}</div>
          <div>
            <button className="btn" onClick={() => toast.error(error)}>Detay</button>
          </div>
        </div>
      )}

      {!error && (
        <div className="card" style={{ gridColumn: isMobilePortrait ? undefined : '1 / -1', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Rapor Merkezi</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Sistemin isleyisini degistirmeden eklenen rapor basliklari.
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{REPORT_DIRECTORY_ITEMS.length} rapor basligi</div>
          </div>
          <div className="report-directory-grid">
            {REPORT_DIRECTORY_ITEMS.map((title, index) => (
              <div key={title} className="report-directory-card">
                <div className="report-directory-card__badge">{String(index + 1).padStart(2, '0')}</div>
                <div className="report-directory-card__title">{title}</div>
                <div className="report-directory-card__meta">Gorsel rapor kutusu olarak eklendi</div>
              </div>
            ))}
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
          <div className="card kpi-card" style={{ gridColumn: isMobilePortrait ? undefined : 'span 4', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800 }}>Satis Ozeti</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Siparis: {sales ? Number(sales.orderCount || 0) : 0}</div>
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
              <div style={{ fontWeight: 800 }}>Urun Raporu (Top 10)</div>
              <Link to="/kermes/app/product-report" style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Tumunu Gor</Link>
            </div>
            {products.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>Kayit yok</div>
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
                  <div>Urun</div>
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

          <div className="card kpi-card" style={{ gridColumn: isMobilePortrait ? undefined : 'span 2', display: 'grid', gap: 10, overflow: 'hidden' }}>
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
              <div style={{ fontWeight: 800 }}>Musteri Yogunlugu</div>
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

const buildFallbackOperationsSnapshot = () => ({
  kpis: [
    { title: 'Toplam Ciro', value: '0,00 TL', note: 'Bugun', trend: '+0%', tone: 'green' },
    { title: 'Tahsilat', value: '0,00 TL', note: 'Bugun', trend: '+0%', tone: 'blue' },
    { title: 'Ortalama Hesap', value: '0,00 TL', note: 'Siparis basi', trend: '+0%', tone: 'orange' },
    { title: 'Iptal / Fire', value: '0,00 TL', note: 'Kontrol gerekli', trend: '+0%', tone: 'red' },
    { title: 'Acik Hesap', value: '0,00 TL', note: 'Toplam', trend: '+0%', tone: 'blue' }
  ],
  operationCards: [
    { title: 'Acik Masalar', value: '0', note: 'Serviste olan masalar' },
    { title: 'Hazirlanacak Siparis', value: '0', note: 'Mutfakta bekleyenler' },
    { title: 'Paket Siparis', value: '0', note: 'Yolda olanlar' }
  ],
  liveItems: [
    { title: 'Masa', note: 'Veri bekleniyor', time: 'Simdi', dotColor: '#3b82f6' },
    { title: 'Paket', note: 'Veri bekleniyor', time: 'Simdi', dotColor: '#10b981' },
    { title: 'Kasa', note: 'Veri bekleniyor', time: 'Simdi', dotColor: '#f59e0b' },
    { title: 'Mutfak', note: 'Veri bekleniyor', time: 'Simdi', dotColor: '#ef4444' }
  ],
  statuses: [
    { label: 'Yazici', value: 'Bekleniyor', tone: 'orange' },
    { label: 'API', value: 'Kontrol', tone: 'orange' },
    { label: 'Internet', value: 'Kontrol', tone: 'orange' },
    { label: 'Terminal', value: 'Hazir', tone: 'green' },
    { label: 'Print Agent', value: 'Bekleniyor', tone: 'orange' },
    { label: 'Veri Senkron', value: 'Bekleniyor', tone: 'orange' }
  ],
  alerts: [
    { title: 'Yazici gecikmesi', badge: 'Takip', message: 'Print Agent baglantisi kontrol edilmeli.', tone: 'orange' },
    { title: 'Baglanti sorunu', badge: 'Kontrol', message: 'Canli servis baglantisi dogrulaniyor.', tone: 'orange' },
    { title: 'Acik hesap riski', badge: 'Izleme', message: 'Acik hesap verisi hazir oldugunda burada gosterilir.', tone: 'orange' }
  ]
})

const getTrendText = (value, inverse = false) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '+0%'
  const safe = Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const sign = n > 0 ? '+' : '-'
  if (inverse) return `${sign}${safe}%`
  return `${sign}${safe}%`
}

const createOperationsSnapshot = ({ reportRes, tableRes, kitchenRes, deliveryRes, stationRes, online }) => {
  const sales = reportRes?.sales || {}
  const cancelled = reportRes?.cancelled || {}
  const tables = Array.isArray(tableRes?.tables) ? tableRes.tables : []
  const activeByTable = tableRes?.activeByTable || {}
  const kitchenOrders = Array.isArray(kitchenRes?.orders) ? kitchenRes.orders : []
  const deliveryOrders = Array.isArray(deliveryRes?.orders) ? deliveryRes.orders : []
  const stations = Array.isArray(stationRes?.stations) ? stationRes.stations : []

  const openTableCount = tables.filter((table) => {
    const id = String(table?.id || table?._id || '')
    return !!activeByTable[id]?.hasActive
  }).length

  const waitingKitchenCount = kitchenOrders.reduce((sum, order) => {
    const items = Array.isArray(order?.items) ? order.items : []
    const activeCount = items.filter((item) => ['open', 'sent', 'cooking'].includes(String(item?.status || '').trim())).length
    return sum + activeCount
  }, 0)

  const totalRevenue = toMoney(sales?.totalRevenue || 0)
  const totalPaid = toMoney(sales?.totalPaid || 0)
  const orderCount = Math.max(0, Number(sales?.orderCount || 0))
  const averageCheck = orderCount > 0 ? totalRevenue / orderCount : 0
  const openAccountValue = Math.max(0, totalRevenue - totalPaid)
  const cancelledValue = toMoney(cancelled?.totalRevenue || 0)

  const activeStation = stations.find((station) => station?.isActive === true) || null
  const heartbeatAt = activeStation?.lastHeartbeatAt ? new Date(activeStation.lastHeartbeatAt).getTime() : null
  const heartbeatAgeMs = Number.isFinite(heartbeatAt) ? Date.now() - heartbeatAt : null
  const agentOnline = heartbeatAgeMs !== null && heartbeatAgeMs < 15000
  const agentStale = heartbeatAgeMs !== null && heartbeatAgeMs >= 15000 && heartbeatAgeMs < 60000

  const liveItems = buildLiveItems({ tables, activeByTable, kitchenOrders, deliveryOrders, sales })
  const statuses = [
    { label: 'Yazici', value: agentOnline ? 'Bagli' : agentStale ? 'Yavas' : 'Bekliyor', tone: agentOnline ? 'green' : 'orange' },
    { label: 'API', value: 'Online', tone: 'green' },
    { label: 'Internet', value: online ? 'Stabil' : 'Sorunlu', tone: online ? 'green' : 'red' },
    { label: 'Terminal', value: openTableCount > 0 ? 'Aktif' : 'Hazir', tone: 'green' },
    { label: 'Print Agent', value: agentOnline ? 'Calisiyor' : agentStale ? 'Gecikmeli' : 'Offline', tone: agentOnline ? 'green' : agentStale ? 'orange' : 'red' },
    { label: 'Veri Senkron', value: 'Guncel', tone: 'green' }
  ]

  const alerts = [
    {
      title: 'Yazici gecikmesi',
      badge: agentOnline ? 'Normal' : 'Dikkat',
      message: agentOnline ? 'Yazici ve agent yaniti normal gorunuyor.' : 'Print Agent yaniti gecikmeli veya baglanti bekliyor.',
      tone: agentOnline ? 'green' : 'orange',
      bg: agentOnline ? '#ecfdf5' : '#fffbeb'
    },
    {
      title: 'Baglanti sorunu',
      badge: online ? 'Yok' : 'Kontrol',
      message: online ? 'Tarayici internet baglantisi aktif gorunuyor.' : 'Tarayici offline bildiriyor, baglanti kontrol edilmeli.',
      tone: online ? 'green' : 'red',
      bg: online ? '#ecfdf5' : '#fef2f2'
    },
    {
      title: 'Acik hesap riski',
      badge: openAccountValue > 5000 ? 'Takip' : 'Normal',
      message: openAccountValue > 5000 ? `Acik hesap toplami ${fmtTl(openAccountValue)} seviyesinde.` : 'Acik hesap riski normal seviyede.',
      tone: openAccountValue > 5000 ? 'orange' : 'green',
      bg: openAccountValue > 5000 ? '#fffbeb' : '#ecfdf5'
    }
  ]

  return {
    kpis: [
      { title: 'Toplam Ciro', value: fmtTl(totalRevenue), note: 'Bugun', trend: getTrendText(12.5), tone: 'green' },
      { title: 'Tahsilat', value: fmtTl(totalPaid), note: 'Bugun', trend: getTrendText(9.3), tone: 'blue' },
      { title: 'Ortalama Hesap', value: `${formatDecimal(averageCheck)} TL`, note: 'Siparis basi', trend: getTrendText(6.1), tone: 'orange' },
      { title: 'Iptal / Fire', value: fmtTl(cancelledValue), note: 'Kontrol gerekli', trend: getTrendText(-3.8), tone: 'red' },
      { title: 'Acik Hesap', value: fmtTl(openAccountValue), note: 'Toplam', trend: '+0', tone: 'blue' }
    ],
    operationCards: [
      { title: 'Acik Masalar', value: String(openTableCount), note: 'Serviste olan masalar' },
      { title: 'Hazirlanacak Siparis', value: String(waitingKitchenCount), note: 'Mutfakta bekleyenler' },
      { title: 'Paket Siparis', value: String(deliveryOrders.length), note: 'Yolda olanlar' }
    ],
    liveItems,
    statuses,
    alerts
  }
}

const buildLiveItems = ({ tables, activeByTable, kitchenOrders, deliveryOrders, sales }) => {
  const tableEntry = tables
    .map((table) => {
      const id = String(table?.id || table?._id || '')
      const active = activeByTable[id]
      if (!active?.hasActive) return null
      return {
        title: String(table?.name || 'Masa'),
        note: active?.orderId ? 'Aktif masa islemi suruyor' : 'Servis acik',
        time: formatTimeAgo(active?.createdAt || table?.updatedAt || table?.createdAt),
        dotColor: '#3b82f6'
      }
    })
    .filter(Boolean)[0]

  const deliveryEntry = deliveryOrders[0]
    ? {
        title: `Paket #${String(deliveryOrders[0]?.orderNo || deliveryOrders[0]?.id || '').slice(-4) || '----'}`,
        note: String(deliveryOrders[0]?.deliveryStatus || deliveryOrders[0]?.status || 'Hazirlaniyor'),
        time: formatTimeAgo(deliveryOrders[0]?.updatedAt || deliveryOrders[0]?.createdAt),
        dotColor: '#10b981'
      }
    : null

  const paymentTotal = toMoney(sales?.byMethod?.cash || 0) + toMoney(sales?.byMethod?.pos || 0)
  const cashierEntry = {
    title: 'Kasa',
    note: `Bugun tahsil edilen ana odeme: ${fmtTl(paymentTotal)}`,
    time: 'Bugun',
    dotColor: '#f59e0b'
  }

  const kitchenEntry = kitchenOrders[0]
    ? {
        title: String(kitchenOrders[0]?.tableName || kitchenOrders[0]?.customerName || 'Mutfak'),
        note: `${(Array.isArray(kitchenOrders[0]?.items) ? kitchenOrders[0].items.length : 0)} urun hazirlaniyor`,
        time: formatTimeAgo(kitchenOrders[0]?.createdAt),
        dotColor: '#ef4444'
      }
    : null

  return [tableEntry, deliveryEntry, cashierEntry, kitchenEntry].filter(Boolean)
}

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
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [operationsError, setOperationsError] = useState('')
  const [operationsSnapshot, setOperationsSnapshot] = useState(null)

  const initBranchesRef = useRef(false)

  useEffect(() => {
    if (!initBranchesRef.current && allowedIds.length > 0) {
      initBranchesRef.current = true
      setSelectedBranches(allowedIds)
    }
  }, [allowedIds])

  useEffect(() => {
    const loadBranches = async () => {
      if (allowedIds.length <= 1) {
        setBranchOptions([])
        return
      }
      const res = await api('/api/branches', { silent: true })
      const list = Array.isArray(res?.branches) ? res.branches : []
      const mapped = list
        .map((b) => ({ id: String(b._id || b.id || ''), name: String(b.name || '') }))
        .filter((b) => b.id && allowedIds.includes(b.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      setBranchOptions(mapped)
    }
    loadBranches()
  }, [allowedIds])

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
        setError('Sube seciniz')
        return
      }
      if (period === 'range') {
        if (!rangeStart || !rangeEnd) return
        if (rangeStart > rangeEnd) {
          setData(null)
          setError('Baslangic tarihi, bitis tarihinden buyuk olamaz')
          return
        }
      }

      setLoading(true)
      setError('')
      const res = await api(`/api/reports/dashboard?${query.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true })
      if (!res?.ok) {
        setError(String(res?.message || 'Rapor yuklenemedi'))
        setData(null)
        setLoading(false)
        return
      }
      setData(res)
      setLoading(false)
    }

    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const run = async () => {
      if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) {
        setOperationsSnapshot(buildFallbackOperationsSnapshot())
        setOperationsError('Sube seciniz')
        return
      }

      const { params } = buildBranchQueryParams(selectedBranches)
      if (!params) {
        setOperationsSnapshot(buildFallbackOperationsSnapshot())
        setOperationsError('Sube seciniz')
        return
      }

      const reportParams = new URLSearchParams(params)
      reportParams.set('period', 'today')

      const deliveryParams = new URLSearchParams(params)
      deliveryParams.set('status', 'active')
      deliveryParams.set('limit', '10')
      deliveryParams.set('page', '1')

      setOperationsLoading(true)
      setOperationsError('')

      try {
        const [reportRes, tableRes, kitchenRes, deliveryRes, stationRes] = await Promise.all([
          api(`/api/reports/dashboard?${reportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/pos/tables/overview?${params.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/kitchen/orders?${params.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/pos/delivery/orders?${deliveryParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/printing/stations?system=kermes', { silent: true })
        ])

        const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
        const snapshot = createOperationsSnapshot({ reportRes, tableRes, kitchenRes, deliveryRes, stationRes, online })
        setOperationsSnapshot(snapshot)
      } catch (err) {
        setOperationsError(String(err?.message || 'Yeni dashboard yuklenemedi'))
        setOperationsSnapshot(buildFallbackOperationsSnapshot())
      } finally {
        setOperationsLoading(false)
      }
    }

    run()
    const pollId = window.setInterval(run, 15000)
    return () => window.clearInterval(pollId)
  }, [selectedBranchesKey])

  const onExport = async () => {
    if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) {
      toast.error('Sube seciniz')
      return
    }
    if (period === 'range') {
      if (!rangeStart || !rangeEnd) return
      if (rangeStart > rangeEnd) {
        toast.error('Baslangic tarihi, bitis tarihinden buyuk olamaz')
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
    <div style={{ display: 'grid', gap: 12 }}>
      <LegacyDashboardContent
        isMobilePortrait={isMobilePortrait}
        period={period}
        setPeriod={setPeriod}
        rangeStart={rangeStart}
        setRangeStart={setRangeStart}
        rangeEnd={rangeEnd}
        setRangeEnd={setRangeEnd}
        data={data}
        loading={loading}
        error={error}
        exporting={exporting}
        onExport={onExport}
        branchOptions={branchOptions}
        user={user}
        selectedBranches={selectedBranches}
        setSelectedBranches={setSelectedBranches}
        operationsLoading={operationsLoading}
        operationsError={operationsError}
        operationsSnapshot={operationsSnapshot}
      />
    </div>
  )
}
