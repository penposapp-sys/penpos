import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams, normalizeBranchIds } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import BranchFilterCard from '../components/BranchFilterCard.jsx'

const CARD_STYLE = {
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  background: '#ffffff',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)'
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

const EMPTY_SUMMARY = {
  totalRevenue: 0,
  totalPaid: 0,
  averageOrder: 0,
  cancelRate: 0,
  orderCount: 0
}

const EMPTY_DATASETS = {
  dashboard: null,
  products: [],
  cancelledProducts: [],
  orders: [],
  accounts: [],
  deliveryOrders: [],
  kitchenOrders: [],
  menuItems: [],
  categories: []
}

const todayYmd = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const reportDefinitions = [
  { key: 'salesSummary', title: 'Satis Ozeti', icon: '₺', description: 'Ciro, tahsilat, siparis adedi ve ortalama sepet.', detailTitle: 'Detayli Satis Ozeti Raporu', metrics: ['Toplam Ciro', 'Net Satis', 'Toplam Tahsilat', 'Ortalama Sepet'], tableColumns: ['Tarih', 'Siparis', 'Brut Satis', 'Iptal', 'Net Satis', 'Tahsilat'] },
  { key: 'paymentDistribution', title: 'Odeme Dagilimi', icon: '💳', description: 'Nakit, kart, online odeme ve acik hesap dagilimi.', detailTitle: 'Detayli Odeme Dagilimi Raporu', metrics: ['Nakit', 'Kredi Karti', 'Online', 'Acik Hesap'], tableColumns: ['Saat', 'Odeme Tipi', 'Islem Sayisi', 'Tutar', 'Oran'] },
  { key: 'productPerformance', title: 'Urun Performansi', icon: '🍽', description: 'En cok satan urunler, adet, ciro ve karlilik.', detailTitle: 'Detayli Urun Performansi Raporu', metrics: ['Satilan Urun', 'Toplam Adet', 'Urun Cirosu', 'Kar Orani'], tableColumns: ['Urun', 'Kategori', 'Adet', 'Birim Fiyat', 'Ciro', 'Kar'] },
  { key: 'categoryRevenue', title: 'Kategori Cirosu', icon: '🧾', description: 'Kategori bazli satis ve ciro karsilastirmasi.', detailTitle: 'Detayli Kategori Cirosu Raporu', metrics: ['Kategori Sayisi', 'En Yuksek Kategori', 'Toplam Ciro', 'Pay Orani'], tableColumns: ['Kategori', 'Urun Adedi', 'Satis Adedi', 'Ciro', 'Oran'] },
  { key: 'hourlyDensity', title: 'Saatlik Yogunluk', icon: '⏱', description: 'Gunun saatlerine gore siparis ve ciro yogunlugu.', detailTitle: 'Detayli Saatlik Yogunluk Raporu', metrics: ['Yogun Saat', 'Siparis Adedi', 'Saatlik Ciro', 'Ortalama Sepet'], tableColumns: ['Saat', 'Siparis', 'Masa', 'Paket', 'Ciro'] },
  { key: 'waiterPerformance', title: 'Garson Performansi', icon: '🧑', description: 'Garson bazli siparis, masa, tahsilat ve servis hizi.', detailTitle: 'Detayli Garson Performans Raporu', metrics: ['Garson', 'Masa Sayisi', 'Satis', 'Servis Suresi'], tableColumns: ['Garson', 'Masa', 'Siparis', 'Ciro', 'Ortalama Sure'] },
  { key: 'tableTurnover', title: 'Masa Devir Hizi', icon: '🪑', description: 'Masalarin doluluk suresi, kapanis hizi ve kullanim orani.', detailTitle: 'Detayli Masa Devir Hizi Raporu', metrics: ['Aktif Masa', 'Ortalama Sure', 'Kapanan Masa', 'Doluluk Orani'], tableColumns: ['Masa', 'Acilis', 'Kapanis', 'Sure', 'Tutar'] },
  { key: 'openAccount', title: 'Acik Hesap / Cari', icon: '📒', description: 'Cari musteriler, acik bakiye ve odeme gecmisi.', detailTitle: 'Detayli Acik Hesap ve Cari Raporu', metrics: ['Acik Bakiye', 'Cari Sayisi', 'Tahsil Edilen', 'Geciken'], tableColumns: ['Cari', 'Son Islem', 'Borc', 'Tahsilat', 'Kalan'] },
  { key: 'cancelWaste', title: 'Iptal / Fire', icon: '⚠', description: 'Iptal edilen urunler, fire nedenleri ve kayip tutar.', detailTitle: 'Detayli Iptal ve Fire Raporu', metrics: ['Iptal Tutari', 'Fire Tutari', 'Iptal Adedi', 'Kayip Orani'], tableColumns: ['Saat', 'Urun', 'Adet', 'Neden', 'Tutar', 'Personel'] },
  { key: 'discounts', title: 'Indirimler', icon: '🏷', description: 'Uygulanan indirimler, kampanyalar ve yetkili kullanici.', detailTitle: 'Detayli Indirim Raporu', metrics: ['Indirim Tutari', 'Indirim Adedi', 'Ortalama Indirim', 'Yetkili'], tableColumns: ['Saat', 'Masa/Siparis', 'Indirim', 'Sebep', 'Yetkili'] },
  { key: 'kitchenPrepTime', title: 'Mutfak Hazirlama Suresi', icon: '🔥', description: 'Urunlerin hazirlanma suresi ve geciken siparisler.', detailTitle: 'Detayli Mutfak Hazirlama Suresi Raporu', metrics: ['Ortalama Sure', 'Geciken Siparis', 'Hazirlanan', 'Bekleyen'], tableColumns: ['Siparis', 'Urun', 'Baslangic', 'Hazir', 'Sure'] },
  { key: 'deliveryPerformance', title: 'Paket Servis Performansi', icon: '🛵', description: 'Paket siparis, kurye, teslimat suresi ve durum analizi.', detailTitle: 'Detayli Paket Servis Performans Raporu', metrics: ['Paket Sayisi', 'Yolda', 'Teslim', 'Ortalama Teslimat'], tableColumns: ['Siparis', 'Musteri', 'Kurye', 'Durum', 'Sure', 'Tutar'] },
  { key: 'taxVat', title: 'KDV / Vergi', icon: '🏛', description: 'KDV oranlari, vergi matrahi ve toplam vergi.', detailTitle: 'Detayli KDV ve Vergi Raporu', metrics: ['Matrah', 'KDV', 'Toplam', 'Fis Sayisi'], tableColumns: ['Tarih', 'KDV Orani', 'Matrah', 'KDV', 'Toplam'] },
  { key: 'cashierShift', title: 'Kasa / Vardiya', icon: '🧮', description: 'Vardiya acilis-kapanis, kasa farki ve tahsilat.', detailTitle: 'Detayli Kasa ve Vardiya Raporu', metrics: ['Acilis', 'Kapanis', 'Kasa Farki', 'Tahsilat'], tableColumns: ['Vardiya', 'Kullanici', 'Acilis', 'Kapanis', 'Fark'] },
  { key: 'stockConsumption', title: 'Stok Tuketim', icon: '📦', description: 'Satisa gore dusen stok, kritik stok ve tuketim.', detailTitle: 'Detayli Stok Tuketim Raporu', metrics: ['Tuketilen', 'Kritik Stok', 'Stok Degeri', 'Eksik Urun'], tableColumns: ['Urun', 'Baslangic', 'Tuketim', 'Kalan', 'Durum'] },
  { key: 'customerBehavior', title: 'Musteri Davranisi', icon: '👥', description: 'Tekrar gelen musteri, ortalama harcama ve tercih analizi.', detailTitle: 'Detayli Musteri Davranisi Raporu', metrics: ['Musteri', 'Tekrar Orani', 'Ortalama Harcama', 'Favori Urun'], tableColumns: ['Musteri', 'Ziyaret', 'Harcama', 'Favori Urun', 'Son Islem'] }
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

const buildHourlyCustomerBars = (datasets) => {
  const fromDashboard = safeArray(datasets.dashboard?.customers?.hourly)
    .map((item, index) => ({
      label: String(item?.hour || `${String(index).padStart(2, '0')}:00`).slice(0, 5),
      value: Number(item?.count || 0)
    }))
    .filter((item) => item.label)

  if (fromDashboard.length > 0 && fromDashboard.some((item) => item.value > 0)) return fromDashboard

  const bucket = new Map(Array.from({ length: 24 }).map((_, hour) => [`${String(hour).padStart(2, '0')}:00`, 0]))
  safeArray(datasets.orders).forEach((order) => {
    const raw = order?.closedAt || order?.createdAt
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return
    const key = `${String(date.getHours()).padStart(2, '0')}:00`
    bucket.set(key, (bucket.get(key) || 0) + 1)
  })

  return Array.from(bucket.entries()).map(([label, value]) => ({ label, value }))
}

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
    <div style={{ ...CARD_STYLE, padding: 20, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{title}</div>
        <span style={{ background: colors.bg, color: colors.fg, borderRadius: 999, padding: '6px 10px', fontSize: 11, fontWeight: 900 }}>{trend}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{note}</div>
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
              <button key={tab.key} type="button" className="btn" onClick={() => setPeriod(tab.key)} style={{ background: active ? '#e2e8f0' : '#f8fafc', borderColor: active ? '#cbd5e1' : '#e2e8f0', fontWeight: active ? 900 : 600, padding: '10px 16px' }}>
                {tab.label}
              </button>
            )
          })}
          <BranchFilterCard
            branchOptions={branchOptions}
            selectedBranches={selectedBranches}
            setSelectedBranches={setSelectedBranches}
            title="Sube Sec"
            compact
          />
        </div>
        <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{rangeLabel}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {period === 'range' && (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Baslangic</span>
              <input type="date" className="input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Bitis</span>
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
      <KpiCard title="Toplam Ciro" value={fmtTl(summary.totalRevenue)} note="Secili tarih" trend="+0%" tone="green" />
      <KpiCard title="Toplam Siparis" value={String(summary.orderCount)} note="Adet" trend="+0%" tone="blue" />
      <KpiCard title="Ortalama Siparis" value={fmtTl(summary.averageOrder, 0)} note="Sepet" trend="+0%" tone="orange" />
      <KpiCard title="Iptal Orani" value={fmtPct(summary.cancelRate)} note="Gercek veri" trend="+0%" tone="red" />
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
            Isletmenin tum performansini tek ekranda analiz et.
          </h1>
          <p style={{ margin: '10px 0 0', maxWidth: 720, fontSize: 14, color: 'rgba(255,255,255,0.64)', lineHeight: 1.6 }}>
            Satis, odeme, urun, garson, masa, stok ve mutfak performansini ayri raporlar halinde inceleyebilirsin.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, minWidth: 260 }}>
          <button type="button" className="btn" style={{ borderRadius: 18, background: '#ffffff', color: '#020617', padding: '14px 18px', fontWeight: 900 }}>
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
      <KpiCard title="Net Satis" value={fmtTl(netSales, 0)} note="Secili donem" trend="+0%" tone="green" />
      <KpiCard title="Siparis" value={String(summary.orderCount)} note="Toplam adet" trend="+0" tone="blue" />
      <KpiCard title="Ortalama Sepet" value={fmtTl(summary.averageOrder, 0)} note="Siparis basi" trend="+0%" tone="orange" />
      <KpiCard title="Fire Orani" value={fmtPct(fireRate)} note="Gercek veri" trend="+0%" tone="red" />
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

