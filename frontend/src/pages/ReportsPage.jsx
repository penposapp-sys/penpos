import React, { useEffect, useMemo, useState } from 'react'
import { api, apiDownload } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams, normalizeBranchIds } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import BranchFilterCard from '../components/BranchFilterCard.jsx'
import Modal from '../components/Modal.jsx'
import { downloadBlob } from '../lib/download.js'
import { useTheme } from '../theme/ThemeContext.jsx'

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

export const EMPTY_SUMMARY = {
  totalRevenue: 0,
  totalPaid: 0,
  averageOrder: 0,
  cancelRate: 0,
  orderCount: 0
}

export const EMPTY_DATASETS = {
  dashboard: null,
  products: [],
  cancelledProducts: [],
  orders: [],
  accounts: [],
  deliveryOrders: [],
  courierReportRows: [],
  kitchenOrders: [],
  menuItems: [],
  categories: []
}

const todayYmd = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const reportDefinitions = [
  { key: 'salesSummary', title: 'Satis Ozeti', icon: '₺', description: 'Ciro, tahsilat, sipariş adedi ve ortalama sepet.', detailTitle: 'Detayli Satis Ozeti Raporu', metrics: ['Toplam Ciro', 'Net Satis', 'Toplam Tahsilat', 'Ortalama Sepet'], tableColumns: ['Tarih', 'Sipariş', 'Brut Satis', 'İptal', 'Net Satis', 'Tahsilat'] },
  { key: 'paymentDistribution', title: 'Ödeme Dağılımı', icon: '💳', description: 'Nakit, kart, online ödeme ve açık hesap dağılımı.', detailTitle: 'Detayli Ödeme Dağılımı Raporu', metrics: ['Nakit', 'Kredi Kartı', 'Online', 'Açık Hesap'], tableColumns: ['Saat', 'Ödeme Tipi', 'İşlem Sayisi', 'Tutar', 'Oran'] },
  { key: 'productPerformance', title: 'Ürün Performansi', icon: '🍽', description: 'En cok satan urunler, adet, ciro ve karlilik.', detailTitle: 'Detayli Ürün Performansi Raporu', metrics: ['Satilan Ürün', 'Toplam Adet', 'Ürün Cirosu', 'Kar Oranı'], tableColumns: ['Ürün', 'Kategori', 'Adet', 'Birim Fiyat', 'Ciro', 'Kar'] },
  { key: 'categoryRevenue', title: 'Kategori Cirosu', icon: '🧾', description: 'Kategori bazli satis ve ciro karşılaştırması.', detailTitle: 'Detayli Kategori Cirosu Raporu', metrics: ['Kategori Sayisi', 'En Yuksek Kategori', 'Toplam Ciro', 'Pay Oranı'], tableColumns: ['Kategori', 'Ürün Adedi', 'Satis Adedi', 'Ciro', 'Oran'] },
  { key: 'hourlyDensity', title: 'Saatlik Yoğunluk', icon: '⏱', description: 'Günün saatlerine göre sipariş ve ciro yogunlugu.', detailTitle: 'Detayli Saatlik Yoğunluk Raporu', metrics: ['Yogun Saat', 'Sipariş Adedi', 'Saatlik Ciro', 'Ortalama Sepet'], tableColumns: ['Saat', 'Sipariş', 'Masa', 'Paket', 'Ciro'] },
  { key: 'waiterPerformance', title: 'Garson Performansi', icon: '🧑', description: 'Garson bazli sipariş, masa, tahsilat ve servis hizi.', detailTitle: 'Detayli Garson Performans Raporu', metrics: ['Garson', 'Masa Sayisi', 'Satis', 'Servis Süresi'], tableColumns: ['Garson', 'Masa', 'Sipariş', 'Ciro', 'Ortalama Süre'] },
  { key: 'tableTurnover', title: 'Masa Devir Hizi', icon: '🪑', description: 'Masalarin doluluk süresi, kapanis hizi ve kullanim oranı.', detailTitle: 'Detayli Masa Devir Hizi Raporu', metrics: ['Aktif Masa', 'Ortalama Süre', 'Kapanan Masa', 'Doluluk Oranı'], tableColumns: ['Masa', 'Acilis', 'Kapanis', 'Süre', 'Tutar'] },
  { key: 'openAccount', title: 'Acik Hesap / Cari', icon: '📒', description: 'Cari müşteriler, açık bakiye ve ödeme gecmisi.', detailTitle: 'Detayli Açık Hesap ve Cari Raporu', metrics: ['Açık Bakiye', 'Cari Sayisi', 'Tahsil Edilen', 'Geciken'], tableColumns: ['Cari', 'Son İşlem', 'Borç', 'Tahsilat', 'Kalan'] },
  { key: 'cancelWaste', title: 'Iptal / Fire', icon: '⚠', description: 'İptal edilen urunler, fire nedenleri ve kayıp tutar.', detailTitle: 'Detayli İptal ve Fire Raporu', metrics: ['İptal Tutari', 'Fire Tutari', 'İptal Adedi', 'Kayıp Oranı'], tableColumns: ['Saat', 'Ürün', 'Adet', 'Neden', 'Tutar', 'Personel'] },
  { key: 'discounts', title: 'Indirimler', icon: '🏷', description: 'Uygulanan indirimler, kampanyalar ve yetkili kullanıcı.', detailTitle: 'Detayli İndirim Raporu', metrics: ['İndirim Tutari', 'İndirim Adedi', 'Ortalama İndirim', 'Yetkili'], tableColumns: ['Saat', 'Masa/Siparis', 'İndirim', 'Sebep', 'Yetkili'] },
  { key: 'kitchenPrepTime', title: 'Mutfak Hazırlama Süresi', icon: '🔥', description: 'Urunlerin hazirlanma süresi ve geciken siparisler.', detailTitle: 'Detayli Mutfak Hazırlama Süresi Raporu', metrics: ['Ortalama Süre', 'Geciken Sipariş', 'Hazırlanan', 'Bekleyen'], tableColumns: ['Sipariş', 'Ürün', 'Baslangic', 'Hazır', 'Süre'] },
  { key: 'deliveryPerformance', title: 'Paket Servis Performansi', icon: '🛵', description: 'Paket sipariş, kurye, teslimat süresi ve durum analizi.', detailTitle: 'Detayli Paket Servis Performans Raporu', metrics: ['Paket Sayisi', 'Yolda', 'Teslim', 'Ortalama Teslimat'], tableColumns: ['Sipariş', 'Müşteri', 'Kurye', 'Durum', 'Süre', 'Tutar'] },
  { key: 'courierReport', title: 'Kurye Raporu', icon: '🧾', description: 'Kurye bazlı atama, teslimat, tahsilat ve ortalama teslim süresi.', detailTitle: 'Detayli Kurye Raporu', metrics: ['Atanan Sipariş', 'Teslim Edilen', 'Tahsil Edilen', 'Ortalama Teslim'], tableColumns: ['Kurye', 'Atanan Sipariş', 'Teslim Edilen', 'Geri Dönen', 'İptal', 'Toplam Tutar', 'Tahsil Edilen', 'Veresiye', 'Ortalama Teslim Süresi'] },
  { key: 'taxVat', title: 'KDV / Vergi', icon: '🏛', description: 'KDV oranlari, vergi matrahi ve toplam vergi.', detailTitle: 'Detayli KDV ve Vergi Raporu', metrics: ['Matrah', 'KDV', 'Toplam', 'Fis Sayisi'], tableColumns: ['Tarih', 'KDV Oranı', 'Matrah', 'KDV', 'Toplam'] },
  { key: 'cashierShift', title: 'Kasa / Vardiya', icon: '🧮', description: 'Vardiya acilis-kapanis, kasa farki ve tahsilat.', detailTitle: 'Detayli Kasa ve Vardiya Raporu', metrics: ['Acilis', 'Kapanis', 'Kasa Farki', 'Tahsilat'], tableColumns: ['Vardiya', 'Kullanıcı', 'Acilis', 'Kapanis', 'Fark'] },
  { key: 'stockConsumption', title: 'Stok Tuketim', icon: '📦', description: 'Satisa göre dusen stok, kritik stok ve tuketim.', detailTitle: 'Detayli Stok Tuketim Raporu', metrics: ['Tuketilen', 'Kritik Stok', 'Stok Değeri', 'Eksik Ürün'], tableColumns: ['Ürün', 'Baslangic', 'Tuketim', 'Kalan', 'Durum'] },
  { key: 'customerBehavior', title: 'Müşteri Davranisi', icon: '👥', description: 'Tekrar gelen müşteri, ortalama harcama ve tercih analizi.', detailTitle: 'Detayli Müşteri Davranisi Raporu', metrics: ['Müşteri', 'Tekrar Oranı', 'Ortalama Harcama', 'Favori Ürün'], tableColumns: ['Müşteri', 'Ziyaret', 'Harcama', 'Favori Ürün', 'Son İşlem'] }
]

