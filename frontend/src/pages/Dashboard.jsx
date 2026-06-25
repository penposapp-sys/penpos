import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAppDate } from '../context/AppDateContext.jsx'
import { buildBranchQueryParams, normalizeBranchIds } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import BranchFilterCard from '../components/BranchFilterCard.jsx'
import { fetchZReport } from '../features/reports/zReportApi.ts'
import ZReportModal from '../features/reports/ZReportModal.tsx'
import { ReportsSalesContent } from './ReportsSales.jsx'
import {
  reportDefinitions,
  EMPTY_DATASETS as EMPTY_REPORT_DATASETS,
  EMPTY_SUMMARY as EMPTY_REPORT_SUMMARY,
  buildSummary as buildReportsSummary,
  buildReportDetailData,
  buildPaymentBreakdownRows,
  getRowValueByColumn,
  printProductReportDocument,
  MainRevenuePanel,
  PaymentOverviewPanel,
  TopSellersPanel,
  CategoryRevenuePanel
} from './ReportsPage.jsx'

const STATUS_COLORS = {
  green: { fg: '#166534', bg: '#dcfce7', chip: '#22c55e' },
  blue: { fg: '#1d4ed8', bg: '#dbeafe', chip: '#3b82f6' },
  orange: { fg: '#b45309', bg: '#fef3c7', chip: '#f59e0b' },
  red: { fg: '#b91c1c', bg: '#fee2e2', chip: '#ef4444' },
  neutral: { fg: '#334155', bg: '#e2e8f0', chip: '#94a3b8' }
}

