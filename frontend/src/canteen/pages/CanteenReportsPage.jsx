import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { buildBranchQueryParams } from '../../lib/branchQuery.js'
import { paymentLabel } from '../utils/paymentLabels.js'
import { useTheme } from '../../theme/ThemeContext.jsx'
import useCanteenAutoRefresh from '../hooks/useCanteenAutoRefresh.js'
import ZReportModal from '../../features/reports/ZReportModal.tsx'
import BranchFilterCard from '../../components/BranchFilterCard.jsx'

const REPORT_BRANCH_SELECTION_STORAGE_KEY = 'selectedReportBranchIds_canteen'

const CARD_STYLE = {
  border: '1px solid var(--border)',
  borderRadius: 28,
  background: 'var(--panel)',
  color: 'var(--text)',
  boxShadow: 'var(--card-shadow)'
}

const HERO_STYLE = {
  overflow: 'hidden',
  borderRadius: 34,
  background: '#020617',
  color: '#ffffff',
  padding: 28,
  boxShadow: '0 24px 48px rgba(15, 23, 42, 0.24)'
}

const STATUS_COLORS = {
  green: { fg: '#166534', bg: '#dcfce7' },
  blue: { fg: '#1d4ed8', bg: '#dbeafe' },
  orange: { fg: '#b45309', bg: '#fef3c7' },
  red: { fg: '#b91c1c', bg: '#fee2e2' }
}

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

const normalizeApiMessage = (message, fallback) => {
  const raw = String(message || '').trim()
  if (!raw) return fallback
  if (raw === 'network_error') return 'Sunucuya ulasilamadi. Backend servisinin 4000 portunda calistigini kontrol edin.'
  return raw
}

function KpiCard({ title, value, note, trend, tone = 'blue' }) {
  const colors = STATUS_COLORS[tone] || STATUS_COLORS.blue
  return (
    <div style={{ ...CARD_STYLE, padding: 20, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13, fontWeight: 600 }}>{title}</div>
        <span style={{ background: colors.bg, color: colors.fg, borderRadius: 999, padding: '6px 10px', fontSize: 11, fontWeight: 900 }}>{trend}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
      <div style={{ color: 'var(--app-text-muted, var(--muted))', fontSize: 12 }}>{note}</div>
    </div>
  )
}

function ReportHero({ onExport, onRefresh, loading, exporting }) {
  return (
    <div style={HERO_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 280, flex: '1 1 480px' }}>
          <div style={{ marginBottom: 12, display: 'inline-flex', borderRadius: 999, background: 'rgba(255,255,255,0.1)', padding: '8px 16px', fontSize: 12, fontWeight: 900 }}>
            Rapor Merkezi
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 900 }}>
            Mağaza performansını tek ekranda analiz et.
          </h1>
          <p style={{ margin: '10px 0 0', maxWidth: 720, fontSize: 14, color: '#ffffff', lineHeight: 1.6 }}>
            Satış, ödeme, ürün ve cari hareketlerini restoran rapor ekranındaki gibi güçlü kartlar ve paneller üzerinden inceleyin.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, minWidth: 260 }}>
          <button type="button" className="btn" onClick={onExport} disabled={loading || exporting} style={{ borderRadius: 18, background: 'var(--app-surface)', color: 'var(--app-text)', padding: '14px 18px', fontWeight: 900 }}>
            {exporting ? 'Hazırlanıyor' : 'Excel Aktar'}
          </button>
          <button type="button" className="btn" onClick={onRefresh} disabled={loading || exporting} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.08)', color: '#ffffff', padding: '14px 18px', fontWeight: 900, borderColor: 'rgba(255,255,255,0.14)' }}>
            {loading ? 'Yükleniyor' : 'Yenile'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReportFilter({ period, setPeriod, rangeStart, setRangeStart, rangeEnd, setRangeEnd, onExport, loading, exporting }) {
  const tabs = [
    { key: 'today', label: 'Bugün' },
    { key: 'week', label: 'Bu Hafta' },
    { key: 'month', label: 'Bu Ay' },
    { key: 'year', label: 'Bu Yıl' },
    { key: 'range', label: 'Aralık' }
  ]

  return (
    <div style={{ ...CARD_STYLE, padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const active = period === tab.key
            return (
              <button key={tab.key} type="button" className="btn" onClick={() => setPeriod(tab.key)} style={{ background: active ? 'var(--theme-accent, #111827)' : 'var(--app-surface-soft, var(--panelElevated))', borderColor: active ? 'var(--theme-accent, #111827)' : 'var(--app-border, var(--border))', color: active ? '#ffffff' : 'var(--app-text, var(--text))', fontWeight: active ? 900 : 600, padding: '10px 16px' }}>
                {tab.label}
              </button>
            )
          })}
        </div>
        <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13, fontWeight: 600 }}>Mağaza rapor dönemi filtresi</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <button
          type="button"
          className="btn"
          onClick={onExport}
          disabled={loading || exporting}
          style={{ borderRadius: 18, background: 'var(--app-surface)', color: 'var(--app-text)', padding: '10px 16px', fontWeight: 900 }}
        >
          {exporting ? 'HazÄ±rlanÄ±yor' : 'Excel Aktar'}
        </button>
        {period === 'range' ? (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Başlangıç</span>
              <input type="date" className="input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Bitiş</span>
              <input type="date" className="input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </label>
          </>
        ) : null}
        {period !== 'range' ? (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Baslangic</span>
              <input type="date" className="input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} disabled />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Bitis</span>
              <input type="date" className="input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} disabled />
            </label>
          </>
        ) : null}
      </div>
    </div>
  )
}