const toMoney = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmtTl = (v, digits = 2) => `${toMoney(v).toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} TL`
const fmtPct = (v) => `%${toMoney(v).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`

const fmtDate = (raw) => {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('tr-TR')
}

const fmtTime = (raw) => {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

const buildDateRange = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const toYmd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (period === 'yesterday') {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return { period: 'range', start: toYmd(d), end: toYmd(d) }
  }
  if (period === 'week') return { period: 'week' }
  if (period === 'month') return { period: 'month' }
  return { period: 'today' }
}

const formatRangeLabel = (range) => {
  const fmt = (raw) => {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const start = fmt(range?.start)
  const end = fmt(range?.end)
  if (start && end) return start === end ? start : `${start} - ${end}`
  return new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const formatDurationMinutes = (start, end) => {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return '-'
  return `${Math.round((e - s) / 60000)} dk`
}

const safeArray = (value) => Array.isArray(value) ? value : []

const normalizeLookupKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w]/g, '')
  .toLowerCase()

export const getRowValueByColumn = (row, column) => {
  if (!row || typeof row !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(row, column)) return row[column]
  const normalizedColumn = normalizeLookupKey(column)
  const matchedKey = Object.keys(row).find((key) => normalizeLookupKey(key) === normalizedColumn)
  return matchedKey ? row[matchedKey] : undefined
}

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const buildProductReportPrintHtml = ({ report, detailData, rangeLabel, branchesLabel }) => {
  const columns = safeArray(report?.tableColumns)
  const rows = safeArray(detailData?.rows)

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report?.detailTitle || 'Ürün Raporu')}</title>
  <style>
    body { margin: 0; padding: 18px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
    .sheet { max-width: 960px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 900; margin: 0 0 6px; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 4px; }
    .divider { border-top: 2px solid #111827; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 12px; vertical-align: top; }
    th { background: #f8fafc; font-weight: 800; }
    .empty { padding: 24px; border: 1px solid #cbd5e1; border-radius: 16px; color: #64748b; }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1 class="title">${escapeHtml(report?.detailTitle || 'Ürün Raporu')}</h1>
    <div class="meta">Dönem: ${escapeHtml(rangeLabel || '-')}</div>
    <div class="meta">Şube: ${escapeHtml(branchesLabel || '-')}</div>
    <div class="meta">Oluşturma: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</div>
    <div class="divider"></div>
    ${rows.length === 0 ? `<div class="empty">Bu rapor için sistemde uygun veri bulunamadı.</div>` : `
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(getRowValueByColumn(row, column) ?? '-')}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `}
  </div>
</body>
</html>`
}

export const printProductReportDocument = ({ report, detailData, rangeLabel, branchesLabel, autoPrint = true }) => {
  const html = buildProductReportPrintHtml({ report, detailData, rangeLabel, branchesLabel })
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer,width=1100,height=900')
  if (!win) {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    throw new Error('Yazdırma penceresi açılamadı')
  }

  const cleanup = () => window.setTimeout(() => URL.revokeObjectURL(url), 15000)
  if (autoPrint) {
    window.setTimeout(() => {
      try {
        win.focus()
        win.print()
      } catch {}
      cleanup()
    }, 350)
  } else {
    cleanup()
  }
  return win
}

export const buildPaymentBreakdownRows = (sales, options = {}) => {
  const preferCollected = options.preferCollected !== false
  const dynamic = safeArray(preferCollected ? (sales?.collectedPaymentBreakdown || sales?.paymentBreakdown) : (sales?.paymentBreakdown || sales?.collectedPaymentBreakdown))
  if (dynamic.length > 0) {
    return dynamic.map((row) => ({
      label: String(row?.methodName || 'Diğer'),
      amount: toMoney(row?.totalAmount || 0),
      count: Number(row?.count || 0),
    }))
  }
  return [
    { label: 'Nakit', amount: toMoney(sales?.collectedByMethod?.cash ?? sales?.byMethod?.cash ?? 0), count: 0 },
    { label: 'Kart / POS', amount: toMoney(sales?.collectedByMethod?.pos ?? sales?.byMethod?.pos ?? 0), count: 0 },
    { label: 'Banka', amount: toMoney(sales?.collectedByMethod?.bank ?? sales?.byMethod?.bank ?? 0), count: 0 },
    { label: 'Açık Hesap', amount: toMoney(sales?.accountChargedTotal ?? sales?.byMethod?.account ?? 0), count: 0 },
  ]
}

const filterOrdersByDashboardRange = (datasets, orders) => {
  const start = String(datasets?.dashboard?.range?.start || '').trim()
  const end = String(datasets?.dashboard?.range?.end || '').trim()
  if (!start || !end) return safeArray(orders)

  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${end}T23:59:59.999`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return safeArray(orders)

  return safeArray(orders).filter((order) => {
    const raw = order?.createdAt || order?.closedAt || order?.updatedAt
    const ts = new Date(raw).getTime()
    if (Number.isNaN(ts)) return false
    return ts >= from.getTime() && ts <= to.getTime()
  })
}

export const buildHourlyAnalyticsRows = (datasets, options = {}) => {
  const sourceOrders = options.useDashboardRangeOnly
    ? filterOrdersByDashboardRange(datasets, datasets?.orders)
    : safeArray(datasets?.orders)
  const bucket = new Map(Array.from({ length: 24 }).map((_, hour) => [`${String(hour).padStart(2, '0')}:00`, {
    label: `${String(hour).padStart(2, '0')}:00`,
    count: 0,
    tableCount: 0,
    deliveryCount: 0,
    walkInCount: 0,
    revenue: 0
  }]))

  sourceOrders.forEach((order) => {
    const raw = order?.createdAt || order?.closedAt
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return
    const key = `${String(date.getHours()).padStart(2, '0')}:00`
    const row = bucket.get(key)
    if (!row) return
    row.count += 1
    row.revenue += toMoney(order?.netTotal || 0)
    if (String(order?.saleType || '').trim() === 'delivery') row.deliveryCount += 1
    else if (String(order?.tableName || '').trim()) row.tableCount += 1
    else row.walkInCount += 1
  })

  const rows = Array.from(bucket.values())
  if (rows.some((item) => item.count > 0)) return rows

  return safeArray(datasets.dashboard?.customers?.hourly).map((item, index) => ({
    label: String(item?.hour || `${String(index).padStart(2, '0')}:00`).slice(0, 5),
    count: Number(item?.count || 0),
    tableCount: 0,
    deliveryCount: 0,
    walkInCount: 0,
    revenue: 0
  }))
}

const buildHourlyCustomerBars = (datasets, options = {}) => buildHourlyAnalyticsRows(datasets, options).map((item) => ({
  label: item.label,
  value: item.count,
  tableCount: item.tableCount,
  deliveryCount: item.deliveryCount,
  revenue: item.revenue
}))

const buildWeeklyCustomerBars = (datasets) => {
  const labels = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz']
  const bucket = new Map(labels.map((label) => [label, 0]))

  safeArray(datasets.orders).forEach((order) => {
    const raw = order?.closedAt || order?.createdAt
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return
    const dayIndex = (date.getDay() + 6) % 7
    const key = labels[dayIndex]
    bucket.set(key, (bucket.get(key) || 0) + 1)
  })

  return labels.map((label) => ({ label, value: bucket.get(label) || 0 }))
}

function KpiCard({ title, value, note, trend, tone = 'blue' }) {
  const colors = STATUS_COLORS[tone] || STATUS_COLORS.blue
  return (
    <div style={{ ...CARD_STYLE, padding: 20, display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div className="responsive-card-note" style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 600, minWidth: 0 }}>{title}</div>
        <span className="responsive-card-badge" style={{ background: colors.bg, color: colors.fg, borderRadius: 999, padding: '6px 10px', fontWeight: 900 }}>{trend}</span>
      </div>
      <div className="responsive-card-value" style={{ fontWeight: 900 }}>{value}</div>
      <div className="responsive-card-note" style={{ color: 'var(--app-text-muted, var(--muted))' }}>{note}</div>
    </div>
  )
}

function ReportFilter({
  period,
  setPeriod,
  rangeLabel,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  branchOptions,
  selectedBranches,
  setSelectedBranches
}) {
  const tabs = [
    { key: 'today', label: 'Bugun' },
    { key: 'yesterday', label: 'Dun' },
    { key: 'week', label: 'Bu Hafta' },
    { key: 'month', label: 'Bu Ay' },
    { key: 'range', label: 'Aralik' }
  ]
  return (
    <div style={{ ...CARD_STYLE, padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const active = period === tab.key
            return (
              <button key={tab.key} type="button" className={`btn${active ? ' is-active' : ''}`} aria-pressed={active ? 'true' : 'false'} onClick={() => setPeriod(tab.key)} style={{ background: active ? 'var(--button-active-bg)' : 'var(--app-surface-soft, var(--panelElevated))', borderColor: active ? 'var(--button-active-bg)' : 'var(--app-border, var(--border))', color: active ? 'var(--button-active-text)' : 'var(--button-text)', fontWeight: active ? 900 : 600, padding: '10px 16px' }}>
                {tab.label}
              </button>
            )
          })}
          <BranchFilterCard
            branchOptions={branchOptions}
            selectedBranches={selectedBranches}
            setSelectedBranches={setSelectedBranches}
            title="Şube Seç"
            compact
          />
        </div>
        <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13, fontWeight: 600 }}>{rangeLabel}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {period === 'range' && (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Baslangic</span>
              <input type="date" className="input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Bitis</span>
              <input type="date" className="input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </label>
          </>
        )}
      </div>
    </div>
  )
}