function MainRevenuePanel({ datasets, period, setPeriod }) {
  const chartMode = period === 'week' ? 'week' : 'day'
  const bars = chartMode === 'week'
    ? buildWeeklyCustomerBars(datasets)
    : buildHourlyCustomerBars(datasets)
  const max = bars.reduce((best, item) => Math.max(best, item.value), 0) || 1

  return (
    <div style={{ ...CARD_STYLE, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Saatlik Musteri Analizi</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {chartMode === 'week' ? 'Hafta icinde musteri hareketi ve yogunluk.' : 'Gun icinde musteri hareketi ve yogunluk.'}
          </p>
        </div>
        <div style={{ borderRadius: 18, background: '#f1f5f9', padding: 4, display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setPeriod('today')}
            style={{
              borderRadius: 12,
              background: chartMode === 'day' ? '#ffffff' : 'transparent',
              borderColor: chartMode === 'day' ? '#cbd5e1' : 'transparent',
              color: chartMode === 'day' ? '#020617' : '#94a3b8',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 900
            }}
          >
            Gunluk
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPeriod('week')}
            style={{
              borderRadius: 12,
              background: chartMode === 'week' ? '#ffffff' : 'transparent',
              borderColor: chartMode === 'week' ? '#cbd5e1' : 'transparent',
              color: chartMode === 'week' ? '#020617' : '#94a3b8',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 900
            }}
          >
            Haftalik
          </button>
        </div>
      </div>

      <div style={{ marginTop: 28, display: 'flex', height: 230, alignItems: 'flex-end', gap: 10 }}>
        {bars.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>Musteri verisi bulunamadi.</div>
        ) : bars.map((bar) => (
          <div key={bar.label} style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div title={`${bar.label}: ${bar.value} musteri`} style={{ width: '100%', height: `${Math.max(18, Math.round((bar.value / max) * 100))}%`, borderTopLeftRadius: 18, borderTopRightRadius: 18, background: 'rgba(79, 70, 229, 0.82)' }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentOverviewPanel({ datasets, summary }) {
  const rows = [
    ['Nakit', toMoney(datasets.dashboard?.sales?.byMethod?.cash || 0)],
    ['Kredi Karti', toMoney(datasets.dashboard?.sales?.byMethod?.pos || 0)],
    ['Acik Hesap', toMoney(datasets.dashboard?.sales?.byMethod?.account || 0)]
  ]
  return (
    <div style={{ ...CARD_STYLE, padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Odeme Ozeti</h2>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Tahsilat kanallarina gore dagilim.</p>

      <div style={{ marginTop: 24, display: 'grid', gap: 18 }}>
        {rows.map(([label, amount]) => {
          const ratio = summary.totalRevenue > 0 ? Math.min(100, Math.round((amount / summary.totalRevenue) * 100)) : 0
          return (
            <div key={label}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                <b>{label}</b>
                <span style={{ fontWeight: 900 }}>{fmtTl(amount, 0)}</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: '#f1f5f9' }}>
                <div style={{ width: `${ratio}%`, height: 12, borderRadius: 999, background: '#020617' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopSellersPanel({ datasets }) {
  const rows = safeArray(datasets.products).slice(0, 6)
  return (
    <div style={{ ...CARD_STYLE, padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>En Cok Satanlar</h2>
      <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
        {rows.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>Satis verisi bulunamadi.</div>
        ) : rows.map((item, index) => (
          <div key={`${item.menuItemId || item.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 18, background: '#f8fafc', padding: '14px 16px' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{`${index + 1}. ${String(item.name || '-').toUpperCase('tr-TR')}`}</div>
            <div style={{ fontSize: 16 }}>{`${Number(item.qty || 0)} adet`}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryRevenuePanel({ datasets, summary }) {
  const rows = buildCategoryRevenueRows(datasets).slice(0, 5)
  const max = rows.reduce((best, item) => Math.max(best, item.revenue), 0) || 1
  return (
    <div style={{ ...CARD_STYLE, padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Kategori Cirosu</h2>
      <div style={{ marginTop: 22, display: 'grid', gap: 18 }}>
        {rows.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>Kategori bazli veri bulunamadi.</div>
        ) : rows.map((item) => (
          <div key={item.name}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
              <b>{item.name}</b>
              <span>{fmtTl(item.revenue, 0)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: '#eef2ff' }}>
              <div style={{ width: `${Math.max(8, Math.round((item.revenue / max) * 100))}%`, height: 8, borderRadius: 999, background: '#3b5eea' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportCard({ report, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...CARD_STYLE, padding: 20, textAlign: 'left', cursor: 'pointer', transition: 'transform 160ms ease, box-shadow 160ms ease', minHeight: 250 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'grid', height: 48, width: 48, placeItems: 'center', borderRadius: 18, background: '#f1f5f9', fontSize: 22 }}>
          {report.icon}
        </div>

        <span style={{ borderRadius: 999, background: '#f1f5f9', padding: '6px 12px', fontSize: 11, fontWeight: 900, color: '#64748b' }}>
          Rapor
        </span>
      </div>

      <div style={{ marginTop: 18, fontSize: 20, fontWeight: 900 }}>
        {report.title}
      </div>

      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: '#64748b' }}>
        {report.description}
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8' }}>
          Icerdigi metrikler
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 62, alignContent: 'flex-start' }}>
          {report.metrics.slice(0, 4).map((metric) => (
            <span
              key={metric}
              style={{ borderRadius: 999, background: '#f1f5f9', padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#475569' }}
            >
              {metric}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
          Detay icin ac
        </span>

        <span style={{ borderRadius: 12, background: '#020617', padding: '10px 14px', fontSize: 11, fontWeight: 900, color: '#ffffff' }}>
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
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Rapor Kutuphanesi</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Ozet panellerin altindan detay raporlara gecis yap.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {reportDefinitions.map((report) => (
          <ReportCard
            key={report.key}
            report={report}
            onClick={() => onSelect(report)}
          />
        ))}
      </div>
    </section>
  )
}

function ReportDetail({ report, onClose, detailData, isMobilePortrait }) {
  const metricGrid = isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(2, 6, 23, 0.4)', backdropFilter: 'blur(6px)', padding: 24 }}>
      <div style={{ height: '100%', overflow: 'auto', borderRadius: 32, background: '#ffffff', padding: 24, boxShadow: '0 25px 50px rgba(15, 23, 42, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>{report.detailTitle}</h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>{report.description}</p>
          </div>
          <button type="button" className="btn" onClick={onClose} style={{ background: '#f1f5f9', fontWeight: 900 }}>Kapat</button>
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: metricGrid, gap: 12 }}>
          {report.metrics.map((metric) => (
            <div key={metric} style={{ borderRadius: 18, background: '#f8fafc', padding: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{metric}</div>
              <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900 }}>{detailData.metricValues[metric] ?? 'Veri yok'}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {report.tableColumns.map((col) => <th key={col} style={{ padding: '14px 16px', fontWeight: 900, textAlign: 'left' }}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {detailData.rows.length === 0 ? (
                <tr>
                  <td colSpan={report.tableColumns.length} style={{ padding: '18px 16px', color: '#64748b' }}>Bu rapor icin sistemde uygun veri bulunamadi.</td>
                </tr>
              ) : detailData.rows.map((row, rowIndex) => (
                <tr key={`${report.key}-${rowIndex}`}>
                  {report.tableColumns.map((col) => <td key={col} style={{ padding: '14px 16px', color: '#475569' }}>{row[col] ?? '-'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const buildCategoryMaps = (datasets) => {
  const categoryNameById = new Map(safeArray(datasets.categories).map((c) => [String(c.id || c._id || ''), String(c.name || '-')]))
  const menuById = new Map(safeArray(datasets.menuItems).map((item) => [String(item.id || item._id || ''), item]))
  return { categoryNameById, menuById }
}

const buildSummary = (datasets) => {
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

const buildReportDetailData = (report, datasets, summary) => {
  const dashboard = datasets.dashboard || {}
  const sales = dashboard.sales || {}
  const cancelled = dashboard.cancelled || {}
  const hourly = safeArray(dashboard.customers?.hourly)
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
    return {
      ...item,
      categoryName: categoryNameById.get(categoryId) || '-',
      price: Number(item.qty || 0) > 0 ? toMoney(item.revenue || 0) / Number(item.qty || 1) : 0,
      vatRate: Number(meta.vatRate || 0),
      stockQty: Number(meta.stockQty || 0),
      stockTrackingEnabled: meta.stockTrackingEnabled === true
    }
  })

  const hourlyPeak = hourly.reduce((best, item) => Number(item?.count || 0) > Number(best?.count || 0) ? item : best, hourly[0] || { hour: '-', count: 0 })
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

  const metricValuesByKey = {
    salesSummary: {
      'Toplam Ciro': fmtTl(summary.totalRevenue),
      'Net Satis': fmtTl(summary.totalRevenue - toMoney(cancelled.totalRevenue || 0)),
      'Toplam Tahsilat': fmtTl(summary.totalPaid),
      'Ortalama Sepet': fmtTl(summary.averageOrder, 0)
    },
    paymentDistribution: {
      Nakit: fmtTl(sales.byMethod?.cash || 0),
      'Kredi Karti': fmtTl(sales.byMethod?.pos || 0),
      Online: fmtTl((sales.byMethod?.bank || 0) + 0),
      'Acik Hesap': fmtTl(sales.byMethod?.account || 0)
    },
    productPerformance: {
      'Satilan Urun': String(productWithMeta.length),
      'Toplam Adet': String(productWithMeta.reduce((sum, item) => sum + Number(item.qty || 0), 0)),
      'Urun Cirosu': fmtTl(productWithMeta.reduce((sum, item) => sum + toMoney(item.revenue || 0), 0)),
      'Kar Orani': 'Veri yok'
    },
    categoryRevenue: {
      'Kategori Sayisi': String(categoryRows.length),
      'En Yuksek Kategori': categoryRows[0]?.category || 'Veri yok',
      'Toplam Ciro': fmtTl(summary.totalRevenue),
      'Pay Orani': categoryRows[0] ? fmtPct((categoryRows[0].revenue / Math.max(1, summary.totalRevenue)) * 100) : 'Veri yok'
    },
    hourlyDensity: {
      'Yogun Saat': String(hourlyPeak?.hour || 'Veri yok'),
      'Siparis Adedi': String(hourlyPeak?.count || 0),
      'Saatlik Ciro': fmtTl(summary.averageOrder * Number(hourlyPeak?.count || 0)),
      'Ortalama Sepet': fmtTl(summary.averageOrder, 0)
    },
    waiterPerformance: {
      Garson: 'Sistem verisi yok',
      'Masa Sayisi': String(activeTables),
      Satis: fmtTl(summary.totalRevenue),
      'Servis Suresi': 'Sistem verisi yok'
    },
    tableTurnover: {
      'Aktif Masa': String(activeTables),
      'Ortalama Sure': avgTableMinutes > 0 ? `${Math.round(avgTableMinutes)} dk` : 'Veri yok',
      'Kapanan Masa': String(activeTables),
      'Doluluk Orani': activeTables > 0 ? fmtPct(100) : 'Veri yok'
    },
    openAccount: {
      'Acik Bakiye': fmtTl(accounts.reduce((sum, item) => sum + toMoney(item.balance || 0), 0)),
      'Cari Sayisi': String(accounts.length),
      'Tahsil Edilen': fmtTl(summary.totalPaid),
      Geciken: String(accounts.filter((item) => toMoney(item.balance || 0) > 0).length)
    },
    cancelWaste: {
      'Iptal Tutari': fmtTl(cancelled.totalRevenue || 0),
      'Fire Tutari': fmtTl(cancelled.totalRevenue || 0),
      'Iptal Adedi': String(cancelled.totalQty || 0),
      'Kayip Orani': fmtPct(summary.cancelRate)
    },
    discounts: {
      'Indirim Tutari': fmtTl(discountOrders.reduce((sum, order) => sum + toMoney(order.discountValue || 0), 0)),
      'Indirim Adedi': String(discountOrders.length),
      'Ortalama Indirim': fmtTl(discountOrders.length > 0 ? discountOrders.reduce((sum, order) => sum + toMoney(order.discountValue || 0), 0) / discountOrders.length : 0),
      Yetkili: 'Sistem verisi yok'
    },
    kitchenPrepTime: {
      'Ortalama Sure': 'Sistem verisi yok',
      'Geciken Siparis': String(kitchenOrders.filter((item) => safeArray(item.items).length > 5).length),
      Hazirlanan: String(kitchenOrders.filter((item) => String(item.status || '') === 'completed').length),
      Bekleyen: String(kitchenOrders.filter((item) => String(item.status || '') !== 'completed').length)
    },
    deliveryPerformance: {
      'Paket Sayisi': String(deliveryOrders.length),
      Yolda: String(deliveryOrders.filter((item) => String(item.deliveryStatus || '').includes('yolda')).length),
      Teslim: String(deliveryOrders.filter((item) => String(item.deliveryStatus || item.status || '').includes('delivered')).length),
      'Ortalama Teslimat': 'Sistem verisi yok'
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
      'Stok Degeri': fmtTl(productWithMeta.reduce((sum, item) => sum + (Number(item.stockQty || 0) * toMoney(item.price || 0)), 0)),
      'Eksik Urun': String(productWithMeta.filter((item) => item.stockTrackingEnabled && Number(item.stockQty || 0) <= 0).length)
    },
    customerBehavior: {
      Musteri: topCustomer?.name || 'Veri yok',
      'Tekrar Orani': customerRows.length > 0 ? fmtPct((customerRows.filter((item) => item.count > 1).length / customerRows.length) * 100) : 'Veri yok',
      'Ortalama Harcama': fmtTl(topCustomer?.spend && topCustomer?.count ? topCustomer.spend / topCustomer.count : 0),
      'Favori Urun': productWithMeta[0]?.name || 'Veri yok'
    }
  }

  const rowsByKey = {
    salesSummary: orders.slice(0, 12).map((order) => ({ Tarih: fmtDate(order.closedAt), Siparis: order.orderNo ? `Siparis ${order.orderNo}` : `#${String(order.id || '').slice(-6)}`, 'Brut Satis': fmtTl(order.totals?.grandTotal || order.netTotal || 0), Iptal: fmtTl(Math.max(0, toMoney(order.totals?.grandTotal || order.netTotal || 0) - toMoney(order.netTotal || 0))), 'Net Satis': fmtTl(order.netTotal || 0), Tahsilat: fmtTl(order.paidTotal || 0) })),
    paymentDistribution: [
      { Saat: 'Donem', 'Odeme Tipi': 'Nakit', 'Islem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.cash || 0), Oran: fmtPct((toMoney(sales.byMethod?.cash || 0) / Math.max(1, summary.totalRevenue)) * 100) },
      { Saat: 'Donem', 'Odeme Tipi': 'Kredi Karti', 'Islem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.pos || 0), Oran: fmtPct((toMoney(sales.byMethod?.pos || 0) / Math.max(1, summary.totalRevenue)) * 100) },
      { Saat: 'Donem', 'Odeme Tipi': 'Online', 'Islem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.bank || 0), Oran: fmtPct((toMoney(sales.byMethod?.bank || 0) / Math.max(1, summary.totalRevenue)) * 100) },
      { Saat: 'Donem', 'Odeme Tipi': 'Acik Hesap', 'Islem Sayisi': String(summary.orderCount), Tutar: fmtTl(sales.byMethod?.account || 0), Oran: fmtPct((toMoney(sales.byMethod?.account || 0) / Math.max(1, summary.totalRevenue)) * 100) }
    ].filter((row) => toMoney(String(row.Tutar).replace(/[^\d,.-]/g, '').replace(',', '.')) >= 0),
    productPerformance: productWithMeta.slice(0, 20).map((item) => ({ Urun: item.name || '-', Kategori: item.categoryName || '-', Adet: String(item.qty || 0), 'Birim Fiyat': fmtTl(item.price || 0), Ciro: fmtTl(item.revenue || 0), Kar: '-' })),
    categoryRevenue: categoryRows.slice(0, 20).map((item) => ({ Kategori: item.category, 'Urun Adedi': String(item.itemCount), 'Satis Adedi': String(item.qty), Ciro: fmtTl(item.revenue), Oran: fmtPct((item.revenue / Math.max(1, summary.totalRevenue)) * 100) })),
    hourlyDensity: hourly.map((item) => ({ Saat: item.hour, Siparis: String(item.count || 0), Masa: '-', Paket: '-', Ciro: fmtTl((summary.averageOrder || 0) * Number(item.count || 0)) })),
    waiterPerformance: [],
    tableTurnover: orders.filter((order) => String(order.tableName || '').trim()).slice(0, 20).map((order) => ({ Masa: order.tableName || '-', Acilis: fmtTime(order.createdAt), Kapanis: fmtTime(order.closedAt), Sure: formatDurationMinutes(order.createdAt, order.closedAt), Tutar: fmtTl(order.netTotal || 0) })),
    openAccount: accounts.slice(0, 20).map((account) => ({ Cari: account.name || '-', 'Son Islem': fmtDate(account.createdAt), Borc: fmtTl(account.balance || 0), Tahsilat: fmtTl(0), Kalan: fmtTl(account.balance || 0) })),
    cancelWaste: cancelledProducts.slice(0, 20).map((item) => ({ Saat: '-', Urun: item.name || '-', Adet: String(item.qty || 0), Neden: '-', Tutar: fmtTl(item.revenue || 0), Personel: '-' })),
    discounts: discountOrders.slice(0, 20).map((order) => ({ Saat: fmtTime(order.closedAt), 'Masa/Siparis': order.tableName || (order.orderNo ? `Siparis ${order.orderNo}` : '-'), Indirim: fmtTl(order.discountValue || 0), Sebep: '-', Yetkili: '-' })),
    kitchenPrepTime: kitchenOrders.slice(0, 20).map((order) => ({ Siparis: order.tableName || order.customerName || order.id || '-', Urun: String(safeArray(order.items).length), Baslangic: fmtTime(order.createdAt), Hazir: order.completedAt ? fmtTime(order.completedAt) : '-', Sure: order.completedAt ? formatDurationMinutes(order.createdAt, order.completedAt) : '-' })),
    deliveryPerformance: deliveryOrders.slice(0, 20).map((order) => ({ Siparis: order.orderNo ? `Siparis ${order.orderNo}` : order.id || '-', Musteri: order.customerName || '-', Kurye: order.courierName || '-', Durum: order.deliveryStatus || order.status || '-', Sure: '-', Tutar: fmtTl(order.netTotal || order.total || 0) })),
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
    }, new Map()).values()).map((item) => ({ Tarih: 'Donem', 'KDV Orani': `%${item.vatRate}`, Matrah: fmtTl(item.base), KDV: fmtTl(item.tax), Toplam: fmtTl(item.total) })),
    cashierShift: [],
    stockConsumption: productWithMeta.filter((item) => item.stockTrackingEnabled).slice(0, 20).map((item) => ({ Urun: item.name || '-', Baslangic: String(item.stockQty || 0), Tuketim: String(item.qty || 0), Kalan: String(Math.max(0, Number(item.stockQty || 0) - Number(item.qty || 0))), Durum: Number(item.stockQty || 0) <= 10 ? 'Kritik' : 'Normal' })),
    customerBehavior: customerRows.slice(0, 20).map((item) => ({ Musteri: item.name, Ziyaret: String(item.count), Harcama: fmtTl(item.spend), 'Favori Urun': '-', 'Son Islem': fmtDate(item.last) }))
  }

  return {
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
  const [error, setError] = useState('')
  const [rangeLabel, setRangeLabel] = useState(formatRangeLabel())
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [datasets, setDatasets] = useState(EMPTY_DATASETS)

  const selectedKey = selectedBranches.join(',')
  const detailData = useMemo(() => selectedReport ? buildReportDetailData(selectedReport, datasets, summary) : null, [selectedReport, datasets, summary])

  useEffect(() => {
    if (allowedIds.length > 0 && selectedBranches.length === 0) {
      setSelectedBranches(allowedIds)
    }
  }, [allowedIds.join(','), selectedBranches.length])

  useEffect(() => {
    const loadBranches = async () => {
      if (allowedIds.length <= 1) {
        setBranchOptions(allowedIds.map((id) => ({ id, name: 'Aktif Sube' })))
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
        setError('Sube seciniz')
        setSummary(EMPTY_SUMMARY)
        setDatasets(EMPTY_DATASETS)
        return
      }

      const { params } = buildBranchQueryParams(selectedBranches)
      if (!params) {
        setError('Sube seciniz')
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

      setLoading(true)
      setError('')

      try {
        const results = await Promise.allSettled([
          api(`/api/reports/dashboard?${reportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/reports/products?${reportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/reports/orders?${reportParams.toString()}&status=closed`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/accounts?limit=50', { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/pos/delivery/orders?${deliveryParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/kitchen/orders?${params.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/tenant/menu-items?active=true', { silent: true }),
          api('/api/tenant/categories?active=true', { silent: true })
        ])

        const dashboardRes = results[0].status === 'fulfilled' ? results[0].value : null
        const productsRes = results[1].status === 'fulfilled' ? results[1].value : null
        const ordersRes = results[2].status === 'fulfilled' ? results[2].value : null
        const accountsRes = results[3].status === 'fulfilled' ? results[3].value : null
        const deliveryRes = results[4].status === 'fulfilled' ? results[4].value : null
        const kitchenRes = results[5].status === 'fulfilled' ? results[5].value : null
        const menuItemsRes = results[6].status === 'fulfilled' ? results[6].value : null
        const categoriesRes = results[7].status === 'fulfilled' ? results[7].value : null

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

  return (
    <div style={{ display: 'grid', gap: 20 }}>
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
        <MainRevenuePanel datasets={datasets} period={period} setPeriod={setPeriod} />
        <PaymentOverviewPanel datasets={datasets} summary={summary} />
      </div>
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: isMobilePortrait ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <TopSellersPanel datasets={datasets} />
        <CategoryRevenuePanel datasets={datasets} summary={summary} />
      </div>
      <ReportCatalog onSelect={setSelectedReport} isMobilePortrait={isMobilePortrait} />
      {loading && <div style={{ color: '#64748b', fontSize: 13 }}>Rapor verileri sistemden yukleniyor...</div>}
      {selectedReport && <ReportDetail report={selectedReport} onClose={() => setSelectedReport(null)} detailData={detailData} isMobilePortrait={isMobilePortrait} />}
    </div>
  )
}