function ReportFilterCompact({
  period,
  setPeriod,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  onExport,
  loading,
  exporting,
  branchOptions,
  selectedBranches,
  setSelectedBranches
}) {
  const tabs = [
    { key: 'today', label: 'Bugun' },
    { key: 'week', label: 'Bu Hafta' },
    { key: 'month', label: 'Bu Ay' },
    { key: 'year', label: 'Bu Yil' },
    { key: 'range', label: 'Aralik' }
  ]
  const controlHeight = 30

  return (
    <div style={{ ...CARD_STYLE, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {tabs.map((tab) => {
            const active = period === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                className="btn"
                onClick={() => setPeriod(tab.key)}
                style={{
                  minHeight: controlHeight,
                  height: controlHeight,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: active ? 900 : 600,
                  whiteSpace: 'nowrap',
                  background: active ? 'var(--theme-accent, #111827)' : 'var(--app-surface-soft, var(--panelElevated))',
                  borderColor: active ? 'var(--theme-accent, #111827)' : 'var(--app-border, var(--border))',
                  color: active ? '#ffffff' : 'var(--app-text, var(--text))'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap', flexShrink: 0, justifyContent: 'flex-end' }}>
          <BranchFilterCard
            branchOptions={branchOptions}
            selectedBranches={selectedBranches}
            setSelectedBranches={setSelectedBranches}
            title="Sube Sec"
            compact
            hideSummary
          />
          <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12, fontWeight: 600, alignSelf: 'center', whiteSpace: 'nowrap' }}>Mağaza rapor dönemi filtresi</div>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Baslangic</span>
            <input
              type="date"
              className="input"
              value={rangeStart}
              onChange={(e) => {
                setRangeStart(e.target.value)
                if (period !== 'range') setPeriod('range')
              }}
              style={{ minHeight: controlHeight, height: controlHeight, paddingTop: 0, paddingBottom: 0, minWidth: 168 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Bitis</span>
            <input
              type="date"
              className="input"
              value={rangeEnd}
              onChange={(e) => {
                setRangeEnd(e.target.value)
                if (period !== 'range') setPeriod('range')
              }}
              style={{ minHeight: controlHeight, height: controlHeight, paddingTop: 0, paddingBottom: 0, minWidth: 168 }}
            />
          </label>

          <button
            type="button"
            className="btn"
            onClick={onExport}
            disabled={loading || exporting}
            style={{ minHeight: controlHeight, height: controlHeight, borderRadius: 14, background: 'var(--app-surface)', color: 'var(--app-text)', padding: '0 12px', fontWeight: 900, fontSize: 12, alignSelf: 'end', whiteSpace: 'nowrap' }}
          >
            {exporting ? 'Hazirlaniyor' : 'Excel Aktar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MainPanel({ summary, methodRows }) {
  const max = methodRows.reduce((best, item) => Math.max(best, Number(item.value || 0)), 0) || 1
  return (
    <div style={{ ...CARD_STYLE, padding: 24, minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>Satış Akışı</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
            Dönem içindeki ödeme dağılımı ve işlem yoğunluğu.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Toplam İşlem', value: String(Number(summary?.saleCount || 0)) },
          { label: 'Toplam Ciro', value: `${money(summary?.totalRevenue || 0)} ₺` },
          { label: 'Ortalama Sepet', value: `${money(summary?.avgBasket || 0)} ₺` },
          { label: 'Z Özeti', value: methodRows.length > 0 ? 'Hazır' : 'Boş' }
        ].map((item) => (
          <div key={item.label} style={{ borderRadius: 18, background: 'var(--theme-accent-soft)', padding: '12px 14px', minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--theme-accent-text)', fontWeight: 700 }}>{item.label}</div>
            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: 'var(--text)', overflowWrap: 'anywhere' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, paddingTop: 10, borderTop: '1px solid var(--border)', overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ display: 'flex', width: `${Math.max(100, methodRows.length * 70)}px`, minWidth: '100%', height: 230, alignItems: 'stretch', gap: 8 }}>
          {methodRows.map((row) => (
            <div key={row.label} style={{ display: 'flex', flex: 1, minWidth: 48, flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', width: '100%', flex: 1, alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(18, Math.round((Number(row.value || 0) / max) * 100))}%`,
                    minHeight: Number(row.value || 0) > 0 ? 18 : 0,
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18,
                    borderBottomLeftRadius: 12,
                    borderBottomRightRadius: 12,
                    background: 'var(--theme-gradient)',
                    boxShadow: '0 12px 28px var(--theme-accent-soft)'
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--app-text)', textAlign: 'center' }}>{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SidePanel({ summary, methodRows }) {
  return (
    <div style={{ ...CARD_STYLE, padding: 24, minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>Ödeme Özeti</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Tahsilat kanallarına göre dağılım.</p>
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'grid', gap: 18 }}>
        {methodRows.map((row) => {
          const ratio = Number(summary?.totalRevenue || 0) > 0 ? Math.min(100, Math.round((Number(row.value || 0) / Number(summary.totalRevenue || 1)) * 100)) : 0
          return (
            <div key={row.label}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, minWidth: 0 }}>
                <b style={{ color: 'var(--text)' }}>{row.label}</b>
                <span style={{ fontWeight: 900, color: 'var(--theme-accent-text)', textAlign: 'right' }}>{money(row.value)} ₺</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: 'var(--theme-accent-soft)' }}>
                <div style={{ width: `${ratio}%`, height: 12, borderRadius: 999, background: 'var(--theme-gradient)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListPanel({ title, rows, emptyText, renderRow }) {
  return (
    <div style={{ ...CARD_STYLE, padding: 24, minWidth: 0, overflow: 'hidden' }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>{title}</h2>
      <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
        {rows.length === 0 ? (
          <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>{emptyText}</div>
        ) : rows.map(renderRow)}
      </div>
    </div>
  )
}

function ReportCatalog({ onSelect }) {
  const items = [
    { key: 'zreport', title: 'Z Raporu', desc: 'Tahsilat ve ödeme kırılımı özeti' },
    { key: 'summary', title: 'Satış Özeti', desc: 'Ciro, işlem ve ortalama sepet görünümü' },
    { key: 'products', title: 'Ürün Performansı', desc: 'En çok satan ürünler listesi' },
    { key: 'customers', title: 'Cari Görünümü', desc: 'Cari bakiyeler ve müşteri durumu' }
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          style={{
            ...CARD_STYLE,
            textAlign: 'left',
            padding: 20,
            cursor: 'pointer'
          }}
        >
          <div style={{ fontWeight: 900, color: 'var(--text)', fontSize: 18 }}>{item.title}</div>
          <div style={{ marginTop: 8, color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{item.desc}</div>
          <div style={{ marginTop: 14, color: 'var(--theme-accent-text)', fontWeight: 900, fontSize: 13 }}>Raporu aç →</div>
        </button>
      ))}
    </div>
  )
}

export default function CanteenReportsPage() {
  const { me, session } = useOutletContext()
  const { theme } = useTheme()
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
  const [zReportOpen, setZReportOpen] = useState(false)
  const [zReportLoading, setZReportLoading] = useState(false)
  const [zReportError, setZReportError] = useState('')
  const [zReportData, setZReportData] = useState(null)
  const [loadedBranchOptions, setLoadedBranchOptions] = useState([])
  const allowedBranchIds = useMemo(
    () => Array.isArray(session?.allowedBranchIds) ? session.allowedBranchIds.map(String).filter(Boolean) : [],
    [session?.allowedBranchIds]
  )
  const branchOptions = useMemo(() => {
    const sessionBranches = (Array.isArray(session?.allowedBranches) ? session.allowedBranches : [])
      .map((branch) => ({ id: String(branch?.id || branch?._id || ''), name: String(branch?.name || '') }))
      .filter((branch) => branch.id && branch.name)
    if (sessionBranches.length > 0) return sessionBranches
    const fallback = (Array.isArray(loadedBranchOptions) ? loadedBranchOptions : [])
      .map((branch) => ({ id: String(branch?.id || branch?._id || ''), name: String(branch?.name || '') }))
      .filter((branch) => branch.id && branch.name)
    if (allowedBranchIds.length === 0) return fallback
    const filtered = fallback.filter((branch) => allowedBranchIds.includes(branch.id))
    if (filtered.length > 0) return filtered
    if (allowedBranchIds.length > 0) return allowedBranchIds.map((branchId, index) => ({
      id: branchId,
      name: `Sube ${index + 1}`
    }))
    const activeBranchId = String(session?.branchId || session?.activeBranch?.id || '').trim()
    const activeBranchName = String(session?.activeBranch?.name || '').trim()
    if (activeBranchId) {
      return [{
        id: activeBranchId,
        name: activeBranchName || 'Aktif Sube'
      }]
    }
    let storedBranchId = ''
    try {
      storedBranchId = String(localStorage.getItem('selectedBranchId_canteen') || '').trim()
    } catch {
      storedBranchId = ''
    }
    return storedBranchId ? [{ id: storedBranchId, name: 'Secili Sube' }] : []
  }, [allowedBranchIds, loadedBranchOptions, session?.activeBranch?.id, session?.activeBranch?.name, session?.allowedBranches, session?.branchId])
  const [selectedBranchIds, setSelectedBranchIds] = useState([])

  useEffect(() => {
    let cancelled = false
    const loadBranches = async () => {
      const needsFallback = (!Array.isArray(session?.allowedBranches) || session.allowedBranches.length === 0) && allowedBranchIds.length > 0
      if (!needsFallback) return
      const res = await api('/api/canteen/branches', { silent: true, skipBranchHeader: true, portalOverride: 'canteen' })
      if (cancelled || !res?.ok) return
      setLoadedBranchOptions(Array.isArray(res?.branches) ? res.branches : [])
    }
    loadBranches()
    return () => {
      cancelled = true
    }
  }, [allowedBranchIds, session?.allowedBranches])

  useEffect(() => {
    const options = Array.isArray(branchOptions) ? branchOptions : []
    if (options.length === 0) {
      setSelectedBranchIds([])
      return
    }

    let storedBranchIds = []
    let storedSingleBranchId = ''
    try {
      const raw = JSON.parse(localStorage.getItem(REPORT_BRANCH_SELECTION_STORAGE_KEY) || '[]')
      storedBranchIds = Array.isArray(raw) ? raw.map((value) => String(value || '').trim()).filter(Boolean) : []
    } catch {
      storedBranchIds = []
    }
    try {
      storedSingleBranchId = String(localStorage.getItem('selectedBranchId_canteen') || '').trim()
    } catch {
      storedSingleBranchId = ''
    }

    const optionIds = options.map((branch) => branch.id)
    const validStoredBranchIds = storedBranchIds.filter((branchId) => optionIds.includes(branchId))
    if (validStoredBranchIds.length > 0) {
      setSelectedBranchIds(validStoredBranchIds)
      return
    }

    if (storedSingleBranchId && optionIds.includes(storedSingleBranchId)) {
      setSelectedBranchIds([storedSingleBranchId])
      return
    }

    setSelectedBranchIds(optionIds)
  }, [branchOptions])

  useEffect(() => {
    try {
      localStorage.setItem(REPORT_BRANCH_SELECTION_STORAGE_KEY, JSON.stringify(selectedBranchIds))
    } catch {
    }
  }, [selectedBranchIds])

  const qs = useMemo(() => {
    const base = new URLSearchParams()
    const branch = buildBranchQueryParams(selectedBranchIds)
    if (branch.params) {
      for (const [k, v] of branch.params.entries()) base.set(k, v)
    }
    base.set('period', period)
    if (period === 'range') {
      base.set('start', start)
      base.set('end', end)
    }
    return base.toString()
  }, [period, selectedBranchIds, start, end])

  const methodRows = useMemo(() => {
    if (Array.isArray(summary?.methodBreakdown) && summary.methodBreakdown.length > 0) {
      return summary.methodBreakdown.map((item) => ({ label: paymentLabel(item.name || item.id), value: item.total }))
    }
    return Object.entries(summary?.byMethod || {}).map(([key, value]) => ({ label: paymentLabel(key), value }))
  }, [summary])

  const zReportDate = useMemo(() => {
    if (period === 'range') return start
    return start || toYmd(new Date())
  }, [period, start])

  const downloadAllExcel = async () => {
    if (!canExport) return
    setExporting(true)
    setError('')
    try {
      const token = (() => {
        try { return String(localStorage.getItem('token_canteen') || '') } catch { return '' }
      })()
      const url = `/api/canteen/reports/export?${qs}`
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
        } catch {}
        setError(normalizeApiMessage(msg, 'Rapor dosyasi hazirlanamadi'))
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
    } catch {
      setError('İşlem başarısız')
    } finally {
      setExporting(false)
    }
  }

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    const s = await api(`/api/canteen/reports/summary?${qs}`, { silent: true })
    const p = await api(`/api/canteen/reports/products?${qs}`, { silent: true })
    const c = await api(`/api/canteen/reports/customers?${qs}`, { silent: true })
    if (!s?.ok) setError(s?.message || 'Rapor alınamadı')
    setSummary(s?.ok ? (s.summary || null) : null)
    setProducts(Array.isArray(p?.items) ? p.items : [])
    setCustomers(Array.isArray(c?.items) ? c.items : [])
    if (!background) setLoading(false)
  }

  const loadZReport = async () => {
    setZReportLoading(true)
    setZReportError('')
    try {
      const branch = buildBranchQueryParams(selectedBranchIds)
      const params = new URLSearchParams()
      params.set('date', zReportDate)
      if (branch.params) {
        for (const [key, value] of branch.params.entries()) params.set(key, value)
      }
      const res = await api(`/api/canteen/reports/z-report?${params.toString()}`, {
        silent: true,
        skipBranchHeader: true,
        suppressBranchModal: true,
        portalOverride: 'canteen'
      })
      if (!res?.ok) {
        throw new Error(normalizeApiMessage(res?.message, 'Z raporu alinamadi'))
      }
      setZReportData(res)
    } catch (err) {
      setZReportData(null)
      setZReportError(normalizeApiMessage(err?.message, 'Z raporu alinamadi'))
    } finally {
      setZReportLoading(false)
    }
  }

  const handleCatalogSelect = async (key) => {
    if (key === 'zreport') {
      setZReportOpen(true)
      await loadZReport()
      return
    }
    setTab(key)
  }

  useEffect(() => {
    load()
  }, [qs])
  useCanteenAutoRefresh(() => load({ background: true }), [qs], { enabled: canView })

  if (!canView) return <div className="card">403 - Bu sayfaya yetkin yok</div>

  return (
    <div className="canteen-reports-page" style={{ position: 'relative', display: 'grid', gap: 20 }}>
      <ReportFilterCompact
        period={period}
        setPeriod={setPeriod}
        rangeStart={start}
        setRangeStart={setStart}
        rangeEnd={end}
        setRangeEnd={setEnd}
        onExport={downloadAllExcel}
        loading={loading}
        exporting={exporting}
        branchOptions={branchOptions}
        selectedBranches={selectedBranchIds}
        setSelectedBranches={setSelectedBranchIds}
      />
      {!!error ? <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#7f1d1d' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <KpiCard title="Net Satış" value={`${money(summary?.totalRevenue || 0)} ₺`} note="Seçili dönem" trend="+0%" tone="green" />
        <KpiCard title="İşlem" value={String(Number(summary?.saleCount || 0))} note="Toplam adet" trend="+0%" tone="blue" />
        <KpiCard title="Ortalama Sepet" value={`${money(summary?.avgBasket || 0)} ₺`} note="Sipariş başı" trend="+0%" tone="orange" />
        <KpiCard title="Z Özeti" value={methodRows.length > 0 ? 'Hazır' : 'Boş'} note="Ödeme görünümü" trend="+0%" tone="red" />
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)' }}>
        <MainPanel summary={summary || {}} methodRows={methodRows} />
        <SidePanel summary={summary || {}} methodRows={methodRows} />
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <ListPanel
          title={tab === 'products' ? 'En Çok Satan Ürünler' : 'Z Raporu Özeti'}
          rows={tab === 'products' ? products.slice(0, 6) : methodRows}
          emptyText={tab === 'products' ? 'Satış verisi bulunamadı.' : 'Z raporu verisi bulunamadı.'}
          renderRow={(item, index) => (
            <div key={`${item.productId || item.label}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 18, background: theme.accentSoft, padding: '14px 16px', minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.text, minWidth: 0, overflowWrap: 'anywhere' }}>
                {tab === 'products' ? `${index + 1}. ${String(item.name || '-')}` : item.label}
              </div>
              <div style={{ fontSize: 16, color: theme.accentText, whiteSpace: 'nowrap', fontWeight: 800 }}>
                {tab === 'products' ? `${Number(item.qty || 0)} adet` : `${money(item.value)} ₺`}
              </div>
            </div>
          )}
        />
        <ListPanel
          title={tab === 'customers' ? 'Cariler' : 'Cari Durumu'}
          rows={tab === 'customers' ? customers.slice(0, 6) : customers.slice(0, 6)}
          emptyText="Cari verisi bulunamadı."
          renderRow={(item, index) => (
            <div key={`${item.customerId || item.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 18, background: theme.accentSoft, padding: '14px 16px', minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: theme.text, minWidth: 0, overflowWrap: 'anywhere' }}>{item.name || '-'}</div>
              <div style={{ fontSize: 16, color: Number(item.balance || 0) > 0 ? '#b91c1c' : theme.accentText, whiteSpace: 'nowrap', fontWeight: 800 }}>{money(item.balance || 0)} ₺</div>
            </div>
          )}
        />
      </div>

      <ReportCatalog onSelect={handleCatalogSelect} />
      <div style={{ ...CARD_STYLE, padding: 16, display: 'none', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>
          {(loading || exporting) ? (exporting ? 'Rapor dosyasÄ± hazÄ±rlanÄ±yor...' : 'Rapor verileri sistemden yÃ¼kleniyor...') : 'Rapor dosyasÄ±nÄ± buradan dÄ±ÅŸa aktarabilirsiniz.'}
        </div>
        <button
          type="button"
          className="btn"
          onClick={downloadAllExcel}
          disabled={loading || exporting}
          style={{ borderRadius: 18, background: 'var(--app-surface)', color: 'var(--app-text)', padding: '14px 18px', fontWeight: 900 }}
        >
          {exporting ? 'HazÄ±rlanÄ±yor' : 'Excel Aktar'}
        </button>
      </div>
      {(loading || exporting) ? <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>{exporting ? 'Rapor dosyası hazırlanıyor...' : 'Rapor verileri sistemden yükleniyor...'}</div> : null}
      <ZReportModal
        open={zReportOpen}
        report={zReportData}
        loading={zReportLoading}
        error={zReportError}
        printSystem="kantin"
        onClose={() => {
          setZReportOpen(false)
          setZReportError('')
        }}
      />
    </div>
  )
}