function ReportSummary({ summary, isMobilePortrait }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
      <KpiCard title="Toplam Ciro" value={fmtTl(summary.totalRevenue)} note="Seçili tarih" trend="+0%" tone="green" />
      <KpiCard title="Toplam Sipariş" value={String(summary.orderCount)} note="Adet" trend="+0%" tone="blue" />
      <KpiCard title="Ortalama Sipariş" value={fmtTl(summary.averageOrder, 0)} note="Sepet" trend="+0%" tone="orange" />
      <KpiCard title="İptal Oranı" value={fmtPct(summary.cancelRate)} note="Gercek veri" trend="+0%" tone="red" />
    </div>
  )
}

function ReportHero() {
  return (
    <div style={HERO_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 280, flex: '1 1 480px' }}>
          <div style={{ marginBottom: 12, display: 'inline-flex', borderRadius: 999, background: 'rgba(255,255,255,0.1)', padding: '8px 16px', fontSize: 12, fontWeight: 900 }}>
            Rapor Merkezi
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 900 }}>
            Isletmenin tüm performansini tek ekranda analiz et.
          </h1>
          <p style={{ margin: '10px 0 0', maxWidth: 720, fontSize: 14, color: '#ffffff', lineHeight: 1.6 }}>
            Satis, ödeme, ürün, garson, masa, stok ve mutfak performansini ayri raporlar halinde inceleyebilirsin.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, minWidth: 260 }}>
          <button type="button" className="btn button-light" style={{ borderRadius: 18, background: 'var(--app-surface)', color: 'var(--app-text)', padding: '14px 18px', fontWeight: 900 }}>
            Excel Aktar
          </button>
          <button type="button" className="btn" style={{ borderRadius: 18, background: 'rgba(255,255,255,0.08)', color: '#ffffff', padding: '14px 18px', fontWeight: 900, borderColor: 'rgba(255,255,255,0.14)' }}>
            PDF Indir
          </button>
        </div>
      </div>
    </div>
  )
}

function ReportSummaryCards({ summary, datasets, isMobilePortrait }) {
  const fireRate = summary.cancelRate
  const netSales = Math.max(0, summary.totalRevenue - toMoney(datasets.dashboard?.cancelled?.totalRevenue || 0))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
      <KpiCard title="Net Satis" value={fmtTl(netSales, 0)} note="Seçili dönem" trend="+0%" tone="green" />
      <KpiCard title="Sipariş" value={String(summary.orderCount)} note="Toplam adet" trend="+0" tone="blue" />
      <KpiCard title="Ortalama Sepet" value={fmtTl(summary.averageOrder, 0)} note="Sipariş başı" trend="+0%" tone="orange" />
      <KpiCard title="Fire Oranı" value={fmtPct(fireRate)} note="Gercek veri" trend="+0%" tone="red" />
    </div>
  )
}

function buildCategoryRevenueRows(datasets) {
  const { categoryNameById, menuById } = buildCategoryMaps(datasets)
  const products = safeArray(datasets.products)
  return Array.from(products.reduce((map, item) => {
    const meta = menuById.get(String(item.menuItemId || '')) || {}
    const categoryName = categoryNameById.get(String(meta.categoryId || '')) || 'Diger'
    const prev = map.get(categoryName) || { name: categoryName, revenue: 0 }
    prev.revenue += toMoney(item.revenue || 0)
    map.set(categoryName, prev)
    return map
  }, new Map()).values()).sort((a, b) => b.revenue - a.revenue)
}