const CARD_STYLE = {
  border: '1px solid var(--border)',
  borderRadius: 28,
  background: 'var(--panel)',
  color: 'var(--text)',
  boxShadow: 'var(--card-shadow)'
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
  if (!value) return 'Az önce'
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return 'Az önce'
  const diffMins = Math.max(0, Math.floor((Date.now() - ts) / 60000))
  if (diffMins < 1) return 'Şimdi'
  if (diffMins < 60) return `${diffMins} dk önce`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} sa önce`
  return `${Math.floor(diffHours / 24)} gün önce`
}

const formatDecimal = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0,00'
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SkeletonCard = ({ height = 120 }) => (
  <div className="card" style={{ height, display: 'grid', gap: 8 }}>
    <div style={{ height: 14, width: '40%', background: 'var(--app-surface-soft, var(--panelElevated))', borderRadius: 8 }} />
    <div style={{ height: 28, width: '55%', background: 'var(--app-surface-soft, var(--panelElevated))', borderRadius: 8 }} />
    <div style={{ height: 14, width: '70%', background: 'var(--app-surface-soft, var(--panelElevated))', borderRadius: 8 }} />
  </div>
)

function KpiCard({ title, value, note, trend, tone = 'neutral', onClick, clickable = false }) {
  const colors = STATUS_COLORS[tone] || STATUS_COLORS.neutral
  return (
    <button
      type="button"
      data-button-layout="card"
      onClick={onClick}
      style={{
        ...CARD_STYLE,
        padding: 20,
        display: 'grid',
        gap: 10,
        border: '1px solid var(--app-border, var(--border))',
        cursor: clickable ? 'pointer' : 'default',
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
        transition: 'transform 160ms ease, box-shadow 160ms ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div className="responsive-card-note" style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 600 }}>{title}</div>
        <span className="responsive-card-badge" style={{ background: colors.bg, color: colors.fg, borderRadius: 999, padding: '6px 10px', fontWeight: 900 }}>
          {trend}
        </span>
      </div>
      <div className="responsive-card-value" style={{ fontWeight: 900 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="responsive-card-note" style={{ color: 'var(--app-text-muted, var(--muted))' }}>{note}</div>
        {clickable && <div className="responsive-card-badge" style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 800 }}>Detay</div>}
      </div>
    </button>
  )
}

function InfoCard({ title, value, note, onClick, clickable = false }) {
  return (
    <button
      type="button"
      data-button-layout="card"
      onClick={onClick}
      style={{
        ...CARD_STYLE,
        padding: 20,
        border: '1px solid var(--app-border, var(--border))',
        cursor: clickable ? 'pointer' : 'default',
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
        gap: 8
      }}
    >
      <div className="responsive-card-note" style={{ color: 'var(--app-text-secondary, var(--text-secondary))' }}>{title}</div>
      <div className="responsive-card-value" style={{ marginTop: 10, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="responsive-card-note" style={{ color: 'var(--app-text-muted, var(--muted))' }}>{note}</div>
        {clickable && <div className="responsive-card-badge" style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 800 }}>Detay</div>}
      </div>
    </button>
  )
}

function DetailModal({ open, title, subtitle, items, renderContent, contentWidth = 'min(860px, 100%)', onClose }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(15, 23, 42, 0.42)',
        backdropFilter: 'blur(6px)',
        padding: 24,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden'
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: contentWidth,
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
          borderRadius: 30,
          background: 'var(--app-surface, var(--panel))',
          boxShadow: '0 32px 80px rgba(15, 23, 42, 0.24)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{title}</div>
            {!!subtitle && <div style={{ marginTop: 6, color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 14 }}>{subtitle}</div>}
          </div>
          <button className="btn button-light" onClick={onClose}>Kapat</button>
        </div>

        <div className="scrollbar-hidden" style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
        {typeof renderContent === 'function' ? renderContent() : (
          <div style={{ display: 'grid', gap: 12 }}>
            {Array.isArray(items) && items.length > 0 ? items.map((item, index) => (
            <div key={`${title}-${index}-${item.title || item.label || item.name || 'item'}`} className="card" style={{ padding: 18, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {item.dotColor && <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.dotColor }} />}
            <div className="responsive-card-title" style={{ fontWeight: 900 }}>{item.title || item.label || item.name || 'Detay'}</div>
                </div>
                {item.badge && (
                  <span className="responsive-card-badge" style={{ borderRadius: 999, padding: '6px 10px', background: 'color-mix(in srgb, var(--theme-accent, #274066) 20%, var(--app-surface))', color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 900 }}>
                    {item.badge}
                  </span>
                )}
              </div>
              {item.note && <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 14 }}>{item.note}</div>}
              {item.message && <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 14 }}>{item.message}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {item.time && <span className="page-pill">{item.time}</span>}
                {item.duration && <span className="page-pill">{item.duration}</span>}
                {item.balance && <span className="page-pill">Bakiye: {item.balance}</span>}
                {item.orderId && <span className="page-pill">Siparis: {item.orderId}</span>}
                {item.value && <span className="page-pill">{item.value}</span>}
              </div>
              {Array.isArray(item.details) && item.details.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {item.details.map((detail, detailIndex) => (
                    <div
                      key={`${detail.label}-${detailIndex}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 16,
                        background: 'var(--app-surface-soft, var(--panelElevated))',
                        borderTop: detail.dividerBefore ? '2px solid #cbd5e1' : 'none',
                        marginTop: detail.dividerBefore ? 6 : 0
                      }}
                    >
                      <div className="responsive-card-note" style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: detail.emphasis ? 800 : 500 }}>{detail.label}</div>
                      <div className="responsive-card-note" style={{ fontWeight: 800, textAlign: 'right' }}>{detail.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )) : (
              <div className="card" style={{ color: 'var(--app-text-secondary, var(--text-secondary))' }}>Detay verisi bulunamadı.</div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

function LiveActivityPanel({ items, onOpenDetail }) {
  return (
    <div style={{ ...CARD_STYLE, minHeight: 360, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Canlı İşlem Akisi</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 900, color: '#059669' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.12)' }} />
          CANLI
        </span>
      </div>

      <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
        {items.map((item, index) => (
          <button
            key={`${item.title}-${item.note}-${index}`}
            type="button"
            onClick={() => onOpenDetail?.({
              title: item.title,
              subtitle: 'Canlı işlem detayi',
              items: [item]
            })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              borderRadius: 20,
              background: 'var(--app-surface-soft, var(--panelElevated))',
              padding: '16px 18px',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.dotColor || '#3b82f6' }} />
              <div>
                <div style={{ fontWeight: 900 }}>{item.title}</div>
                <div style={{ marginTop: 4, color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>{item.note}</div>
              </div>
            </div>
            <span style={{ color: 'var(--app-text-muted, var(--muted))', fontSize: 12, whiteSpace: 'nowrap' }}>{item.time}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function OpenTablesPanel({ items, onOpenDetail }) {
  const latestItem = items[0] || null
  const remainingCount = Math.max(0, items.length - 1)
  const handleOpenAll = () => onOpenDetail?.({
    title: 'Açık Masalar',
    subtitle: items.length > 0 ? 'Serviste olan masalarin detay listesi' : 'Su anda serviste aktif masa bulunmuyor.',
    items: items.length > 0 ? items : [{ title: 'Açık masa yok', note: 'Su anda serviste aktif masa bulunmuyor.' }]
  })

  return (
    <div style={{ ...CARD_STYLE, minHeight: 360, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Açık Masalar</h2>
        <span style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12, fontWeight: 800 }}>{items.length} masa</span>
      </div>

      <div style={{ marginTop: 20, minHeight: 148, display: 'grid' }}>
        {latestItem ? (
          <button
            key={`${latestItem.title}-${latestItem.orderId || latestItem.time || 'latest'}`}
            type="button"
            onClick={handleOpenAll}
            style={{
              display: 'grid',
              gap: 10,
              borderRadius: 20,
              background: 'var(--app-surface-soft, var(--panelElevated))',
              padding: '16px 18px',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              minHeight: 148,
              alignContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 900 }}>{latestItem.title}</div>
              <span style={{ color: 'var(--app-text, var(--text))', fontSize: 13, fontWeight: 900 }}>{latestItem.balance}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span className="page-pill">{latestItem.duration}</span>
              {latestItem.time && <span className="page-pill">{latestItem.time}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>{latestItem.note}</div>
              <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12, fontWeight: 800 }}>
                {remainingCount > 0 ? `+${remainingCount} masa daha` : 'Detayi ac'}
              </div>
            </div>
          </button>
        ) : (
          <div style={{ borderRadius: 20, background: 'var(--app-surface-soft, var(--panelElevated))', padding: '16px 18px', color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 14, minHeight: 148 }}>
            Açık masa bulunmuyor.
          </div>
        )}
      </div>
    </div>
  )
}

function SystemStatusPanel({ statuses, alerts, onOpenDetail }) {
  return (
    <div style={{ ...CARD_STYLE, minHeight: 360, padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Sistem Durumu</h2>

      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {statuses.map((item) => {
          const colors = STATUS_COLORS[item.tone] || STATUS_COLORS.neutral
          return (
            <button
              key={item.label}
              type="button"
              data-button-layout="card"
              onClick={() => onOpenDetail?.({
                title: item.label,
                subtitle: 'Sistem durum detayi',
                items: [{ title: item.label, value: item.value, note: item.note || 'Sistem durumu izleniyor.', badge: item.tone?.toUpperCase?.() || 'DURUM' }]
              })}
              style={{ position: 'relative', borderRadius: 20, background: 'var(--app-surface-soft, var(--panelElevated))', padding: 18, border: 'none', cursor: 'pointer', textAlign: 'left', gap: 6 }}
            >
              <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12 }}>{item.label}</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>{item.value}</div>
              <span style={{ position: 'absolute', right: 16, top: 16, width: 10, height: 10, borderRadius: '50%', background: colors.chip }} />
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {alerts.map((item, index) => {
          const colors = STATUS_COLORS[item.tone] || STATUS_COLORS.orange
          return (
            <button
              key={`${item.title}-${index}`}
              type="button"
              data-button-layout="card"
              onClick={() => onOpenDetail?.({
                title: item.title,
                subtitle: 'Uyari detayi',
                items: [{ ...item, note: item.message }]
              })}
              style={{ border: `1px solid ${colors.bg}`, background: item.bg || '#fff7ed', borderRadius: 20, padding: 16, textAlign: 'left', cursor: 'pointer', width: '100%', gap: 6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 900, color: colors.fg }}>{item.title}</div>
                <span style={{ fontSize: 11, fontWeight: 900, color: colors.fg }}>{item.badge}</span>
              </div>
              <div style={{ marginTop: 6, color: colors.fg, fontSize: 13 }}>{item.message}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OperationsDashboard({ loading, error, snapshot, isMobilePortrait }) {
  const [detailState, setDetailState] = useState({ open: false, title: '', subtitle: '', items: [], renderContent: null, contentWidth: 'min(860px, 100%)' })

  if (loading && !snapshot) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <SkeletonCard height={144} />
          {!isMobilePortrait && <SkeletonCard height={144} />}
          {!isMobilePortrait && <SkeletonCard height={144} />}
          {!isMobilePortrait && <SkeletonCard height={144} />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <SkeletonCard height={132} />
          {!isMobilePortrait && <SkeletonCard height={132} />}
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
  const displayKpis = data.kpis.filter((item) => item.title !== 'Iptal / Fire')
  const cancelKpi = data.kpis.find((item) => item.title === 'Iptal / Fire')
  const displayOperationCards = [
    {
      title: 'Kapanan Masalar',
      value: String(data.kpis.find((item) => item.title === 'Toplam Ciro')?.detail?.items?.[0]?.badge?.split(' ')?.[0] || 0),
      note: 'Kapanan siparişleri aç',
      detail: {
        title: 'Kapanan Masalar',
        subtitle: 'Kapanan masalar sayfasi',
        renderContent: () => <ReportsSalesContent embedded />,
        contentWidth: 'min(1180px, 100%)'
      }
    },
    ...data.operationCards
      .filter((item) => item.title === 'Hazırlanacak Sipariş' || item.title === 'Paket Sipariş'),
    ...(cancelKpi ? [{
      title: 'İptal Urunler',
      value: cancelKpi.value,
      note: 'İptal edilen urunler',
      detail: cancelKpi.detail ? { ...cancelKpi.detail, title: 'İptal Urunler Detayi' } : undefined
    }] : [])
  ]
  const kpiGrid = isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))'
  const opsGrid = isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))'
  const bottomGrid = isMobilePortrait ? '1fr' : 'minmax(0, 1.05fr) minmax(0, 0.8fr) minmax(0, 0.9fr)'
  const openDetail = (payload) => setDetailState({
    open: true,
    title: payload.title || 'Detay',
    subtitle: payload.subtitle || '',
    items: payload.items || [],
    renderContent: payload.renderContent || null,
    contentWidth: payload.contentWidth || 'min(860px, 100%)'
  })

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: kpiGrid, gap: 12 }}>
        {displayKpis.map((item) => (
          <KpiCard
            key={item.title}
            {...item}
            clickable={!!item.detail && ((Array.isArray(item.detail?.items) && item.detail.items.length > 0) || typeof item.detail?.renderContent === 'function')}
            onClick={item.detail ? () => openDetail(item.detail) : undefined}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: opsGrid, gap: 12 }}>
        {displayOperationCards.map((item) => (
          <InfoCard
            key={item.title}
            {...item}
            clickable={!!item.detail && ((Array.isArray(item.detail?.items) && item.detail.items.length > 0) || typeof item.detail?.renderContent === 'function')}
            onClick={item.detail ? () => openDetail(item.detail) : undefined}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: bottomGrid, gap: 20 }}>
        <LiveActivityPanel items={data.liveItems} onOpenDetail={openDetail} />
        <OpenTablesPanel items={data.openTables} onOpenDetail={openDetail} />
        <SystemStatusPanel statuses={data.statuses} alerts={data.alerts} onOpenDetail={openDetail} />
      </div>

      <DetailModal
        open={detailState.open}
        title={detailState.title}
        subtitle={detailState.subtitle}
        items={detailState.items}
        renderContent={detailState.renderContent}
        contentWidth={detailState.contentWidth}
        onClose={() => setDetailState((current) => ({ ...current, open: false }))}
      />
    </div>
  )
}

function LegacyDashboardContent({
  isMobilePortrait,
  branchOptions,
  selectedBranches,
  setSelectedBranches,
  zReportLoading,
  onOpenZReport,
  operationsLoading,
  operationsError,
  operationsSnapshot,
  reportsLoading,
  reportsError,
  reportsSummary,
  reportsDatasets
}) {
  return (
    <div className="dashboard-page" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {branchOptions.length > 1 && (
            <BranchFilterCard
              branchOptions={branchOptions}
              selectedBranches={selectedBranches}
              setSelectedBranches={setSelectedBranches}
              title="Şube Filtresi"
              compact
              iconOnly
            />
          )}
          <button
            type="button"
            className="btn"
            onClick={onOpenZReport}
            disabled={zReportLoading}
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: 16,
              background: '#0f172a',
              color: '#fff',
              borderColor: '#0f172a',
              padding: '10px 12px',
              display: 'grid',
              placeItems: 'center'
            }}
            title="Z Raporu Al"
            aria-label="Z Raporu Al"
          >
            {zReportLoading ? (
              <span style={{ fontSize: 11, lineHeight: 1, fontWeight: 900 }}>...</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M15 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M8 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 20l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <OperationsDashboard
        loading={operationsLoading}
        error={operationsError}
        snapshot={operationsSnapshot}
        isMobilePortrait={isMobilePortrait}
      />
      <ReportsOverviewDashboard
        loading={reportsLoading}
        error={reportsError}
        summary={reportsSummary}
        datasets={reportsDatasets}
        isMobilePortrait={isMobilePortrait}
      />
    </div>
  )
}

function ReportDetailView({ report, detailData, isMobilePortrait, onPrint }) {
  const metricGrid = isMobilePortrait ? '1fr' : 'repeat(4, minmax(0, 1fr))'
  const metricEntries = Array.isArray(detailData.metricEntries) && detailData.metricEntries.length > 0
    ? detailData.metricEntries
    : report.metrics.map((metric) => ({ label: metric, value: detailData.metricValues?.[metric] ?? 'Veri yok' }))
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {report?.key === 'productPerformance' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={onPrint}>Yazdır</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: metricGrid, gap: 12 }}>
        {metricEntries.map((metric) => (
          <div key={metric.label} style={{ borderRadius: 18, background: 'var(--app-surface-soft, var(--panelElevated))', padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))' }}>{metric.label}</div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900 }}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 24, overflowX: 'auto', overflowY: 'hidden' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--app-surface-soft, var(--panelElevated))' }}>
              {report.tableColumns.map((col) => <th key={col} style={{ padding: '14px 16px', fontWeight: 900, textAlign: 'left' }}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(detailData.rows) || detailData.rows.length === 0 ? (
              <tr>
                <td colSpan={report.tableColumns.length} style={{ padding: '18px 16px', color: 'var(--app-text-secondary, var(--text-secondary))' }}>Bu rapor için sistemde uygun veri bulunamadı.</td>
              </tr>
            ) : detailData.rows.map((row, rowIndex) => (
              <tr key={`${report.key}-${rowIndex}`}>
                {report.tableColumns.map((col) => <td key={col} style={{ padding: '14px 16px', color: '#475569' }}>{getRowValueByColumn(row, col) ?? '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReportsOverviewDashboard({ loading, error, summary, datasets, isMobilePortrait }) {
  const [detailState, setDetailState] = useState({ open: false, report: null, detailData: null })
  const reportPanels = useMemo(() => ([
    reportDefinitions.find((item) => item.key === 'hourlyDensity'),
    reportDefinitions.find((item) => item.key === 'paymentDistribution'),
    reportDefinitions.find((item) => item.key === 'productPerformance'),
    reportDefinitions.find((item) => item.key === 'categoryRevenue')
  ].filter(Boolean)), [])

  const openReportDetail = (report) => {
    if (!report || !datasets?.dashboard) return
    setDetailState({
      open: true,
      report,
      detailData: buildReportDetailData(report, datasets, summary)
    })
  }

  if (loading && !datasets?.dashboard) {
    return (
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
        <SkeletonCard height={320} />
        <SkeletonCard height={320} />
        <SkeletonCard height={320} />
        <SkeletonCard height={320} />
      </div>
    )
  }

  if (error && !datasets?.dashboard) {
    return (
      <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 900, color: '#b91c1c' }}>Rapor panelleri yuklenemedi</div>
        <div style={{ color: '#7f1d1d' }}>{error}</div>
      </div>
    )
  }

  if (!datasets?.dashboard) return null

  const detailButton = (report) => (
    <button className="btn button-light" type="button" onClick={() => openReportDetail(report)}>Detay</button>
  )

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Rapor Ozeti</h2>
          <div style={{ marginTop: 4, color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13 }}>Ana sayfadaki analizler sadece bugunun verisini gosterir.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
        <div style={{ minWidth: 0 }}>
          <MainRevenuePanel
            datasets={datasets}
            period="today"
            setPeriod={() => {}}
            showModeToggle={false}
            useDashboardRangeOnly
            headerAction={detailButton(reportPanels[0])}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <PaymentOverviewPanel
            datasets={datasets}
            summary={summary}
            headerAction={detailButton(reportPanels[1])}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <TopSellersPanel
            datasets={datasets}
            headerAction={detailButton(reportPanels[2])}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <CategoryRevenuePanel
            datasets={datasets}
            summary={summary}
            headerAction={detailButton(reportPanels[3])}
          />
        </div>
      </div>

      <DetailModal
        open={detailState.open}
        title={detailState.report?.detailTitle || detailState.report?.title || 'Rapor Detayi'}
        subtitle={detailState.report?.description || ''}
        items={[]}
        renderContent={detailState.report && detailState.detailData
          ? () => (
            <ReportDetailView
              report={detailState.report}
              detailData={detailState.detailData}
              isMobilePortrait={isMobilePortrait}
              onPrint={() => printProductReportDocument({
                report: detailState.report,
                detailData: detailState.detailData,
                rangeLabel: 'Bugün',
                branchesLabel: 'Ana Sayfa'
              })}
            />
          )
          : null}
        contentWidth="min(1180px, 100%)"
        onClose={() => setDetailState({ open: false, report: null, detailData: null })}
      />
    </div>
  )
}

const buildFallbackOperationsSnapshot = () => ({
  kpis: [
    { title: 'Toplam Ciro', value: '0,00 TL', note: 'Bugun', trend: '+0%', tone: 'green' },
    { title: 'Tahsilat', value: '0,00 TL', note: 'Bugun', trend: '+0%', tone: 'blue' },
    { title: 'Ortalama Hesap', value: '0,00 TL', note: 'Sipariş başı', trend: '+0%', tone: 'orange' },
    { title: 'Açık Hesap', value: '0,00 TL', note: 'Toplam', trend: '+0%', tone: 'blue' }
  ],
  operationCards: [
    { title: 'Hazırlanacak Sipariş', value: '0', note: 'Mutfakta bekleyenler' },
    { title: 'Paket Sipariş', value: '0', note: 'Yolda olanlar' },
    { title: 'İptal Urunler', value: '0', note: 'İptal edilen urunler' }
  ],
  openTables: [],
  liveItems: [
    { title: 'Masa', note: 'Veri bekleniyor', time: 'Şimdi', dotColor: '#3b82f6' },
    { title: 'Paket', note: 'Veri bekleniyor', time: 'Şimdi', dotColor: '#10b981' },
    { title: 'Kasa', note: 'Veri bekleniyor', time: 'Şimdi', dotColor: '#f59e0b' },
    { title: 'Mutfak', note: 'Veri bekleniyor', time: 'Şimdi', dotColor: '#ef4444' }
  ],
  statuses: [
    { label: 'Yazici', value: 'Bekleniyor', tone: 'orange' },
    { label: 'API', value: 'Kontrol', tone: 'orange' },
    { label: 'Internet', value: 'Kontrol', tone: 'orange' },
    { label: 'Terminal', value: 'Hazır', tone: 'green' },
    { label: 'Print Agent', value: 'Bekleniyor', tone: 'orange' },
    { label: 'Veri Senkron', value: 'Bekleniyor', tone: 'orange' }
  ],
  alerts: [
    { title: 'Yazici gecikmesi', badge: 'Takip', message: 'Print Agent baglantisi kontrol edilmeli.', tone: 'orange' },
    { title: 'Bağlantı sorunu', badge: 'Kontrol', message: 'Canlı servis baglantisi doğrulanıyor.', tone: 'orange' },
    { title: 'Açık hesap riski', badge: 'Izleme', message: 'Açık hesap verisi hazır oldugunda burada gosterilir.', tone: 'orange' }
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

const ACTIVE_KITCHEN_ITEM_STATUSES = ['open', 'sent', 'cooking']

const getKitchenOrderItems = (order) => {
  if (Array.isArray(order?.items) && order.items.length > 0) return order.items
  const batches = Array.isArray(order?.batches) ? order.batches : []
  return batches.flatMap((batch) => Array.isArray(batch?.items) ? batch.items : [])
}

const getKitchenActiveItems = (order) => (
  getKitchenOrderItems(order).filter((item) => ACTIVE_KITCHEN_ITEM_STATUSES.includes(String(item?.status || '').trim()))
)

const createOperationsSnapshot = ({ reportRes, tableRes, kitchenRes, deliveryRes, stationRes, online, orderDetailsById }) => {
  const sales = reportRes?.sales || {}
  const cancelled = reportRes?.cancelled || {}
  const tables = Array.isArray(tableRes?.tables) ? tableRes.tables : []
  const activeByTable = tableRes?.activeByTable || {}
  const paidByTable = tableRes?.paidByTable || {}
  const kitchenOrders = Array.isArray(kitchenRes?.orders) ? kitchenRes.orders : []
  const deliveryOrders = Array.isArray(deliveryRes?.orders) ? deliveryRes.orders : []
  const stations = Array.isArray(stationRes?.stations) ? stationRes.stations : []

  const openTableCount = tables.filter((table) => {
    const id = String(table?.id || table?._id || '')
    return !!activeByTable[id]?.hasActive
  }).length

  const pendingKitchenOrders = kitchenOrders
    .map((order) => {
      const allItems = getKitchenOrderItems(order)
      const activeItems = getKitchenActiveItems(order)
      return { ...order, allItems, activeItems }
    })
    .filter((order) => order.activeItems.length > 0)

  const waitingKitchenCount = pendingKitchenOrders.reduce((sum, order) => sum + order.activeItems.length, 0)

  const totalRevenue = toMoney(sales?.totalRevenue || 0)
  const totalPaid = toMoney((sales?.collectedTotal ?? sales?.totalPaid) || 0)
  const orderCount = Math.max(0, Number(sales?.orderCount || 0))
  const cancelledValue = toMoney(cancelled?.totalRevenue || 0)

  const activeStation = stations.find((station) => station?.isActive === true) || null
  const heartbeatAt = activeStation?.lastHeartbeatAt ? new Date(activeStation.lastHeartbeatAt).getTime() : null
  const heartbeatAgeMs = Number.isFinite(heartbeatAt) ? Date.now() - heartbeatAt : null
  const agentOnline = heartbeatAgeMs !== null && heartbeatAgeMs < 15000
  const agentStale = heartbeatAgeMs !== null && heartbeatAgeMs >= 15000 && heartbeatAgeMs < 60000

  const liveItems = buildLiveItems({ tables, activeByTable, kitchenOrders: pendingKitchenOrders, deliveryOrders, sales })
  const openTables = buildOpenTablesItems({ tables, activeByTable, paidByTable, orderDetailsById })
  const cashValue = toMoney((sales?.collectedByMethod?.cash ?? sales?.byMethod?.cash) || 0)
  const posValue = toMoney((sales?.collectedByMethod?.pos ?? sales?.byMethod?.pos) || 0)
  const bankValue = toMoney((sales?.collectedByMethod?.bank ?? sales?.byMethod?.bank) || 0)
  const chargedToAccountValue = toMoney((sales?.accountChargedTotal ?? sales?.byMethod?.account) || 0)
  const accountCollectionValue = toMoney(sales?.accountCollectionTotal || 0)
  const discountValue = toMoney(sales?.discountTotal || 0)
  const totalRevenueWithAccount = totalRevenue + chargedToAccountValue
  const averageCheck = orderCount > 0 ? totalRevenueWithAccount / orderCount : 0
  const currentAccountBalanceValue = toMoney(sales?.currentAccountBalance || 0)
  const overpayValue = toMoney(sales?.overpayTotal || 0)
  const balanceDueSigned = toMoney(sales?.balanceDueSigned || 0)
  const openOrderBalanceTotal = openTables.reduce((sum, item) => sum + toMoney(item?.rawBalanceValue || 0), 0)
  const explicitOpenAccountValue = Math.max(0, balanceDueSigned) + currentAccountBalanceValue + openOrderBalanceTotal
  const openAccountValue = currentAccountBalanceValue + openOrderBalanceTotal
  const revenueBreakdownDetails = buildPaymentBreakdownRows(sales, { preferCollected: false })
    .filter((row) => row.amount > 0)
    .map((row) => ({ label: row.label, value: fmtTl(row.amount) }))
  const revenueBreakdownWithAccountDetails = [
    ...revenueBreakdownDetails,
    ...(chargedToAccountValue > 0 && !revenueBreakdownDetails.some((row) => String(row.label || '').trim().toLowerCase() === 'cariye yazilan')
      ? [{ label: 'Cariye Yazilan', value: fmtTl(chargedToAccountValue) }]
      : [])
  ]
  const collectionBreakdownDetails = buildPaymentBreakdownRows(sales, { preferCollected: true })
    .filter((row) => row.amount > 0)
    .map((row) => ({ label: row.label, value: fmtTl(row.amount) }))
  const statuses = [
    { label: 'Yazici', value: agentOnline ? 'Bagli' : agentStale ? 'Yavas' : 'Bekliyor', tone: agentOnline ? 'green' : 'orange' },
    { label: 'API', value: 'Online', tone: 'green' },
    { label: 'Internet', value: online ? 'Stabil' : 'Sorunlu', tone: online ? 'green' : 'red' },
    { label: 'Terminal', value: openTableCount > 0 ? 'Aktif' : 'Hazır', tone: 'green' },
    { label: 'Print Agent', value: agentOnline ? 'Calisiyor' : agentStale ? 'Gecikmeli' : 'Offline', tone: agentOnline ? 'green' : agentStale ? 'orange' : 'red' },
    { label: 'Veri Senkron', value: 'Güncel', tone: 'green' }
  ]

  const alerts = [
    {
      title: 'Yazici gecikmesi',
      badge: agentOnline ? 'Normal' : 'Dikkat',
      message: agentOnline ? 'Yazici ve agent yaniti normal gorunuyor.' : 'Print Agent yaniti gecikmeli veya bağlantı bekliyor.',
      tone: agentOnline ? 'green' : 'orange',
      bg: agentOnline ? '#ecfdf5' : '#fffbeb'
    },
    {
      title: 'Bağlantı sorunu',
      badge: online ? 'Yok' : 'Kontrol',
      message: online ? 'Tarayici internet baglantisi aktif gorunuyor.' : 'Tarayici offline bildiriyor, bağlantı kontrol edilmeli.',
      tone: online ? 'green' : 'red',
      bg: online ? '#ecfdf5' : '#fef2f2'
    },
    {
      title: 'Açık hesap riski',
      badge: openAccountValue > 5000 ? 'Takip' : 'Normal',
      message: openAccountValue > 5000 ? `Açık hesap toplami ${fmtTl(openAccountValue)} seviyesinde.` : 'Açık hesap riski normal seviyede.',
      tone: openAccountValue > 5000 ? 'orange' : 'green',
      bg: openAccountValue > 5000 ? '#fffbeb' : '#ecfdf5'
    }
  ]

  return {
    kpis: [
      {
        title: 'Toplam Ciro',
        value: fmtTl(totalRevenueWithAccount),
        note: 'Bugun',
        trend: getTrendText(12.5),
        tone: 'green',
        detail: {
          title: 'Toplam Ciro Detayi',
          subtitle: 'Bugunku ciro ve tahsilat kirilimlari',
          items: [
            {
              title: 'Genel Özet',
              value: fmtTl(totalRevenueWithAccount),
              badge: `${orderCount} sipariş`,
              note: 'Toplam ciroya ulasan tüm ödeme ve açık hesap kirilimlari.',
              details: [
                { label: 'Toplam Ciro', value: fmtTl(totalRevenueWithAccount) },
                ...(revenueBreakdownWithAccountDetails.length > 0 ? revenueBreakdownWithAccountDetails : [
                  { label: 'Nakit', value: fmtTl(cashValue) },
                  { label: 'Banka', value: fmtTl(bankValue) },
                  { label: 'K. Karti / POS', value: fmtTl(posValue) },
                  { label: 'Cariye Yazilan', value: fmtTl(chargedToAccountValue) }
                ])
              ]
            }
          ]
        }
      },
      {
        title: 'Tahsilat',
        value: fmtTl(totalPaid),
        note: 'Bugun',
        trend: getTrendText(9.3),
        tone: 'blue',
        detail: {
          title: 'Tahsilat Detayi',
          subtitle: 'Bugun alinan odemelerin yontemlere göre dağılımı',
          items: [
            {
              title: 'Ödeme Yontemleri',
              value: fmtTl(totalPaid),
              badge: 'Tahsilat',
              note: 'Kasaya giren ve cariye yazilan tahsilatlar.',
              details: [
                { label: 'Toplam Tahsilat', value: fmtTl(totalPaid) },
                ...(collectionBreakdownDetails.length > 0 ? collectionBreakdownDetails : [
                  { label: 'Nakit', value: fmtTl(cashValue) },
                { label: 'Banka', value: fmtTl(bankValue) },
                  { label: 'K. Karti / POS', value: fmtTl(posValue) }
                ]),
                ...(discountValue > 0 ? [{ label: 'İndirim', value: fmtTl(discountValue) }] : []),
                { label: 'Fazla Tahsilat', value: fmtTl(overpayValue) },
                { label: 'Cari Tahsilati', value: fmtTl(accountCollectionValue), dividerBefore: true, emphasis: true }
              ]
            }
          ]
        }
      },
      {
        title: 'Ortalama Hesap',
        value: `${formatDecimal(averageCheck)} TL`,
        note: 'Sipariş başı',
        trend: getTrendText(6.1),
        tone: 'orange',
        detail: {
          title: 'Ortalama Hesap Detayi',
          subtitle: 'Sipariş başı ortalama ve günlük özet',
          items: [
            {
              title: 'Sipariş Ortalamasi',
              value: `${formatDecimal(averageCheck)} TL`,
              badge: `${orderCount} sipariş`,
              note: 'Seçili gün için ortalama hesap tutari.',
              details: [
                { label: 'Sipariş Sayisi', value: String(orderCount) },
                { label: 'Toplam Ciro', value: fmtTl(totalRevenueWithAccount) },
                { label: 'Toplam Tahsilat', value: fmtTl(totalPaid) },
                { label: 'Cari Bakiyesi', value: fmtTl(currentAccountBalanceValue) },
                { label: 'Bekleyen Açık Hesap', value: fmtTl(explicitOpenAccountValue) },
                { label: 'Sipariş Başı Ortalama', value: `${formatDecimal(averageCheck)} TL` }
              ]
            }
          ]
        }
      },
      {
        title: 'Iptal / Fire',
        value: fmtTl(cancelledValue),
        note: 'Kontrol gerekli',
        trend: getTrendText(-3.8),
        tone: 'red',
        detail: {
          title: 'Iptal / Fire Detayi',
          subtitle: 'İptal edilen urunlerin günlük özet verisi',
          items: [
            {
              title: 'İptal Ozeti',
              value: fmtTl(cancelledValue),
              badge: `${Number(cancelled?.itemCount || 0)} ürün`,
              note: 'Fire verisi ayri tutulmuyorsa iptal tutari uzerinden izlenir.',
              details: [
                { label: 'İptal Tutarı', value: fmtTl(cancelledValue) },
                { label: 'İptal Edilen Ürün', value: String(Number(cancelled?.itemCount || 0)) },
                { label: 'İptal Adedi', value: String(Number(cancelled?.totalQty || 0)) },
                { label: 'Fire', value: '0,00 TL' }
              ]
            }
          ]
        }
      },
      {
        title: 'Açık Hesap',
        value: fmtTl(openAccountValue),
        note: 'Toplam',
        trend: '+0',
        tone: 'blue',
        detail: {
          title: 'Açık Hesap Detayi',
          subtitle: 'Cari ve tahsil edilmemiş bakiye ozetleri',
          items: [
            {
              title: 'Cari / Acik Hesap',
              value: fmtTl(openAccountValue),
              badge: 'Takip',
              note: 'Tahsil edilmemiş bakiye ve cariye yazilan satislar.',
              details: [
                { label: 'Güncel Cari Bakiyesi', value: fmtTl(currentAccountBalanceValue) },
                { label: 'Acilan Cari Borcu', value: fmtTl(chargedToAccountValue) },
                { label: 'Açık Masa Bekleyeni', value: fmtTl(openOrderBalanceTotal) },
                { label: 'Bekleyen Açık Hesap', value: fmtTl(explicitOpenAccountValue) },
                { label: 'Toplam Ciro', value: fmtTl(totalRevenueWithAccount) },
                { label: 'Toplam Tahsilat', value: fmtTl(totalPaid) },
                { label: 'Net Açık Hesap Gosterimi', value: fmtTl(openAccountValue) }
              ]
            }
          ]
        }
      }
    ],
    operationCards: [
      {
        title: 'Açık Masalar',
        value: String(openTableCount),
        note: 'Serviste olan masalar',
        detail: {
          title: 'Açık Masalar Detayi',
          subtitle: 'Serviste olan masalarin listesi',
          items: openTables.length > 0 ? openTables : [{ title: 'Açık masa yok', note: 'Su anda serviste aktif masa bulunmuyor.' }]
        }
      },
      {
        title: 'Hazırlanacak Sipariş',
        value: String(waitingKitchenCount),
        note: 'Mutfakta bekleyenler',
        detail: {
          title: 'Hazırlanacak Siparisler',
          subtitle: 'Mutfakta açık durumda bekleyen sipariş kalemleri',
          items: pendingKitchenOrders.length > 0
            ? pendingKitchenOrders.map((order, index) => ({
                title: String(order?.tableName || order?.customerName || `Sipariş ${index + 1}`),
                note: `${order.activeItems.length} ürün islemde`,
                time: formatTimeAgo(order?.createdAt),
                orderId: String(order?.orderNo || order?.id || ''),
                details: [
                  { label: 'Toplam Ürün', value: String(order.allItems.length) },
                  {
                    label: 'Bekleyen Ürün',
                    value: String(order.activeItems.length)
                  },
                  { label: 'Olusturma', value: order?.createdAt ? new Date(order.createdAt).toLocaleString('tr-TR') : '-' }
                ]
              }))
            : [{ title: 'Bekleyen sipariş yok', note: 'Mutfakta sıra bekleyen sipariş bulunmuyor.' }]
        }
      },
      {
        title: 'Paket Sipariş',
        value: String(deliveryOrders.length),
        note: 'Yolda olanlar',
        detail: {
          title: 'Paket Siparisleri',
          subtitle: 'Aktif paket siparislerinin durumu',
          items: deliveryOrders.length > 0
            ? deliveryOrders.map((order, index) => ({
                title: `Paket #${String(order?.orderNo || order?.id || index + 1).slice(-6)}`,
                note: String(order?.customerName || order?.deliveryStatus || order?.status || 'Aktif sipariş'),
                time: formatTimeAgo(order?.updatedAt || order?.createdAt),
                orderId: String(order?.orderNo || order?.id || ''),
                details: [
                  { label: 'Durum', value: String(order?.deliveryStatus || order?.status || '-') },
                  { label: 'Müşteri', value: String(order?.customerName || '-') },
                  { label: 'Telefon', value: String(order?.customerPhone || '-') },
                  { label: 'Tutar', value: fmtTl(order?.paidTotal || order?.netTotal || order?.total || 0) }
                ]
              }))
            : [{ title: 'Aktif paket sipariş yok', note: 'Yolda olan veya hazırlanan paket sipariş bulunmuyor.' }]
        }
      }
    ],
    openTables,
    liveItems,
    statuses,
    alerts
  }
}

const buildOpenTablesItems = ({ tables, activeByTable, paidByTable, orderDetailsById }) => {
  return tables
    .map((table) => {
      const id = String(table?.id || table?._id || '')
      const active = activeByTable[id]
      if (!active?.hasActive || !active?.orderId) return null
      const paid = paidByTable[id] || {}
      const order = orderDetailsById?.[active.orderId] || {}
      const createdAt = paid?.createdAt || order?.createdAt || table?.updatedAt || table?.createdAt
      const elapsed = getElapsedMinutes(createdAt)
      const balanceValue = Number(order?.balanceDue ?? order?.totals?.balanceDue ?? order?.remainingBalance ?? 0)
      return {
        title: String(table?.name || 'Masa'),
        note: String(paid?.createdByName || order?.createdByName || 'Aktif servis suruyor'),
        time: formatTimeAgo(createdAt),
        duration: elapsed !== null ? `${elapsed} dk açık` : 'Süre hesaplanamadi',
        balance: fmtTl(balanceValue),
        rawBalanceValue: balanceValue,
        createdAtTs: createdAt ? new Date(createdAt).getTime() : 0,
        orderId: String(order?.orderNo || active.orderId || '').slice(-8),
        dotColor: '#3b82f6',
        details: [
          { label: 'Masa', value: String(table?.name || '-') },
          { label: 'Sipariş durumu', value: String(active?.status || order?.status || '-') },
          { label: 'Acilis', value: createdAt ? new Date(createdAt).toLocaleString('tr-TR') : '-' },
          { label: 'Açık kalma', value: elapsed !== null ? `${elapsed} dk` : '-' },
          { label: 'Bakiye', value: fmtTl(balanceValue) }
        ]
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      return (b.createdAtTs || 0) - (a.createdAtTs || 0)
    })
}

const buildLiveItems = ({ tables, activeByTable, kitchenOrders, deliveryOrders, sales }) => {
  const tableEntry = tables
    .map((table) => {
      const id = String(table?.id || table?._id || '')
      const active = activeByTable[id]
      if (!active?.hasActive) return null
      return {
        title: String(table?.name || 'Masa'),
        note: active?.orderId ? 'Aktif masa islemi suruyor' : 'Servis açık',
        time: formatTimeAgo(active?.createdAt || table?.updatedAt || table?.createdAt),
        dotColor: '#3b82f6'
      }
    })
    .filter(Boolean)[0]

  const deliveryEntry = deliveryOrders[0]
    ? {
        title: `Paket #${String(deliveryOrders[0]?.orderNo || deliveryOrders[0]?.id || '').slice(-4) || '----'}`,
        note: String(deliveryOrders[0]?.deliveryStatus || deliveryOrders[0]?.status || 'Hazırlanıyor'),
        time: formatTimeAgo(deliveryOrders[0]?.updatedAt || deliveryOrders[0]?.createdAt),
        dotColor: '#10b981'
      }
    : null

  const paymentTotal = toMoney(sales?.byMethod?.cash || 0) + toMoney(sales?.byMethod?.pos || 0)
  const cashierEntry = {
    title: 'Kasa',
    note: `Bugun tahsil edilen ana ödeme: ${fmtTl(paymentTotal)}`,
    time: 'Bugun',
    dotColor: '#f59e0b'
  }

  const kitchenEntry = kitchenOrders[0]
    ? {
        title: String(kitchenOrders[0]?.tableName || kitchenOrders[0]?.customerName || 'Mutfak'),
        note: `${getKitchenActiveItems(kitchenOrders[0]).length} ürün hazırlanıyor`,
        time: formatTimeAgo(kitchenOrders[0]?.createdAt),
        dotColor: '#ef4444'
      }
    : null

  return [tableEntry, deliveryEntry, cashierEntry, kitchenEntry].filter(Boolean)
}

const getElapsedMinutes = (value) => {
  if (!value) return null
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return null
  return Math.max(0, Math.floor((Date.now() - ts) / 60000))
}

export default function Dashboard() {
  const { allowedBranchIds } = useAuth()
  const { isMobilePortrait } = useResponsiveFlags()
  const { selectedDate, setSelectedDate } = useAppDate()

  const allowedIds = useMemo(() => normalizeBranchIds(allowedBranchIds), [allowedBranchIds])
  const [branchOptions, setBranchOptions] = useState([])
  const [selectedBranches, setSelectedBranches] = useState([])
  const [zBranchId, setZBranchId] = useState('all')
  const [zReportOpen, setZReportOpen] = useState(false)
  const [zReportLoading, setZReportLoading] = useState(false)
  const [zReportError, setZReportError] = useState('')
  const [zReportData, setZReportData] = useState(null)
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [operationsError, setOperationsError] = useState('')
  const [operationsSnapshot, setOperationsSnapshot] = useState(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const [reportsSummary, setReportsSummary] = useState(EMPTY_REPORT_SUMMARY)
  const [reportsDatasets, setReportsDatasets] = useState(EMPTY_REPORT_DATASETS)

  const initBranchesRef = useRef(false)

  useEffect(() => {
    if (!initBranchesRef.current && allowedIds.length > 0) {
      initBranchesRef.current = true
      setSelectedBranches(allowedIds)
    }
  }, [allowedIds])

  useEffect(() => {
    const loadBranches = async () => {
      if (allowedIds.length === 0) {
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

  useEffect(() => {
    const run = async () => {
      if (!Array.isArray(selectedBranches) || selectedBranches.length === 0) {
        setOperationsSnapshot(buildFallbackOperationsSnapshot())
        setOperationsError('Şube seciniz')
        setReportsSummary(EMPTY_REPORT_SUMMARY)
        setReportsDatasets(EMPTY_REPORT_DATASETS)
        setReportsError('Şube seciniz')
        return
      }

      const { params } = buildBranchQueryParams(selectedBranches)
      if (!params) {
        setOperationsSnapshot(buildFallbackOperationsSnapshot())
        setOperationsError('Şube seciniz')
        setReportsSummary(EMPTY_REPORT_SUMMARY)
        setReportsDatasets(EMPTY_REPORT_DATASETS)
        setReportsError('Şube seciniz')
        return
      }

      const reportParams = new URLSearchParams(params)
      reportParams.set('period', 'range')
      reportParams.set('start', selectedDate)
      reportParams.set('end', selectedDate)

      const deliveryParams = new URLSearchParams(params)
      deliveryParams.set('status', 'active')
      deliveryParams.set('limit', '10')
      deliveryParams.set('page', '1')

      setOperationsLoading(true)
      setReportsLoading(true)
      setOperationsError('')
      setReportsError('')

      try {
        const [reportRes, tableRes, kitchenRes, deliveryRes, stationRes, productsRes, ordersRes, accountsRes, menuItemsRes, categoriesRes] = await Promise.all([
          api(`/api/reports/dashboard?${reportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/pos/tables/overview?${params.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/kitchen/orders?${params.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/pos/delivery/orders?${deliveryParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/printing/stations?system=kermes', { silent: true }),
          api(`/api/reports/products?${reportParams.toString()}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api(`/api/reports/orders?${reportParams.toString()}&status=closed`, { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/accounts?limit=50', { silent: true, skipBranchHeader: true, suppressBranchModal: true }),
          api('/api/tenant/menu-items?active=true', { silent: true }),
          api('/api/tenant/categories?active=true', { silent: true })
        ])

        const activeOrderIds = Array.from(new Set(
          Object.values(tableRes?.activeByTable || {})
            .map((entry) => String(entry?.orderId || ''))
            .filter(Boolean)
        ))

        const orderDetailResults = await Promise.allSettled(
          activeOrderIds.map((orderId) => api(`/api/pos/orders/${orderId}`, { silent: true, suppressBranchModal: true }))
        )

        const orderDetailsById = {}
        orderDetailResults.forEach((result, index) => {
          if (result.status !== 'fulfilled') return
          const res = result.value
          if (!res?.ok) return
          const order = res?.order || res?.data || res
          orderDetailsById[activeOrderIds[index]] = order
        })

        const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
        const snapshot = createOperationsSnapshot({ reportRes, tableRes, kitchenRes, deliveryRes, stationRes, online, orderDetailsById })
        setOperationsSnapshot(snapshot)

        if (!reportRes?.ok) {
          setReportsError(String(reportRes?.message || 'Raporlar yuklenemedi'))
          setReportsSummary(EMPTY_REPORT_SUMMARY)
          setReportsDatasets(EMPTY_REPORT_DATASETS)
        } else {
          const safeArray = (value) => Array.isArray(value) ? value : []
          const nextDatasets = {
            dashboard: reportRes,
            products: safeArray(productsRes?.items),
            cancelledProducts: safeArray(productsRes?.cancelledItems),
            orders: safeArray(ordersRes?.orders),
            accounts: safeArray(accountsRes?.accounts),
            deliveryOrders: safeArray(deliveryRes?.orders),
            kitchenOrders: safeArray(kitchenRes?.orders),
            menuItems: safeArray(menuItemsRes?.items),
            categories: safeArray(categoriesRes?.categories)
          }
          setReportsDatasets(nextDatasets)
          setReportsSummary(buildReportsSummary(nextDatasets))
        }
      } catch (err) {
        setOperationsError(String(err?.message || 'Yeni dashboard yuklenemedi'))
        setOperationsSnapshot(buildFallbackOperationsSnapshot())
        setReportsError(String(err?.message || 'Rapor panelleri yuklenemedi'))
        setReportsSummary(EMPTY_REPORT_SUMMARY)
        setReportsDatasets(EMPTY_REPORT_DATASETS)
      } finally {
        setOperationsLoading(false)
        setReportsLoading(false)
      }
    }

    run()
    const pollId = window.setInterval(run, 15000)
    return () => window.clearInterval(pollId)
  }, [selectedBranchesKey, selectedDate])

  const openZReport = async () => {
    const effectiveBranchId = String(zBranchId || '').trim() || (branchOptions.length > 1 ? 'all' : (branchOptions[0]?.id || ''))
    if (!selectedDate || !effectiveBranchId) return
    setZReportOpen(true)
    setZReportLoading(true)
    setZReportError('')
    setZReportData(null)
    try {
      const report = await fetchZReport(selectedDate, effectiveBranchId)
      setZReportData(report)
    } catch (err) {
      setZReportData(null)
      setZReportError(String(err?.message || 'Z raporu alınamadı'))
    } finally {
      setZReportLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <LegacyDashboardContent
        isMobilePortrait={isMobilePortrait}
        branchOptions={branchOptions}
        selectedBranches={selectedBranches}
        setSelectedBranches={setSelectedBranches}
        zReportLoading={zReportLoading}
        onOpenZReport={openZReport}
        operationsLoading={operationsLoading}
        operationsError={operationsError}
        operationsSnapshot={operationsSnapshot}
        reportsLoading={reportsLoading}
        reportsError={reportsError}
        reportsSummary={reportsSummary}
        reportsDatasets={reportsDatasets}
      />
      <ZReportModal
        open={zReportOpen}
        report={zReportData}
        loading={zReportLoading}
        error={zReportError}
        onClose={() => {
          setZReportOpen(false)
          setZReportError('')
        }}
      />
    </div>
  )
}