export function MainRevenuePanel({ datasets, period, setPeriod, showModeToggle = true, headerAction = null, useDashboardRangeOnly = false }) {
  const { theme } = useTheme()
  const chartMode = period === 'week' ? 'week' : 'day'
  const bars = chartMode === 'week'
    ? buildWeeklyCustomerBars(datasets)
    : buildHourlyCustomerBars(datasets, { useDashboardRangeOnly })
  const max = bars.reduce((best, item) => Math.max(best, item.value), 0) || 1
  const hourlyRows = buildHourlyAnalyticsRows(datasets, { useDashboardRangeOnly })
  const peakRow = hourlyRows.reduce((best, item) => item.count > (best?.count || 0) ? item : best, hourlyRows[0] || { label: '-', count: 0, tableCount: 0, deliveryCount: 0 })
  const totalCustomers = hourlyRows.reduce((sum, item) => sum + Number(item.count || 0), 0)
  const totalTables = hourlyRows.reduce((sum, item) => sum + Number(item.tableCount || 0), 0)
  const totalDelivery = hourlyRows.reduce((sum, item) => sum + Number(item.deliveryCount || 0), 0)
  const statCards = [
    { label: 'Toplam Müşteri', value: String(totalCustomers) },
    { label: 'Yogun Saat', value: peakRow?.label || '-' },
    { label: 'Masa Siparisi', value: String(totalTables) },
    { label: 'Paket Siparisi', value: String(totalDelivery) }
  ]
  const chartInnerWidth = Math.max(100, bars.length * 36)

  return (
    <div style={{ ...CARD_STYLE, padding: 24, minWidth: 0, overflow: 'hidden', borderColor: theme.border }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: theme.text }}>Saatlik Müşteri Analizi</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
            {chartMode === 'week' ? 'Hafta icinde müşteri hareketi ve yoğunluk.' : 'Gün icinde müşteri hareketi ve yoğunluk.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {headerAction}
          {showModeToggle && (
            <div style={{ borderRadius: 18, background: theme.accentSoft, padding: 4, display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setPeriod('today')}
                style={{
                  borderRadius: 12,
                  background: chartMode === 'day' ? theme.accent : 'transparent',
                  borderColor: chartMode === 'day' ? theme.accent : 'transparent',
                  color: chartMode === 'day' ? '#ffffff' : theme.accentText,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 900
                }}
              >
                Günlük
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPeriod('week')}
                style={{
                  borderRadius: 12,
                  background: chartMode === 'week' ? theme.accent : 'transparent',
                  borderColor: chartMode === 'week' ? theme.accent : 'transparent',
                  color: chartMode === 'week' ? '#ffffff' : theme.accentText,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 900
                }}
              >
                Haftalik
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {statCards.map((item) => (
          <div key={item.label} style={{ borderRadius: 18, background: theme.accentSoft, padding: '12px 14px', minWidth: 0 }}>
            <div className="responsive-card-badge" style={{ color: theme.accentText, fontWeight: 700 }}>{item.label}</div>
            <div className="responsive-card-title" style={{ marginTop: 6, fontWeight: 900, color: theme.text }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, paddingTop: 10, borderTop: `1px solid ${theme.border}`, overflowX: 'auto', overflowY: 'hidden' }}>
        {bars.length === 0 ? (
          <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>Müşteri verisi bulunamadı.</div>
        ) : (
          <div style={{ display: 'flex', width: `${chartInnerWidth}px`, minWidth: '100%', height: 230, alignItems: 'stretch', gap: 8 }}>
            {bars.map((bar) => (
              <div key={bar.label} style={{ display: 'flex', flex: 1, minWidth: 28, flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', width: '100%', flex: 1, alignItems: 'flex-end' }}>
                  <div
                    title={`${bar.label}: ${bar.value} müşteri`}
                    style={{
                      width: '100%',
                      height: `${Math.max(18, Math.round((bar.value / max) * 100))}%`,
                      minHeight: bar.value > 0 ? 18 : 0,
                      borderTopLeftRadius: 18,
                      borderTopRightRadius: 18,
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                      background: theme.gradient,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      boxShadow: `0 12px 28px ${theme.accentSoft}`
                    }}
                  >
                    {!!bar.deliveryCount && (
                      <div style={{ height: `${Math.max(8, Math.round((bar.deliveryCount / Math.max(1, bar.value)) * 100))}%`, background: theme.accentSoft, opacity: 0.9 }} />
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--app-text)', whiteSpace: 'nowrap' }}>{bar.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function PaymentOverviewPanel({ datasets, summary, headerAction = null }) {
  const { theme } = useTheme()
  const paymentRows = buildPaymentBreakdownRows(datasets.dashboard?.sales, { preferCollected: true })
    .filter((row) => row.amount > 0)
    .map((row) => [row.label, row.amount])
  const rows = [
    ['Nakit', toMoney(datasets.dashboard?.sales?.collectedByMethod?.cash ?? datasets.dashboard?.sales?.byMethod?.cash ?? 0)],
    ['Kart / POS', toMoney(datasets.dashboard?.sales?.collectedByMethod?.pos ?? datasets.dashboard?.sales?.byMethod?.pos ?? 0)],
    ['Banka', toMoney(datasets.dashboard?.sales?.collectedByMethod?.bank ?? datasets.dashboard?.sales?.byMethod?.bank ?? 0)],
    ['Açık Hesap', toMoney(datasets.dashboard?.sales?.accountChargedTotal ?? datasets.dashboard?.sales?.byMethod?.account ?? 0)]
  ]
  return (
    <div style={{ ...CARD_STYLE, padding: 24, minWidth: 0, overflow: 'hidden', borderColor: theme.border }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: theme.text }}>Ödeme Ozeti</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Tahsilat kanallarina göre dagilim.</p>
        </div>
        {headerAction}
      </div>

      <div style={{ marginTop: 24, display: 'grid', gap: 18 }}>
        {(paymentRows.length > 0 ? paymentRows : rows).map(([label, amount]) => {
          const ratio = summary.totalRevenue > 0 ? Math.min(100, Math.round((amount / summary.totalRevenue) * 100)) : 0
          return (
            <div key={label}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, minWidth: 0 }}>
                <b style={{ color: theme.text }}>{label}</b>
                <span style={{ fontWeight: 900, color: theme.accentText, textAlign: 'right' }}>{fmtTl(amount, 0)}</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: theme.accentSoft }}>
                <div style={{ width: `${ratio}%`, height: 12, borderRadius: 999, background: theme.gradient }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TopSellersPanel({ datasets, headerAction = null }) {
  const { theme } = useTheme()
  const rows = safeArray(datasets.products).slice(0, 6)
  return (
    <div style={{ ...CARD_STYLE, padding: 24, minWidth: 0, overflow: 'hidden', borderColor: theme.border }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="responsive-card-title" style={{ margin: 0, fontWeight: 900, color: theme.text }}>En Cok Satanlar</h2>
        {headerAction}
      </div>
      <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
        {rows.length === 0 ? (
          <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>Satis verisi bulunamadı.</div>
        ) : rows.map((item, index) => (
          <div key={`${item.menuItemId || item.name}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderRadius: 18, background: theme.accentSoft, padding: '14px 16px', minWidth: 0 }}>
            <div className="responsive-card-title" style={{ fontWeight: 900, color: theme.text, minWidth: 0 }}>{`${index + 1}. ${String(item.name || '-').toUpperCase('tr-TR')}`}</div>
            <div className="responsive-card-badge" style={{ color: theme.accentText, fontWeight: 800, textAlign: 'right' }}>{`${Number(item.qty || 0)} adet`}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CategoryRevenuePanel({ datasets, summary, headerAction = null }) {
  const { theme } = useTheme()
  const rows = buildCategoryRevenueRows(datasets).slice(0, 5)
  const max = rows.reduce((best, item) => Math.max(best, item.revenue), 0) || 1
  return (
    <div style={{ ...CARD_STYLE, padding: 24, minWidth: 0, overflow: 'hidden', borderColor: theme.border }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="responsive-card-title" style={{ margin: 0, fontWeight: 900, color: theme.text }}>Kategori Cirosu</h2>
        {headerAction}
      </div>
      <div style={{ marginTop: 22, display: 'grid', gap: 18 }}>
        {rows.length === 0 ? (
          <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>Kategori bazli veri bulunamadı.</div>
        ) : rows.map((item) => (
          <div key={item.name}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
              <b className="responsive-card-note" style={{ color: theme.text, minWidth: 0 }}>{item.name}</b>
              <span className="responsive-card-badge" style={{ color: theme.accentText, fontWeight: 800, textAlign: 'right' }}>{fmtTl(item.revenue, 0)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: theme.accentSoft }}>
              <div style={{ width: `${Math.max(8, Math.round((item.revenue / max) * 100))}%`, height: 8, borderRadius: 999, background: theme.gradient }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportCard({ report, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-button-layout="card"
      style={{ ...CARD_STYLE, padding: compact ? 16 : 20, textAlign: 'left', cursor: 'pointer', transition: 'transform 160ms ease, box-shadow 160ms ease', minHeight: compact ? 0 : 250, minWidth: 0, overflow: 'hidden', gap: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'grid', height: 48, width: 48, placeItems: 'center', borderRadius: 18, background: 'var(--app-surface-soft, var(--panelElevated))', fontSize: 22 }}>
          {report.icon}
        </div>

        <span className="responsive-card-badge" style={{ borderRadius: 999, background: 'var(--app-surface-soft, var(--panelElevated))', padding: '6px 12px', fontWeight: 900, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
          Rapor
        </span>
      </div>

      <div className="responsive-card-title" style={{ marginTop: 18, fontWeight: 900 }}>
        {report.title}
      </div>

      <div className="responsive-card-note" style={{ marginTop: 8, lineHeight: 1.6, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
        {report.description}
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid var(--app-border, var(--border))', paddingTop: 16 }}>
        <div className="responsive-card-badge" style={{ fontWeight: 900, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
          Icerdigi metrikler
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: compact ? 0 : 62, alignContent: 'flex-start' }}>
          {report.metrics.slice(0, 4).map((metric) => (
            <span
              key={metric}
              className="responsive-card-chip"
              style={{ borderRadius: 999, background: 'var(--app-surface-soft, var(--panelElevated))', padding: '6px 12px', fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}
            >
              {metric}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: compact ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12, flexDirection: compact ? 'column' : 'row' }}>
        <span className="responsive-card-badge" style={{ fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))', width: compact ? '100%' : 'auto' }}>
          Detay için ac
        </span>

        <span className="responsive-card-badge" style={{ borderRadius: 12, background: 'var(--button-active-bg)', border: '1px solid var(--button-active-bg)', padding: '10px 14px', fontWeight: 900, color: 'var(--button-active-text)', width: compact ? '100%' : 'auto', textAlign: 'center' }}>
          Ac
        </span>
      </div>
    </button>
  )
}

function ReportCatalog({ onSelect, isMobilePortrait }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 className="responsive-card-title" style={{ margin: 0, fontWeight: 900 }}>Rapor Kutuphanesi</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
          Özet panellerin altindan detay raporlara gecis yap.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {reportDefinitions.map((report) => (
          <ReportCard
            key={report.key}
            report={report}
            compact={isMobilePortrait}
            onClick={() => onSelect(report)}
          />
        ))}
      </div>
    </section>
  )
}

function ReportDetail({ report, onClose, detailData, isMobilePortrait, rangeLabel, branchesLabel }) {
  const metricGrid = isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))'
  const metricEntries = Array.isArray(detailData?.metricEntries) && detailData.metricEntries.length > 0
    ? detailData.metricEntries
    : report.metrics.map((metric) => ({ label: metric, value: detailData?.metricValues?.[metric] ?? 'Veri yok' }))
  const canPrint = report?.key === 'productPerformance'

  return (
    <Modal
      open
      onClose={onClose}
      title={report.detailTitle}
      backdropClose
      dialogStyle={{
        width: isMobilePortrait ? 'min(100%, calc(100vw - 20px))' : 'min(1440px, calc(100vw - 32px))',
        maxWidth: '100%',
        maxHeight: isMobilePortrait ? 'calc(100vh - 20px)' : 'calc(100vh - 32px)'
      }}
      bodyStyle={{
        padding: isMobilePortrait ? 16 : 22
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          gap: 18
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--app-text-secondary, var(--text-secondary))' }}>{report.description}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {canPrint && (
              <button
                type="button"
                className="btn button-light"
                onClick={() => printProductReportDocument({ report, detailData, rangeLabel, branchesLabel })}
                style={{ fontWeight: 900 }}
              >
                Yazdır
              </button>
            )}
          </div>
        </div>

        <div className="scrollbar-hidden" style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: metricGrid, gap: 12 }}>
          {metricEntries.map((metric) => (
            <div key={metric.label} style={{ borderRadius: 18, background: 'var(--app-surface-soft, var(--panelElevated))', padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))' }}>{metric.label}</div>
              <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900 }}>{metric.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, border: '1px solid var(--app-border, var(--border))', borderRadius: 24, overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--app-surface-soft, var(--panelElevated))' }}>
                {report.tableColumns.map((col) => <th key={col} style={{ padding: '14px 16px', fontWeight: 900, textAlign: 'left' }}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {detailData.rows.length === 0 ? (
                <tr>
                  <td colSpan={report.tableColumns.length} style={{ padding: '18px 16px', color: 'var(--app-text-secondary, var(--text-secondary))' }}>Bu rapor için sistemde uygun veri bulunamadı.</td>
                </tr>
              ) : detailData.rows.map((row, rowIndex) => (
                <tr key={`${report.key}-${rowIndex}`}>
                  {report.tableColumns.map((col) => <td key={col} style={{ padding: '14px 16px', color: 'var(--app-text, var(--text))' }}>{getRowValueByColumn(row, col) ?? '-'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </Modal>
  )
}

const buildCategoryMaps = (datasets) => {
  const categoryNameById = new Map(safeArray(datasets.categories).map((c) => [String(c.id || c._id || ''), String(c.name || '-')]))
  const menuById = new Map(safeArray(datasets.menuItems).map((item) => [String(item.id || item._id || ''), item]))
  return { categoryNameById, menuById }
}

export const buildSummary = (datasets) => {
  const dashboard = datasets.dashboard || {}
  const sales = dashboard.sales || {}
  const cancelled = dashboard.cancelled || {}
  const totalRevenue = toMoney(sales.totalRevenue || 0)
  const totalPaid = toMoney(sales.totalPaid || 0)
  const orderCount = Number(sales.orderCount || 0)
  const averageOrder = orderCount > 0 ? totalRevenue / orderCount : 0
  const cancelRate = orderCount > 0 ? (toMoney(cancelled.totalQty || 0) / orderCount) * 100 : 0
  return { totalRevenue, totalPaid, averageOrder, cancelRate, orderCount }
}

const buildCustomerRows = (orders) => {
  const map = new Map()
  safeArray(orders).forEach((order) => {
    const name = String(order.customerName || '').trim()
    if (!name) return
    const prev = map.get(name) || { count: 0, spend: 0, last: order.closedAt || order.createdAt }
    prev.count += 1
    prev.spend += toMoney(order.netTotal || 0)
    if (new Date(order.closedAt || order.createdAt).getTime() > new Date(prev.last).getTime()) prev.last = order.closedAt || order.createdAt
    map.set(name, prev)
  })
  return Array.from(map.entries()).map(([name, value]) => ({ name, ...value })).sort((a, b) => b.count - a.count || b.spend - a.spend)
}

export const buildReportDetailData = (report, datasets, summary) => {
  const dashboard = datasets.dashboard || {}
  const sales = dashboard.sales || {}
  const cancelled = dashboard.cancelled || {}
  const hourly = buildHourlyAnalyticsRows(datasets)
  const products = safeArray(datasets.products)
  const cancelledProducts = safeArray(datasets.cancelledProducts)
  const orders = safeArray(datasets.orders)
  const accounts = safeArray(datasets.accounts)
  const deliveryOrders = safeArray(datasets.deliveryOrders)
  const kitchenOrders = safeArray(datasets.kitchenOrders)
  const { categoryNameById, menuById } = buildCategoryMaps(datasets)
  const customerRows = buildCustomerRows(orders)
  const topCustomer = customerRows[0] || null

  const productWithMeta = products.map((item) => {
    const meta = menuById.get(String(item.menuItemId || '')) || {}
    const categoryId = String(meta.categoryId || '')
    const revenue = toMoney(item.revenue ?? item.total ?? 0)
    return {
      ...item,
      revenue,
      categoryName: categoryNameById.get(categoryId) || '-',
      price: Number(item.qty || 0) > 0 ? revenue / Number(item.qty || 1) : 0,
      vatRate: Number(meta.vatRate || 0),
      stockQty: Number(meta.stockQty || 0),
      stockTrackingEnabled: meta.stockTrackingEnabled === true
    }
  })

  const hourlyPeak = hourly.reduce((best, item) => Number(item?.count || 0) > Number(best?.count || 0) ? item : best, hourly[0] || { label: '-', count: 0, revenue: 0 })
  const categoryRows = Array.from(productWithMeta.reduce((map, item) => {
    const key = item.categoryName || '-'
    const prev = map.get(key) || { category: key, itemCount: 0, qty: 0, revenue: 0 }
    prev.itemCount += 1
    prev.qty += Number(item.qty || 0)
    prev.revenue += toMoney(item.revenue || 0)
    map.set(key, prev)
    return map
  }, new Map()).values()).sort((a, b) => b.revenue - a.revenue)

  const discountOrders = orders
    .filter((order) => {
      const gross = toMoney(order.totals?.grandTotal || order.netTotal || 0)
      const net = toMoney(order.netTotal || 0)
      return gross > net
    })
    .map((order) => {
      const gross = toMoney(order.totals?.grandTotal || order.netTotal || 0)
      const net = toMoney(order.netTotal || 0)
      return { ...order, discountValue: Math.max(0, gross - net) }
    })

  const activeTables = orders.filter((order) => String(order.tableName || '').trim()).length
  const totalTableMinutes = orders.reduce((sum, order) => {
    const s = new Date(order.createdAt).getTime()
    const e = new Date(order.closedAt).getTime()
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return sum
    return sum + Math.round((e - s) / 60000)
  }, 0)
  const avgTableMinutes = activeTables > 0 ? totalTableMinutes / activeTables : 0
  const paymentDistributionRows = buildPaymentBreakdownRows(sales, { preferCollected: true })
    .filter((row) => row.amount > 0)
  const paymentMetricEntries = paymentDistributionRows.length > 0
    ? paymentDistributionRows.slice(0, 4).map((row) => ({ label: row.label, value: fmtTl(row.amount) }))
    : [
        { label: 'Nakit', value: fmtTl(0) },
        { label: 'Kart / POS', value: fmtTl(0) },
        { label: 'Banka', value: fmtTl(0) },
        { label: 'Açık Hesap', value: fmtTl(0) }
      ]

  const courierRows = safeArray(datasets.courierReportRows)
  const courierTop = courierRows[0] || null

  const metricValuesByKey = {
    salesSummary: {
      'Toplam Ciro': fmtTl(summary.totalRevenue),
      'Net Satis': fmtTl(summary.totalRevenue - toMoney(cancelled.totalRevenue || 0)),
      'Toplam Tahsilat': fmtTl(summary.totalPaid),
      'Ortalama Sepet': fmtTl(summary.averageOrder, 0)
    },
    paymentDistribution: {
      Nakit: fmtTl(sales.byMethod?.cash || 0),
      'Kredi Kartı': fmtTl(sales.byMethod?.pos || 0),
      Online: fmtTl((sales.byMethod?.bank || 0) + 0),
      'Açık Hesap': fmtTl(sales.byMethod?.account || 0)
    },
    productPerformance: {
      'Satilan Ürün': String(productWithMeta.length),
      'Toplam Adet': String(productWithMeta.reduce((sum, item) => sum + Number(item.qty || 0), 0)),
      'Ürün Cirosu': fmtTl(productWithMeta.reduce((sum, item) => sum + toMoney(item.revenue || 0), 0)),
      'Kar Oranı': 'Veri yok'
    },
    categoryRevenue: {
      'Kategori Sayisi': String(categoryRows.length),
      'En Yuksek Kategori': categoryRows[0]?.category || 'Veri yok',
      'Toplam Ciro': fmtTl(summary.totalRevenue),
      'Pay Oranı': categoryRows[0] ? fmtPct((categoryRows[0].revenue / Math.max(1, summary.totalRevenue)) * 100) : 'Veri yok'
    },
    hourlyDensity: {
      'Yogun Saat': String(hourlyPeak?.label || 'Veri yok'),
      'Sipariş Adedi': String(hourlyPeak?.count || 0),
      'Saatlik Ciro': fmtTl(hourlyPeak?.revenue || 0),
      'Ortalama Sepet': fmtTl(summary.averageOrder, 0)
    },
    waiterPerformance: {
      Garson: 'Sistem verisi yok',
      'Masa Sayisi': String(activeTables),
      Satis: fmtTl(summary.totalRevenue),
      'Servis Süresi': 'Sistem verisi yok'
    },
    tableTurnover: {
      'Aktif Masa': String(activeTables),
      'Ortalama Süre': avgTableMinutes > 0 ? `${Math.round(avgTableMinutes)} dk` : 'Veri yok',
      'Kapanan Masa': String(activeTables),
      'Doluluk Oranı': activeTables > 0 ? fmtPct(100) : 'Veri yok'
    },
    openAccount: {
      'Açık Bakiye': fmtTl(accounts.reduce((sum, item) => sum + toMoney(item.balance || 0), 0)),
      'Cari Sayisi': String(accounts.length),
      'Tahsil Edilen': fmtTl(summary.totalPaid),
      Geciken: String(accounts.filter((item) => toMoney(item.balance || 0) > 0).length)
    },
    cancelWaste: {
      'İptal Tutari': fmtTl(cancelled.totalRevenue || 0),
      'Fire Tutari': fmtTl(cancelled.totalRevenue || 0),
      'İptal Adedi': String(cancelled.totalQty || 0),
      'Kayıp Oranı': fmtPct(summary.cancelRate)
    },
    discounts: {
      'İndirim Tutari': fmtTl(discountOrders.reduce((sum, order) => sum + toMoney(order.discountValue || 0), 0)),
      'İndirim Adedi': String(discountOrders.length),
      'Ortalama İndirim': fmtTl(discountOrders.length > 0 ? discountOrders.reduce((sum, order) => sum + toMoney(order.discountValue || 0), 0) / discountOrders.length : 0),
      Yetkili: 'Sistem verisi yok'
    },
    kitchenPrepTime: {
      'Ortalama Süre': 'Sistem verisi yok',
      'Geciken Sipariş': String(kitchenOrders.filter((item) => safeArray(item.items).length > 5).length),
      Hazirlanan: String(kitchenOrders.filter((item) => String(item.status || '') === 'completed').length),
      Bekleyen: String(kitchenOrders.filter((item) => String(item.status || '') !== 'completed').length)
    },
    deliveryPerformance: {
      'Paket Sayisi': String(deliveryOrders.length),
      Yolda: String(deliveryOrders.filter((item) => String(item.deliveryStatus || '').includes('yolda')).length),
      Teslim: String(deliveryOrders.filter((item) => String(item.deliveryStatus || item.status || '').includes('delivered')).length),
      'Ortalama Teslimat': 'Sistem verisi yok'
    },
    courierReport: {
      'Atanan Sipariş': String(courierRows.reduce((sum, item) => sum + Number(item.assignedOrderCount || 0), 0)),
      'Teslim Edilen': String(courierRows.reduce((sum, item) => sum + Number(item.deliveredOrderCount || 0), 0)),
      'Tahsil Edilen': fmtTl(courierRows.reduce((sum, item) => sum + Number(item.collectedCashAmount || 0) + Number(item.collectedCardAmount || 0), 0)),
      'Ortalama Teslim': courierTop ? `${Number(courierTop.averageDeliveryMinutes || 0)} dk` : 'Veri yok'
    },
    taxVat: {
      Matrah: fmtTl(productWithMeta.reduce((sum, item) => sum + (toMoney(item.revenue || 0) / (1 + (Number(item.vatRate || 0) / 100))), 0)),
      KDV: fmtTl(productWithMeta.reduce((sum, item) => {
        const revenue = toMoney(item.revenue || 0)
        const vatRate = Number(item.vatRate || 0)
        const base = revenue / (1 + vatRate / 100)
        return sum + Math.max(0, revenue - base)
      }, 0)),
      Toplam: fmtTl(summary.totalRevenue),
      'Fis Sayisi': String(summary.orderCount)
    },
    cashierShift: {
      Acilis: 'Sistem verisi yok',
      Kapanis: 'Sistem verisi yok',
      'Kasa Farki': 'Sistem verisi yok',
      Tahsilat: fmtTl(summary.totalPaid)
    },
    stockConsumption: {
      Tuketilen: String(productWithMeta.reduce((sum, item) => sum + Number(item.qty || 0), 0)),
      'Kritik Stok': String(productWithMeta.filter((item) => item.stockTrackingEnabled && Number(item.stockQty || 0) <= 10).length),
      'Stok Değeri': fmtTl(productWithMeta.reduce((sum, item) => sum + (Number(item.stockQty || 0) * toMoney(item.price || 0)), 0)),
      'Eksik Ürün': String(productWithMeta.filter((item) => item.stockTrackingEnabled && Number(item.stockQty || 0) <= 0).length)
    },
    customerBehavior: {
      Musteri: topCustomer?.name || 'Veri yok',
      'Tekrar Oranı': customerRows.length > 0 ? fmtPct((customerRows.filter((item) => item.count > 1).length / customerRows.length) * 100) : 'Veri yok',
      'Ortalama Harcama': fmtTl(topCustomer?.spend && topCustomer?.count ? topCustomer.spend / topCustomer.count : 0),
      'Favori Ürün': productWithMeta[0]?.name || 'Veri yok'
    }
  }

  const rowsByKey = {
    salesSummary: orders.slice(0, 12).map((order) => ({ Tarih: fmtDate(order.closedAt), Siparis: order.orderNo ? `Sipariş ${order.orderNo}` : `#${String(order.id || '').slice(-6)}`, 'Brut Satis': fmtTl(order.totals?.grandTotal || order.netTotal || 0), Iptal: fmtTl(Math.max(0, toMoney(order.totals?.grandTotal || order.netTotal || 0) - toMoney(order.netTotal || 0))), 'Net Satis': fmtTl(order.netTotal || 0), Tahsilat: fmtTl(order.paidTotal || 0) })),
    paymentDistribution: [
      { Saat: 'Dönem', 'Ödeme Tipi': 'Nakit', 'İşlem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.cash || 0), Oran: fmtPct((toMoney(sales.byMethod?.cash || 0) / Math.max(1, summary.totalRevenue)) * 100) },
      { Saat: 'Dönem', 'Ödeme Tipi': 'Kredi Kartı', 'İşlem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.pos || 0), Oran: fmtPct((toMoney(sales.byMethod?.pos || 0) / Math.max(1, summary.totalRevenue)) * 100) },
      { Saat: 'Dönem', 'Ödeme Tipi': 'Online', 'İşlem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.bank || 0), Oran: fmtPct((toMoney(sales.byMethod?.bank || 0) / Math.max(1, summary.totalRevenue)) * 100) },
      { Saat: 'Dönem', 'Ödeme Tipi': 'Açık Hesap', 'İşlem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.account || 0), Oran: fmtPct((toMoney(sales.byMethod?.account || 0) / Math.max(1, summary.totalRevenue)) * 100) }
    ].filter((row) => toMoney(String(row.Tutar).replace(/[^\d,.-]/g, '').replace(',', '.')) >= 0),
    productPerformance: productWithMeta.slice(0, 20).map((item) => ({ Urun: item.name || '-', Kategori: item.categoryName || '-', Adet: String(item.qty || 0), 'Birim Fiyat': fmtTl(item.price || 0), Ciro: fmtTl(item.revenue || 0), Kar: '-' })),
    categoryRevenue: categoryRows.slice(0, 20).map((item) => ({ Kategori: item.category, 'Ürün Adedi': String(item.itemCount), 'Satis Adedi': String(item.qty), Ciro: fmtTl(item.revenue), Oran: fmtPct((item.revenue / Math.max(1, summary.totalRevenue)) * 100) })),
    hourlyDensity: hourly.map((item) => ({ Saat: item.label, Siparis: String(item.count || 0), Masa: String(item.tableCount || 0), Paket: String(item.deliveryCount || 0), Ciro: fmtTl(item.revenue || 0) })),
    waiterPerformance: [],
    tableTurnover: orders.filter((order) => String(order.tableName || '').trim()).slice(0, 20).map((order) => ({ Masa: order.tableName || '-', Acilis: fmtTime(order.createdAt), Kapanis: fmtTime(order.closedAt), Sure: formatDurationMinutes(order.createdAt, order.closedAt), Tutar: fmtTl(order.netTotal || 0) })),
    openAccount: accounts.slice(0, 20).map((account) => ({ Cari: account.name || '-', 'Son İşlem': fmtDate(account.createdAt), Borc: fmtTl(account.balance || 0), Tahsilat: fmtTl(0), Kalan: fmtTl(account.balance || 0) })),
    cancelWaste: cancelledProducts.slice(0, 20).map((item) => ({ Saat: '-', Urun: item.name || '-', Adet: String(item.qty || 0), Neden: '-', Tutar: fmtTl(item.revenue || 0), Personel: '-' })),
    discounts: discountOrders.slice(0, 20).map((order) => ({ Saat: fmtTime(order.closedAt), 'Masa/Siparis': order.tableName || (order.orderNo ? `Sipariş ${order.orderNo}` : '-'), Indirim: fmtTl(order.discountValue || 0), Sebep: '-', Yetkili: '-' })),
    kitchenPrepTime: kitchenOrders.slice(0, 20).map((order) => ({ Siparis: order.tableName || order.customerName || order.id || '-', Urun: String(safeArray(order.items).length), Baslangic: fmtTime(order.createdAt), Hazir: order.completedAt ? fmtTime(order.completedAt) : '-', Sure: order.completedAt ? formatDurationMinutes(order.createdAt, order.completedAt) : '-' })),
    deliveryPerformance: deliveryOrders.slice(0, 20).map((order) => ({ Siparis: order.orderNo ? `Sipariş ${order.orderNo}` : order.id || '-', Musteri: order.customerName || '-', Kurye: order.courierName || '-', Durum: order.deliveryStatus || order.status || '-', Sure: '-', Tutar: fmtTl(order.netTotal || order.total || 0) })),
    courierReport: courierRows.map((row) => ({ Kurye: row.courierName || '-', 'Atanan Sipariş': String(row.assignedOrderCount || 0), 'Teslim Edilen': String(row.deliveredOrderCount || 0), 'Geri Dönen': String(row.returnedOrderCount || 0), İptal: String(row.cancelledOrderCount || 0), 'Toplam Tutar': fmtTl(row.totalPackageAmount || 0), 'Tahsil Edilen': fmtTl((row.collectedCashAmount || 0) + (row.collectedCardAmount || 0)), Veresiye: fmtTl(row.receivableAmount || 0), 'Ortalama Teslim Süresi': `${Number(row.averageDeliveryMinutes || 0)} dk` })),
    taxVat: Array.from(productWithMeta.reduce((map, item) => {
      const key = String(Number(item.vatRate || 0))
      const revenue = toMoney(item.revenue || 0)
      const base = revenue / (1 + Number(item.vatRate || 0) / 100)
      const prev = map.get(key) || { vatRate: Number(item.vatRate || 0), base: 0, tax: 0, total: 0, count: 0 }
      prev.base += base
      prev.tax += Math.max(0, revenue - base)
      prev.total += revenue
      prev.count += 1
      map.set(key, prev)
      return map
    }, new Map()).values()).map((item) => ({ Tarih: 'Dönem', 'KDV Oranı': `%${item.vatRate}`, Matrah: fmtTl(item.base), KDV: fmtTl(item.tax), Toplam: fmtTl(item.total) })),
    cashierShift: [],
    stockConsumption: productWithMeta.filter((item) => item.stockTrackingEnabled).slice(0, 20).map((item) => ({ Urun: item.name || '-', Baslangic: String(item.stockQty || 0), Tuketim: String(item.qty || 0), Kalan: String(Math.max(0, Number(item.stockQty || 0) - Number(item.qty || 0))), Durum: Number(item.stockQty || 0) <= 10 ? 'Kritik' : 'Normal' })),
    customerBehavior: customerRows.slice(0, 20).map((item) => ({ Musteri: item.name, Ziyaret: String(item.count), Harcama: fmtTl(item.spend), 'Favori Ürün': '-', 'Son İşlem': fmtDate(item.last) }))
  }

  metricValuesByKey.paymentDistribution = Object.fromEntries(paymentMetricEntries.map((item) => [item.label, item.value]))
  rowsByKey.paymentDistribution = paymentDistributionRows.map((row) => ({
    Saat: 'Dönem',
    'Ödeme Tipi': row.label,
    'İşlem Sayisi': String(row.count || summary.orderCount || 0),
    Tutar: fmtTl(row.amount),
    Oran: fmtPct((row.amount / Math.max(1, summary.totalPaid || summary.totalRevenue)) * 100)
  }))

  if (report.key === 'paymentDistribution' && Array.isArray(report.tableColumns) && report.tableColumns.length >= 5) {
    rowsByKey.paymentDistribution = paymentDistributionRows.map((row) => ({
      [report.tableColumns[0]]: 'Dönem',
      [report.tableColumns[1]]: row.label,
      [report.tableColumns[2]]: String(row.count || summary.orderCount || 0),
      [report.tableColumns[3]]: fmtTl(row.amount),
      [report.tableColumns[4]]: fmtPct((row.amount / Math.max(1, summary.totalPaid || summary.totalRevenue)) * 100)
    }))
  }

  return {
    metricEntries: report.key === 'paymentDistribution' ? paymentMetricEntries : null,
    metricValues: metricValuesByKey[report.key] || {},
    rows: rowsByKey[report.key] || []
  }
}

export default function ReportsPage() {
  const { allowedBranchIds } = useAuth()
  const { isMobilePortrait } = useResponsiveFlags()
  const allowedIds = useMemo(() => normalizeBranchIds(allowedBranchIds), [allowedBranchIds])
  const [period, setPeriod] = useState('today')
  const [rangeStart, setRangeStart] = useState(todayYmd())
  const [rangeEnd, setRangeEnd] = useState(todayYmd())
  const [selectedBranches, setSelectedBranches] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [rangeLabel, setRangeLabel] = useState(formatRangeLabel())
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [datasets, setDatasets] = useState(EMPTY_DATASETS)

  const selectedKey = selectedBranches.join(',')
  const detailData = useMemo(() => selectedReport ? buildReportDetailData(selectedReport, datasets, summary) : null, [selectedReport, datasets, summary])
  const branchesLabel = useMemo(() => {
    if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) return '-'
    const names = selectedBranches
      .map((id) => branchOptions.find((branch) => branch.id === id)?.name || 'Aktif Şube')
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : '-'
  }, [branchOptions, selectedBranches])
  const hourlyReport = useMemo(() => reportDefinitions.find((report) => report.key === 'hourlyDensity') || null, [])
  const paymentReport = useMemo(() => reportDefinitions.find((report) => report.key === 'paymentDistribution') || null, [])
  const topSellersReport = useMemo(() => reportDefinitions.find((report) => report.key === 'productPerformance') || null, [])
  const categoryRevenueReport = useMemo(() => reportDefinitions.find((report) => report.key === 'categoryRevenue') || null, [])

  useEffect(() => {
    if (allowedIds.length > 0 && selectedBranches.length === 0) {
      setSelectedBranches(allowedIds)
    }
  }, [allowedIds.join(','), selectedBranches.length])

  useEffect(() => {
    const loadBranches = async () => {
      if (allowedIds.length <= 1) {
        setBranchOptions(allowedIds.map((id) => ({ id, name: 'Aktif Şube' })))
        return
      }
      const res = await api('/api/branches', { silent: true })
      const list = Array.isArray(res?.branches) ? res.branches : []
      const mapped = list
        .map((branch) => ({ id: String(branch._id || branch.id || ''), name: String(branch.name || '') }))
        .filter((branch) => branch.id && allowedIds.includes(branch.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      setBranchOptions(mapped)
    }
    loadBranches()
  }, [allowedIds.join(',')])

  useEffect(() => {
    const load = async () => {
      if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) {
        setError('Şube seciniz')
        setSummary(EMPTY_SUMMARY)
        setDatasets(EMPTY_DATASETS)
        return
      }

      const { params } = buildBranchQueryParams(selectedBranches)
      if (!params) {
        setError('Şube seciniz')
        return
      }

      const range = period === 'range'
        ? { period: 'range', start: rangeStart, end: rangeEnd }
        : buildDateRange(period)
      if (period === 'range' && rangeStart && rangeEnd && rangeStart > rangeEnd) {
        setError('Baslangic tarihi bitis tarihinden buyuk olamaz')
        setSummary(EMPTY_SUMMARY)
        setDatasets(EMPTY_DATASETS)
        return
      }
      const reportParams = new URLSearchParams(params)
      reportParams.set('period', range.period)
      if (range.start) reportParams.set('start', range.start)
      if (range.end) reportParams.set('end', range.end)

      const deliveryParams = new URLSearchParams(params)
      deliveryParams.set('status', 'active')
      deliveryParams.set('limit', '50')
      deliveryParams.set('page', '1')

      const courierReportParams = new URLSearchParams(params)
      if (range.start) courierReportParams.set('startDate', range.start)
      if (range.end) courierReportParams.set('endDate', range.end)

      setLoading(true)
      setError('')

      try {
        const results = await Promise.allSettled([
          api(`/api/reports/dashboard?${reportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/reports/products?${reportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/reports/orders?${reportParams.toString()}&status=closed`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/accounts?limit=50', { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/pos/delivery/orders?${deliveryParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/pos/courier-report?${courierReportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/kitchen/orders?${params.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/tenant/menu-items?active=true', { silent: true }),
          api('/api/tenant/categories?active=true', { silent: true })
        ])

        const dashboardRes = results[0].status === 'fulfilled' ? results[0].value : null
        const productsRes = results[1].status === 'fulfilled' ? results[1].value : null
        const ordersRes = results[2].status === 'fulfilled' ? results[2].value : null
        const accountsRes = results[3].status === 'fulfilled' ? results[3].value : null
        const deliveryRes = results[4].status === 'fulfilled' ? results[4].value : null
        const courierReportRes = results[5].status === 'fulfilled' ? results[5].value : null
        const kitchenRes = results[6].status === 'fulfilled' ? results[6].value : null
        const menuItemsRes = results[7].status === 'fulfilled' ? results[7].value : null
        const categoriesRes = results[8].status === 'fulfilled' ? results[8].value : null

        if (!dashboardRes?.ok) {
          setError(String(dashboardRes?.message || 'Raporlar yuklenemedi'))
          setSummary(EMPTY_SUMMARY)
          setDatasets(EMPTY_DATASETS)
          setLoading(false)
          return
        }

        const nextDatasets = {
          dashboard: dashboardRes,
          products: safeArray(productsRes?.items),
          cancelledProducts: safeArray(productsRes?.cancelledItems),
          orders: safeArray(ordersRes?.orders),
          accounts: safeArray(accountsRes?.accounts),
          deliveryOrders: safeArray(deliveryRes?.orders),
          courierReportRows: safeArray(courierReportRes?.rows),
          kitchenOrders: safeArray(kitchenRes?.orders),
          menuItems: safeArray(menuItemsRes?.items),
          categories: safeArray(categoriesRes?.categories)
        }

        setDatasets(nextDatasets)
        setSummary(buildSummary(nextDatasets))
        setRangeLabel(formatRangeLabel(dashboardRes?.range))
      } catch (err) {
        setError(String(err?.message || 'Raporlar yuklenemedi'))
        setSummary(EMPTY_SUMMARY)
        setDatasets(EMPTY_DATASETS)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [period, rangeStart, rangeEnd, selectedKey])

  useEffect(() => {
    const onExport = async () => {
      if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) return

      const { params } = buildBranchQueryParams(selectedBranches)
      if (!params) return

      const range = period === 'range'
        ? { period: 'range', start: rangeStart, end: rangeEnd }
        : buildDateRange(period)

      const exportParams = new URLSearchParams(params)
      exportParams.set('period', range.period)
      if (range.start) exportParams.set('start', range.start)
      if (range.end) exportParams.set('end', range.end)

      setExporting(true)
      try {
        const res = await apiDownload(`/api/reports/export?${exportParams.toString()}`, {
          silent: true,
          skipBranchHeader: true,
          suppressBranchModal: true
        })
        if (!res?.ok || !res?.blob) return
        downloadBlob(res.blob, res.filename || 'rapor.xlsx')
      } finally {
        setExporting(false)
      }
    }

    window.addEventListener('reports:export-request', onExport)
    return () => window.removeEventListener('reports:export-request', onExport)
  }, [period, rangeStart, rangeEnd, selectedKey])

  return (
    <div className="reports-page" style={{ position: 'relative', display: 'grid', gap: 20 }}>
      <ReportFilter
        period={period}
        setPeriod={setPeriod}
        rangeLabel={rangeLabel}
        rangeStart={rangeStart}
        setRangeStart={setRangeStart}
        rangeEnd={rangeEnd}
        setRangeEnd={setRangeEnd}
        branchOptions={branchOptions}
        selectedBranches={selectedBranches}
        setSelectedBranches={setSelectedBranches}
      />
      {error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#7f1d1d' }}>{error}</div>}
      <ReportSummaryCards summary={summary} datasets={datasets} isMobilePortrait={isMobilePortrait} />
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: isMobilePortrait ? '1fr' : 'minmax(0, 1.2fr) minmax(0, 0.8fr)' }}>
        <MainRevenuePanel
          datasets={datasets}
          period={period}
          setPeriod={setPeriod}
          showModeToggle={false}
          headerAction={hourlyReport ? <button className="btn button-light" type="button" onClick={() => setSelectedReport(hourlyReport)}>Detay</button> : null}
        />
        <PaymentOverviewPanel
          datasets={datasets}
          summary={summary}
          headerAction={paymentReport ? <button className="btn button-light" type="button" onClick={() => setSelectedReport(paymentReport)}>Detay</button> : null}
        />
      </div>
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: isMobilePortrait ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <TopSellersPanel
          datasets={datasets}
          headerAction={topSellersReport ? <button className="btn button-light" type="button" onClick={() => setSelectedReport(topSellersReport)}>Detay</button> : null}
        />
        <CategoryRevenuePanel
          datasets={datasets}
          summary={summary}
          headerAction={categoryRevenueReport ? <button className="btn button-light" type="button" onClick={() => setSelectedReport(categoryRevenueReport)}>Detay</button> : null}
        />
      </div>
      <ReportCatalog onSelect={setSelectedReport} isMobilePortrait={isMobilePortrait} />
      {(loading || exporting) && <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>{exporting ? 'Rapor dosyasi hazırlanıyor...' : 'Rapor verileri sistemden yükleniyor...'}</div>}
      {selectedReport && <ReportDetail report={selectedReport} onClose={() => setSelectedReport(null)} detailData={detailData} isMobilePortrait={isMobilePortrait} rangeLabel={rangeLabel} branchesLabel={branchesLabel} />}
    </div>
  )
}
